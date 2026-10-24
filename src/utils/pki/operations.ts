import { bytesToHex, decodeMaterial, type MaterialKind, type InputEncoding } from '../crypto/material-format'
import { algorithm, certificate, certificates, createCertificate, createCsr, decryptWithKey, der, encryptWithCertificate, generateIdentity, inspectCsr, loadIdentity, name, verifyCertificate, verifyData, type Algorithm, type SubjectOptions } from './core'
import { validateChain } from './chain'
import { createEnvelope, createPkcs12, openEnvelope } from './containers'
import type { PkiMode } from '../../lib/local-pki-tools'
import { MAX_CONTENT_BYTES, MAX_ENCODED_BYTES } from './limits'

export interface PkiInput extends SubjectOptions {
  mode: PkiMode; action: 'create' | 'open' | 'certificate' | 'data'; algorithm: Algorithm; rsaBits: number
  privateKey: string; privateKeyPassword: string; cert: string; issuer: string; roots: string; intermediates: string; csr: string
  password: string; alias: string; content: Uint8Array; encoded: string; encoding: InputEncoding
  signatureMode: 'RSA-SHA256' | 'RSA-PSS-SHA256' | 'ECDSA-SHA256' | 'SM2'; userId: string
}
export interface PkiArtifact { label: string; kind: MaterialKind; hex: string; filename: string }
export interface PkiResult { status?: boolean; details?: unknown; artifacts: PkiArtifact[]; plaintext?: string }
export async function runPki(input: PkiInput): Promise<PkiResult> {
  if (!globalThis.crypto?.subtle) throw new Error('浏览器本地密码功能需要 HTTPS 或 localhost / HTTPS or localhost is required')
  if (input.content.byteLength > MAX_CONTENT_BYTES) throw new Error('原文不能超过 20 MB / Content must not exceed 20 MB')
  const result: PkiResult = { artifacts: [] }
  const add = (label: string, kind: MaterialKind, bytes: Uint8Array, filename: string) => result.artifacts.push({ label, kind, hex: bytesToHex(bytes), filename })
  const id = () => loadIdentity(input.privateKey, input.privateKeyPassword)
  const encoded = () => {
    const bytes = decodeMaterial(input.encoded, input.encoding)
    if (bytes.length > MAX_ENCODED_BYTES) throw new Error('密文、信封或签名材料不能超过 21 MB / Encoded material must not exceed 21 MB')
    return bytes
  }
  const userId = input.userId
  if (new TextEncoder().encode(userId).length > 8191) throw new Error('SM2 userId 不能超过 8191 字节 / SM2 userId exceeds 8191 bytes')
  switch (input.mode) {
    case 'csr-create':
    case 'self-signed-certificate': {
      const identity = input.privateKey.trim() ? await id() : await generateIdentity(input.algorithm, input.rsaBits)
      const isCsr = input.mode === 'csr-create'
      add(isCsr ? 'CSR' : '证书 / Certificate', isCsr ? 'csr' : 'certificate', isCsr ? await createCsr(identity, input, userId) : await createCertificate(identity, input, undefined, userId), isCsr ? 'request.csr' : 'certificate.cer')
      add('私钥 / Private key', 'private-key', identity.privateDer, 'private-key.der')
      add('公钥 / Public key', 'public-key', der(identity.publicInfo), 'public-key.der')
      result.details = { algorithm: identity.algorithm, subject: input.commonName }
      break
    }
    case 'csr-parse': {
      const info = await inspectCsr(input.csr, userId); result.status = info.signatureValid; result.details = info; break
    }
    case 'pkcs12-create':
      add('PKCS#12', 'binary', await createPkcs12(await id(), certificates(input.cert), input.password, input.alias, userId), 'identity.p12'); break
    case 'certificate-chain': {
      const report = await validateChain(certificate(input.cert), input.intermediates.trim() ? certificates(input.intermediates) : [], certificates(input.roots), userId)
      result.status = report.valid; result.details = report; break
    }
    case 'certificate-verify': {
      const cert = certificate(input.cert)
      result.status = input.action === 'data' ? await verifyData(cert, input.content, encoded(), input.signatureMode, userId) : await verifyCertificate(cert, input.issuer.trim() ? certificate(input.issuer) : cert, userId)
      result.details = { subject: name(cert.subject), algorithm: algorithm(cert.subjectPublicKeyInfo), validFrom: cert.notBefore.value.toISOString(), validTo: cert.notAfter.value.toISOString(), withinValidity: new Date() >= cert.notBefore.value && new Date() <= cert.notAfter.value, trust: '未检查 / Not checked', revocation: '未检查 / Not checked' }; break
    }
    case 'certificate-encrypt':
    case 'certificate-envelope': {
      const envelope = input.mode === 'certificate-envelope'
      if (input.action === 'open') {
        const bytes = envelope ? await openEnvelope(certificate(input.cert), await id(), encoded()) : await decryptWithKey(await id(), encoded())
        add('解密结果 / Decrypted content', 'binary', bytes, 'decrypted.bin')
        try { result.plaintext = new TextDecoder('utf-8', { fatal: true }).decode(bytes) } catch { /* Binary data remains available for download. */ }
      } else add(envelope ? 'CMS EnvelopedData' : '密文 / Ciphertext', envelope ? 'pkcs7' : 'ciphertext', envelope ? await createEnvelope(certificate(input.cert), input.content) : await encryptWithCertificate(certificate(input.cert), input.content), envelope ? 'envelope.p7m' : 'ciphertext.bin')
      break
    }
  }
  return result
}
