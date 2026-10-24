import { test, after } from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { mkdir, mkdtemp, writeFile, readFile, rm } from 'node:fs/promises'
import { resolve, join, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createPrivateKey, createPublicKey, createHash, sign, verify, X509Certificate, privateDecrypt, constants } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import * as p from 'pkijs'
import * as a from 'asn1js'
import { sm2 } from 'sm-crypto'

const require = createRequire(import.meta.url)
const { build } = createRequire(require.resolve('vite/package.json'))('esbuild')
const root = fileURLToPath(new URL('..', import.meta.url)), tempRoot = resolve(root, 'tmp')
await mkdir(tempRoot, { recursive: true })
const temp = await mkdtemp(join(tempRoot, 'local-pki-'))
after(async () => { assert.ok(resolve(temp).startsWith(tempRoot + sep)); await rm(temp, { recursive: true, force: true }) })
await build({ stdin: { contents: "export * from './src/utils/pki/core.ts'; export * from './src/utils/pki/chain.ts'; export * from './src/utils/pki/containers.ts'; export * from './src/utils/pki/operations.ts'", resolveDir: root }, bundle: true, packages: 'external', platform: 'node', format: 'cjs', outfile: join(temp, 'pki.cjs') })
const api = require(join(temp, 'pki.cjs'))
const decode = bytes => new TextDecoder().decode(bytes)
const cert = bytes => api.certificate(api.pem(bytes, 'CERTIFICATE'))
const text = new TextEncoder().encode('本地 PKI 测试 🔐\nline two')
const identities = new Map()
for (const algorithm of ['SM2', 'RSA', 'ECDSA']) {
  const identity = await api.generateIdentity(algorithm)
  const certificate = cert(await api.createCertificate(identity, { commonName: `${algorithm}.example.test`, sans: 'dns:example.test\nip:127.0.0.1' }))
  identities.set(algorithm, { identity, certificate })
}

