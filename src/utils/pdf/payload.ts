import * as a from 'asn1js'
import * as p from 'pkijs'
import { sm2 } from 'sm-crypto'
import { algorithm, buf, certificate, der, name, schema, smPublic, O } from '../pki/core'
import { bytesToHex, decodeMaterial } from '../crypto/material-format'
import { decodeSm2SignatureDer, encodeSm2SignatureDer } from '../crypto/asn1/sm2'
import { Sm3Stream } from '../crypto/sm3-stream'
import { PdfUnsupported, type PdfCertificateInfo, type PdfVerifyOptions } from './types'

const CMS = '1.2.840.113549.1.7.2', DATA = '1.2.840.113549.1.7.1', SM3 = '1.2.156.10197.1.401'
const hashes: Record<string, string> = { '2.16.840.1.101.3.4.2.1': 'SHA-256', '2.16.840.1.101.3.4.2.2': 'SHA-384', '2.16.840.1.101.3.4.2.3': 'SHA-512' }
const equal = (left: Uint8Array, right: Uint8Array) => left.length === right.length && left.every((byte, index) => byte === right[index])
const hashSm3 = (bytes: Uint8Array) => decodeMaterial(new Sm3Stream().update(bytes).digest(), 'hex')
function sequence(node: a.BaseBlock): a.BaseBlock[] {
  if (!(node instanceof a.Sequence)) throw new Error('签名 ASN.1 需要 SEQUENCE / Expected signature ASN.1 SEQUENCE')
  return node.valueBlock.value
}
function octets(node: a.BaseBlock): Uint8Array {
  if (!(node instanceof a.OctetString)) throw new Error('签名 ASN.1 需要 OCTET STRING / Expected signature OCTET STRING')
  return new Uint8Array(node.getValue())
}
function bits(node: a.BaseBlock): Uint8Array {
  if (!(node instanceof a.BitString) || node.valueBlock.unusedBits !== 0 || node.idBlock.isConstructed) throw new Error('签名 BIT STRING 无效 / Invalid signature BIT STRING')
  return node.valueBlock.valueHexView
}
function oid(node: a.BaseBlock) {
  if (!(node instanceof a.ObjectIdentifier)) throw new Error('签名算法 OID 无效 / Invalid signature algorithm OID')
  return node.valueBlock.toString()
}
function rawEncoding(node: a.BaseBlock) { return node.valueBeforeDecodeView.length ? node.valueBeforeDecodeView : new Uint8Array(node.toBER(false)) }
function certFrom(bytes: Uint8Array) { return new p.Certificate({ schema: schema(bytes) }) }
function supportedPublicKey(info: p.PublicKeyInfo) {
  try { return algorithm(info) }
  catch { throw new PdfUnsupported('不支持的签名者公钥算法或曲线 / Unsupported signer public key algorithm or curve') }
}
function absentOrNull(identifier: p.AlgorithmIdentifier, label: string) {
  if (identifier.algorithmParams && !(identifier.algorithmParams instanceof a.Null)) throw new Error(`${label} 参数必须缺省或 NULL / ${label} parameters must be absent or NULL`)
}
// Signed attributes require DER even when the outer CMS uses BER. Check the
// original TLVs recursively: ASN.1 libraries can preserve nonminimal lengths.
function assertDer(bytes: Uint8Array) {
  let count = 0
  const visit = (start: number, boundary: number, depth: number): number => {
    if (depth > 32 || ++count > 4096 || start + 2 > boundary) throw new Error('签名属性 DER 结构超限或不完整 / Invalid signed-attribute DER structure')
    let offset = start
    const tag = bytes[offset++]
    if ((tag & 31) === 31) {
      if (bytes[offset] === 128 || bytes[offset] < 31) throw new Error('签名属性 DER 标签不是最小编码 / Nonminimal signed-attribute DER tag')
      let width = 0
      while (offset < boundary && bytes[offset++] & 128) if (++width > 5) throw new Error('DER 标签过长 / DER tag is too long')
    }
    const encodedLength = bytes[offset++]
    let length = encodedLength
    if (encodedLength & 128) {
      const width = encodedLength & 127
      if (!width || width > 4 || offset + width > boundary || bytes[offset] === 0) throw new Error('签名属性 DER 长度无效 / Invalid signed-attribute DER length')
      length = 0
      for (let index = 0; index < width; index++) length = length * 256 + bytes[offset++]
      if (length < 128) throw new Error('签名属性 DER 长度不是最小编码 / Nonminimal signed-attribute DER length')
    }
    const end = offset + length
    if (end > boundary) throw new Error('签名属性 DER 数据不完整 / Truncated signed-attribute DER')
    if (tag & 32) {
      let previous: Uint8Array | undefined
      while (offset < end) {
        const next = visit(offset, end, depth + 1), current = bytes.subarray(offset, next)
        if (tag === 49 && previous && bytesToHex(previous) > bytesToHex(current)) throw new Error('签名属性 DER SET 排序无效 / Invalid signed-attribute DER SET ordering')
        previous = current; offset = next
      }
    }
    return end
  }
  if (visit(0, bytes.length, 0) !== bytes.length) throw new Error('签名属性 DER 有多余数据 / Trailing signed-attribute DER data')
}

