import * as asn1 from 'asn1js'
import * as pki from 'pkijs'
import ipaddr from 'ipaddr.js'
import { sm2 as sm2Library } from 'sm-crypto'
import { BigInteger } from 'jsbn'
import { inspectPrivateKeyEnvelope, inspectPublicKeyEnvelope, parseCertificateAddress, rootCaProfiles, rootCaSubject } from './config'
import type { CertificateConfig, CertificateFile, GenerationRequest, GenerationResult, GenerationStage, SiteAlgorithm } from '../../types/ssl'

const OID = {
  rsa: '1.2.840.113549.1.1.1', ec: '1.2.840.10045.2.1', p256: '1.2.840.10045.3.1.7', p384: '1.3.132.0.34',
  sm2: '1.2.156.10197.1.301', sm2Sign: '1.2.156.10197.1.501',
  basic: '2.5.29.19', usage: '2.5.29.15', eku: '2.5.29.37', san: '2.5.29.17', ski: '2.5.29.14', aki: '2.5.29.35'
}
const SUBJECT_OIDS: Record<string, string> = { CN: '2.5.4.3', O: '2.5.4.10', OU: '2.5.4.11', C: '2.5.4.6', ST: '2.5.4.8', L: '2.5.4.7' }
const SM2_ORDER = BigInt('0xfffffffeffffffffffffffffffffffff7203df6b21c6052b53bbf40939d54123')
const SM2_USER_ID = '1234567812345678'
// @types/sm-crypto predates these public APIs. Keep the adapter local.
const sm2 = sm2Library as typeof sm2Library & {
  getPublicKeyFromPrivateKey(key: string): string
  verifyPublicKey(key: string): boolean
  comparePublicKeyHex(a: string, b: string): boolean
}
pki.ECNamedCurves.register('SM2', OID.sm2, 32)

export class CertificateInputError extends Error {}
function ensure(condition: unknown, message: string): asserts condition {
  if (!condition) throw new CertificateInputError(message)
}
function buffer(bytes: Uint8Array): ArrayBuffer { return bytes.slice().buffer as ArrayBuffer }
function hex(bytes: Uint8Array): string { return Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('') }
function unhex(value: string): Uint8Array { return Uint8Array.from(value.match(/../g) || [], byte => parseInt(byte, 16)) }
function der(node: { toBER(sizeOnly: boolean): ArrayBuffer }): ArrayBuffer { return node.toBER(false) }
export function toPem(label: string, data: ArrayBuffer | Uint8Array): string {
  const bytes = data instanceof Uint8Array ? data : new Uint8Array(data)
  const base64 = btoa(Array.from(bytes, byte => String.fromCharCode(byte)).join(''))
  return `-----BEGIN ${label}-----\n${base64.match(/.{1,64}/g)!.join('\n')}\n-----END ${label}-----\n`
}
export function parseDer(data: ArrayBuffer | Uint8Array): asn1.Sequence {
  const bytes = data instanceof Uint8Array ? data : new Uint8Array(data)
  const decoded = asn1.fromBER(bytes)
  ensure(decoded.offset === bytes.length && decoded.result instanceof asn1.Sequence, '文件的 ASN.1 结构损坏或包含额外数据，请重新导出 PEM。')
  return decoded.result
}
function readPem(text: string, kind: 'private' | 'public') {
  const info = kind === 'private' ? inspectPrivateKeyEnvelope(text) : inspectPublicKeyEnvelope(text)
  ensure(!info.error, info.error)
  const match = text.trim().match(/^-----BEGIN ([A-Z ]+)-----\s+([A-Za-z0-9+/=\s]+)\s+-----END \1-----$/)!
  const bytes = Uint8Array.from(atob(match[2].replace(/\s/g, '')), char => char.charCodeAt(0))
  return { label: match[1], schema: parseDer(bytes), bytes }
}
function objectId(params: unknown): string {
  return params instanceof asn1.ObjectIdentifier ? params.valueBlock.toString() : ''
}
function algorithmIdentifier(oid: string, curve?: string) {
  return new pki.AlgorithmIdentifier({ algorithmId: oid,
    ...(curve ? { algorithmParams: new asn1.ObjectIdentifier({ value: curve }) } : oid === OID.rsa ? { algorithmParams: new asn1.Null() } : {}) })
}

