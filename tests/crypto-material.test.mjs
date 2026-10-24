import test from 'node:test'
import assert from 'node:assert/strict'
import { createPrivateKey, createPublicKey } from 'node:crypto'
import smCrypto from 'sm-crypto'
import {
  bytesToHex, bytesToBase64, decodeMaterial, encodeSm2KeyDer,
  formatMaterial, materialLabel, materialToHex,
} from '../src/utils/crypto/material-format.ts'

test('Hex/Base64 encode the same binary bytes, including zero and high bytes', () => {
  const bytes = Uint8Array.of(0, 1, 127, 128, 255)
  assert.equal(bytesToHex(bytes), '00017f80ff')
  assert.equal(bytesToBase64(bytes), 'AAF/gP8=')
  assert.deepEqual(decodeMaterial('00 01\n7f 80\r\nff', 'hex'), bytes)
  assert.deepEqual(decodeMaterial('AAF/gP8=', 'base64'), bytes)
  assert.deepEqual(decodeMaterial('AAF/gP8', 'base64'), bytes)
  assert.equal(materialToHex('AAAA', 'auto'), 'aaaa')
  assert.equal(materialToHex('AAAA', 'base64'), '000000')
})

test('all wrap lengths and line endings round trip without altering bytes', () => {
  const bytes = Uint8Array.from({ length: 257 }, (_, index) => index % 256)
  for (const encoding of ['hex', 'base64']) {
    for (const lineLength of [0, 32, 64, 76]) {
      for (const lineEnding of ['LF', 'CRLF']) {
        const text = formatMaterial(bytes, { encoding, lineLength, lineEnding, uppercase: true })
        const eol = lineEnding === 'CRLF' ? '\r\n' : '\n'
        const lines = text.split(eol)
        assert.equal(lines.length, lineLength ? Math.ceil((encoding === 'hex' ? 514 : 344) / lineLength) : 1)
        if (lineLength) assert.ok(lines.slice(0, -1).every(line => line.length === lineLength))
        assert.equal(text.replaceAll(eol, '').includes('\n'), false)
        assert.deepEqual(decodeMaterial(text, encoding), bytes)
      }
    }
  }
})

test('headers have matching labels, preserve CRLF, and decode to the original bytes', () => {
  const text = formatMaterial(Uint8Array.of(0, 255, 128), {
    encoding: 'base64', header: 'CERTIFICATE', lineLength: 32, lineEnding: 'CRLF',
  })
  assert.equal(text, '-----BEGIN CERTIFICATE-----\r\nAP+A\r\n-----END CERTIFICATE-----')
  assert.equal(materialToHex(text), '00ff80')
  assert.equal(materialToHex(text, 'pem'), '00ff80')
  assert.equal(materialLabel('sm2-public'), 'SM2 RAW PUBLIC KEY')
  assert.equal(materialLabel('sm2-private', 'der'), 'PRIVATE KEY')
  assert.equal(materialLabel('envelope'), 'GM ENVELOPED DATA')
})

test('invalid data and mismatched/multiple headers are rejected instead of stripped', () => {
  for (const value of ['0', '001', '00xz', '0x00', 'ff:00']) {
    assert.throws(() => decodeMaterial(value, 'hex'))
  }
  for (const value of ['A', 'AA=', 'A===', 'AB==', 'AAB=', 'AA-_', 'AA$A']) {
    assert.throws(() => decodeMaterial(value, 'base64'))
  }
  for (const value of [
    '-----BEGIN CERTIFICATE-----\nAA==\n-----END PUBLIC KEY-----',
    '-----BEGIN CERTIFICATE-----\nAA==',
    '-----BEGIN CERTIFICATE-----\nAA==\n-----END CERTIFICATE-----\ntrailing',
    '-----BEGIN A-----\nAA==\n-----END A-----\n-----BEGIN A-----\nAA==\n-----END A-----',
  ]) assert.throws(() => decodeMaterial(value, 'pem'))
  assert.throws(() => formatMaterial(Uint8Array.of(1), { encoding: 'base64', header: 'bad\nlabel' }))
  assert.throws(() => formatMaterial(Uint8Array.of(1), { encoding: 'hex', lineLength: -1 }))
  assert.equal(formatMaterial(new Uint8Array(), { encoding: 'base64', header: 'CERTIFICATE' }), '')
})

test('large envelopes/certificates encode without spread argument limits', () => {
  const bytes = Uint8Array.from({ length: 300_000 }, (_, index) => index % 256)
  const text = formatMaterial(bytes, { encoding: 'base64', header: 'GM ENVELOPED DATA', lineLength: 64 })
  assert.deepEqual(decodeMaterial(text), bytes)
})

test('OpenSSL imports SPKI and PKCS#8 exports and derives the same SM2 public key', () => {
  const keys = smCrypto.sm2.generateKeyPairHex()
  const publicDer = encodeSm2KeyDer(decodeMaterial(keys.publicKey, 'hex'), 'sm2-public')
  const privateDer = encodeSm2KeyDer(decodeMaterial(keys.privateKey, 'hex'), 'sm2-private')
  const publicKey = createPublicKey({ key: Buffer.from(publicDer), format: 'der', type: 'spki' })
  const privateKey = createPrivateKey({ key: Buffer.from(privateDer), format: 'der', type: 'pkcs8' })
  assert.deepEqual(publicKey.export({ format: 'der', type: 'spki' }), Buffer.from(publicDer))
  assert.deepEqual(createPublicKey(privateKey).export({ format: 'der', type: 'spki' }), Buffer.from(publicDer))
  const pem = formatMaterial(privateDer, { encoding: 'base64', header: 'PRIVATE KEY', lineLength: 64 })
  assert.deepEqual(createPublicKey(createPrivateKey(pem)).export({ format: 'der', type: 'spki' }), Buffer.from(publicDer))
  assert.throws(() => encodeSm2KeyDer(new Uint8Array(32), 'sm2-private'))
  assert.throws(() => encodeSm2KeyDer(new Uint8Array(32).fill(255), 'sm2-private'))
  assert.throws(() => encodeSm2KeyDer(new Uint8Array(64), 'sm2-public'))
})
