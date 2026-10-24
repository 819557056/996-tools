import { test, after } from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { mkdir, mkdtemp, writeFile, readFile, rm } from 'node:fs/promises'
import { join, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createPrivateKey, createPublicKey, verify } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import * as a from 'asn1js'
import * as p from 'pkijs'

const require = createRequire(import.meta.url), root = fileURLToPath(new URL('..', import.meta.url)), tempRoot = resolve(root, 'tmp')
const { build } = createRequire(require.resolve('vite/package.json'))('esbuild')
await mkdir(tempRoot, { recursive: true })
const temp = await mkdtemp(join(tempRoot, 'offline-revocation-'))
after(async () => { assert.ok(resolve(temp).startsWith(tempRoot + sep)); await rm(temp, { recursive: true, force: true }) })
await build({ stdin: { contents: "export * from './src/utils/pki/core.ts'; export * from './src/utils/pki/revocation.ts'", resolveDir: root }, bundle: true, packages: 'external', platform: 'node', format: 'cjs', outfile: join(temp, 'api.cjs') })
const api = require(join(temp, 'api.cjs'))
const cert = bytes => api.certificate(api.pem(bytes, 'CERTIFICATE'))
const hex = bytes => Buffer.from(bytes).toString('hex')
const asText = object => hex(api.der(object))
const fixtures = new Map()
const times = () => ({ thisUpdate: new Date(Date.now() - 60000), nextUpdate: new Date(Date.now() + 3600000), revocationTime: new Date(Date.now() - 86400000) })
for (const algorithm of ['RSA', 'ECDSA', 'SM2']) {
  const identity = await api.generateIdentity(algorithm), leafIdentity = await api.generateIdentity(algorithm)
  const issuer = cert(await api.createCertificate(identity, { commonName: `${algorithm} Issuer`, organization: 'Offline Test', country: 'CN', ca: true }))
  const leaf = cert(await api.createCertificate(leafIdentity, { commonName: `${algorithm} Leaf` }, { certificate: issuer, identity }))
  const request = await api.createOcspRequest(leaf, issuer)
  fixtures.set(algorithm, { identity, issuer, leaf, request })
}

for (const [algorithm, fixture] of fixtures) {
  const { identity, issuer, leaf, request } = fixture
  test(`${algorithm}: request issuer binding, random nonce, all signed response statuses and tampering`, async () => {
    const parsedRequest = api.inspectOcspRequest(hex(request))
    assert.equal(parsedRequest.requests[0].hashAlgorithm, 'SHA-256')
    assert.equal(parsedRequest.nonce.length, 64)
    assert.equal(parsedRequest.signedRequest, false)
    for (const status of ['good', 'revoked', 'unknown']) {
      const response = await api.createOcspResponse(hex(request), issuer, issuer, identity, { status, ...times(), reason: 1 })
      const report = await api.verifyOcspResponse(hex(response), hex(request), issuer, { target: leaf })
      assert.equal(report.valid, true)
      assert.equal(report.responses[0].status, status)
      assert.equal(report.nonceMatches, true)
      if (status === 'revoked') assert.equal(report.responses[0].reason, 1)
      const outer = new p.OCSPResponse({ schema: api.schema(response) })
      const basic = new p.BasicOCSPResponse({ schema: api.schema(outer.responseBytes.response.valueBlock.valueHexView) })
      if (algorithm !== 'SM2') {
        const publicKey = createPublicKey({ key: Buffer.from(api.der(issuer.subjectPublicKeyInfo)), type: 'spki', format: 'der' })
        assert.equal(verify('sha256', basic.tbsResponseData.tbsView, publicKey, basic.signature.valueBlock.valueHexView), true)
      }
      basic.signature.valueBlock.valueHexView[0] ^= 1
      outer.responseBytes.response = new a.OctetString({ valueHex: api.buf(api.der(basic)) })
      assert.equal((await api.verifyOcspResponse(asText(outer), hex(request), issuer)).valid, false)
    }
    const wrong = fixtures.get(algorithm === 'RSA' ? 'ECDSA' : 'RSA')
    await assert.rejects(api.createOcspRequest(leaf, wrong.issuer), /does not match issuer/)
    await assert.rejects(api.createOcspResponse(hex(request), wrong.issuer, wrong.issuer, wrong.identity, { status: 'good', ...times() }), /CertID does not match issuer/)
    await assert.rejects(api.createOcspResponse(hex(request), issuer, issuer, wrong.identity, { status: 'good', ...times() }), /key does not match/)
    const otherRequest = await api.createOcspRequest(leaf, issuer)
    const response = await api.createOcspResponse(hex(request), issuer, issuer, identity, { status: 'good', ...times() })
    const nonceReport = await api.verifyOcspResponse(hex(response), hex(otherRequest), issuer)
    assert.equal(nonceReport.signatureValid, true); assert.equal(nonceReport.nonceMatches, false); assert.equal(nonceReport.valid, false)
    const sha1 = await api.createOcspRequest(leaf, issuer, { hashAlgorithm: 'SHA-1', nonce: false })
    assert.equal(api.inspectOcspRequest(hex(sha1)).nonce, '')
    const sha1Response = await api.createOcspResponse(hex(sha1), issuer, issuer, identity, { status: 'good', ...times() })
    assert.equal((await api.verifyOcspResponse(hex(sha1Response), hex(sha1), issuer)).valid, true)
    assert.equal((await api.verifyOcspResponse(hex(response), hex(sha1), issuer)).bindingValid, false)
  })
}

