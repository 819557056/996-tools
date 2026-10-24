import * as a from 'asn1js'
import * as p from 'pkijs'
import { sm2 } from 'sm-crypto'
import { bytesToHex, decodeMaterial, encodeSm2KeyDer, formatMaterial } from '../crypto/material-format'
import { convertRawCipherToAsn1, convertAsn1ToRawCipher } from '../crypto/asn1/sm2'
import { MAX_CONTENT_BYTES, MAX_ENCODED_BYTES } from './limits'

export const O = { rsa: '1.2.840.113549.1.1.1', ec: '1.2.840.10045.2.1', sm2: '1.2.156.10197.1.301', smSign: '1.2.156.10197.1.501', rsaSign: '1.2.840.113549.1.1.11', ecSign: '1.2.840.10045.4.3.2' }
export type Algorithm = 'SM2' | 'RSA' | 'ECDSA'
export interface Identity { algorithm: Algorithm; privateDer: Uint8Array; publicInfo: p.PublicKeyInfo; key?: CryptoKey; scalar?: string }
export const buf = (bytes: Uint8Array): ArrayBuffer => Uint8Array.from(bytes).buffer
export const der = (value: { toSchema: () => a.BaseBlock }): Uint8Array => new Uint8Array(value.toSchema().toBER(false))
export const pem = (bytes: Uint8Array, header: string) => formatMaterial(bytes, { encoding: 'base64', header, lineLength: 64 })
export function schema(bytes: Uint8Array, maxBytes = MAX_CONTENT_BYTES) {
  if (!bytes.length || bytes.length > maxBytes) throw new Error(`材料为空或超过 ${maxBytes} 字节 / Empty material or larger than ${maxBytes} bytes`)
  const result = a.fromBER(buf(bytes))
  if (result.offset !== bytes.length) throw new Error('无效的 ASN.1 或包含多余数据 / Invalid ASN.1 or trailing bytes')
  return result.result
}
export function certificates(text: string): p.Certificate[] {
  const blocks = text.match(/-----BEGIN CERTIFICATE-----[\s\S]*?-----END CERTIFICATE-----/g)
  if (blocks && text.replace(/-----BEGIN CERTIFICATE-----[\s\S]*?-----END CERTIFICATE-----/g, '').trim()) throw new Error('证书包中包含无效内容 / Invalid certificate bundle')
  const items = blocks ?? [text]
  if (items.length > 16) throw new Error('最多 16 张证书 / At most 16 certificates')
  return items.map(item => new p.Certificate({ schema: schema(decodeMaterial(item)) }))
}
export function certificate(text: string): p.Certificate {
  const list = certificates(text)
  if (list.length !== 1) throw new Error('此处需要单张证书 / One certificate required')
  return list[0]
}
export function algorithm(info: p.PublicKeyInfo | p.AlgorithmIdentifier): Algorithm {
  const alg = info instanceof p.PublicKeyInfo ? info.algorithm : info
  if (alg.algorithmId === O.rsa) return 'RSA'
  if (alg.algorithmId === O.ec && alg.algorithmParams instanceof a.ObjectIdentifier) {
    const curve = alg.algorithmParams.valueBlock.toString()
    if (curve === O.sm2) return 'SM2'
    if (['1.2.840.10045.3.1.7', '1.3.132.0.34', '1.3.132.0.35'].includes(curve)) return 'ECDSA'
  }
  throw new Error('不支持的公钥算法或曲线 / Unsupported public key algorithm or curve')
}
export function smPublic(info: p.PublicKeyInfo) {
  if (algorithm(info) !== 'SM2') throw new Error('需要 SM2 公钥 / SM2 public key required')
  const hex = bytesToHex(info.subjectPublicKey.valueBlock.valueHexView)
  if (hex.length !== 130 || !hex.startsWith('04') || !(sm2 as typeof sm2 & { verifyPublicKey: (key: string) => boolean }).verifyPublicKey(hex)) throw new Error('无效的 SM2 公钥 / Invalid SM2 point')
  return hex
}
const curves: Record<string, string> = { '1.2.840.10045.3.1.7': 'P-256', '1.3.132.0.34': 'P-384', '1.3.132.0.35': 'P-521' }
function wrapPrivateKey(privateKey: Uint8Array, alg: p.AlgorithmIdentifier) {
  return new Uint8Array(new a.Sequence({ value: [new a.Integer({ value: 0 }), alg.toSchema(), new a.OctetString({ valueHex: buf(privateKey) })] }).toBER(false))
}
function ecPrivateKey(bytes: Uint8Array, expectedCurve?: string) {
  const node = schema(bytes)
  if (!(node instanceof a.Sequence)) throw new Error('无效的 EC 私钥 / Invalid EC private key')
  const values = node.valueBlock.value
  if (!(values[0] instanceof a.Integer) || values[0].valueBlock.valueDec !== 1 || !(values[1] instanceof a.OctetString) || values.length > 4) throw new Error('无效的 EC 私钥 / Invalid EC private key')
  let curve: string | undefined, publicPoint: Uint8Array | undefined
  for (const value of values.slice(2)) {
    if (!(value instanceof a.Constructed) || value.idBlock.tagClass !== 3 || value.valueBlock.value.length !== 1) throw new Error('无效的 EC 私钥参数 / Invalid EC private key parameters')
    const inner = value.valueBlock.value[0]
    if (value.idBlock.tagNumber === 0 && curve === undefined && publicPoint === undefined && inner instanceof a.ObjectIdentifier) curve = inner.valueBlock.toString()
    else if (value.idBlock.tagNumber === 1 && publicPoint === undefined && inner instanceof a.BitString && inner.valueBlock.unusedBits === 0) publicPoint = inner.valueBlock.valueHexView
    else throw new Error('无效的 EC 私钥参数 / Invalid EC private key parameters')
  }
  if (expectedCurve && curve && curve !== expectedCurve) throw new Error('EC 私钥内外曲线不一致 / EC curve parameters do not match')
  curve ??= expectedCurve
  if (!curve) throw new Error('SEC1 私钥必须包含命名曲线 / SEC1 key must include a named curve')
  if (curve !== O.sm2 && !curves[curve]) throw new Error('不支持的 EC 曲线 / Unsupported EC curve')
  return { curve, scalar: values[1].valueBlock.valueHexView, publicPoint }
}
async function decryptPrivateKey(node: a.Sequence, password: string) {
  const encrypted = new p.PKCS8ShroudedKeyBag({ schema: node })
  if (encrypted.encryptionAlgorithm.algorithmId !== '1.2.840.113549.1.5.13') throw new Error('加密私钥仅支持 PBES2 / Encrypted keys require PBES2')
  const params = new p.PBES2Params({ schema: encrypted.encryptionAlgorithm.algorithmParams })
  if (params.keyDerivationFunc.algorithmId !== '1.2.840.113549.1.5.12') throw new Error('加密私钥仅支持 PBKDF2 / Encrypted keys require PBKDF2')
  const kdf = new p.PBKDF2Params({ schema: params.keyDerivationFunc.algorithmParams })
  const aesLengths: Record<string, number> = { '2.16.840.1.101.3.4.1.2': 16, '2.16.840.1.101.3.4.1.22': 24, '2.16.840.1.101.3.4.1.42': 32 }
  const keyLength = aesLengths[params.encryptionScheme.algorithmId]
  if (!keyLength) throw new Error('加密私钥仅支持 AES-CBC / Encrypted keys require AES-CBC')
  if (kdf.prf && !['1.2.840.113549.2.7', '1.2.840.113549.2.9', '1.2.840.113549.2.10', '1.2.840.113549.2.11'].includes(kdf.prf.algorithmId)) throw new Error('不支持的 PBKDF2 摘要 / Unsupported PBKDF2 hash')
  const iv = params.encryptionScheme.algorithmParams
  if (!(kdf.salt instanceof a.OctetString) || !kdf.salt.valueBlock.valueHexView.length || kdf.salt.valueBlock.valueHexView.length > 1024 || !Number.isSafeInteger(kdf.iterationCount) || kdf.iterationCount < 1 || kdf.iterationCount > 10000000 || (kdf.keyLength !== undefined && kdf.keyLength !== keyLength) || !(iv instanceof a.OctetString) || iv.valueBlock.valueHexView.length !== 16 || !encrypted.encryptedData.valueBlock.valueHexView.length || encrypted.encryptedData.valueBlock.valueHexView.length % 16) throw new Error('无效的加密私钥参数（PBKDF2 迭代上限为 1000 万）/ Invalid encrypted key parameters (PBKDF2 maximum 10 million iterations)')
  const passwordBytes = new TextEncoder().encode(password)
  const passwordBuffer = buf(passwordBytes)
  try {
    const data = new p.EncryptedData({ encryptedContentInfo: new p.EncryptedContentInfo({ contentEncryptionAlgorithm: encrypted.encryptionAlgorithm, encryptedContent: encrypted.encryptedData }) })
    return new Uint8Array(await data.decrypt({ password: passwordBuffer }))
  } catch {
    throw new Error('私钥口令错误或加密数据损坏 / Incorrect private key password or corrupted encrypted key')
  } finally {
    passwordBytes.fill(0)
    new Uint8Array(passwordBuffer).fill(0)
  }
}
export async function loadIdentity(text: string, password = ''): Promise<Identity> {
  let bytes = decodeMaterial(text)
  if (bytes.length === 32) bytes = encodeSm2KeyDer(bytes, 'sm2-private')
  let node = schema(bytes)
  if (!(node instanceof a.Sequence)) throw new Error('需要 PKCS#8、PKCS#1 或 SEC1 私钥 / PKCS#8, PKCS#1 or SEC1 private key required')
  if (node.valueBlock.value.length === 2 && node.valueBlock.value[0] instanceof a.Sequence && node.valueBlock.value[1] instanceof a.OctetString) {
    bytes = await decryptPrivateKey(node, password)
    node = schema(bytes)
    if (!(node instanceof a.Sequence)) throw new Error('解密后的私钥无效 / Invalid decrypted private key')
  }
  let values = node.valueBlock.value
  // RSA PKCS#1 can be wrapped losslessly as PKCS#8.
  if (values.length === 9 && values.every(value => value instanceof a.Integer) && (values[0] as a.Integer).valueBlock.valueDec === 0) {
    bytes = wrapPrivateKey(bytes, new p.AlgorithmIdentifier({ algorithmId: O.rsa, algorithmParams: new a.Null() }))
    values = (schema(bytes) as a.Sequence).valueBlock.value
  } else if (values[0] instanceof a.Integer && values[1] instanceof a.OctetString) {
    const ec = ecPrivateKey(bytes)
    bytes = wrapPrivateKey(bytes, new p.AlgorithmIdentifier({ algorithmId: O.ec, algorithmParams: new a.ObjectIdentifier({ value: ec.curve }) }))
    values = (schema(bytes) as a.Sequence).valueBlock.value
  }
  if (!(values[0] instanceof a.Integer) || values[0].valueBlock.valueDec !== 0 || !(values[1] instanceof a.Sequence) || !(values[2] instanceof a.OctetString)) throw new Error('需要 PKCS#8 私钥（SM2 也可输入裸 Hex）/ PKCS#8 required (SM2 raw Hex also accepted)')
  // Validate the container without PKI.js's EC decoder, which does not know SM2.
  if (values.length > 4 || !a.compareSchema(schema(bytes), schema(bytes), p.PrivateKeyInfo.schema()).verified) throw new Error('无效的 PKCS#8 私钥结构 / Invalid PKCS#8 private key structure')
  const alg = new p.AlgorithmIdentifier({ schema: values[1] })
  const kind = algorithm(alg)
  if (kind === 'RSA') new p.RSAPrivateKey({ schema: schema(values[2].valueBlock.valueHexView) })
  const ec = kind === 'RSA' ? undefined : ecPrivateKey(values[2].valueBlock.valueHexView, (alg.algorithmParams as a.ObjectIdentifier).valueBlock.toString())
  if (kind === 'SM2') {
    const scalar = bytesToHex(ec!.scalar)
    encodeSm2KeyDer(decodeMaterial(scalar, 'hex'), 'sm2-private')
    const publicInfo = new p.PublicKeyInfo({ schema: schema(encodeSm2KeyDer(decodeMaterial(sm2.getPublicKeyFromPrivateKey(scalar), 'hex'), 'sm2-public')) })
    if (ec!.publicPoint) {
      const publicHex = smPublic(publicInfo)
      const compressed = `${parseInt(publicHex.slice(-2), 16) % 2 ? '03' : '02'}${publicHex.slice(2, 66)}`
      const supplied = bytesToHex(ec!.publicPoint)
      if (supplied !== publicHex && supplied !== compressed) throw new Error('EC 公私钥不匹配 / EC public and private keys do not match')
    }
    return { algorithm: kind, privateDer: bytes, scalar, publicInfo }
  }
  const params = kind === 'RSA' ? { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' } : { name: 'ECDSA', namedCurve: curves[(alg.algorithmParams as a.ObjectIdentifier).valueBlock.toString()] }
  const key = await crypto.subtle.importKey('pkcs8', buf(bytes), params, true, ['sign'])
  const jwk = await crypto.subtle.exportKey('jwk', key)
  const publicJwk: JsonWebKey = kind === 'RSA' ? { kty: jwk.kty, n: jwk.n, e: jwk.e, ext: true } : { kty: jwk.kty, crv: jwk.crv, x: jwk.x, y: jwk.y, ext: true }
  const publicKey = await crypto.subtle.importKey('jwk', publicJwk, params, true, ['verify'])
  const publicInfo = new p.PublicKeyInfo({ schema: schema(new Uint8Array(await crypto.subtle.exportKey('spki', publicKey))) })
  const challenge = crypto.getRandomValues(new Uint8Array(32))
  const signing = kind === 'RSA' ? { name: 'RSASSA-PKCS1-v1_5' } : { name: 'ECDSA', hash: 'SHA-256' }
  const signature = await crypto.subtle.sign(signing, key, challenge)
  if (!await crypto.subtle.verify(signing, publicKey, signature, challenge)) throw new Error('公私钥不匹配 / Public and private keys do not match')
  return { algorithm: kind, privateDer: bytes, key, publicInfo }
}
export async function generateIdentity(kind: Algorithm, rsaBits = 2048): Promise<Identity> {
  if (kind === 'SM2') {
    // Use the browser CSPRNG explicitly, including on browsers without legacy window.crypto adapters.
    for (;;) {
      const scalar = crypto.getRandomValues(new Uint8Array(32))
      try { encodeSm2KeyDer(scalar, 'sm2-private') } catch { continue }
      return loadIdentity(bytesToHex(scalar))
    }
  }
  if (![2048, 3072, 4096].includes(rsaBits)) throw new Error('RSA 位长必须为 2048、3072 或 4096 / Invalid RSA size')
  const params = kind === 'RSA' ? { name: 'RSASSA-PKCS1-v1_5', modulusLength: rsaBits, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' } : { name: 'ECDSA', namedCurve: 'P-256' }
  const keys = await crypto.subtle.generateKey(params, true, ['sign', 'verify']) as CryptoKeyPair
  return loadIdentity(pem(new Uint8Array(await crypto.subtle.exportKey('pkcs8', keys.privateKey)), 'PRIVATE KEY'))
}
export interface SubjectOptions { commonName: string; organization?: string; country?: string; sans?: string; ca?: boolean; days?: number }
function subject(options: SubjectOptions) {
  if (!options.commonName.trim()) throw new Error('请填写通用名称 CN / Common name is required')
  if (options.country && !/^[A-Z]{2}$/.test(options.country)) throw new Error('国家为两个大写字母 / Country must be two uppercase letters')
  const attributes = [['2.5.4.3', options.commonName], ['2.5.4.10', options.organization], ['2.5.4.6', options.country]]
    .filter(([, value]) => value)
    .map(([type, value]) => new p.AttributeTypeAndValue({ type: type!, value: type === '2.5.4.6' ? new a.PrintableString({ value: value! }) : new a.Utf8String({ value: value! }) }))
  // Each attribute is a separate RDN. PKI.js's typesAndValues constructor puts
  // them in one unsorted SET, which changes the signed bytes on DER re-encoding.
  const sequence = new a.Sequence({ value: attributes.map(attribute => new a.Set({ value: [attribute.toSchema()] })) })
  // Parsing the encoded sequence populates valueBeforeDecodeView, which PKI.js
  // uses to preserve the RDN grouping when it serializes the signed structure.
  return new p.RelativeDistinguishedNames({ schema: schema(new Uint8Array(sequence.toBER(false))) })
}
export function extensions(options: SubjectOptions, kind: Algorithm): p.Extension[] {
  const ext = [new p.Extension({ extnID: '2.5.29.19', critical: true, extnValue: new p.BasicConstraints({ cA: !!options.ca }).toSchema().toBER(false) }), new p.Extension({ extnID: '2.5.29.15', critical: true, extnValue: new a.BitString({ unusedBits: options.ca ? 1 : kind === 'ECDSA' ? 7 : 5, valueHex: new Uint8Array([options.ca ? 0x86 : kind === 'ECDSA' ? 0x80 : 0xa0]).buffer }).toBER(false) })]
  const names = (options.sans ?? '').split(/\r?\n/).map(v => v.trim()).filter(Boolean).map(value => {
    const split = value.indexOf(':'); const prefix = value.slice(0, split).toLowerCase(); const name = value.slice(split + 1)
    if (prefix === 'ip') {
      const octets = name.split('.')
      if (octets.length !== 4 || octets.some(v => !/^(0|[1-9]\d{0,2})$/.test(v) || Number(v) > 255)) throw new Error('IP SAN 当前支持 IPv4 / IP SAN currently supports IPv4')
      return new p.GeneralName({ type: 7, value: new a.OctetString({ valueHex: new Uint8Array(octets.map(Number)).buffer }) })
    }
    if (!['dns', 'email'].includes(prefix) || !name || /[^\x21-\x7e]/.test(name)) throw new Error('SAN 使用 dns:example.com、ip:127.0.0.1 或 email:a@b.com / Invalid SAN')
    return new p.GeneralName({ type: prefix === 'dns' ? 2 : 1, value: name })
  })
  if (names.length) ext.push(new p.Extension({ extnID: '2.5.29.17', extnValue: new p.GeneralNames({ names }).toSchema().toBER(false) }))
  return ext
}
async function signObject(object: p.Certificate | p.CertificationRequest, identity: Identity, userId = '1234567812345678') {
  if (identity.algorithm !== 'SM2') { await object.sign(identity.key!, 'SHA-256'); return }
  object.signatureAlgorithm = new p.AlgorithmIdentifier({ algorithmId: O.smSign })
  if (object instanceof p.Certificate) object.signature = object.signatureAlgorithm
  object.tbsView = new Uint8Array(object.toSchema(true).valueBlock.value[0].toBER(false))
  const signature = sm2.doSignature(Array.from(object.tbsView), identity.scalar!, { hash: true, der: true, publicKey: smPublic(identity.publicInfo), userId })
  object.signatureValue = new a.BitString({ valueHex: buf(decodeMaterial(signature, 'hex')) })
}
export async function createCsr(identity: Identity, options: SubjectOptions, userId?: string) {
  const request = new p.CertificationRequest({ version: 0, subject: subject(options), subjectPublicKeyInfo: identity.publicInfo, attributes: [new p.Attribute({ type: '1.2.840.113549.1.9.14', values: [new p.Extensions({ extensions: extensions(options, identity.algorithm) }).toSchema()] })] })
  await signObject(request, identity, userId)
  return der(request)
}
export function name(dn: p.RelativeDistinguishedNames) { return dn.typesAndValues.map(item => `${({ '2.5.4.3': 'CN', '2.5.4.10': 'O', '2.5.4.6': 'C' } as Record<string, string>)[item.type] ?? item.type}=${item.value.valueBlock.value}`).join(', ') }
export async function inspectCsr(text: string, userId = '1234567812345678') {
  const request = new p.CertificationRequest({ schema: schema(decodeMaterial(text)) })
  if (request.version !== 0) throw new Error('不支持的 CSR 版本 / Unsupported CSR version')
  const kind = algorithm(request.subjectPublicKeyInfo)
  const valid = request.signatureAlgorithm.algorithmId === O.smSign
    ? sm2.doVerifySignature(Array.from(request.tbsView), bytesToHex(request.signatureValue.valueBlock.valueHexView), smPublic(request.subjectPublicKeyInfo), { hash: true, der: true, userId })
    : await request.verify()
  return { subject: name(request.subject), algorithm: kind, signatureAlgorithm: request.signatureAlgorithm.algorithmId, signatureValid: valid, extensions: request.attributes?.filter(attr => attr.type === '1.2.840.113549.1.9.14').flatMap(attr => attr.values.map(value => new p.Extensions({ schema: value }).toJSON())) ?? [] }
}
export async function createCertificate(identity: Identity, options: SubjectOptions, issuer?: { certificate: p.Certificate; identity: Identity }, userId?: string) {
  const days = options.days ?? 365
  if (!Number.isInteger(days) || days < 1 || days > 36500) throw new Error('有效期须为 1–36500 天 / Invalid validity')
  const serial = crypto.getRandomValues(new Uint8Array(16)); serial[0] = (serial[0] & 0x7f) || 1
  const notBefore = new Date(Date.now() - 60000), notAfter = new Date(Date.now() + days * 86400000)
  const time = (value: Date) => new p.Time({ type: value.getUTCFullYear() >= 2050 ? 1 : 0, value })
  const cert = new p.Certificate({ version: 2, serialNumber: new a.Integer({ valueHex: buf(serial) }), subject: subject(options), issuer: issuer?.certificate.subject ?? subject(options), subjectPublicKeyInfo: identity.publicInfo, notBefore: time(notBefore), notAfter: time(notAfter), extensions: extensions(options, identity.algorithm) })
  await signObject(cert, issuer?.identity ?? identity, userId)
  return der(cert)
}
export async function verifyCertificate(cert: p.Certificate, issuer: p.Certificate, userId = '1234567812345678'): Promise<boolean> {
  if (!cert.issuer.isEqual(issuer.subject) || bytesToHex(der(cert.signature)) !== bytesToHex(der(cert.signatureAlgorithm))) return false
  if (cert.signatureAlgorithm.algorithmId === O.smSign) return sm2.doVerifySignature(Array.from(cert.tbsView), bytesToHex(cert.signatureValue.valueBlock.valueHexView), smPublic(issuer.subjectPublicKeyInfo), { hash: true, der: true, userId })
  return cert.verify(issuer)
}
export async function verifyData(cert: p.Certificate, content: Uint8Array, signature: Uint8Array, mode: 'RSA-SHA256' | 'RSA-PSS-SHA256' | 'ECDSA-SHA256' | 'SM2', userId = '1234567812345678') {
  const kind = algorithm(cert.subjectPublicKeyInfo)
  if (mode === 'SM2') {
    if (kind !== 'SM2') throw new Error('签名算法与证书不匹配 / Algorithm does not match certificate')
    return sm2.doVerifySignature(Array.from(content), bytesToHex(signature), smPublic(cert.subjectPublicKeyInfo), { hash: true, der: signature.length !== 64, userId })
  }
  if (kind !== (mode.startsWith('RSA') ? 'RSA' : 'ECDSA')) throw new Error('签名算法与证书不匹配 / Algorithm does not match certificate')
  const alg = new p.AlgorithmIdentifier({ algorithmId: mode === 'ECDSA-SHA256' ? O.ecSign : mode === 'RSA-SHA256' ? O.rsaSign : '1.2.840.113549.1.1.10' })
  if (mode === 'RSA-PSS-SHA256') alg.algorithmParams = new p.RSASSAPSSParams({ hashAlgorithm: new p.AlgorithmIdentifier({ algorithmId: '2.16.840.1.101.3.4.2.1', algorithmParams: new a.Null() }), maskGenAlgorithm: new p.AlgorithmIdentifier({ algorithmId: '1.2.840.113549.1.1.8', algorithmParams: new p.AlgorithmIdentifier({ algorithmId: '2.16.840.1.101.3.4.2.1', algorithmParams: new a.Null() }).toSchema() }), saltLength: 32 }).toSchema()
  return p.getCrypto(true).verifyWithPublicKey(buf(content), new a.BitString({ valueHex: buf(signature) }), cert.subjectPublicKeyInfo, alg)
}
export async function keyMatches(identity: Identity, cert: p.Certificate) {
  const info = cert.subjectPublicKeyInfo
  return identity.algorithm === algorithm(info)
    && bytesToHex(identity.publicInfo.subjectPublicKey.valueBlock.valueHexView) === bytesToHex(info.subjectPublicKey.valueBlock.valueHexView)
    && (identity.algorithm === 'RSA' || bytesToHex(new Uint8Array(identity.publicInfo.algorithm.algorithmParams!.toBER(false))) === bytesToHex(new Uint8Array(info.algorithm.algorithmParams!.toBER(false))))
}
export function checkEncryptionCertificate(cert: p.Certificate) {
  if (algorithm(cert.subjectPublicKeyInfo) === 'ECDSA') throw new Error('ECDSA 证书不能直接用于本工具的加密；请选择 RSA 或 SM2 / Select an RSA or SM2 encryption certificate')
  const now = new Date()
  if (now < cert.notBefore.value || now > cert.notAfter.value) throw new Error('加密证书不在有效期内 / Encryption certificate is outside validity')
  const usage = cert.extensions?.find(ext => ext.extnID === '2.5.29.15')
  if (usage) {
    const bits = schema(usage.extnValue.valueBlock.valueHexView)
    if (!(bits instanceof a.BitString) || !(bits.valueBlock.valueHexView[0] & 0x20)) throw new Error('证书 KeyUsage 不允许密钥加密 / KeyUsage does not permit key encipherment')
  }
}
export async function encryptWithCertificate(cert: p.Certificate, content: Uint8Array): Promise<Uint8Array> {
  checkEncryptionCertificate(cert)
  if (!content.length) throw new Error('请输入待加密内容 / Content is required')
  if (algorithm(cert.subjectPublicKeyInfo) === 'SM2') {
    const raw = sm2.doEncrypt(Array.from(content), smPublic(cert.subjectPublicKeyInfo), 1)
    return convertRawCipherToAsn1(decodeMaterial('04' + raw, 'hex'), 'C1C3C2')
  }
  const key = await crypto.subtle.importKey('spki', buf(der(cert.subjectPublicKeyInfo)), { name: 'RSA-OAEP', hash: 'SHA-256' }, false, ['encrypt'])
  const max = (key.algorithm as RsaKeyAlgorithm).modulusLength / 8 - 66
  if (content.length > max) throw new Error(`RSA-OAEP 最多 ${max} 字节，请改用证书数字信封 / Maximum ${max} bytes; use a digital envelope`)
  return new Uint8Array(await crypto.subtle.encrypt('RSA-OAEP', key, buf(content)))
}
export async function decryptWithKey(identity: Identity, content: Uint8Array): Promise<Uint8Array> {
  if (identity.algorithm === 'SM2') {
    schema(content, MAX_ENCODED_BYTES)
    const raw = convertAsn1ToRawCipher(content, 'C1C3C2')
    const result = sm2.doDecrypt(bytesToHex(raw).slice(2), identity.scalar!, 1, { output: 'array' }) as unknown as number[]
    if (!Array.isArray(result) || !result.length) throw new Error('SM2 解密失败 / SM2 decryption failed')
    return Uint8Array.from(result)
  }
  if (identity.algorithm !== 'RSA') throw new Error('仅支持 RSA / SM2 解密 / RSA or SM2 required')
  const key = await crypto.subtle.importKey('pkcs8', buf(identity.privateDer), { name: 'RSA-OAEP', hash: 'SHA-256' }, false, ['decrypt'])
  return new Uint8Array(await crypto.subtle.decrypt('RSA-OAEP', key, buf(content)))
}