export function requireSupportedSubFilter(subFilter: string) {
  if (!['adbe.pkcs7.detached', 'ETSI.CAdES.detached', 'GM.sm2seal'].includes(subFilter)) throw new PdfUnsupported(`不支持 PDF SubFilter: ${subFilter || '(missing)'} / Unsupported PDF SubFilter`)
}

export function unpadSignature(bytes: Uint8Array) {
  if (!bytes.length || bytes.length > 4 * 1024 * 1024) throw new PdfUnsupported('签名容器为空或超过 4 MB / Signature container is empty or exceeds 4 MB')
  const result = a.fromBER(buf(bytes))
  if (result.offset <= 0 || !(result.result instanceof a.Sequence)) throw new Error('Contents 不是有效 ASN.1 签名 / Contents is not a valid ASN.1 signature')
  if (!bytes.subarray(result.offset).every(byte => byte === 0)) throw new Error('签名后存在非零填充 / Nonzero bytes follow the signature object')
  return bytes.slice(0, result.offset)
}

export async function describeCertificate(cert: p.Certificate): Promise<PdfCertificateInfo> {
  const encoded = der(cert)
  let kind = cert.subjectPublicKeyInfo.algorithm.algorithmId
  try { kind = algorithm(cert.subjectPublicKeyInfo) } catch { /* Show unknown algorithm without implying support. */ }
  return { subject: name(cert.subject), issuer: name(cert.issuer), serialNumber: bytesToHex(cert.serialNumber.valueBlock.valueHexView), algorithm: kind,
    validFrom: cert.notBefore.value.toISOString(), validTo: cert.notAfter.value.toISOString(), withinValidity: new Date() >= cert.notBefore.value && new Date() <= cert.notAfter.value,
    sha256: bytesToHex(new Uint8Array(await crypto.subtle.digest('SHA-256', buf(encoded)))), hex: bytesToHex(encoded) }
}