test('delegated responder needs direct issuer authorization, OCSP EKU and signing usage', async () => {
  const { issuer, identity, leaf, request } = fixtures.get('RSA')
  const responderKey = await api.generateIdentity('RSA')
  const responder = cert(await api.createCertificate(responderKey, { commonName: 'Delegated OCSP Responder' }, { certificate: issuer, identity }))
  await assert.rejects(api.createOcspResponse(hex(request), issuer, responder, responderKey, { status: 'good', ...times() }), /OCSP Signing EKU/)
  const unauthorizedBytes = await api.createOcspResponse(hex(request), issuer, issuer, identity, { status: 'good', ...times() })
  const unauthorizedOuter = new p.OCSPResponse({ schema: api.schema(unauthorizedBytes) })
  const unauthorized = new p.BasicOCSPResponse({ schema: api.schema(unauthorizedOuter.responseBytes.response.valueBlock.valueHexView) })
  unauthorized.tbsResponseData.responderID = responder.subject; unauthorized.certs = [responder]
  await unauthorized.sign(responderKey.key, 'SHA-256')
  unauthorizedOuter.responseBytes.response = new a.OctetString({ valueHex: api.buf(api.der(unauthorized)) })
  const rejected = await api.verifyOcspResponse(asText(unauthorizedOuter), hex(request), issuer)
  assert.equal(rejected.signatureValid, true); assert.equal(rejected.authorized, false); assert.equal(rejected.valid, false)
  responder.extensions.push(new p.Extension({ extnID: '2.5.29.37', extnValue: new p.ExtKeyUsage({ keyPurposes: ['1.3.6.1.5.5.7.3.9'] }).toSchema().toBER(false) }))
  await responder.sign(identity.key, 'SHA-256')
  const signedResponder = cert(api.der(responder))
  const response = await api.createOcspResponse(hex(request), issuer, signedResponder, responderKey, { status: 'good', ...times() })
  const report = await api.verifyOcspResponse(hex(response), hex(request), issuer, { target: leaf })
  assert.equal(report.valid, true); assert.match(report.responder, /Delegated/)
  const usage = responder.extensions.find(item => item.extnID === '2.5.29.15')
  usage.extnValue = new a.OctetString({ valueHex: new a.BitString({ valueHex: new Uint8Array([0x20]).buffer, unusedBits: 5 }).toBER(false) })
  await responder.sign(identity.key, 'SHA-256')
  await assert.rejects(api.createOcspResponse(hex(request), issuer, cert(api.der(responder)), responderKey, { status: 'good', ...times() }), /digitalSignature/)
})

