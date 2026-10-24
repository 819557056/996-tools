import { after, test } from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { mkdir, mkdtemp, rm, writeFile, readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { join, resolve, sep } from 'node:path'
import { createPublicKey, generateKeyPairSync } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import * as a from 'asn1js'
import * as p from 'pkijs'

const require = createRequire(import.meta.url)
const { build } = createRequire(require.resolve('vite/package.json'))('esbuild')
const root = fileURLToPath(new URL('..', import.meta.url)), tempRoot = resolve(root, 'tmp')
await mkdir(tempRoot, { recursive: true })
const temp = await mkdtemp(join(tempRoot, 'pki-key-import-'))
after(async () => { assert.ok(resolve(temp).startsWith(tempRoot + sep)); await rm(temp, { recursive: true, force: true }) })
await build({ stdin: { contents: "export * from './src/utils/pki/core.ts'", resolveDir: root }, bundle: true, packages: 'external', platform: 'node', format: 'cjs', outfile: join(temp, 'pki.cjs') })
const api = require(join(temp, 'pki.cjs'))
const bytes = node => new Uint8Array(node.toBER(false))
const encoded = node => api.pem(bytes(node), 'EC PRIVATE KEY')
const password = '本地导入-password-123'
const keys = new Map([
  ['RSA', generateKeyPairSync('rsa', { modulusLength: 2048 }).privateKey],
  ['P-256', generateKeyPairSync('ec', { namedCurve: 'prime256v1' }).privateKey],
  ['P-384', generateKeyPairSync('ec', { namedCurve: 'secp384r1' }).privateKey],
  ['P-521', generateKeyPairSync('ec', { namedCurve: 'secp521r1' }).privateKey],
  ['SM2', generateKeyPairSync('ec', { namedCurve: 'SM2' }).privateKey],
])
async function checkIdentity(material, key, name, secret = '') {
  const identity = await api.loadIdentity(material, secret)
  assert.equal(identity.algorithm, name.startsWith('P-') ? 'ECDSA' : name)
  const expected = createPublicKey(key).export({ type: 'spki', format: 'der' })
  assert.ok(Buffer.from(api.der(identity.publicInfo)).equals(expected), 'Imported public key must match the independently generated key')
  const csr = await api.createCsr(identity, { commonName: 'key-import.example.test' })
  assert.equal((await api.inspectCsr(api.pem(csr, 'CERTIFICATE REQUEST'))).signatureValid, true)
}

for (const [name, key] of keys) {
  test(`${name}: independently generated PKCS#8 and legacy PKCS#1 / SEC1 imports`, async () => {
    await checkIdentity(key.export({ type: 'pkcs8', format: 'pem' }), key, name)
    const legacy = key.export({ type: name === 'RSA' ? 'pkcs1' : 'sec1', format: 'der' })
    await checkIdentity(api.pem(legacy, name === 'RSA' ? 'RSA PRIVATE KEY' : 'EC PRIVATE KEY'), key, name)
    await checkIdentity(legacy.toString('hex'), key, name)
    await checkIdentity(legacy.toString('base64'), key, name)
  })

  test(`${name}: encrypted PKCS#8 PEM, DER-encoded text, wrong password and corruption`, async () => {
    const encrypted = key.export({ type: 'pkcs8', format: 'der', cipher: 'aes-256-cbc', passphrase: password })
    for (const material of [api.pem(encrypted, 'ENCRYPTED PRIVATE KEY'), encrypted.toString('hex'), encrypted.toString('base64')]) await checkIdentity(material, key, name, password)
    await assert.rejects(api.loadIdentity(api.pem(encrypted, 'ENCRYPTED PRIVATE KEY'), 'incorrect'), /password|corrupted/)
    await assert.rejects(api.loadIdentity(api.pem(encrypted, 'ENCRYPTED PRIVATE KEY')), /password|corrupted/)
    await assert.rejects(api.loadIdentity(encrypted.subarray(0, -1).toString('hex'), password), /ASN.1/)
    const broken = api.schema(encrypted)
    const cipher = broken.valueBlock.value[1].valueBlock.valueHexView
    broken.valueBlock.value[1] = new a.OctetString({ valueHex: api.buf(cipher.subarray(1)) })
    await assert.rejects(api.loadIdentity(Buffer.from(bytes(broken)).toString('base64'), password), /parameters/)
  })
}

test('SEC1 rejects absent/unknown curve, invalid scalar, invalid version and conflicting public point', async () => {
  const sm2 = keys.get('SM2')
  const sec1 = () => api.schema(sm2.export({ type: 'sec1', format: 'der' }))
  const absent = sec1(); absent.valueBlock.value = absent.valueBlock.value.filter(value => value.idBlock.tagClass !== 3 || value.idBlock.tagNumber !== 0)
  await assert.rejects(api.loadIdentity(encoded(absent)), /named curve/)
  const unknown = generateKeyPairSync('ec', { namedCurve: 'secp256k1' }).privateKey.export({ type: 'sec1', format: 'pem' })
  await assert.rejects(api.loadIdentity(unknown), /Unsupported EC curve/)
  const zero = sec1(); zero.valueBlock.value[1] = new a.OctetString({ valueHex: new Uint8Array(32).buffer })
  await assert.rejects(api.loadIdentity(encoded(zero)), /scalar/)
  const version = sec1(); version.valueBlock.value[0] = new a.Integer({ value: 0 })
  await assert.rejects(api.loadIdentity(encoded(version)), /Invalid EC private key/)
  for (const name of ['SM2', 'P-256']) {
    const original = api.schema(keys.get(name).export({ type: 'sec1', format: 'der' }))
    const other = generateKeyPairSync('ec', { namedCurve: name === 'SM2' ? 'SM2' : 'prime256v1' }).privateKey
    const otherNode = api.schema(other.export({ type: 'sec1', format: 'der' }))
    const publicIndex = original.valueBlock.value.findIndex(value => value.idBlock.tagClass === 3 && value.idBlock.tagNumber === 1)
    original.valueBlock.value[publicIndex] = otherNode.valueBlock.value.find(value => value.idBlock.tagClass === 3 && value.idBlock.tagNumber === 1)
    await assert.rejects(api.loadIdentity(encoded(original)), /match|Invalid key/)
  }
})

test('SM2 SEC1 accepts compressed public points and optional omitted public point', async () => {
  const key = keys.get('SM2')
  const compressed = api.schema(key.export({ type: 'sec1', format: 'der' }))
  const pointNode = compressed.valueBlock.value.find(value => value.idBlock.tagClass === 3 && value.idBlock.tagNumber === 1)
  const point = pointNode.valueBlock.value[0].valueBlock.valueHexView
  const compact = new Uint8Array(33); compact[0] = 2 + (point[64] & 1); compact.set(point.subarray(1, 33), 1)
  pointNode.valueBlock.value[0] = new a.BitString({ valueHex: compact.buffer })
  await checkIdentity(encoded(compressed), key, 'SM2')
  compressed.valueBlock.value = compressed.valueBlock.value.filter(value => value.idBlock.tagClass !== 3 || value.idBlock.tagNumber !== 1)
  await checkIdentity(encoded(compressed), key, 'SM2')
})

test('PKCS#8 rejects mismatched curves, trailing fields and unsupported versions', async () => {
  const key = keys.get('SM2')
  const fresh = () => api.schema(key.export({ type: 'pkcs8', format: 'der' }))
  const wrongCurve = fresh()
  const inner = api.schema(wrongCurve.valueBlock.value[2].valueBlock.valueHexView)
  inner.valueBlock.value.splice(2, 0, new a.Constructed({ idBlock: { tagClass: 3, tagNumber: 0 }, value: [new a.ObjectIdentifier({ value: '1.2.840.10045.3.1.7' })] }))
  wrongCurve.valueBlock.value[2] = new a.OctetString({ valueHex: api.buf(bytes(inner)) })
  await assert.rejects(api.loadIdentity(api.pem(bytes(wrongCurve), 'PRIVATE KEY')), /curve parameters|curve OID/)
  const extra = fresh(); extra.valueBlock.value.push(new a.Null())
  await assert.rejects(api.loadIdentity(api.pem(bytes(extra), 'PRIVATE KEY')))
  const version = fresh(); version.valueBlock.value[0] = new a.Integer({ value: 1 })
  await assert.rejects(api.loadIdentity(api.pem(bytes(version), 'PRIVATE KEY')), /PKCS#8 required/)
})

test('PBES2 rejects unsupported derivation, excessive iterations and key length mismatch before decryption', async () => {
  const encrypted = keys.get('RSA').export({ type: 'pkcs8', format: 'der', cipher: 'aes-256-cbc', passphrase: password })
  async function rejected(modify, pattern) {
    const bag = new p.PKCS8ShroudedKeyBag({ schema: api.schema(encrypted) })
    const params = new p.PBES2Params({ schema: bag.encryptionAlgorithm.algorithmParams })
    const kdf = new p.PBKDF2Params({ schema: params.keyDerivationFunc.algorithmParams })
    modify(params, kdf)
    params.keyDerivationFunc.algorithmParams = kdf.toSchema()
    bag.encryptionAlgorithm.algorithmParams = params.toSchema()
    await assert.rejects(api.loadIdentity(api.pem(api.der(bag), 'ENCRYPTED PRIVATE KEY'), password), pattern)
  }
  await rejected((params) => { params.keyDerivationFunc.algorithmId = '1.3.6.1.4.1.11591.4.11' }, /PBKDF2/)
  await rejected((_, kdf) => { kdf.iterationCount = 10000001 }, /maximum 10 million/)
  await rejected((_, kdf) => { kdf.iterationCount = 0 }, /parameters/)
  await rejected((_, kdf) => { kdf.keyLength = 16 }, /parameters/)
  await rejected((params) => { params.encryptionScheme.algorithmId = '1.2.840.113549.3.7' }, /AES-CBC/)
})

test('malformed containers and invalid bare SM2 are rejected', async () => {
  for (const material of ['', 'broken', '00'.repeat(32), 'ff'.repeat(32), '-----BEGIN PRIVATE KEY-----\nAQ==\n-----END PUBLIC KEY-----']) await assert.rejects(api.loadIdentity(material))
  const key = await api.generateIdentity('SM2')
  const imported = await api.loadIdentity(key.scalar)
  assert.equal(imported.scalar, key.scalar)
  const keyBytes = keys.get('RSA').export({ type: 'pkcs8', format: 'der' })
  await assert.rejects(api.loadIdentity(Buffer.concat([keyBytes, Buffer.from([0])]).toString('base64')), /trailing bytes/)
})

const openssl = process.env.PKI_OPENSSL
test('OpenSSL PBES2 AES-128/SHA1, AES-192/SHA384 and AES-256/SHA512 imports', { skip: !openssl }, async () => {
  const input = join(temp, 'source.pem'), secret = join(temp, 'secret.txt')
  await writeFile(input, keys.get('P-256').export({ type: 'pkcs8', format: 'pem' }))
  await writeFile(secret, 'interop-only-password')
  for (const [cipher, prf] of [['aes-128-cbc', 'hmacWithSHA1'], ['aes-192-cbc', 'hmacWithSHA384'], ['aes-256-cbc', 'hmacWithSHA512']]) {
    const output = join(temp, `${cipher}.der`)
    execFileSync(openssl, ['pkcs8', '-topk8', '-in', input, '-out', output, '-outform', 'DER', '-v2', cipher, '-v2prf', prf, '-iter', '2000', '-passout', `file:${secret}`], { stdio: 'pipe' })
    await checkIdentity((await readFile(output)).toString('base64'), keys.get('P-256'), 'P-256', 'interop-only-password')
  }
})
