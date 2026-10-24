import { test, after } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'
import { decodeMaterial, formatMaterial } from '../src/utils/crypto/material-format.ts'

// Bundle the actual composables with Vite's existing compiler, including @ aliases.
const require = createRequire(import.meta.url)
const { build } = createRequire(require.resolve('vite/package.json'))('esbuild')
const root = fileURLToPath(new URL('..', import.meta.url))
const bundle = await build({
  stdin: {
    contents: ['Sm2Encrypt', 'Sm2Sign', 'Sm2Tool', 'Sm4Tool', 'DigitalEnvelope']
      .map(name => `export { default as use${name} } from './src/views/tools/${name}/use${name}.ts'`).join('\n'),
    resolveDir: root,
  },
  bundle: true, platform: 'node', format: 'cjs', write: false,
  alias: { '@': resolve(root, 'src') },
})
const temp = await mkdtemp(join(tmpdir(), '996-crypto-workflows-'))
after(() => rm(temp, { recursive: true, force: true }))
const compiled = join(temp, 'workflows.cjs')
await writeFile(compiled, bundle.outputFiles[0].contents)
const workflows = createRequire(import.meta.url)(compiled)
globalThis.window = { crypto: globalThis.crypto }
globalThis.alert = message => { throw new Error(message) }

function formats(hex, header) {
  const bytes = decodeMaterial(hex, 'hex')
  return [
    ['hex', formatMaterial(bytes, { encoding: 'hex', lineLength: 32, uppercase: true })],
    ['base64', formatMaterial(bytes, { encoding: 'base64', lineLength: 76, lineEnding: 'CRLF' })],
    ['pem', formatMaterial(bytes, { encoding: 'base64', header, lineLength: 64 })],
  ]
}

test('SM2 raw and ASN.1 ciphertext decrypt from all formatted representations', () => {
  const tool = workflows.useSm2Encrypt()
  tool.generateKeyPair()
  tool.encryptInput.value = '格式转换测试 🔐\nsecond line'
  for (const mode of [0, 1]) {
    tool.cipherMode.value = mode
    for (const structure of ['hex', 'asn1']) {
      tool.outputFormat.value = structure
      tool.doEncrypt()
      assert.equal(tool.encryptError.value, '')
      for (const [encoding, text] of formats(tool.encryptOutput.value, 'ENCRYPTED DATA')) {
        tool.decryptEncoding.value = encoding
        tool.decryptInput.value = text
        tool.doDecrypt()
        assert.equal(tool.decryptError.value, '')
        assert.equal(tool.decryptOutput.value, tool.encryptInput.value)
      }
      tool.copyToDecrypt()
      assert.equal(tool.decryptEncoding.value, 'hex')
    }
  }
})

test('SM2 raw, DER and P7 signatures verify after Base64/header conversion', () => {
  const tool = workflows.useSm2Sign()
  tool.generateKeyPair()
  tool.signInput.value = '签名格式 round trip'
  tool.verifyMessage.value = tool.signInput.value
  for (const structure of ['hex', 'asn1', 'p7']) {
    tool.signatureFormat.value = structure
    tool.doSign()
    assert.equal(tool.signError.value, '')
    assert.equal(tool.signResultKind.value, structure === 'p7' ? 'pkcs7' : 'signature')
    for (const [encoding, text] of formats(tool.signOutput.value, structure === 'p7' ? 'PKCS7' : 'SM2 SIGNATURE')) {
      tool.verifyEncoding.value = encoding
      tool.verifySignature.value = text
      tool.doVerify()
      assert.equal(tool.verifyError.value, '')
      assert.equal(tool.verifyResult.value, true, structure + ' / ' + encoding)
    }
    tool.copyToVerify()
    assert.equal(tool.verifyEncoding.value, 'hex')
  }
  tool.signatureFormat.value = 'hex'
  assert.equal(tool.signResultKind.value, 'pkcs7', 'result metadata belongs to the generated result')
})

test('legacy SM2 tool accepts formatted ciphertext and signatures', () => {
  const tool = workflows.useSm2Tool()
  tool.generateKeyPair()
  tool.doEncrypt()
  for (const [encoding, text] of formats(tool.encryptOutput.value, 'ENCRYPTED DATA')) {
    tool.decryptEncoding.value = encoding
    tool.decryptInput.value = text
    tool.doDecrypt()
    assert.equal(tool.decryptOutput.value, tool.encryptInput.value)
  }
  tool.doSign()
  tool.verifyMessage.value = tool.signInput.value
  for (const [encoding, text] of formats(tool.signOutput.value, 'SM2 SIGNATURE')) {
    tool.verifyEncoding.value = encoding
    tool.verifySignature.value = text
    tool.doVerify()
    assert.equal(tool.verifyResult.value, true)
  }
})

test('SM4 ECB/CBC decrypt formatted data and convenience copy resets input encoding', () => {
  const tool = workflows.useSm4Tool()
  tool.generateRandomKey()
  tool.generateRandomIv()
  for (const mode of ['ecb', 'cbc']) {
    tool.encryptMode.value = mode
    tool.copyToDecrypt()
    assert.equal(tool.decryptEncoding.value, 'hex')
    for (const [encoding, text] of formats(tool.encryptResult.value, 'ENCRYPTED DATA')) {
      tool.decryptEncoding.value = encoding
      tool.decryptInput.value = text
      assert.equal(tool.decryptResult.value, tool.encryptInput.value)
    }
  }
})

test('digital envelopes and recovered session keys survive all display conversions', () => {
  const keys = workflows.useSm2Tool()
  keys.generateKeyPair()
  const tool = workflows.useDigitalEnvelope()
  tool.envelopePublicKey.value = keys.publicKey.value
  tool.envelopeDecryptPrivateKey.value = keys.privateKey.value
  tool.envelopeData.value = '数字信封测试\n123 🔐'
  tool.generateEnvelope()
  assert.ok(tool.envelopeResult.value)
  for (const [encoding, text] of formats(tool.envelopeResult.value.asn1, 'GM ENVELOPED DATA')) {
    tool.envelopeEncoding.value = encoding
    tool.envelopeDecryptInput.value = text
    tool.openEnvelope()
    assert.equal(tool.envelopeDecryptResult.value.decryptedData, tool.envelopeData.value)
    assert.equal(tool.envelopeDecryptResult.value.sessionKey, tool.envelopeResult.value.sessionKey)
  }
})