test('invalid status/times, critical extensions, multiple/duplicate CertIDs, wrong target and custom SM2 userId', async () => {
  const { issuer, identity, request, leaf } = fixtures.get('SM2')
  for (const options of [{ status: 'invented' }, { status: 'revoked' }, { status: 'revoked', revocationTime: new Date(Date.now() + 10000) }, { status: 'revoked', revocationTime: new Date(0), reason: 7 }]) await assert.rejects(api.createOcspResponse(hex(request), issuer, issuer, identity, { ...times(), revocationTime: undefined, ...options }))
  await assert.rejects(api.createOcspResponse(hex(request), issuer, issuer, identity, { status: 'good', thisUpdate: new Date(Date.now() + 60000) }), /time interval/)
  const parsed = new p.OCSPRequest({ schema: api.schema(request) })
  parsed.tbsRequest.requestList.push(parsed.tbsRequest.requestList[0])
  await assert.rejects(api.createOcspResponse(hex(new Uint8Array(parsed.toSchema(true).toBER(false))), issuer, issuer, identity, { status: 'good', ...times() }), /distinct CertIDs/)
  const otherLeaf = cert(await api.createCertificate(await api.generateIdentity('SM2'), { commonName: 'Other' }, { certificate: issuer, identity }))
  const otherRequest = new p.OCSPRequest({ schema: api.schema(await api.createOcspRequest(otherLeaf, issuer)) })
  const singleResponse = await api.createOcspResponse(hex(request), issuer, issuer, identity, { status: 'good', ...times() })
  await assert.rejects(api.verifyOcspResponse(hex(singleResponse), hex(request), issuer, { target: otherLeaf }), /does not contain target/)
  parsed.tbsRequest.requestList[1] = otherRequest.tbsRequest.requestList[0]
  const multi = hex(new Uint8Array(parsed.toSchema(true).toBER(false)))
  const response = await api.createOcspResponse(multi, issuer, issuer, identity, { status: 'unknown', ...times(), userId: 'offline-custom-id' })
  assert.equal((await api.verifyOcspResponse(hex(response), multi, issuer, { target: leaf, userId: 'offline-custom-id', certificateUserId: '1234567812345678' })).valid, true)
  assert.equal((await api.verifyOcspResponse(hex(response), multi, issuer)).signatureValid, false)
  parsed.tbsRequest.requestExtensions.push(new p.Extension({ extnID: '1.2.3.4.5', critical: true, extnValue: new a.Null().toBER(false) }))
  assert.throws(() => api.inspectOcspRequest(hex(new Uint8Array(parsed.toSchema(true).toBER(false)))), /critical extension/)
})

test('worker operation imports encrypted PKCS#8 without mixing its password with OCSP data', async () => {
  const { identity, issuer, request } = fixtures.get('ECDSA')
  const key = createPrivateKey({ key: Buffer.from(identity.privateDer), type: 'pkcs8', format: 'der' })
  const input = { mode: 'response-create', issuer: api.pem(api.der(issuer), 'CERTIFICATE'), responder: '', request: hex(request), privateKey: key.export({ type: 'pkcs8', format: 'pem', cipher: 'aes-256-cbc', passphrase: 'test-import-only' }), password: 'test-import-only', userId: '1234567812345678', status: 'good', thisUpdate: times().thisUpdate.toISOString(), nextUpdate: times().nextUpdate.toISOString(), reason: -1 }
  const result = await api.runRevocation(input)
  assert.equal(result.valid, true); assert.equal(result.artifacts[0].kind, 'ocsp-response')
  await assert.rejects(api.runRevocation({ ...input, password: 'wrong' }), /password/)
})