for (const [algorithm, { identity, certificate }] of identities) {
  test(`${algorithm}: CSR and certificate signatures, extensions, tampering and key imports`, async () => {
    const csr = await api.createCsr(identity, { commonName: '申请人', organization: '测试机构', country: 'CN', sans: 'dns:example.test\nip:192.0.2.1' })
    const report = await api.inspectCsr(api.pem(csr, 'CERTIFICATE REQUEST'))
    assert.equal(report.signatureValid, true); assert.equal(report.algorithm, algorithm); assert.ok(report.extensions.length)
    const request = new p.CertificationRequest({ schema: api.schema(csr) })
    assert.equal(await api.verifyCertificate(certificate, certificate), true)
    assert.equal(await api.keyMatches(await api.loadIdentity(api.pem(identity.privateDer, 'PRIVATE KEY')), certificate), true)
    if (algorithm !== 'SM2') {
      const key = createPublicKey({ key: Buffer.from(api.der(identity.publicInfo)), format: 'der', type: 'spki' })
      assert.equal(verify('sha256', request.tbsView, key, request.signatureValue.valueBlock.valueHexView), true)
      assert.equal(new X509Certificate(Buffer.from(api.der(certificate))).verify(key), true)
    }
    const broken = Uint8Array.from(csr); broken[broken.length - 1] ^= 1
    assert.equal((await api.inspectCsr(api.pem(broken, 'CERTIFICATE REQUEST'))).signatureValid, false)
    await assert.rejects(() => api.createCsr(identity, { commonName: 'bad', sans: 'ip:999.1.1.1' }), /IPv4/)
    if (algorithm === 'SM2') assert.equal((await api.inspectCsr(api.pem(csr, 'CERTIFICATE REQUEST'), 'wrong-id')).signatureValid, false)
  })

  test(`${algorithm}: explicit root, unordered intermediates, wrong trust and invalid CA`, async () => {
    const rootId = await api.generateIdentity(algorithm), intermediateId = await api.generateIdentity(algorithm)
    const rootCert = cert(await api.createCertificate(rootId, { commonName: 'Root', ca: true }))
    const intermediate = cert(await api.createCertificate(intermediateId, { commonName: 'Intermediate', ca: true }, { certificate: rootCert, identity: rootId }))
    const leaf = cert(await api.createCertificate(identity, { commonName: 'Leaf' }, { certificate: intermediate, identity: intermediateId }))
    const valid = await api.validateChain(leaf, [rootCert, intermediate], [rootCert])
    assert.equal(valid.valid, true); assert.equal(valid.path.length, 3); assert.match(valid.revocation, /Not checked/)
    assert.equal((await api.validateChain(leaf, [intermediate], [certificate])).valid, false)
    assert.equal((await api.validateChain(leaf, [intermediate], [rootCert], undefined, new Date('2100-01-01'))).valid, false)
    await assert.rejects(() => api.validateChain(leaf, [intermediate], []), /trust anchors/)
    const notCa = cert(await api.createCertificate(intermediateId, { commonName: 'Intermediate', ca: false }, { certificate: rootCert, identity: rootId }))
    assert.equal((await api.validateChain(leaf, [notCa], [rootCert])).valid, false)
  })

  test(`${algorithm}: verify data signature independently signed, reject altered content`, async () => {
    const signature = algorithm === 'SM2' ? Buffer.from(sm2.doSignature(Array.from(text), identity.scalar, { hash: true, der: true, publicKey: api.smPublic(identity.publicInfo) }), 'hex') : sign('sha256', text, createPrivateKey({ key: Buffer.from(identity.privateDer), format: 'der', type: 'pkcs8' }))
    const mode = algorithm === 'SM2' ? 'SM2' : `${algorithm}-SHA256`
    assert.equal(await api.verifyData(certificate, text, signature, mode), true)
    assert.equal(await api.verifyData(certificate, new Uint8Array([1]), signature, mode), false)
    if (algorithm === 'RSA') {
      const pss = sign('sha256', text, { key: createPrivateKey({ key: Buffer.from(identity.privateDer), format: 'der', type: 'pkcs8' }), padding: constants.RSA_PKCS1_PSS_PADDING, saltLength: 32 })
      assert.equal(await api.verifyData(certificate, text, pss, 'RSA-PSS-SHA256'), true)
    }
  })

  test(`${algorithm}: PKCS#12 integrity and encrypted PKCS#8 recover without an external runtime`, async () => {
    const password = new TextEncoder().encode('本地-test-123')
    const bytes = await api.createPkcs12(identity, [certificate], decode(password), 'test')
    const pfx = new p.PFX({ schema: api.schema(bytes) })
    await pfx.parseInternalValues({ password: api.buf(password), checkIntegrity: true })
    const safe = new p.SafeContents({ schema: api.schema(pfx.parsedValue.authenticatedSafe.safeContents[0].content.valueBlock.valueHexView) })
    const bag = safe.safeBags[0].bagValue
    const encrypted = new p.EncryptedData({ encryptedContentInfo: new p.EncryptedContentInfo({ contentEncryptionAlgorithm: bag.encryptionAlgorithm, encryptedContent: bag.encryptedData }) })
    const recovered = new Uint8Array(await encrypted.decrypt({ password: api.buf(password) }))
    assert.deepEqual(recovered, identity.privateDer)
    await assert.rejects(() => pfx.parseInternalValues({ password: api.buf(new TextEncoder().encode('wrong')), checkIntegrity: true }))
  })
}

