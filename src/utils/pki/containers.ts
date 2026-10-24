import * as a from 'asn1js'
import * as p from 'pkijs'
import forge from 'node-forge'
import { sm4 } from 'sm-crypto'
import { bytesToHex } from '../crypto/material-format'
import { algorithm, buf, checkEncryptionCertificate, decryptWithKey, der, encryptWithCertificate, keyMatches, schema, verifyCertificate, type Identity } from './core'
import { MAX_CONTENT_BYTES, MAX_ENCODED_BYTES } from './limits'

const DATA = '1.2.840.113549.1.7.1', ENVELOPE = '1.2.840.113549.1.7.3', SM2_ENC = '1.2.156.10197.1.301.3', SM4_CBC = '1.2.156.10197.1.104.2'
const binary = (bytes: Uint8Array) => forge.util.hexToBytes(bytesToHex(bytes))

export async function createPkcs12(identity: Identity, chain: p.Certificate[], password: string, alias: string, userId = '1234567812345678') {
  if (!password || password.includes('\0')) throw new Error('请输入不含空字符的口令 / A non-empty password without NUL is required')
  if (!alias.trim() || alias.length > 128 || /[\uD800-\uDFFF\x00]/.test(alias)) throw new Error('别名须为 1–128 个 BMP 字符 / Invalid alias')
  const matching = await Promise.all(chain.map(cert => keyMatches(identity, cert)))
  if (matching.filter(Boolean).length !== 1) throw new Error('证书链中必须恰好有一张与私钥匹配的证书 / Exactly one certificate must match the private key')
  const ordered = [chain[matching.indexOf(true)]]
  const remaining = chain.filter(cert => cert !== ordered[0])
  while (remaining.length) {
    const tail = ordered[ordered.length - 1]
    let index = -1
    for (let i = 0; i < remaining.length; i++) if (await verifyCertificate(tail, remaining[i], userId)) { index = i; break }
    if (index < 0) throw new Error('包含不相关或签名不匹配的证书 / Unrelated or invalid certificate in chain')
    ordered.push(remaining.splice(index, 1)[0])
  }
  const localId = crypto.getRandomValues(new Uint8Array(20))
  const attributes = [new p.Attribute({ type: '1.2.840.113549.1.9.20', values: [new a.BmpString({ value: alias })] }), new p.Attribute({ type: '1.2.840.113549.1.9.21', values: [new a.OctetString({ valueHex: buf(localId) })] })].sort((x, y) => bytesToHex(der(x)).localeCompare(bytesToHex(der(y))))
  const encrypted = new p.EncryptedData()
  await encrypted.encrypt({ password: buf(new TextEncoder().encode(password)), contentEncryptionAlgorithm: { name: 'AES-CBC', length: 256, iv: crypto.getRandomValues(new Uint8Array(16)) }, hmacHashAlgorithm: 'SHA-256', iterationCount: 100000, contentToEncrypt: buf(identity.privateDer) })
  const bag = new p.PKCS8ShroudedKeyBag({ encryptionAlgorithm: encrypted.encryptedContentInfo.contentEncryptionAlgorithm, encryptedData: encrypted.encryptedContentInfo.encryptedContent })
  const keySafe = new p.SafeContents({ safeBags: [new p.SafeBag({ bagId: '1.2.840.113549.1.12.10.1.2', bagValue: bag, bagAttributes: attributes })] })
  const certSafe = new p.SafeContents({ safeBags: ordered.map((cert, index) => new p.SafeBag({ bagId: '1.2.840.113549.1.12.10.1.3', bagValue: new p.CertBag({ certId: '1.2.840.113549.1.9.22.1', certValue: new a.OctetString({ valueHex: buf(der(cert)) }) }), ...(index === 0 ? { bagAttributes: attributes } : {}) })) })
  const authSafe = new p.AuthenticatedSafe({ safeContents: [keySafe, certSafe].map(safe => new p.ContentInfo({ contentType: DATA, content: new a.OctetString({ valueHex: buf(der(safe)) }) })) })
  const data = der(authSafe), salt = crypto.getRandomValues(new Uint8Array(32)), iterations = 10000
  // PKCS#12 MAC uses UTF-16BE password derivation, unlike the UTF-8 PBES2 key encryption.
  const macKey = forge.pkcs12.generateKey(password, forge.util.createBuffer(binary(salt)), 3, iterations, 32, forge.md.sha256.create())
  const hmac = forge.hmac.create(); hmac.start('sha256', macKey); hmac.update(binary(data))
  const mac = Uint8Array.from(hmac.digest().getBytes(), char => char.charCodeAt(0))
  return der(new p.PFX({ version: 3, authSafe: new p.ContentInfo({ contentType: DATA, content: new a.OctetString({ valueHex: buf(data) }) }), macData: new p.MacData({ mac: new p.DigestInfo({ digestAlgorithm: new p.AlgorithmIdentifier({ algorithmId: '2.16.840.1.101.3.4.2.1', algorithmParams: new a.Null() }), digest: new a.OctetString({ valueHex: buf(mac) }) }), macSalt: new a.OctetString({ valueHex: buf(salt) }), iterations }) }))
}