function selectedSm2Key(cert: p.Certificate | undefined, options: PdfVerifyOptions): string {
  if (cert) supportedPublicKey(cert.subjectPublicKeyInfo)
  const fromCert = cert ? smPublic(cert.subjectPublicKeyInfo) : undefined
  let supplied: string | undefined
  if (options.publicKey?.trim()) {
    const bytes = decodeMaterial(options.publicKey)
    if (bytes.length === 64 || bytes.length === 65) {
      supplied = (bytes.length === 64 ? '04' : '') + bytesToHex(bytes)
      if (!(sm2 as typeof sm2 & { verifyPublicKey: (key: string) => boolean }).verifyPublicKey(supplied)) throw new Error('无效 SM2 公钥 / Invalid SM2 public key')
    } else {
      const info = new p.PublicKeyInfo({ schema: schema(bytes) })
      supportedPublicKey(info); supplied = smPublic(info)
    }
  }
  if (supplied && fromCert && supplied.toLowerCase() !== fromCert.toLowerCase()) throw new Error('输入公钥与签名证书不匹配 / Supplied public key differs from signer certificate')
  if (!supplied && !fromCert) throw new PdfUnsupported('缺少签名者证书或公钥 / Signer certificate or public key is required')
  return supplied ?? fromCert!
}
function checkExternalCertificate(cert: p.Certificate | undefined, external: p.Certificate | undefined) {
  if (cert && external && !equal(der(cert), der(external))) throw new Error('输入证书与内嵌签名者证书不一致 / Supplied certificate differs from embedded signer certificate')
}
function strictDsaSignature(signature: Uint8Array) {
  const values = sequence(schema(signature))
  if (values.length !== 2) throw new Error('签名必须包含两个整数 / Signature must contain two integers')
  for (const value of values) {
    if (!(value instanceof a.Integer)) throw new Error('签名分量必须为整数 / Signature components must be integers')
    const bytes = value.valueBlock.valueHexView
    if (!bytes.length || bytes.length > 67 || bytes[0] & 0x80 || bytes.every(byte => byte === 0) || bytes.length > 1 && bytes[0] === 0 && !(bytes[1] & 0x80)) throw new Error('签名整数不是规范正整数 / Signature integer is not a canonical positive integer')
  }
  // Re-encoding without decoded long-form lengths enforces minimal DER lengths.
  const canonical = new Uint8Array(new a.Sequence({ value: values.map(value => new a.Integer({ valueHex: buf((value as a.Integer).valueBlock.valueHexView) })) }).toBER(false))
  if (!equal(canonical, signature)) throw new Error('签名不是规范 DER / Signature is not canonical DER')
}
function sm2Verify(content: Uint8Array, signature: Uint8Array, key: string, userId?: string, allowRaw = false) {
  let raw = signature
  if (!allowRaw || signature.length !== 64) {
    strictDsaSignature(signature)
    const { r, s } = decodeSm2SignatureDer(signature)
    if (!equal(encodeSm2SignatureDer({ r, s }), signature)) throw new Error('SM2 签名不是规范 DER / SM2 signature is not canonical DER')
    raw = new Uint8Array(64); raw.set(r); raw.set(s, 32)
  }
  const order = BigInt('0xfffffffeffffffffffffffffffffffff7203df6b21c6052b53bbf40939d54123')
  for (const part of [raw.subarray(0, 32), raw.subarray(32)]) {
    const value = BigInt('0x' + bytesToHex(part))
    if (value <= 0n || value >= order) throw new Error('SM2 签名整数越界 / SM2 signature component out of range')
  }
  return sm2.doVerifySignature(Array.from(content), bytesToHex(raw), key, { hash: true, der: false, userId })
}

export interface PayloadResult { format: 'CMS' | 'SES' | 'RAW_SM2'; valid: boolean; contentValid: boolean; certificates: p.Certificate[]; warnings: string[] }