for (const algorithm of ['RSA', 'SM2']) test(`${algorithm}: certificate encryption and CMS binary/empty/chunked envelopes`, async () => {
  const { identity, certificate } = identities.get(algorithm)
  const ciphertext = await api.encryptWithCertificate(certificate, text)
  assert.equal(decode(await api.decryptWithKey(identity, ciphertext)), decode(text))
  if (algorithm === 'RSA') {
    assert.deepEqual(privateDecrypt({ key: createPrivateKey({ key: Buffer.from(identity.privateDer), format: 'der', type: 'pkcs8' }), padding: constants.RSA_PKCS1_OAEP_PADDING, oaepHash: 'sha256' }, ciphertext), Buffer.from(text))
    await assert.rejects(() => api.encryptWithCertificate(certificate, new Uint8Array(191)), /Maximum/)
  }
  for (const input of [new Uint8Array(), text, new Uint8Array(12001).fill(0xff)]) {
    const envelope = await api.createEnvelope(certificate, input)
    assert.deepEqual(await api.openEnvelope(certificate, identity, envelope), input)
    const parsed = new p.ContentInfo({ schema: api.schema(envelope) })
    const data = new p.EnvelopedData({ schema: parsed.content })
    assert.ok(data.recipientInfos[0].value.rid instanceof p.IssuerAndSerialNumber)
  }
  const wrong = await api.generateIdentity(algorithm)
  await assert.rejects(() => api.openEnvelope(certificate, wrong, new Uint8Array()), /does not match/)
})

test('unsupported encryption keys and invalid material fail explicitly', async () => {
  await assert.rejects(() => api.encryptWithCertificate(identities.get('ECDSA').certificate, text), /RSA or SM2/)
  assert.throws(() => api.certificate('broken'), /./)
  const { identity, certificate } = identities.get('RSA')
  await assert.rejects(() => api.createPkcs12(identity, [identities.get('SM2').certificate], 'test', 'key'), /must match/)
  await assert.rejects(() => api.createPkcs12(identity, [certificate], '', 'key'), /password/)
})

test('PFX preserves SM2 chains signed with a custom userId', async () => {
  const rootKey = await api.generateIdentity('SM2'), identity = identities.get('SM2').identity
  const userId = 'custom-pki-user-id'
  const rootCert = cert(await api.createCertificate(rootKey, { commonName: 'Custom SM2 root', ca: true }, undefined, userId))
  const leaf = cert(await api.createCertificate(identity, { commonName: 'Custom SM2 leaf' }, { certificate: rootCert, identity: rootKey }, userId))
  await assert.rejects(() => api.createPkcs12(identity, [rootCert, leaf], 'test-password', 'custom'), /invalid certificate/)
  const pfx = await api.createPkcs12(identity, [rootCert, leaf], 'test-password', 'custom', userId)
  assert.ok(pfx.length > 500)
})

test('20 MiB source data produces a reopenable CMS envelope within its encoded limit', async () => {
  const { identity, certificate } = identities.get('RSA')
  const content = new Uint8Array(20 * 1024 * 1024).fill(0xa5)
  const envelope = await api.createEnvelope(certificate, content)
  assert.ok(envelope.length > content.length)
  assert.ok(envelope.length <= 21 * 1024 * 1024)
  const decoded = await api.openEnvelope(certificate, identity, envelope)
  assert.equal(decoded.length, content.length)
  assert.equal(createHash('sha256').update(decoded).digest('hex'), createHash('sha256').update(content).digest('hex'))
  await assert.rejects(() => api.createEnvelope(certificate, new Uint8Array(content.length + 1)), /20 MB/)
  await assert.rejects(() => api.openEnvelope(certificate, identity, new Uint8Array(21 * 1024 * 1024 + 1)), /larger than/)
})

