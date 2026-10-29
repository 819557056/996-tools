import assert from 'node:assert/strict'
import { test } from 'node:test'
import { generateKeyPairSync, X509Certificate, createPrivateKey } from 'node:crypto'
import { createServer, get } from 'node:https'
import { mkdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import * as asn1 from 'asn1js'
import * as pki from 'pkijs'
import { generateCertificates, importKeyPair, parseDer, validateConfig } from '../../src/utils/ssl/generator'
import type { CertificateConfig, GenerationResult } from '../../src/types/ssl'

const base: CertificateConfig = {
  rootAlgorithm: 'rsa-2048', rootDays: 3650, days: 365,
  subject: { CN: 'localhost', O: '测试公司,研发+组', OU: '开发部', C: 'CN', ST: '浙江', L: '杭州' },
  addresses: [{ type: 'DNS', value: 'localhost' }, { type: 'DNS', value: '*.example.com' }, { type: 'IP', value: '127.0.0.1' }, { type: 'IP', value: '::1' }],
  clientAuth: true, keySource: 'generate', siteAlgorithm: 'rsa-2048'
}
function content(result: GenerationResult, name: string): string { return result.files.find(file => file.name === name)!.content as string }
function bytes(result: GenerationResult): Uint8Array { return result.files.find(file => file.name === 'server.der')!.content as Uint8Array }
async function saveFixture(name: string, result: GenerationResult) {
  if (!process.env.SSL_TEST_OUTPUT) return
  const directory = resolve(process.env.SSL_TEST_OUTPUT, name)
  await mkdir(directory, { recursive: true })
  for (const file of result.files) await writeFile(resolve(directory, file.name), file.content)
}
async function handshake(result: GenerationResult, key = content(result, 'server.key')) {
  const server = createServer({ key, cert: content(result, 'server.crt') }, (_, response) => response.end('TLS works'))
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
  try {
    const address = server.address() as { port: number }
    const text = await new Promise<string>((resolve, reject) => {
      get({ hostname: '127.0.0.1', port: address.port, ca: content(result, `${result.rootName}.crt`), rejectUnauthorized: true }, response => {
        let body = ''
        response.setEncoding('utf8')
        response.on('data', chunk => { body += chunk })
        response.on('end', () => resolve(body))
      }).on('error', reject)
    })
    assert.equal(text, 'TLS works')
  } finally { await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve())) }
}

test('RSA2048 root issues a TLS server certificate with exact RDNs, SANs and key usages', async () => {
  const stages: string[] = []
  const result = await generateCertificates({ config: base }, stage => stages.push(stage))
  const root = new X509Certificate(content(result, `${result.rootName}.crt`))
  const site = new X509Certificate(content(result, 'server.crt'))
  assert.ok(root.verify(root.publicKey))
  assert.ok(site.verify(root.publicKey))
  assert.ok(site.checkPrivateKey(createPrivateKey(content(result, 'server.key'))))
  assert.equal(site.checkHost('localhost'), 'localhost')
  assert.equal(site.checkHost('api.example.com'), '*.example.com')
  assert.equal(site.checkHost('example.com'), undefined)
  assert.equal(site.checkIP('127.0.0.1'), '127.0.0.1')
  assert.equal(site.checkIP('::1'), '::1')
  assert.ok(root.subject.includes('OU=test\nOU=xcf\nC=cn'))
  assert.equal(root.ca, true)
  assert.equal(site.ca, false)
  assert.deepEqual(site.keyUsage, ['1.3.6.1.5.5.7.3.1', '1.3.6.1.5.5.7.3.2'])
  const decoded = new pki.Certificate({ schema: parseDer(Buffer.from(root.raw)) })
  const rdns = decoded.subject.toSchema().valueBlock.value
  assert.equal(rdns.length, 4)
  assert.ok(rdns.every(set => set instanceof asn1.Set && set.valueBlock.value.length === 1))
  assert.deepEqual(stages, ['validate', 'site-key', 'root-key', 'root-certificate', 'site-certificate', 'verify'])
  await handshake(result)
  await saveFixture('rsa2048', result)
})

test('RSA4096 root signs ECDSA P-384 public key; real TLS handshake succeeds', async () => {
  const result = await generateCertificates({ config: { ...base, rootAlgorithm: 'rsa-4096', siteAlgorithm: 'ec-p384' } })
  const root = new X509Certificate(content(result, `${result.rootName}.crt`))
  assert.equal(root.publicKey.asymmetricKeyDetails?.modulusLength, 4096)
  assert.equal(result.signatureAlgorithm, 'SHA256withRSA')
  assert.equal(new X509Certificate(content(result, 'server.crt')).publicKey.asymmetricKeyDetails?.namedCurve, 'secp384r1')
  await handshake(result)
  await saveFixture('rsa4096-ec384', result)
})