async function verifyCms(encoded: Uint8Array, content: Uint8Array, options: PdfVerifyOptions): Promise<PayloadResult> {
  const info = new p.ContentInfo({ schema: schema(encoded) }), signed = new p.SignedData({ schema: info.content })
  if (signed.encapContentInfo.eContent) throw new PdfUnsupported('PDF 当前仅支持分离式 CMS / Only detached CMS is supported for PDF')
  if (signed.encapContentInfo.eContentType !== DATA) throw new PdfUnsupported('不支持 CMS 原文类型 / Unsupported CMS content type')
  if (!signed.signerInfos.length || signed.signerInfos.length > 16) throw new PdfUnsupported('CMS 签名者须为 1 至 16 个 / CMS must have 1 to 16 signers')
  const candidates = (signed.certificates ?? []).filter((value): value is p.Certificate => value instanceof p.Certificate)
  if (candidates.length > 64) throw new PdfUnsupported('CMS 证书数量超过 64 / Too many CMS certificates')
  const external = options.certificate?.trim() ? certificate(options.certificate) : undefined
  const certificates: p.Certificate[] = [], warnings: string[] = []
  const unsupported: string[] = []
  const digestIds = new Set<string>()
  for (const identifier of signed.digestAlgorithms) {
    absentOrNull(identifier, 'CMS digestAlgorithms')
    if (digestIds.has(identifier.algorithmId)) throw new Error('CMS 摘要算法集合包含重复算法 / Duplicate CMS digest algorithm')
    digestIds.add(identifier.algorithmId)
  }
  let valid = true, contentValid = true
  for (const signer of signed.signerInfos) {
    try {
    if (!(signer.sid instanceof p.IssuerAndSerialNumber)) throw new PdfUnsupported('暂不支持 CMS 的该签名者标识 / Unsupported CMS signer identifier')
    const sid = signer.sid
    const matches = candidates.filter(cert => cert.issuer.isEqual(sid.issuer) && cert.serialNumber.isEqual(sid.serialNumber))
    if (matches.length > 1) throw new Error('CMS 签名者证书不唯一 / Ambiguous CMS signer certificate')
    let cert = matches[0]
    if (external) {
      if (signed.signerInfos.length !== 1) throw new PdfUnsupported('外部证书覆盖仅适用于单签名者 CMS / External certificate requires a single CMS signer')
      if (!external.issuer.isEqual(sid.issuer) || !external.serialNumber.isEqual(sid.serialNumber)) throw new Error('输入证书不匹配 CMS 签名者 / Supplied certificate does not match CMS signer')
      checkExternalCertificate(cert, external); cert ??= external
    }
    if (cert) certificates.push(cert)
    const digestOid = signer.digestAlgorithm.algorithmId, hash = hashes[digestOid]
    if (digestOid !== SM3 && !hash) throw new PdfUnsupported(`不支持 CMS 摘要算法 ${digestOid} / Unsupported CMS digest`)
    if (!digestIds.has(digestOid)) throw new Error('CMS 摘要算法集合不一致 / CMS digest algorithm set mismatch')
    absentOrNull(signer.digestAlgorithm, 'CMS signer digest')
    const digest = digestOid === SM3 ? hashSm3(content) : new Uint8Array(await crypto.subtle.digest(hash, buf(content)))
    let message = content
    if (signer.signedAttrs) {
      const attributes = signer.signedAttrs.attributes
      const digests = attributes.filter(attr => attr.type === '1.2.840.113549.1.9.4'), types = attributes.filter(attr => attr.type === '1.2.840.113549.1.9.3')
      if (digests.length !== 1 || digests[0].values.length !== 1 || types.length !== 1 || types[0].values.length !== 1 || oid(types[0].values[0]) !== DATA) throw new Error('CMS 必需签名属性无效 / Invalid required CMS signed attributes')
      if (!equal(octets(digests[0].values[0]), digest)) contentValid = false
      const sorted = attributes.map(attr => ({ node: attr.toSchema(), bytes: bytesToHex(der(attr)) })).sort((left, right) => left.bytes < right.bytes ? -1 : left.bytes > right.bytes ? 1 : 0)
      const canonical = new Uint8Array(new a.Set({ value: sorted.map(item => item.node) }).toBER(false))
      message = new Uint8Array(signer.signedAttrs.encodedValue)
      assertDer(message)
      if (!equal(message, canonical)) throw new Error('CMS 签名属性不符合规范 DER / CMS signed attributes are not canonical DER')
    }
    const signature = new Uint8Array(signer.signature.getValue()), signatureOid = signer.signatureAlgorithm.algorithmId
    if (signatureOid === O.smSign) {
      if (digestOid !== SM3 || signer.signatureAlgorithm.algorithmParams && !(signer.signatureAlgorithm.algorithmParams instanceof a.Null)) throw new PdfUnsupported('不支持 SM2 CMS 算法组合 / Unsupported SM2 CMS algorithms')
      valid = sm2Verify(message, signature, selectedSm2Key(cert, options), options.userId) && valid
    } else {
      if (!cert) throw new PdfUnsupported('RSA/ECDSA CMS 需要匹配的证书 / RSA/ECDSA CMS requires a matching certificate')
      if (options.publicKey?.trim()) throw new PdfUnsupported('RSA/ECDSA CMS 请使用证书输入 / Use certificate input for RSA/ECDSA CMS')
      const kind = supportedPublicKey(cert.subjectPublicKeyInfo)
      const combinations: Record<string, [string, string]> = {
        '1.2.840.113549.1.1.11': ['RSA', 'SHA-256'], '1.2.840.113549.1.1.12': ['RSA', 'SHA-384'], '1.2.840.113549.1.1.13': ['RSA', 'SHA-512'],
        '1.2.840.10045.4.3.2': ['ECDSA', 'SHA-256'], '1.2.840.10045.4.3.3': ['ECDSA', 'SHA-384'], '1.2.840.10045.4.3.4': ['ECDSA', 'SHA-512'],
      }
      const genericRsa = signatureOid === O.rsa && kind === 'RSA' && !!hash
      const pair = combinations[signatureOid]
      const pss = signatureOid === '1.2.840.113549.1.1.10'
      if (pss) {
        if (kind !== 'RSA' || !hash || !signer.signatureAlgorithm.algorithmParams) throw new PdfUnsupported('不支持 RSA-PSS CMS 参数 / Unsupported RSA-PSS CMS parameters')
        const params = new p.RSASSAPSSParams({ schema: signer.signatureAlgorithm.algorithmParams })
        const mgf = new p.AlgorithmIdentifier({ schema: params.maskGenAlgorithm.algorithmParams })
        absentOrNull(params.hashAlgorithm, 'RSA-PSS hash')
        absentOrNull(mgf, 'RSA-PSS MGF hash')
        if (params.hashAlgorithm.algorithmId !== digestOid || params.maskGenAlgorithm.algorithmId !== '1.2.840.113549.1.1.8' || mgf.algorithmId !== digestOid || !Number.isSafeInteger(params.saltLength) || params.saltLength < 0 || params.saltLength > 512 || params.trailerField !== 1) throw new PdfUnsupported('不支持 RSA-PSS 参数组合 / Unsupported RSA-PSS parameter combination')
      } else if (!genericRsa && (!pair || pair[0] !== kind || pair[1] !== hash)) throw new PdfUnsupported('不支持 CMS 签名/摘要算法组合 / Unsupported CMS signature/digest combination')
      if (!pss && signer.signatureAlgorithm.algorithmParams && !(signer.signatureAlgorithm.algorithmParams instanceof a.Null)) throw new PdfUnsupported('不支持 CMS 签名算法参数 / Unsupported CMS signature parameters')
      if (kind === 'ECDSA') {
        if (signer.signatureAlgorithm.algorithmParams) throw new Error('ECDSA 签名算法参数必须缺省 / ECDSA signature parameters must be absent')
        strictDsaSignature(signature)
      }
      valid = await p.getCrypto(true).verifyWithPublicKey(buf(message), new a.OctetString({ valueHex: buf(signature) }), cert.subjectPublicKeyInfo, signer.signatureAlgorithm, hash) && valid
    }
    if (signer.unsignedAttrs?.attributes.length) warnings.push('CMS 未签名属性（含可能的时间戳）未作信任判断 / CMS unsigned attributes and timestamps were not evaluated for trust')
    } catch (error) {
      const message = error instanceof Error ? error.message : 'CMS 签名者验证失败 / CMS signer verification failed'
      if (error instanceof PdfUnsupported) unsupported.push(message)
      else { valid = false; warnings.push(message) }
    }
  }
  // A known invalid signer/digest always wins over another unsupported signer,
  // regardless of their order. Still inspect every signer before aggregating.
  if (unsupported.length) {
    if (valid && contentValid) throw new PdfUnsupported([...new Set(unsupported)].join('; '))
    warnings.push(...unsupported)
  }
  return { format: 'CMS', valid, contentValid, certificates, warnings }
}