test('path length, issuer key usage and unknown critical constraints fail closed', async () => {
  const rootKey = await api.generateIdentity('RSA'), middleKey = await api.generateIdentity('RSA')
  const rootCert = cert(await api.createCertificate(rootKey, { commonName: 'Restricted Root', ca: true }))
  const middle = cert(await api.createCertificate(middleKey, { commonName: 'Middle', ca: true }, { certificate: rootCert, identity: rootKey }))
  const leaf = cert(await api.createCertificate(identities.get('RSA').identity, { commonName: 'Leaf' }, { certificate: middle, identity: middleKey }))
  rootCert.extensions.find(ext => ext.extnID === '2.5.29.19').extnValue = new a.OctetString({ valueHex: new p.BasicConstraints({ cA: true, pathLenConstraint: 0 }).toSchema().toBER(false) })
  await rootCert.sign(rootKey.key, 'SHA-256')
  assert.equal((await api.validateChain(leaf, [middle], [rootCert])).valid, false)
  rootCert.extensions.find(ext => ext.extnID === '2.5.29.19').extnValue = new a.OctetString({ valueHex: new p.BasicConstraints({ cA: true, pathLenConstraint: 1 }).toSchema().toBER(false) })
  await rootCert.sign(rootKey.key, 'SHA-256')
  assert.equal((await api.validateChain(leaf, [middle], [rootCert])).valid, true)
  middle.extensions.find(ext => ext.extnID === '2.5.29.15').extnValue = new a.OctetString({ valueHex: new a.BitString({ unusedBits: 7, valueHex: new Uint8Array([0x80]).buffer }).toBER(false) })
  await middle.sign(rootKey.key, 'SHA-256')
  assert.equal((await api.validateChain(leaf, [middle], [rootCert])).valid, false)
  leaf.extensions.push(new p.Extension({ extnID: '1.2.3.4', critical: true, extnValue: new a.Null().toBER(false) }))
  await leaf.sign(middleKey.key, 'SHA-256')
  // Explicitly anchored leaf still must not silently ignore its critical extension.
  assert.equal((await api.validateChain(leaf, [], [leaf])).valid, false)
})

const openssl = process.env.PKI_OPENSSL
for (const [algorithm, { identity, certificate }] of identities) test(`${algorithm}: OpenSSL reads PFX, validates MAC and decrypts exported key`, { skip: !openssl }, async () => {
  const password = '本地-test-123'
  const pfx = await api.createPkcs12(identity, [certificate], password, '签名证书')
  const filename = join(temp, `${algorithm}.p12`), keyfile = join(temp, `${algorithm}-key.pem`)
  await writeFile(filename, pfx)
  const env = { ...process.env, PKI_TEST_PASSWORD: password }
  execFileSync(openssl, ['pkcs12', '-in', filename, '-info', '-noout', '-passin', 'env:PKI_TEST_PASSWORD'], { env, stdio: 'pipe' })
  execFileSync(openssl, ['pkcs12', '-in', filename, '-nocerts', '-nodes', '-out', keyfile, '-passin', 'env:PKI_TEST_PASSWORD'], { env, stdio: 'pipe' })
  const keyText = await readFile(keyfile, 'utf8')
  const keyPem = keyText.match(/-----BEGIN PRIVATE KEY-----[\s\S]*?-----END PRIVATE KEY-----/)[0]
  assert.equal(await api.keyMatches(await api.loadIdentity(keyPem), certificate), true)
  assert.throws(() => execFileSync(openssl, ['pkcs12', '-in', filename, '-noout', '-passin', 'pass:wrong'], { stdio: 'pipe' }))
})

test('OpenSSL decrypts RSA CMS envelope generated in the browser implementation', { skip: !openssl }, async () => {
  const { identity, certificate } = identities.get('RSA')
  await writeFile(join(temp, 'rsa-key.pem'), api.pem(identity.privateDer, 'PRIVATE KEY'))
  await writeFile(join(temp, 'rsa-cert.pem'), api.pem(api.der(certificate), 'CERTIFICATE'))
  await writeFile(join(temp, 'message.p7m'), await api.createEnvelope(certificate, text))
  execFileSync(openssl, ['cms', '-decrypt', '-inform', 'DER', '-in', join(temp, 'message.p7m'), '-inkey', join(temp, 'rsa-key.pem'), '-recip', join(temp, 'rsa-cert.pem'), '-out', join(temp, 'decrypted.bin')], { stdio: 'pipe' })
  assert.deepEqual(await readFile(join(temp, 'decrypted.bin')), Buffer.from(text))
})