export async function createEnvelope(cert: p.Certificate, content: Uint8Array) {
  if (content.length > MAX_CONTENT_BYTES) throw new Error('原文不能超过 20 MB / Content must not exceed 20 MB')
  checkEncryptionCertificate(cert)
  const envelope = new p.EnvelopedData({ version: 0 })
  if (algorithm(cert.subjectPublicKeyInfo) === 'RSA') {
    envelope.addRecipientByCertificate(cert, { useOAEP: true, oaepHashAlgorithm: 'SHA-256' })
    const encryption = { name: 'AES-CBC', length: 256 }
    await envelope.encrypt(encryption, buf(content))
  } else {
    const key = crypto.getRandomValues(new Uint8Array(16)), iv = crypto.getRandomValues(new Uint8Array(16))
    try {
      const encryptedKey = await encryptWithCertificate(cert, key)
      const encrypted = sm4.encrypt(Array.from(content), bytesToHex(key), { mode: 'cbc', iv: bytesToHex(iv), output: 'array' }) as unknown as number[]
      envelope.recipientInfos = [new p.RecipientInfo({ variant: 1, value: new p.KeyTransRecipientInfo({ version: 0, rid: new p.IssuerAndSerialNumber({ issuer: cert.issuer, serialNumber: cert.serialNumber }), keyEncryptionAlgorithm: new p.AlgorithmIdentifier({ algorithmId: SM2_ENC }), encryptedKey: new a.OctetString({ valueHex: buf(encryptedKey) }) }) })]
      envelope.encryptedContentInfo = new p.EncryptedContentInfo({ contentType: DATA, contentEncryptionAlgorithm: new p.AlgorithmIdentifier({ algorithmId: SM4_CBC, algorithmParams: new a.OctetString({ valueHex: buf(iv) }) }), encryptedContent: new a.OctetString({ valueHex: buf(Uint8Array.from(encrypted)) }) })
    } finally { key.fill(0) }
  }
  return der(new p.ContentInfo({ contentType: ENVELOPE, content: envelope.toSchema() }))
}
export async function openEnvelope(cert: p.Certificate, identity: Identity, data: Uint8Array) {
  if (!await keyMatches(identity, cert)) throw new Error('私钥与接收者证书不匹配 / Private key does not match recipient certificate')
  const info = new p.ContentInfo({ schema: schema(data, MAX_ENCODED_BYTES) })
  if (info.contentType !== ENVELOPE) throw new Error('需要 CMS EnvelopedData / Expected CMS EnvelopedData')
  const envelope = new p.EnvelopedData({ schema: info.content })
  if (envelope.recipientInfos.length !== 1 || envelope.recipientInfos[0].variant !== 1) throw new Error('当前支持单接收者密钥传输信封 / Only single-recipient key transport is supported')
  const recipient = envelope.recipientInfos[0].value as p.KeyTransRecipientInfo
  if (!(recipient.rid instanceof p.IssuerAndSerialNumber) || !recipient.rid.issuer.isEqual(cert.issuer) || !recipient.rid.serialNumber.isEqual(cert.serialNumber)) throw new Error('接收者标识不匹配 / Recipient identifier mismatch')
  const content = envelope.encryptedContentInfo
  if (content.contentType !== DATA) throw new Error('不支持的信封内容类型 / Unsupported envelope content type')
  if (algorithm(cert.subjectPublicKeyInfo) === 'RSA') {
    if (recipient.keyEncryptionAlgorithm.algorithmId !== '1.2.840.113549.1.1.7' || content.contentEncryptionAlgorithm.algorithmId !== '2.16.840.1.101.3.4.1.42') throw new Error('仅支持 RSA-OAEP / AES-256-CBC 信封 / Unsupported envelope algorithms')
    return new Uint8Array(await envelope.decrypt(0, { recipientCertificate: cert, recipientPrivateKey: buf(identity.privateDer) }))
  }
  if (recipient.keyEncryptionAlgorithm.algorithmId !== SM2_ENC || content.contentEncryptionAlgorithm.algorithmId !== SM4_CBC || !(content.contentEncryptionAlgorithm.algorithmParams instanceof a.OctetString)) throw new Error('不支持的国密信封算法 / Unsupported SM envelope algorithms')
  const key = await decryptWithKey(identity, recipient.encryptedKey.valueBlock.valueHexView)
  try {
    const iv = content.contentEncryptionAlgorithm.algorithmParams.valueBlock.valueHexView
    const encryptedNode = content.encryptedContent
    if (!encryptedNode) throw new Error('缺少信封密文 / Missing encrypted content')
    const encrypted = encryptedNode.idBlock.isConstructed
      ? new Uint8Array(new a.OctetString({ isConstructed: true, value: encryptedNode.valueBlock.value.map(node => {
        if (!(node instanceof a.OctetString)) throw new Error('无效的分块密文 / Invalid encrypted content chunks')
        return node
      }) }).getValue())
      : encryptedNode.valueBlock.valueHexView
    if (key.length !== 16 || iv.length !== 16 || !encrypted.length || encrypted.length % 16) throw new Error('无效的 SM4 参数 / Invalid SM4 parameters')
    // Validate PKCS#7 padding explicitly; sm-crypto otherwise only truncates by its last byte.
    const padded = Uint8Array.from(sm4.decrypt(Array.from(encrypted), bytesToHex(key), { mode: 'cbc', iv: bytesToHex(iv), padding: 'none', output: 'array' }) as unknown as number[])
    const pad = padded[padded.length - 1]
    if (pad < 1 || pad > 16 || !padded.slice(-pad).every(byte => byte === pad)) throw new Error('解密失败：填充无效 / Invalid decryption padding')
    return padded.slice(0, -pad)
  } finally { key.fill(0) }
}