export async function verifyPayload(encoded: Uint8Array, content: Uint8Array, subFilter: string, embedded: Uint8Array | undefined, options: PdfVerifyOptions): Promise<PayloadResult> {
  requireSupportedSubFilter(subFilter)
  const structure = schema(encoded), fields = sequence(structure)
  if (['adbe.pkcs7.detached', 'ETSI.CAdES.detached'].includes(subFilter)) {
    if (!(fields[0] instanceof a.ObjectIdentifier) || oid(fields[0]) !== CMS) throw new Error('SubFilter 与 CMS 签名封装不匹配 / SubFilter does not match CMS payload')
    const result = await verifyCms(encoded, content, options)
    if (subFilter === 'ETSI.CAdES.detached') result.warnings.push('仅验证 CMS 密码签名；CAdES 策略和长期验证属性未评估 / CMS signature only; CAdES policy and long-term attributes not evaluated')
    return result
  }
  if (subFilter !== 'GM.sm2seal') throw new PdfUnsupported(`不支持 PDF SubFilter: ${subFilter || '(missing)'} / Unsupported PDF SubFilter`)
  const external = options.certificate?.trim() ? certificate(options.certificate) : undefined
  if (fields.length === 2 && fields.every(field => field instanceof a.Integer)) {
    const cert = embedded ? certFrom(embedded) : external
    checkExternalCertificate(cert, external)
    decodeSm2SignatureDer(encoded)
    return { format: 'RAW_SM2', valid: sm2Verify(hashSm3(content), encoded, selectedSm2Key(cert, options), options.userId), contentValid: true, certificates: cert ? [cert] : [], warnings: ['历史裸 SM2 格式，对 PDF 摘要作为 SM2 消息验签 / Legacy raw SM2 signature over the PDF digest'] }
  }
  if (fields.length < 4 || !(fields[0] instanceof a.Sequence)) throw new PdfUnsupported('不支持该国密 PDF 签名封装 / Unsupported GM PDF signature payload')
  if (fields.length > 4) throw new PdfUnsupported('暂不支持带额外字段的 SES 签名 / Extended SES signature fields are unsupported')
  const tbs = sequence(fields[0]), cert = certFrom(octets(fields[1]))
  checkExternalCertificate(cert, external)
  if (tbs.length !== 5 || !(tbs[0] instanceof a.Integer) || tbs[0].valueBlock.valueDec !== 4 || oid(fields[2]) !== O.smSign) throw new PdfUnsupported('当前仅支持版本 4 的 SM2/SM3 SES / Only version 4 SM2/SM3 SES is supported')
  if (!(tbs[1] instanceof a.Sequence) || !(tbs[2] instanceof a.GeneralizedTime) || !(tbs[4] instanceof a.IA5String)) throw new Error('SES 签章信息结构无效 / Invalid SES to-sign fields')
  const recordedHash = bits(tbs[3]), length = tbs[4].valueBlock.value
  if (recordedHash.length !== 32 || !/^\d+$/.test(length) || Number(length) !== content.length) throw new Error('SES 原文长度或摘要字段无效 / Invalid SES content length/digest')
  const warnings = ['SES 外层签名与原文摘要已检查；印章制章签名、授权及有效期未检查 / SES outer signature and digest checked; seal maker signature, authorization and validity not checked', 'SES 签署时间为签名者声明时间，不是可信时间戳 / SES signing time is signer-declared, not a trusted timestamp']
  return { format: 'SES', valid: sm2Verify(rawEncoding(fields[0]), bits(fields[3]), selectedSm2Key(cert, options), options.userId, true), contentValid: equal(recordedHash, hashSm3(content)), certificates: [cert], warnings }
}