interface KeyMaterial {
  id: SiteAlgorithm
  label: string
  spki: pki.PublicKeyInfo
  privatePem: string
  privateKey?: CryptoKey
  publicKey?: CryptoKey
  privateHex?: string
  publicHex?: string
}

function freshSm2Pair() {
  // Rejection sampling avoids modulo bias. Never use sm-crypto's legacy RC4 RNG.
  let scalar: bigint
  let privateHex: string
  do {
    privateHex = hex(crypto.getRandomValues(new Uint8Array(32)))
    scalar = BigInt(`0x${privateHex}`)
  } while (scalar < 1n || scalar >= SM2_ORDER - 1n)
  return { privateHex, publicHex: sm2.getPublicKeyFromPrivateKey(privateHex) }
}
function signSm2(data: Uint8Array, privateHex: string, publicHex: string): Uint8Array {
  // A fresh Web Crypto nonce for every attempt, including rare SM2 r/s retries.
  // The pool deliberately never becomes empty, so the library cannot fall back to its RNG.
  const pointPool = {
    length: 1,
    pop() {
      const pair = freshSm2Pair()
      return { k: new BigInteger(pair.privateHex, 16), x1: new BigInteger(pair.publicHex.slice(2, 66), 16) }
    }
  } as unknown as NonNullable<Parameters<typeof sm2.doSignature>[2]>['pointPool']
  return unhex(sm2.doSignature(Array.from(data), privateHex, { pointPool, der: true, hash: true, publicKey: publicHex, userId: SM2_USER_ID }))
}
function verifySm2(data: Uint8Array, signature: Uint8Array, publicHex: string): boolean {
  return sm2.doVerifySignature(Array.from(data), hex(signature), publicHex, { der: true, hash: true, userId: SM2_USER_ID })
}
function sm2Material(privateHex: string, publicHex: string): KeyMaterial {
  const spki = new pki.PublicKeyInfo({ algorithm: algorithmIdentifier(OID.ec, OID.sm2), subjectPublicKey: new asn1.BitString({ valueHex: buffer(unhex(publicHex)) }) })
  const ecPrivate = new asn1.Sequence({ value: [
    new asn1.Integer({ value: 1 }), new asn1.OctetString({ valueHex: buffer(unhex(privateHex)) }),
    new asn1.Constructed({ idBlock: { tagClass: 3, tagNumber: 1 }, value: [new asn1.BitString({ valueHex: buffer(unhex(publicHex)) })] })
  ] })
  const pkcs8 = new pki.PrivateKeyInfo({ privateKeyAlgorithm: algorithmIdentifier(OID.ec, OID.sm2), privateKey: new asn1.OctetString({ valueHex: der(ecPrivate) }) })
  return { id: 'sm2', label: 'SM2 · 256 位', spki, privateHex, publicHex, privatePem: toPem('PRIVATE KEY', der(pkcs8.toSchema())) }
}