test('SM2 root and server use SM3withSM2, preserve both OU values, and import exported key pairs', async () => {
  const config: CertificateConfig = { ...base, rootAlgorithm: 'sm2', siteAlgorithm: 'sm2' }
  const result = await generateCertificates({ config })
  assert.equal(result.signatureAlgorithm, 'SM3withSM2')
  const site = new pki.Certificate({ schema: parseDer(bytes(result)) })
  assert.equal(site.signatureAlgorithm.algorithmId, '1.2.156.10197.1.501')
  const imported = await generateCertificates({ config: { ...config, keySource: 'import' }, keyPair: { privatePem: content(result, 'server.key'), publicPem: content(result, 'server.pub') } })
  assert.equal(imported.siteAlgorithm, 'SM2 · 256 位')
  assert.ok(!imported.files.some(file => file.name === 'server.key'))
  await saveFixture('sm2', result)
  await saveFixture('sm2-imported', imported)
})

test('imports PKCS#1 RSA private/public and SEC1 EC private with real pairing verification', async () => {
  const rsa = generateKeyPairSync('rsa', { modulusLength: 2048, privateKeyEncoding: { type: 'pkcs1', format: 'pem' }, publicKeyEncoding: { type: 'pkcs1', format: 'pem' } })
  assert.equal((await importKeyPair(rsa.privateKey, rsa.publicKey, 'rsa-2048')).id, 'rsa-2048')
  const ec = generateKeyPairSync('ec', { namedCurve: 'prime256v1', privateKeyEncoding: { type: 'sec1', format: 'pem' }, publicKeyEncoding: { type: 'spki', format: 'pem' } })
  const result = await generateCertificates({ config: { ...base, keySource: 'import' }, keyPair: { privatePem: ec.privateKey, publicPem: ec.publicKey } })
  assert.equal(result.siteAlgorithm, 'ECDSA · P-256')
  assert.ok(!result.files.some(file => file.name === 'server.key'))
  await handshake(result, ec.privateKey)
  await saveFixture('imported-ec256', result)
})

test('mismatched pairs, unsupported curves, encrypted keys and bad ASN.1 are rejected before root generation', async () => {
  const options = { modulusLength: 2048, privateKeyEncoding: { type: 'pkcs8' as const, format: 'pem' as const }, publicKeyEncoding: { type: 'spki' as const, format: 'pem' as const } }
  const one = generateKeyPairSync('rsa', options)
  const two = generateKeyPairSync('rsa', options)
  const stages: string[] = []
  await assert.rejects(generateCertificates({ config: { ...base, keySource: 'import' }, keyPair: { privatePem: one.privateKey, publicPem: two.publicKey } }, stage => stages.push(stage)), /不匹配/)
  assert.ok(!stages.includes('root-key'))
  await assert.rejects(importKeyPair(one.privateKey, one.publicKey, 'sm2'), /需要 SM2/)
  await assert.rejects(importKeyPair('-----BEGIN PRIVATE KEY-----\n' + 'A'.repeat(64) + '\n-----END PRIVATE KEY-----', one.publicKey, 'rsa-2048'), /结构损坏/)
  const weak = generateKeyPairSync('rsa', { ...options, modulusLength: 1024 })
  await assert.rejects(importKeyPair(weak.privateKey, weak.publicKey, 'rsa-2048'), /2048/)
  const ec = generateKeyPairSync('ec', { namedCurve: 'secp521r1', privateKeyEncoding: { type: 'pkcs8', format: 'pem' }, publicKeyEncoding: { type: 'spki', format: 'pem' } })
  await assert.rejects(importKeyPair(ec.privateKey, ec.publicKey, 'rsa-2048'), /仅支持/)
  const encrypted = generateKeyPairSync('rsa', { ...options, privateKeyEncoding: { type: 'pkcs8', format: 'pem', cipher: 'aes-256-cbc', passphrase: 'disposable-test-password' } })
  await assert.rejects(importKeyPair(encrypted.privateKey, encrypted.publicKey, 'rsa-2048'), /加密私钥/)
})

test('validity boundaries, invalid SANs and country codes fail; post-2050 dates encode correctly', async () => {
  assert.throws(() => validateConfig({ ...base, rootDays: 30 }), /覆盖/)
  assert.throws(() => validateConfig({ ...base, days: 0 }), /有效期/)
  assert.throws(() => validateConfig({ ...base, days: 1.5 }), /整数/)
  assert.throws(() => validateConfig({ ...base, addresses: [{ type: 'DNS', value: 'https://example.com' }] }), /只填写/)
  assert.throws(() => validateConfig({ ...base, subject: { ...base.subject, C: 'CHN' } }), /国家代码/)
  assert.throws(() => validateConfig({ ...base, start: '2001-01-01T00:00:00.000Z' }), /已经结束/)
  const start = '2051-01-01T00:00:00.000Z'
  const result = await generateCertificates({ config: { ...base, start, days: 90, rootDays: 365, rootAlgorithm: 'sm2', siteAlgorithm: 'sm2' } })
  const certificate = new pki.Certificate({ schema: parseDer(bytes(result)) })
  assert.equal(certificate.notBefore.type, 1)
  assert.equal(certificate.notBefore.value.toISOString(), start)
  assert.equal(certificate.notAfter.value.toISOString(), '2051-04-01T00:00:00.000Z')
})
