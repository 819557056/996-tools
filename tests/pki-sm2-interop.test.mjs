// Optional independent SM2 interoperability checks. Configure PKI_JAVA (Java 17+)
// and PKI_BC_CLASSPATH (bcprov/bcpkix/bcutil, validated with 1.84), then run:
// node --test tests/pki-sm2-interop.test.mjs
// Java is a test oracle only; browser PKI tools have no Java runtime dependency.
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { execFileSync } from 'node:child_process'
import { mkdir, mkdtemp, readFile, writeFile, rm } from 'node:fs/promises'
import { resolve, join, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import * as a from 'asn1js'
import * as p from 'pkijs'

const java = process.env.PKI_JAVA, classpath = process.env.PKI_BC_CLASSPATH
const options = { skip: !java || !classpath ? 'Configure PKI_JAVA and PKI_BC_CLASSPATH for independent BC verification' : false }
const root = fileURLToPath(new URL('..', import.meta.url)), tempRoot = resolve(root, 'tmp')
const helper = join(root, 'tests/helpers/PkiSm2Interop.java')
const customId = 'interop-测试'
const direct = new TextEncoder().encode('SM2 独立互操作 🔐\n\u0000\u0001\u007f')
const cases = new Map([
  ['empty', new Uint8Array()],
  ['binary', Uint8Array.from({ length: 256 }, (_, i) => i)],
  ['large', Uint8Array.from({ length: 12001 }, (_, i) => (i * 17) % 256)],
])
let temp, api, browserIdentity, browserCertificate, bcIdentity, bcCertificate

function runJava(action) {
  const result = execFileSync(java, ['-Dfile.encoding=UTF-8', '--class-path', classpath, helper, action, temp], {
    cwd: root, encoding: 'utf8', timeout: 60000, maxBuffer: 1024 * 1024, stdio: 'pipe',
  })
  assert.match(result, new RegExp(`^OK ${action} BC `))
}

async function read(name) { return Uint8Array.from(await readFile(join(temp, name))) }
function parseCertificate(bytes) { return api.certificate(api.pem(bytes, 'CERTIFICATE')) }

before(async () => {
  if (options.skip) return
  await mkdir(tempRoot, { recursive: true })
  temp = await mkdtemp(join(tempRoot, 'pki-sm2-interop-'))
  const require = createRequire(import.meta.url)
  const { build } = createRequire(require.resolve('vite/package.json'))('esbuild')
  await build({
    stdin: { contents: "export * from './src/utils/pki/core.ts'; export * from './src/utils/pki/containers.ts'", resolveDir: root },
    bundle: true, packages: 'external', platform: 'node', format: 'cjs', outfile: join(temp, 'pki.cjs'),
  })
  api = require(join(temp, 'pki.cjs'))
  browserIdentity = await api.generateIdentity('SM2')
  const subject = { commonName: 'Browser SM2 互操作', country: 'CN', sans: 'dns:sm2.example.test\nip:192.0.2.1' }
  browserCertificate = parseCertificate(await api.createCertificate(browserIdentity, subject))
  await writeFile(join(temp, 'browser-private.der'), browserIdentity.privateDer)
  await writeFile(join(temp, 'browser-certificate.der'), api.der(browserCertificate))
  await writeFile(join(temp, 'browser-certificate-custom.der'), await api.createCertificate(browserIdentity, subject, undefined, customId))
  await writeFile(join(temp, 'browser-csr.der'), await api.createCsr(browserIdentity, subject))
  await writeFile(join(temp, 'browser-csr-custom.der'), await api.createCsr(browserIdentity, subject, customId))
  await writeFile(join(temp, 'direct-content.bin'), direct)
  await writeFile(join(temp, 'browser-cipher.der'), await api.encryptWithCertificate(browserCertificate, direct))
  await writeFile(join(temp, 'browser.p12'), await api.createPkcs12(browserIdentity, [browserCertificate], 'interop-测试-123', '互操作测试'))
  for (const [name, content] of cases) {
    await writeFile(join(temp, `${name}.bin`), content)
    await writeFile(join(temp, `browser-envelope-${name}.der`), await api.createEnvelope(browserCertificate, content))
  }
  runJava('fixtures')
  bcIdentity = await api.loadIdentity(api.pem(await read('bc-private.der'), 'PRIVATE KEY'))
  bcCertificate = parseCertificate(await read('bc-certificate.der'))
})

after(async () => {
  if (!temp) return
  assert.ok(resolve(temp).startsWith(tempRoot + sep), 'Only remove the generated test fixture directory')
  await rm(temp, { recursive: true, force: true })
})

test('SM2 CSR: BC and browser verify each other, including custom user ID and tampering', options, async () => {
  runJava('csr')
  for (const suffix of ['', '-custom']) {
    const csr = await read(`bc-csr${suffix}.der`), userId = suffix ? customId : undefined
    const parsed = await api.inspectCsr(api.pem(csr, 'CERTIFICATE REQUEST'), userId)
    assert.equal(parsed.algorithm, 'SM2')
    assert.equal(parsed.signatureValid, true)
    assert.equal((await api.inspectCsr(api.pem(csr, 'CERTIFICATE REQUEST'), 'wrong-id')).signatureValid, false)
    const modified = new p.CertificationRequest({ schema: api.schema(csr) })
    const subjectOffset = Buffer.from(modified.tbsView).indexOf('BC Interop')
    assert.ok(subjectOffset >= 0)
    // Preserve ASN.1 lengths and alter a subject character inside the original TBS.
    modified.tbsView[subjectOffset] ^= 1
    assert.equal((await api.inspectCsr(api.pem(api.der(modified), 'CERTIFICATE REQUEST'), userId)).signatureValid, false)
  }
})

test('SM2 certificates/data signatures: independent BC signing and verification with user ID binding', options, async () => {
  runJava('certificate')
  assert.equal(await api.keyMatches(bcIdentity, bcCertificate), true)
  for (const suffix of ['', '-custom']) {
    const certificate = parseCertificate(await read(`bc-certificate${suffix}.der`)), userId = suffix ? customId : undefined
    assert.equal(await api.verifyCertificate(certificate, certificate, userId), true)
    assert.equal(await api.verifyCertificate(certificate, certificate, 'wrong-id'), false)
    const damagedCertificate = await read(`bc-certificate${suffix}.der`)
    damagedCertificate[damagedCertificate.length - 1] ^= 1
    assert.equal(await api.verifyCertificate(parseCertificate(damagedCertificate), certificate, userId), false)
    const signature = await read(`bc-signature${suffix}.der`)
    assert.equal(await api.verifyData(certificate, direct, signature, 'SM2', userId), true)
    assert.equal(await api.verifyData(certificate, direct, signature, 'SM2', 'wrong-id'), false)
    const modified = Uint8Array.from(direct); modified[0] ^= 1
    assert.equal(await api.verifyData(certificate, modified, signature, 'SM2', userId), false)
  }
})

test('SM2 DER encryption: BC/browser bidirectional recovery and C3 tamper rejection', options, async () => {
  runJava('cipher')
  assert.deepEqual(await api.decryptWithKey(bcIdentity, await read('bc-cipher.der')), direct)
  await assert.rejects(() => read('bc-cipher-bad-digest.der').then(bytes => api.decryptWithKey(bcIdentity, bytes)), /SM2/)
  await assert.rejects(() => read('bc-cipher.der').then(bytes => api.decryptWithKey(browserIdentity, bytes)), /SM2/)
})

test('SM2/SM4 CMS: BC ASN.1/crypto oracle and browser open empty, binary and chunked content', options, async () => {
  runJava('envelope')
  const browserLarge = new p.ContentInfo({ schema: api.schema(await read('browser-envelope-large.der')) })
  assert.equal(new p.EnvelopedData({ schema: browserLarge.content }).encryptedContentInfo.encryptedContent.idBlock.isConstructed, true)
  for (const [name, expected] of cases) {
    assert.deepEqual(await api.openEnvelope(bcCertificate, bcIdentity, await read(`bc-envelope-${name}.der`)), expected)
  }
  const invalidPadding = await read('bc-envelope-bad-padding.der')
  await assert.rejects(() => api.openEnvelope(bcCertificate, bcIdentity, invalidPadding), /padding/)
  const envelopeBytes = await read('bc-envelope-binary.der')
  await assert.rejects(() => api.openEnvelope(bcCertificate, browserIdentity, envelopeBytes), /does not match/)
  const outer = new p.ContentInfo({ schema: api.schema(envelopeBytes) })
  const envelope = new p.EnvelopedData({ schema: outer.content })
  envelope.recipientInfos[0].value.rid.serialNumber = new a.Integer({ value: 0 })
  outer.content = envelope.toSchema()
  await assert.rejects(() => api.openEnvelope(bcCertificate, bcIdentity, api.der(outer)), /identifier mismatch/)
})

test('SM2 PKCS#12: BC imports Unicode alias/password, recovers key/cert, rejects bad MAC/password', options, () => {
  runJava('pkcs12')
})