async function generateKey(id: SiteAlgorithm): Promise<KeyMaterial> {
  if (id === 'sm2') {
    const pair = freshSm2Pair()
    return sm2Material(pair.privateHex, pair.publicHex)
  }
  const params: RsaHashedKeyGenParams | EcKeyGenParams = id.startsWith('rsa-')
    ? { name: 'RSASSA-PKCS1-v1_5', modulusLength: Number(id.slice(4)), publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' }
    : { name: 'ECDSA', namedCurve: id === 'ec-p256' ? 'P-256' : 'P-384' }
  const pair = await crypto.subtle.generateKey(params, true, ['sign', 'verify'])
  const publicDer = await crypto.subtle.exportKey('spki', pair.publicKey)
  const privateDer = await crypto.subtle.exportKey('pkcs8', pair.privateKey)
  return { id, label: id.startsWith('rsa-') ? `RSA · ${id.slice(4)} 位` : `ECDSA · ${id === 'ec-p256' ? 'P-256' : 'P-384'}`,
    spki: new pki.PublicKeyInfo({ schema: parseDer(publicDer) }), privatePem: toPem('PRIVATE KEY', privateDer), ...pair }
}

export async function importKeyPair(privatePem: string, publicPem: string, rootAlgorithm: CertificateConfig['rootAlgorithm']): Promise<KeyMaterial> {
  try {
    const pub = readPem(publicPem, 'public')
    const priv = readPem(privatePem, 'private')
    const spki = pub.label === 'RSA PUBLIC KEY'
      ? new pki.PublicKeyInfo({ algorithm: algorithmIdentifier(OID.rsa), subjectPublicKey: new asn1.BitString({ valueHex: buffer(pub.bytes) }) })
      : new pki.PublicKeyInfo({ schema: pub.schema })
    const curve = objectId(spki.algorithm.algorithmParams)
    let pkcs8: pki.PrivateKeyInfo
    if (priv.label === 'RSA PRIVATE KEY') {
      new pki.RSAPrivateKey({ schema: priv.schema })
      pkcs8 = new pki.PrivateKeyInfo({ privateKeyAlgorithm: algorithmIdentifier(OID.rsa), privateKey: new asn1.OctetString({ valueHex: buffer(priv.bytes) }) })
    } else if (priv.label === 'EC PRIVATE KEY') {
      const ec = new pki.ECPrivateKey({ namedCurve: curve, schema: priv.schema })
      ensure(ec.namedCurve === curve, '公钥与私钥的椭圆曲线不同，请提供配套的密钥。')
      pkcs8 = new pki.PrivateKeyInfo({ privateKeyAlgorithm: algorithmIdentifier(OID.ec, curve), privateKey: new asn1.OctetString({ valueHex: buffer(priv.bytes) }) })
    } else pkcs8 = new pki.PrivateKeyInfo({ schema: priv.schema })
    ensure(pkcs8.version === 0, '目前支持 PKCS#8 v1 私钥，请重新导出为标准未加密 PEM。')
    ensure(pkcs8.privateKeyAlgorithm.algorithmId === spki.algorithm.algorithmId && objectId(pkcs8.privateKeyAlgorithm.algorithmParams) === curve, '公钥和私钥的算法或曲线不一致，请选择配套文件。')
    const isSm2 = spki.algorithm.algorithmId === OID.ec && curve === OID.sm2
    ensure((rootAlgorithm === 'sm2') === isSm2, rootAlgorithm === 'sm2' ? 'SM2 根预设需要 SM2 站点密钥，请更换密钥对。' : '请为 SM2 密钥选择 SM2 根证书；RSA 根预设支持 RSA / ECDSA 密钥。')
    if (isSm2) {
      const inner = new pki.ECPrivateKey({ namedCurve: curve, schema: parseDer(pkcs8.privateKey.valueBlock.valueHexView) })
      ensure(inner.namedCurve === curve && inner.version === 1, 'SM2 私钥的参数与封装不一致。')
      const scalarBytes = inner.privateKey.valueBlock.valueHexView
      ensure(scalarBytes.length > 0 && scalarBytes.length <= 32, 'SM2 私钥长度不正确。')
      const privateHex = hex(scalarBytes).padStart(64, '0')
      const scalar = BigInt(`0x${privateHex}`)
      ensure(scalar >= 1n && scalar < SM2_ORDER - 1n, 'SM2 私钥数值不在有效范围内。')
      const publicHex = hex(spki.subjectPublicKey.valueBlock.valueHexView)
      ensure(spki.subjectPublicKey.valueBlock.unusedBits === 0 && sm2.verifyPublicKey(publicHex), 'SM2 公钥不是有效的曲线点。')
      const derived = sm2.getPublicKeyFromPrivateKey(privateHex)
      ensure(sm2.comparePublicKeyHex(publicHex, derived), '公钥与私钥不匹配，请上传同一密钥对的两个文件。')
      if (inner.publicKey) ensure(sm2.comparePublicKeyHex(hex(new Uint8Array(inner.publicKey.toSchema().toBER(false))), derived), '私钥内嵌的公钥与私钥不匹配，请重新导出。')
      const material = sm2Material(privateHex, derived)
      await checkKeyPair(material)
      return material
    }
    const rsa = spki.algorithm.algorithmId === OID.rsa
    ensure(rsa || spki.algorithm.algorithmId === OID.ec && [OID.p256, OID.p384].includes(curve), '仅支持 RSA 2048/3072/4096、ECDSA P-256/P-384 或 SM2 密钥。')
    const params: RsaHashedImportParams | EcKeyImportParams = rsa ? { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' } : { name: 'ECDSA', namedCurve: curve === OID.p256 ? 'P-256' : 'P-384' }
    const publicKey = await crypto.subtle.importKey('spki', der(spki.toSchema()), params, true, ['verify'])
    const privateKey = await crypto.subtle.importKey('pkcs8', der(pkcs8.toSchema()), params, true, ['sign'])
    const bits = rsa ? (publicKey.algorithm as RsaKeyAlgorithm).modulusLength : 0
    ensure(!rsa || [2048, 3072, 4096].includes(bits), 'RSA 密钥需要 2048、3072 或 4096 位，请重新生成密钥。')
    const privateJwk = await crypto.subtle.exportKey('jwk', privateKey)
    const publicJwk = await crypto.subtle.exportKey('jwk', publicKey)
    ensure(rsa ? privateJwk.n === publicJwk.n && privateJwk.e === publicJwk.e : privateJwk.crv === publicJwk.crv && privateJwk.x === publicJwk.x && privateJwk.y === publicJwk.y, '公钥与私钥不匹配，请上传同一密钥对的两个文件。')
    if (rsa) ensure((publicKey.algorithm as RsaKeyAlgorithm).publicExponent.toString() === '1,0,1', 'RSA 公钥指数需要为 65537，请使用标准参数重新生成密钥。')
    const id = (rsa ? `rsa-${bits}` : curve === OID.p256 ? 'ec-p256' : 'ec-p384') as SiteAlgorithm
    const material: KeyMaterial = { id, label: rsa ? `RSA · ${bits} 位` : `ECDSA · ${curve === OID.p256 ? 'P-256' : 'P-384'}`, spki, privateKey, publicKey, privatePem: toPem('PRIVATE KEY', await crypto.subtle.exportKey('pkcs8', privateKey)) }
    await checkKeyPair(material)
    return material
  } catch (error) {
    if (error instanceof CertificateInputError) throw error
    // Do not echo parser/library exceptions that might include key fragments.
    throw new CertificateInputError('密钥解析失败。请检查 PEM 是否完整，并使用未加密的 PKCS#8 / PKCS#1 / SEC1 私钥及 SPKI / PKCS#1 公钥。')
  }
}

async function checkKeyPair(key: KeyMaterial) {
  const challenge = crypto.getRandomValues(new Uint8Array(32))
  if (key.id === 'sm2') {
    ensure(verifySm2(challenge, signSm2(challenge, key.privateHex!, key.publicHex!), key.publicHex!), '公私钥配对验证失败。')
  } else {
    const params = key.id.startsWith('rsa') ? { name: 'RSASSA-PKCS1-v1_5' } : { name: 'ECDSA', hash: key.id === 'ec-p384' ? 'SHA-384' : 'SHA-256' }
    const signature = await crypto.subtle.sign(params, key.privateKey!, challenge)
    ensure(await crypto.subtle.verify(params, key.publicKey!, signature, challenge), '公钥与私钥签名验证不通过，请选择配套文件。')
  }
}

function distinguishedName(attributes: { type: string; value: string }[]): pki.RelativeDistinguishedNames {
  // PKI.js typesAndValues alone builds a single multi-valued SET. Parse an explicit
  // SEQUENCE of singleton SETs so order and the two independent OU RDNs survive.
  const schema = new asn1.Sequence({ value: attributes.map(({ type, value }) => new asn1.Set({ value: [
    new pki.AttributeTypeAndValue({ type: SUBJECT_OIDS[type], value: type === 'C' ? new asn1.PrintableString({ value }) : new asn1.Utf8String({ value }) }).toSchema()
  ] })) })
  return new pki.RelativeDistinguishedNames({ schema: parseDer(der(schema)) })
}
function randomSerial() {
  const bytes = crypto.getRandomValues(new Uint8Array(20))
  bytes[0] = (bytes[0] & 0x7f) || 1
  return new asn1.Integer({ valueHex: buffer(bytes) })
}
function certificateTime(date: Date) { return new pki.Time({ type: date.getUTCFullYear() < 2050 ? 0 : 1, value: date }) }
function extension(oid: string, value: { toBER(sizeOnly: boolean): ArrayBuffer }, critical = false) {
  return new pki.Extension({ extnID: oid, critical, extnValue: der(value) })
}
async function keyIdentifier(key: KeyMaterial) {
  // RFC 5280 method 1: SHA-1 identifies the public key; it is not a signature hash.
  return crypto.subtle.digest('SHA-1', buffer(key.spki.subjectPublicKey.valueBlock.valueHexView))
}
async function certificateExtensions(key: KeyMaterial, issuer: KeyMaterial, config: CertificateConfig, ca: boolean) {
  const extensions = [
    extension(OID.basic, new pki.BasicConstraints(ca ? { cA: true, pathLenConstraint: 0 } : { cA: false }).toSchema(), true),
    extension(OID.usage, new asn1.BitString({ unusedBits: ca ? 1 : key.id.startsWith('rsa') ? 5 : 7, valueHex: new Uint8Array([ca ? 0x06 : key.id.startsWith('rsa') ? 0xa0 : 0x80]).buffer }), true),
    extension(OID.ski, new asn1.OctetString({ valueHex: await keyIdentifier(key) })),
    extension(OID.aki, new pki.AuthorityKeyIdentifier({ keyIdentifier: new asn1.OctetString({ valueHex: await keyIdentifier(issuer) }) }).toSchema())
  ]
  if (!ca) {
    extensions.push(extension(OID.eku, new pki.ExtKeyUsage({ keyPurposes: ['1.3.6.1.5.5.7.3.1', ...(config.clientAuth ? ['1.3.6.1.5.5.7.3.2'] : [])] }).toSchema()))
    extensions.push(extension(OID.san, new pki.AltName({ altNames: config.addresses.map(address => new pki.GeneralName(address.type === 'IP'
      ? { type: 7, value: new asn1.OctetString({ valueHex: new Uint8Array(ipaddr.parse(address.value).toByteArray()).buffer }) }
      : { type: 2, value: address.value })) }).toSchema()))
  }
  return extensions
}
async function issueCertificate(key: KeyMaterial, issuer: KeyMaterial, subject: pki.RelativeDistinguishedNames, issuerName: pki.RelativeDistinguishedNames, config: CertificateConfig, start: Date, end: Date, ca: boolean, engine: pki.CryptoEngine) {
  const certificate = new pki.Certificate({ version: 2, serialNumber: randomSerial(), subject, issuer: issuerName,
    notBefore: certificateTime(start), notAfter: certificateTime(end), subjectPublicKeyInfo: key.spki,
    extensions: await certificateExtensions(key, issuer, config, ca) })
  if (issuer.id === 'sm2') {
    certificate.signature = algorithmIdentifier(OID.sm2Sign)
    certificate.signatureAlgorithm = algorithmIdentifier(OID.sm2Sign)
    certificate.tbsView = new Uint8Array(der(certificate.encodeTBS()))
    certificate.signatureValue = new asn1.BitString({ valueHex: buffer(signSm2(certificate.tbsView, issuer.privateHex!, issuer.publicHex!)) })
  } else await certificate.sign(issuer.privateKey!, 'SHA-256', engine)
  return new Uint8Array(der(certificate.toSchema()))
}

export function validateConfig(config: CertificateConfig): CertificateConfig {
  ensure(rootCaProfiles.some(profile => profile.id === config.rootAlgorithm), '请选择有效的根 CA 算法。')
  ensure(Number.isInteger(config.days) && config.days >= 1 && config.days <= 3650, '站点有效期需要为 1–3650 天的整数。')
  ensure(Number.isInteger(config.rootDays) && config.rootDays >= config.days && config.rootDays <= 10950, '根证书有效期需要覆盖站点有效期，且不超过 10950 天。')
  ensure(config.keySource === 'generate' || config.keySource === 'import', '请选择站点密钥来源。')
  ensure(['rsa-2048', 'rsa-3072', 'rsa-4096', 'ec-p256', 'ec-p384', 'sm2'].includes(config.siteAlgorithm), '站点密钥算法不受支持。')
  if (config.keySource === 'generate') ensure((config.rootAlgorithm === 'sm2') === (config.siteAlgorithm === 'sm2'), 'SM2 根证书需搭配 SM2 站点密钥。')
  const fields = Object.fromEntries(Object.keys(SUBJECT_OIDS).map(key => [key, config.subject[key as keyof typeof config.subject]?.trim() || ''])) as unknown as CertificateConfig['subject']
  ensure(fields.CN.length > 0, '请填写站点证书名称 CN。')
  for (const value of Object.values(fields)) ensure(value.length <= 128 && !/[\u0000-\u001f\u007f]/.test(value), 'DN 字段应不超过 128 个字符，且不能包含控制字符。')
  ensure(!fields.C || /^[A-Za-z]{2}$/.test(fields.C), '国家代码需要两个英文字母。')
  ensure(Array.isArray(config.addresses) && config.addresses.length >= 1 && config.addresses.length <= 100, '请提供 1–100 个证书覆盖的地址。')
  const addresses = config.addresses.map(item => {
    const parsed = parseCertificateAddress(item.value)
    ensure(parsed.address && parsed.address.type === item.type, parsed.error || 'SAN 地址类型不正确。')
    return parsed.address
  }).filter((item, index, all) => all.findIndex(other => other.value === item.value) === index)
  if (config.start) {
    const date = new Date(config.start)
    ensure(Number.isFinite(date.getTime()) && date.getUTCFullYear() >= 2000 && date.getUTCFullYear() <= 2099, '生效时间需要在 2000–2099 年之间。')
    ensure(date.getTime() + config.days * 86_400_000 > Date.now(), '所选有效期已经结束，请调整生效日期或有效天数。')
  }
  return { ...config, subject: fields, addresses }
}

async function verifyIssued(rootDer: Uint8Array, siteDer: Uint8Array, rootKey: KeyMaterial, siteKey: KeyMaterial, config: CertificateConfig, start: Date, end: Date, rootEnd: Date, engine: pki.CryptoEngine) {
  const root = new pki.Certificate({ schema: parseDer(rootDer) })
  const site = new pki.Certificate({ schema: parseDer(siteDer) })
  const certificates = [root, site]
  for (const cert of certificates) {
    const verified = rootKey.id === 'sm2'
      ? verifySm2(cert.tbsView, cert.signatureValue.valueBlock.valueHexView, rootKey.publicHex!)
      : await cert.verify(root, engine)
    ensure(verified, '生成后的证书签名验证失败，未提供下载。')
    ensure(cert.signature.algorithmId === cert.signatureAlgorithm.algorithmId, '证书签名算法字段不一致。')
  }
  ensure(site.issuer.isEqual(root.subject) && root.issuer.isEqual(root.subject), '证书签发者关系校验失败。')
  const expectedRoot = distinguishedName(rootCaSubject(rootCaProfiles.find(profile => profile.id === config.rootAlgorithm)!.commonName))
  const expectedSite = distinguishedName(Object.entries(config.subject).filter(([, value]) => value).map(([type, value]) => ({ type, value })))
  ensure(hex(new Uint8Array(der(root.subject.toSchema()))) === hex(new Uint8Array(der(expectedRoot.toSchema()))) && site.subject.isEqual(expectedSite), '生成后的证书 DN 与配置不符。')
  ensure(root.notBefore.value.getTime() === start.getTime() && site.notBefore.value.getTime() === start.getTime() && site.notAfter.value.getTime() === end.getTime() && root.notAfter.value.getTime() === rootEnd.getTime(), '证书有效期核验失败。')
  ensure(hex(new Uint8Array(der(site.subjectPublicKeyInfo.toSchema()))) === hex(new Uint8Array(der(siteKey.spki.toSchema()))), '证书中的公钥与站点密钥不一致。')
  for (const [index, cert] of certificates.entries()) {
    const expected = await certificateExtensions(index === 0 ? rootKey : siteKey, rootKey, config, index === 0)
    ensure(cert.extensions?.length === expected.length && expected.every(ext => cert.extensions?.some(actual => actual.extnID === ext.extnID && actual.critical === ext.critical && hex(actual.extnValue.valueBlock.valueHexView) === hex(ext.extnValue.valueBlock.valueHexView))), '证书 SAN、用途或 CA 扩展校验失败。')
  }
  await checkKeyPair(siteKey)
}

function readme(config: CertificateConfig, rootName: string, start: Date, end: Date, rootFingerprint: string) {
  return `996 Tools — 本地生成的测试证书\n\n站点：${config.subject.CN}\nSAN：${config.addresses.map(item => `${item.type}:${item.value}`).join(', ')}\n生效（UTC）：${start.toISOString()}\n到期（UTC）：${end.toISOString()}\n签发者：${rootName}\n根证书 SHA-256：${rootFingerprint}\n\n文件说明\nserver.crt：站点证书（PEM）。\nserver.der：同一站点证书（DER）。\nserver.pub：站点公钥（SPKI PEM）。\n${config.keySource === 'generate' ? 'server.key：站点私钥（未加密 PKCS#8 PEM）。' : '站点私钥使用你导入的原文件，此部署包没有复制该私钥。'}\n\n${config.rootAlgorithm === 'sm2' ? 'SM2 使用 SM3withSM2，签名用户 ID 为 1234567812345678。需要国密服务端/客户端；单张签名证书不是 TLCP 双证书方案，不保证普通浏览器或标准 Nginx/Vite 支持。' : 'Nginx 示例（私钥路径按实际情况调整）：\nssl_certificate /your/path/server.crt;\nssl_certificate_key /your/path/server.key;\n\nVite 示例：\nserver: { https: { key: readFileSync("server.key"), cert: readFileSync("server.crt") } }\n需从 node:fs 导入 readFileSync。'}\n\n信任与备份\n单独下载 ${rootName}.crt，在自己管理的测试设备上导入为可信根。它不属于公共 CA，浏览器不会自动信任。\n单独下载并保管 ${rootName}.key；根私钥不要放到站点、源码仓库或分发给测试成员。所有私钥当前均为未加密格式。\n每次生成都是全新的根 CA，即使名称相同也不是上次的根；重新生成后须重新导入根证书。\n本工具不会自动安装根证书，页面刷新或离开后生成结果会丢失，请及时下载。\n`
}

export async function generateCertificates(request: GenerationRequest, progress: (stage: GenerationStage) => void = () => {}): Promise<GenerationResult> {
  ensure(globalThis.crypto?.subtle && globalThis.crypto?.getRandomValues, '浏览器缺少 Web Crypto，请通过 HTTPS 或 localhost 使用最新版浏览器。')
  progress('validate')
  const config = validateConfig(request.config)
  const engine = new pki.CryptoEngine({ name: 'browser-webcrypto', crypto, subtle: crypto.subtle })
  const profile = rootCaProfiles.find(item => item.id === config.rootAlgorithm)!
  const start = new Date(Math.floor((config.start ? new Date(config.start).getTime() : Date.now() - 300_000) / 1000) * 1000)
  const end = new Date(start.getTime() + config.days * 86_400_000)
  const rootEnd = new Date(start.getTime() + config.rootDays * 86_400_000)
  progress('site-key')
  ensure(config.keySource !== 'import' || request.keyPair?.privatePem && request.keyPair?.publicPem, '请同时提供站点公钥和私钥。')
  const siteKey = config.keySource === 'import'
    ? await importKeyPair(request.keyPair!.privatePem, request.keyPair!.publicPem, config.rootAlgorithm)
    : await generateKey(config.siteAlgorithm)
  progress('root-key')
  const rootKey = await generateKey(config.rootAlgorithm)
  const rootName = distinguishedName(rootCaSubject(profile.commonName))
  const siteName = distinguishedName(Object.entries(config.subject).filter(([, value]) => value).map(([type, value]) => ({ type, value })))
  progress('root-certificate')
  const rootDer = await issueCertificate(rootKey, rootKey, rootName, rootName, config, start, rootEnd, true, engine)
  progress('site-certificate')
  const siteDer = await issueCertificate(siteKey, rootKey, siteName, rootName, config, start, end, false, engine)
  progress('verify')
  await verifyIssued(rootDer, siteDer, rootKey, siteKey, config, start, end, rootEnd, engine)
  const fingerprint = hex(new Uint8Array(await crypto.subtle.digest('SHA-256', buffer(siteDer)))).toUpperCase().match(/../g)!.join(':')
  const rootFingerprint = hex(new Uint8Array(await crypto.subtle.digest('SHA-256', buffer(rootDer)))).toUpperCase().match(/../g)!.join(':')
  const files: CertificateFile[] = [
    { name: 'server.crt', label: 'SSL 证书', description: 'PEM 格式，配置到 HTTPS 服务', group: 'site', secret: false, content: toPem('CERTIFICATE', siteDer) },
    { name: 'server.der', label: 'SSL 证书 DER', description: '同一张证书的二进制格式', group: 'site', secret: false, content: siteDer },
    { name: 'server.pub', label: '站点公钥', description: 'SPKI PEM，可用于验签和配置核对', group: 'site', secret: false, content: toPem('PUBLIC KEY', der(siteKey.spki.toSchema())) },
    ...(config.keySource === 'generate' ? [{ name: 'server.key', label: '站点私钥', description: '未加密 PKCS#8 PEM，与站点证书配套', group: 'site' as const, secret: true, content: siteKey.privatePem }] : []),
    { name: 'README.txt', label: '使用说明', description: '部署、信任和备份步骤', group: 'site', secret: false, content: readme(config, profile.commonName, start, end, rootFingerprint) },
    { name: `${profile.commonName}.crt`, label: '根证书', description: '导入测试设备的信任库', group: 'root', secret: false, content: toPem('CERTIFICATE', rootDer) },
    { name: `${profile.commonName}.key`, label: '根私钥', description: '未加密 PKCS#8 PEM，请单独备份', group: 'root', secret: true, content: rootKey.privatePem }
  ]
  return { files, rootName: profile.commonName, rootSubject: `CN=${profile.commonName},ou=test,ou=xcf,c=cn`, siteAlgorithm: siteKey.label,
    signatureAlgorithm: profile.signature, notBefore: start.toISOString(), notAfter: end.toISOString(), rootNotAfter: rootEnd.toISOString(), fingerprint, rootFingerprint,
    checks: ['根证书自签名验证通过', 'SSL 证书根签名验证通过', '站点公私钥匹配', 'DN、SAN、有效期与证书用途核验通过'] }
}
