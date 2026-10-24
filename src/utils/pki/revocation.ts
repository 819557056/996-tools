import * as a from 'asn1js'
import * as p from 'pkijs'
import { sm2 } from 'sm-crypto'
import { bytesToHex, decodeMaterial } from '../crypto/material-format'
import { O, buf, certificate, der, keyMatches, loadIdentity, name, schema, smPublic, verifyCertificate, type Identity } from './core'

const NONCE = '1.3.6.1.5.5.7.48.1.2', BASIC = '1.3.6.1.5.5.7.48.1.1', OCSP_SIGNING = '1.3.6.1.5.5.7.3.9'
const HASHES: Record<string, string> = { '1.3.14.3.2.26': 'SHA-1', '2.16.840.1.101.3.4.2.1': 'SHA-256' }
const SCOPE = '仅验证导入材料，不查询在线状态或系统信任库 / Imported materials only; no online status or system trust lookup'
type Status = 'good' | 'revoked' | 'unknown'
export type RevocationMode = 'request-create' | 'request-inspect' | 'response-create' | 'response-verify' | 'crl-inspect'
export interface RevocationInput {
  mode: RevocationMode; target: string; issuer: string; responder: string; privateKey: string; password: string
  request: string; response: string; crl: string; hashAlgorithm: 'SHA-1' | 'SHA-256'; nonce: boolean
  status: Status; thisUpdate: string; nextUpdate: string; revocationTime: string; reason: number; userId: string; certificateUserId?: string
}
export interface RevocationArtifact { label: string; kind: 'ocsp-request' | 'ocsp-response'; hex: string; filename: string }
export interface RevocationResult { valid?: boolean; details: Record<string, unknown>; artifacts: RevocationArtifact[] }
const fail = (message: string): never => { throw new Error(message) }
const equal = (left: Uint8Array, right: Uint8Array) => bytesToHex(left) === bytesToHex(right)
const serial = (value: a.Integer) => bytesToHex(value.valueBlock.valueHexView).replace(/^(00)+(?=..)/, '')
const date = (value: string | Date) => {
  const result = new Date(value)
  if (!Number.isFinite(result.getTime())) fail('无效的时间 / Invalid date')
  // RFC 6960 / RFC 5280 timestamps use UTC seconds without fractional seconds.
  result.setUTCMilliseconds(0)
  return result
}
function extensions(items: p.Extension[] = [], supported: string[] = []) {
  if (new Set(items.map(item => item.extnID)).size !== items.length) fail('包含重复扩展 / Duplicate extensions')
  if (items.some(item => item.critical && !supported.includes(item.extnID))) fail('存在不支持的关键扩展 / Unsupported critical extension')
}
function nonceOf(items: p.Extension[] = []) {
  extensions(items, [NONCE])
  const item = items.find(extension => extension.extnID === NONCE)
  if (!item) return undefined
  const value = schema(item.extnValue.valueBlock.valueHexView)
  if (!(value instanceof a.OctetString) || value.idBlock.isConstructed || value.valueBlock.valueHexView.length < 1 || value.valueBlock.valueHexView.length > 32) fail('OCSP nonce 必须为 1–32 字节 / OCSP nonce must contain 1–32 bytes')
  return (value as a.OctetString).valueBlock.valueHexView
}
function requireUsage(cert: p.Certificate, bit: number, label: string) {
  const extension = cert.extensions?.find(item => item.extnID === '2.5.29.15')
  if (!extension) return
  const bits = schema(extension.extnValue.valueBlock.valueHexView)
  if (!(bits instanceof a.BitString) || !(bits.valueBlock.valueHexView[0] & bit)) fail(`证书 KeyUsage 不允许 ${label} / Certificate KeyUsage does not permit ${label}`)
}
function requireCa(cert: p.Certificate) {
  const extension = cert.extensions?.find(item => item.extnID === '2.5.29.19')
  if (!extension || !new p.BasicConstraints({ schema: schema(extension.extnValue.valueBlock.valueHexView) }).cA) fail('签发者必须是 CA 证书 / Issuer must be a CA certificate')
  requireUsage(cert, 0x04, 'keyCertSign')
}
function validAt(cert: p.Certificate, at: Date) {
  if (at < cert.notBefore.value || at > cert.notAfter.value) fail('签发者或响应者证书不在有效期内 / Issuer or responder certificate is outside validity')
}
async function targetIssuer(target: p.Certificate, issuer: p.Certificate, userId: string) {
  requireCa(issuer)
  if (!await verifyCertificate(target, issuer, userId)) fail('目标证书与签发者不匹配 / Target certificate does not match issuer')
}
async function certIdFor(serialNumber: a.Integer, issuer: p.Certificate, hashAlgorithm: string) {
  const hashOid = Object.keys(HASHES).find(oid => HASHES[oid] === hashAlgorithm)
  if (!hashOid) fail('CertID 仅支持 SHA-1 / SHA-256 / CertID supports SHA-1 / SHA-256')
  return new p.CertID({ hashAlgorithm: new p.AlgorithmIdentifier({ algorithmId: hashOid!, algorithmParams: new a.Null() }), serialNumber,
    issuerNameHash: new a.OctetString({ valueHex: await crypto.subtle.digest(hashAlgorithm, buf(der(issuer.subject))) }),
    issuerKeyHash: new a.OctetString({ valueHex: await crypto.subtle.digest(hashAlgorithm, buf(issuer.subjectPublicKeyInfo.subjectPublicKey.valueBlock.valueHexView)) }) })
}
function certIdKey(id: p.CertID) { return `${id.hashAlgorithm.algorithmId}:${bytesToHex(id.issuerNameHash.valueBlock.valueHexView)}:${bytesToHex(id.issuerKeyHash.valueBlock.valueHexView)}:${serial(id.serialNumber)}` }
function describeId(id: p.CertID) { return { hashAlgorithm: HASHES[id.hashAlgorithm.algorithmId] ?? id.hashAlgorithm.algorithmId, issuerNameHash: bytesToHex(id.issuerNameHash.valueBlock.valueHexView), issuerKeyHash: bytesToHex(id.issuerKeyHash.valueBlock.valueHexView), serialNumber: serial(id.serialNumber) } }
function parseRequest(text: string) {
  const request = new p.OCSPRequest({ schema: schema(decodeMaterial(text)) })
  if (request.tbsRequest.version !== undefined && request.tbsRequest.version !== 0) fail('不支持的 OCSP 请求版本 / Unsupported OCSP request version')
  const entries = request.tbsRequest.requestList
  if (!entries.length || entries.length > 64 || new Set(entries.map(entry => certIdKey(entry.reqCert))).size !== entries.length) fail('OCSP 请求须含 1–64 个不重复的 CertID / Expected 1–64 distinct CertIDs')
  for (const entry of entries) {
    extensions(entry.singleRequestExtensions)
    if (!HASHES[entry.reqCert.hashAlgorithm.algorithmId]) fail('不支持的 CertID 摘要算法 / Unsupported CertID hash')
    const raw = entry.reqCert.serialNumber.valueBlock.valueHexView
    if (!raw.length || raw[0] & 0x80) fail('证书序号必须为非负整数 / Certificate serial must be non-negative')
  }
  nonceOf(request.tbsRequest.requestExtensions)
  return request
}
async function bindIssuer(request: p.OCSPRequest, issuer: p.Certificate) {
  requireCa(issuer)
  for (const item of request.tbsRequest.requestList) {
    const expected = await certIdFor(item.reqCert.serialNumber, issuer, HASHES[item.reqCert.hashAlgorithm.algorithmId])
    if (certIdKey(item.reqCert) !== certIdKey(expected)) fail('请求 CertID 与签发者不匹配 / Request CertID does not match issuer')
  }
}
export async function createOcspRequest(target: p.Certificate, issuer: p.Certificate, options: { hashAlgorithm?: 'SHA-1' | 'SHA-256'; nonce?: boolean; userId?: string } = {}) {
  await targetIssuer(target, issuer, options.userId ?? '1234567812345678')
  const request = new p.OCSPRequest({ tbsRequest: new p.TBSRequest({ requestList: [new p.Request({ reqCert: await certIdFor(target.serialNumber, issuer, options.hashAlgorithm ?? 'SHA-256') })] }) })
  if (options.nonce !== false) request.tbsRequest.requestExtensions = [new p.Extension({ extnID: NONCE, extnValue: new a.OctetString({ valueHex: crypto.getRandomValues(new Uint8Array(32)).buffer }).toBER(false) })]
  return new Uint8Array(request.toSchema(true).toBER(false))
}
export function inspectOcspRequest(text: string) {
  const request = parseRequest(text)
  return { requests: request.tbsRequest.requestList.map(item => describeId(item.reqCert)), nonce: bytesToHex(nonceOf(request.tbsRequest.requestExtensions) ?? new Uint8Array()), signedRequest: !!request.optionalSignature, requestSignature: '未验证 / Not verified', scope: SCOPE }
}
async function authorizeResponder(responder: p.Certificate, issuer: p.Certificate, at: Date, userId: string) {
  requireCa(issuer); validAt(issuer, at); validAt(responder, at)
  if (equal(der(responder), der(issuer))) return
  if (!await verifyCertificate(responder, issuer, userId)) fail('响应者不是该签发者直接授权的证书 / Responder is not directly issued by this issuer')
  const extension = responder.extensions?.find(item => item.extnID === '2.5.29.37')
  if (!extension || !new p.ExtKeyUsage({ schema: schema(extension.extnValue.valueBlock.valueHexView) }).keyPurposes.includes(OCSP_SIGNING)) fail('响应者缺少 OCSP Signing EKU / Responder lacks OCSP Signing EKU')
  requireUsage(responder, 0x80, 'digitalSignature')
}
function statusNode(status: Status, revocationTime?: Date, reason?: number) {
  if (status === 'good' || status === 'unknown') return new a.Primitive({ idBlock: { tagClass: 3, tagNumber: status === 'good' ? 0 : 2 } })
  if (status !== 'revoked' || !revocationTime) fail('吊销状态需要吊销时间 / Revoked status requires a revocation time')
  if (reason !== undefined && ![0, 1, 2, 3, 4, 5, 6, 8, 9, 10].includes(reason)) fail('无效的吊销原因 / Invalid revocation reason')
  return new a.Constructed({ idBlock: { tagClass: 3, tagNumber: 1 }, value: [new a.GeneralizedTime({ valueDate: date(revocationTime!) }), ...(reason === undefined ? [] : [new a.Constructed({ idBlock: { tagClass: 3, tagNumber: 0 }, value: [new a.Enumerated({ value: reason })] })])] })
}
function describeStatus(value: a.BaseBlock): { status: Status; revocationTime?: string; reason?: number } {
  if (value.idBlock.tagClass !== 3) return fail('无效的 OCSP 状态 / Invalid OCSP status')
  if (value instanceof a.Primitive && [0, 2].includes(value.idBlock.tagNumber) && !value.valueBlock.valueHexView.length) return { status: value.idBlock.tagNumber === 0 ? 'good' : 'unknown' }
  if (!(value instanceof a.Constructed) || value.idBlock.tagNumber !== 1 || !(value.valueBlock.value[0] instanceof a.GeneralizedTime)) return fail('无效的吊销状态 / Invalid revoked status')
  const time = value.valueBlock.value[0].toDate(), extra = value.valueBlock.value[1]
  let reason: number | undefined
  if (extra) {
    if (!(extra instanceof a.Constructed) || extra.idBlock.tagClass !== 3 || extra.idBlock.tagNumber !== 0 || extra.valueBlock.value.length !== 1 || !(extra.valueBlock.value[0] instanceof a.Enumerated)) return fail('无效的吊销原因 / Invalid revocation reason')
    reason = extra.valueBlock.value[0].valueBlock.valueDec
  }
  if (value.valueBlock.value.length > 2) return fail('无效的吊销状态 / Invalid revoked status')
  statusNode('revoked', time, reason)
  return { status: 'revoked', revocationTime: time.toISOString(), reason }
}
export async function createOcspResponse(requestText: string, issuer: p.Certificate, responder: p.Certificate, identity: Identity, options: { status: Status; thisUpdate: Date; nextUpdate?: Date; revocationTime?: Date; reason?: number; userId?: string; certificateUserId?: string }) {
  const request = parseRequest(requestText), userId = options.userId ?? '1234567812345678', producedAt = date(new Date())
  await bindIssuer(request, issuer)
  await authorizeResponder(responder, issuer, producedAt, options.certificateUserId ?? userId)
  if (!await keyMatches(identity, responder)) fail('响应私钥与响应者证书不匹配 / Response key does not match responder certificate')
  const thisUpdate = date(options.thisUpdate), nextUpdate = options.nextUpdate ? date(options.nextUpdate) : undefined
  if (thisUpdate > producedAt || nextUpdate && nextUpdate <= thisUpdate) fail('thisUpdate 不能在未来，nextUpdate 须晚于 thisUpdate / Invalid response time interval')
  if (options.revocationTime && date(options.revocationTime) > thisUpdate) fail('吊销时间不能晚于 thisUpdate / Revocation time must not follow thisUpdate')
  const nonce = request.tbsRequest.requestExtensions?.find(item => item.extnID === NONCE)
  const response = new p.BasicOCSPResponse({ tbsResponseData: new p.ResponseData({ responderID: responder.subject, producedAt,
    responses: request.tbsRequest.requestList.map(item => new p.SingleResponse({ certID: item.reqCert, certStatus: statusNode(options.status, options.revocationTime, options.reason), thisUpdate, ...(nextUpdate ? { nextUpdate } : {}) })),
    ...(nonce ? { responseExtensions: [nonce] } : {}) }), certs: [responder] })
  if (identity.algorithm === 'SM2') {
    response.signatureAlgorithm = new p.AlgorithmIdentifier({ algorithmId: O.smSign })
    response.tbsResponseData.tbsView = new Uint8Array(response.tbsResponseData.toSchema(true).toBER(false))
    const signature = sm2.doSignature(Array.from(response.tbsResponseData.tbsView), identity.scalar!, { hash: true, der: true, publicKey: smPublic(identity.publicInfo), userId })
    response.signature = new a.BitString({ valueHex: buf(decodeMaterial(signature, 'hex')) })
  } else await response.sign(identity.key!, 'SHA-256')
  return der(new p.OCSPResponse({ responseStatus: new a.Enumerated({ value: 0 }), responseBytes: new p.ResponseBytes({ responseType: BASIC, response: new a.OctetString({ valueHex: buf(der(response)) }) }) }))
}
async function verifySignature(data: Uint8Array, signature: a.BitString, algorithm: p.AlgorithmIdentifier, signer: p.Certificate, userId: string) {
  if (signature.valueBlock.unusedBits) return false
  if (algorithm.algorithmId === O.smSign) {
    // sm-crypto's DER reader tolerates malformed tags; validate the container first.
    try {
      const value = schema(signature.valueBlock.valueHexView)
      if (!(value instanceof a.Sequence) || value.valueBlock.value.length !== 2 || value.valueBlock.value.some(item => {
        if (!(item instanceof a.Integer)) return true
        const raw = item.valueBlock.valueHexView
        return !raw.length || raw.length > 33 || !!(raw[0] & 0x80) || raw.length > 1 && raw[0] === 0 && !(raw[1] & 0x80)
      })) return false
    } catch { return false }
    return sm2.doVerifySignature(Array.from(data), bytesToHex(signature.valueBlock.valueHexView), smPublic(signer.subjectPublicKeyInfo), { hash: true, der: true, userId })
  }
  return p.getCrypto(true).verifyWithPublicKey(buf(data), signature, signer.subjectPublicKeyInfo, algorithm)
}
async function responderMatches(value: unknown, cert: p.Certificate) {
  if (value instanceof p.RelativeDistinguishedNames) return value.isEqual(cert.subject)
  if (value instanceof a.OctetString) return equal(value.valueBlock.valueHexView, new Uint8Array(await crypto.subtle.digest('SHA-1', buf(cert.subjectPublicKeyInfo.subjectPublicKey.valueBlock.valueHexView))))
  return false
}
export async function verifyOcspResponse(responseText: string, requestText: string, issuer: p.Certificate, options: { responder?: p.Certificate; target?: p.Certificate; userId?: string; certificateUserId?: string; at?: Date } = {}) {
  const request = parseRequest(requestText), userId = options.userId ?? '1234567812345678', at = options.at ?? new Date()
  await bindIssuer(request, issuer)
  const outer = new p.OCSPResponse({ schema: schema(decodeMaterial(responseText)) })
  if (outer.responseStatus.valueBlock.valueDec !== 0 || outer.responseBytes?.responseType !== BASIC) fail('需要 successful BasicOCSPResponse / Expected successful BasicOCSPResponse')
  const response = new p.BasicOCSPResponse({ schema: schema(outer.responseBytes!.response.valueBlock.valueHexView) }), data = response.tbsResponseData
  if (data.version !== undefined && data.version !== 0) fail('不支持的 OCSP 响应版本 / Unsupported OCSP response version')
  const requestNonce = nonceOf(request.tbsRequest.requestExtensions), responseNonce = nonceOf(data.responseExtensions)
  const nonceMatches = equal(requestNonce ?? new Uint8Array(), responseNonce ?? new Uint8Array())
  const requested = new Set(request.tbsRequest.requestList.map(item => certIdKey(item.reqCert)))
  const bindingValid = data.responses.length === requested.size && new Set(data.responses.map(item => certIdKey(item.certID))).size === requested.size && data.responses.every(item => requested.has(certIdKey(item.certID)))
  if (options.target) {
    await targetIssuer(options.target, issuer, options.certificateUserId ?? userId)
    if (!request.tbsRequest.requestList.some(item => serial(item.reqCert.serialNumber) === serial(options.target!.serialNumber))) fail('请求未包含目标证书 / Request does not contain target certificate')
  }
  const responses = data.responses.map(item => { extensions(item.singleExtensions); return { ...describeId(item.certID), ...describeStatus(item.certStatus), thisUpdate: item.thisUpdate.toISOString(), nextUpdate: item.nextUpdate?.toISOString() } })
  const timeValid = Number.isFinite(data.producedAt.getTime()) && data.producedAt.getTime() <= at.getTime() + 300000 && responses.every(item => {
    const start = date(item.thisUpdate), end = item.nextUpdate ? date(item.nextUpdate) : undefined
    return start <= data.producedAt && start.getTime() <= at.getTime() + 300000 && (!end || end > start && end >= at && data.producedAt <= end) && (!item.revocationTime || date(item.revocationTime) <= start)
  })
  const candidates = options.responder ? [options.responder] : [...(response.certs ?? []), issuer]
  if (candidates.length > 17) fail('响应者证书过多 / Too many responder certificates')
  let signatureValid = false, authorized = false, signerName = '', authorizationError = ''
  for (const candidate of candidates) {
    if (!await responderMatches(data.responderID, candidate)) continue
    if (!await verifySignature(data.tbsView, response.signature, response.signatureAlgorithm, candidate, userId)) continue
    signatureValid = true; signerName = name(candidate.subject)
    try { await authorizeResponder(candidate, issuer, data.producedAt, options.certificateUserId ?? userId); validAt(candidate, at); authorized = true; break }
    catch (error) { authorizationError = (error as Error).message }
  }
  return { valid: signatureValid && authorized && bindingValid && nonceMatches && timeValid, signatureValid, authorized, bindingValid, nonceMatches, noncePresent: !!requestNonce, timeValid, responder: signerName, producedAt: data.producedAt.toISOString(), responses, authorizationError,
    freshness: responses.every(item => item.nextUpdate) ? '已检查 nextUpdate / nextUpdate checked' : '无 nextUpdate 的响应无法确定新鲜度上限 / No freshness upper bound for responses without nextUpdate', scope: SCOPE,
    warning: '状态来自响应签发者；本工具生成的是用户指定状态的离线测试响应 / Status is asserted by the signer; this tool generates offline test responses with user-selected status' }
}
export async function inspectCrl(text: string, issuer: p.Certificate, target?: p.Certificate, userId = '1234567812345678', at = new Date(), certificateUserId = userId) {
  const crl = new p.CertificateRevocationList({ schema: schema(decodeMaterial(text)) })
  if (![0, 1].includes(crl.version)) fail('不支持的 CRL 版本 / Unsupported CRL version')
  const items = crl.crlExtensions?.extensions ?? []
  extensions(items, ['2.5.29.20', '2.5.29.35'])
  if (items.some(item => ['2.5.29.27', '2.5.29.28'].includes(item.extnID))) fail('当前仅支持完整直接 CRL，不支持增量、间接或限定范围 CRL / Only complete direct CRLs are supported')
  requireCa(issuer); requireUsage(issuer, 0x02, 'cRLSign'); validAt(issuer, at)
  if (target) await targetIssuer(target, issuer, certificateUserId)
  const entries = crl.revokedCertificates ?? []
  if (new Set(entries.map(item => serial(item.userCertificate))).size !== entries.length) fail('CRL 含重复序号 / Duplicate CRL serial numbers')
  for (const entry of entries) {
    extensions(entry.crlEntryExtensions?.extensions, ['2.5.29.21', '2.5.29.24'])
    if (entry.crlEntryExtensions?.extensions.some(item => item.extnID === '2.5.29.29')) fail('不支持间接 CRL 条目 / Indirect CRL entries are unsupported')
  }
  const signatureValid = crl.issuer.isEqual(issuer.subject) && equal(der(crl.signature), der(crl.signatureAlgorithm)) && await verifySignature(crl.tbsView, crl.signatureValue, crl.signatureAlgorithm, issuer, userId)
  const timeValid = crl.thisUpdate.value <= at && (!crl.nextUpdate || crl.nextUpdate.value > crl.thisUpdate.value && crl.nextUpdate.value >= at)
  const found = target ? entries.find(item => serial(item.userCertificate) === serial(target.serialNumber)) : undefined
  const reason = found?.crlEntryExtensions?.extensions.find(item => item.extnID === '2.5.29.21')
  const reasonValue = reason ? schema(reason.extnValue.valueBlock.valueHexView) : undefined
  if (reasonValue && !(reasonValue instanceof a.Enumerated)) fail('无效的 CRL 吊销原因 / Invalid CRL reason')
  return { valid: signatureValid && timeValid, signatureValid, timeValid, issuer: name(crl.issuer), thisUpdate: crl.thisUpdate.value.toISOString(), nextUpdate: crl.nextUpdate?.value.toISOString(), revokedCount: entries.length,
    targetSerial: target ? serial(target.serialNumber) : undefined, listed: target ? !!found : undefined, revocationTime: found?.revocationDate.value.toISOString(), reason: reasonValue instanceof a.Enumerated ? reasonValue.valueBlock.valueDec : undefined,
    scope: SCOPE, warning: '未列入所导入 CRL 不代表实时未吊销；本工具不获取更新 / Absence from this imported CRL does not establish current good status; updates are not fetched' }
}
export async function runRevocation(input: RevocationInput): Promise<RevocationResult> {
  if (!globalThis.crypto?.subtle) fail('需要 HTTPS 或 localhost / HTTPS or localhost required')
  if ([input.userId, input.certificateUserId ?? input.userId].some(id => new TextEncoder().encode(id).length > 8191)) fail('SM2 userId 超过 8191 字节 / SM2 userId exceeds 8191 bytes')
  if (input.mode === 'request-inspect') return { details: inspectOcspRequest(input.request), artifacts: [] }
  const issuer = certificate(input.issuer)
  if (input.mode === 'request-create') {
    const bytes = await createOcspRequest(certificate(input.target), issuer, { ...input, userId: input.certificateUserId ?? input.userId })
    return { details: inspectOcspRequest(bytesToHex(bytes)), artifacts: [{ label: 'OCSP 请求 / OCSP request', kind: 'ocsp-request', hex: bytesToHex(bytes), filename: 'request.ocsp' }] }
  }
  if (input.mode === 'response-create') {
    const responder = input.responder.trim() ? certificate(input.responder) : issuer
    const bytes = await createOcspResponse(input.request, issuer, responder, await loadIdentity(input.privateKey, input.password), { status: input.status, thisUpdate: date(input.thisUpdate), nextUpdate: input.nextUpdate ? date(input.nextUpdate) : undefined, revocationTime: input.status === 'revoked' ? date(input.revocationTime) : undefined, reason: input.reason < 0 ? undefined : input.reason, userId: input.userId, certificateUserId: input.certificateUserId })
    const details = await verifyOcspResponse(bytesToHex(bytes), input.request, issuer, { responder, userId: input.userId, certificateUserId: input.certificateUserId })
    return { valid: details.valid, details, artifacts: [{ label: '离线测试 OCSP 响应 / Offline test OCSP response', kind: 'ocsp-response', hex: bytesToHex(bytes), filename: 'test-response.ocsp' }] }
  }
  if (input.mode === 'response-verify') {
    const details = await verifyOcspResponse(input.response, input.request, issuer, { responder: input.responder.trim() ? certificate(input.responder) : undefined, target: input.target.trim() ? certificate(input.target) : undefined, userId: input.userId, certificateUserId: input.certificateUserId })
    return { valid: details.valid, details, artifacts: [] }
  }
  if (input.mode === 'crl-inspect') {
    const details = await inspectCrl(input.crl, issuer, input.target.trim() ? certificate(input.target) : undefined, input.userId, new Date(), input.certificateUserId ?? input.userId)
    return { valid: details.valid, details, artifacts: [] }
  }
  return fail('不支持的操作 / Unsupported operation')
}