test('CRL signature, issuer, times and serial lookup; delta/indirect CRLs rejected', async () => {
  const { identity, issuer, leaf } = fixtures.get('RSA')
  const crl = new p.CertificateRevocationList({ version: 1, issuer: issuer.subject, thisUpdate: new p.Time({ value: times().thisUpdate }), nextUpdate: new p.Time({ value: times().nextUpdate }), revokedCertificates: [new p.RevokedCertificate({ userCertificate: leaf.serialNumber, revocationDate: new p.Time({ value: times().revocationTime }), crlEntryExtensions: new p.Extensions({ extensions: [new p.Extension({ extnID: '2.5.29.21', extnValue: new a.Enumerated({ value: 1 }).toBER(false) })] }) })] })
  await crl.sign(identity.key, 'SHA-256')
  const report = await api.inspectCrl(asText(crl), issuer, leaf)
  assert.equal(report.valid, true); assert.equal(report.listed, true); assert.equal(report.reason, 1)
  assert.equal((await api.inspectCrl(asText(crl), issuer, issuer)).listed, false)
  assert.equal((await api.inspectCrl(asText(crl), issuer, leaf, undefined, new Date(Date.now() + 7200000))).timeValid, false)
  assert.equal((await api.inspectCrl(asText(crl), fixtures.get('ECDSA').issuer)).signatureValid, false)
  crl.signatureValue.valueBlock.valueHexView[0] ^= 1
  assert.equal((await api.inspectCrl(asText(crl), issuer, leaf)).signatureValid, false)
  crl.crlExtensions = new p.Extensions({ extensions: [new p.Extension({ extnID: '2.5.29.27', extnValue: new a.Integer({ value: 1 }).toBER(false) })] })
  await crl.sign(identity.key, 'SHA-256')
  await assert.rejects(api.inspectCrl(asText(crl), issuer), /complete direct CRLs/)
})

test('OpenSSL independently verifies RSA/ECDSA OCSP signature, nonce, CertID and status', { skip: !process.env.PKI_OPENSSL }, async () => {
  for (const algorithm of ['RSA', 'ECDSA']) {
    const { identity, issuer, leaf, request } = fixtures.get(algorithm)
    const response = await api.createOcspResponse(hex(request), issuer, issuer, identity, { status: 'good', ...times() })
    await writeFile(join(temp, 'issuer.pem'), api.pem(api.der(issuer), 'CERTIFICATE'))
    await writeFile(join(temp, 'leaf.pem'), api.pem(api.der(leaf), 'CERTIFICATE'))
    await writeFile(join(temp, 'request.der'), request); await writeFile(join(temp, 'response.der'), response)
    const output = execFileSync(process.env.PKI_OPENSSL, ['ocsp', '-reqin', join(temp, 'request.der'), '-respin', join(temp, 'response.der'), '-CAfile', join(temp, 'issuer.pem'), '-text'], { encoding: 'utf8', stdio: 'pipe' })
    assert.match(output, /good/)
  }
})

test('BouncyCastle independently verifies all response algorithms and supplies OCSP/CRL fixtures', { skip: !process.env.PKI_JAVA || !process.env.PKI_BC_CLASSPATH }, async () => {
  for (const [algorithm, { identity, issuer, leaf, request }] of fixtures) {
    const response = await api.createOcspResponse(hex(request), issuer, issuer, identity, { status: 'revoked', ...times(), reason: 1 })
    for (const [filename, bytes] of Object.entries({ 'issuer.der': api.der(issuer), 'leaf.der': api.der(leaf), 'key.der': identity.privateDer, 'request.der': request, 'response.der': response })) await writeFile(join(temp, `${algorithm}-${filename}`), bytes)
  }
  const output = execFileSync(process.env.PKI_JAVA, ['-Dfile.encoding=UTF-8', '--class-path', process.env.PKI_BC_CLASSPATH, join(root, 'tests/helpers/OfflineRevocationInterop.java'), temp], { encoding: 'utf8', timeout: 60000, stdio: 'pipe' })
  assert.match(output, /OK offline revocation BC/)
  for (const [algorithm, { issuer, leaf, request }] of fixtures) {
    assert.equal((await api.verifyOcspResponse(hex(await readFile(join(temp, `${algorithm}-bc-response.der`))), hex(request), issuer, { target: leaf })).valid, true)
    const crl = await api.inspectCrl(hex(await readFile(join(temp, `${algorithm}-bc.crl`))), issuer, leaf)
    assert.equal(crl.valid, true); assert.equal(crl.listed, true); assert.equal(crl.reason, 1)
  }
})
