import { parsePdfSignatures, type PdfSignatureSource } from './parser'
import { describeCertificate, requireSupportedSubFilter, unpadSignature, verifyPayload } from './payload'
import { PdfUnsupported, type PdfReport, type PdfSignatureReport, type PdfVerifyOptions } from './types'
export type { PdfReport, PdfSignatureReport, PdfCertificateInfo, PdfVerifyOptions, PdfStatus } from './types'
export { MAX_PDF_BYTES } from './types'

function contentBytes(bytes: Uint8Array, source: PdfSignatureSource): { range: number[]; content: Uint8Array; revisionEnd: number } {
  const value = source.byteRange
  if (value?.kind !== 'array' || value.items?.length !== 4 || value.items.some(item => item.kind !== 'number' || !Number.isSafeInteger(item.value) || (item.value as number) < 0)) throw new Error('ByteRange 必须为四个非负安全整数 / ByteRange must contain four nonnegative safe integers')
  const range = value.items.map(item => item.value as number), [start, firstLength, secondStart, secondLength] = range
  if (start !== 0 || firstLength >= secondStart || secondStart > bytes.length || secondLength > bytes.length - secondStart) throw new Error('ByteRange 越界或重叠 / ByteRange is out of bounds or overlaps')
  if (source.contents?.kind !== 'string' || source.contents.start !== firstLength || source.contents.end !== secondStart) throw new Error('ByteRange 排除区间必须精确对应当前签名 Contents / ByteRange gap must exactly match this signature Contents')
  const revisionEnd = secondStart + secondLength
  if (!source.revisionEnds.includes(revisionEnd)) throw new Error('ByteRange 未覆盖完整签署修订 / ByteRange does not end at a complete signed revision')
  if (source.dictionary.end > revisionEnd || value.start >= firstLength && value.end <= secondStart) throw new Error('签名字典未被签名范围覆盖 / Signature dictionary is outside the signed revision')
  const content = new Uint8Array(firstLength + secondLength)
  content.set(bytes.subarray(0, firstLength)); content.set(bytes.subarray(secondStart, revisionEnd), firstLength)
  return { range, content, revisionEnd }
}

export async function verifyPdf(bytes: Uint8Array, options: PdfVerifyOptions = {}): Promise<PdfReport> {
  const report: PdfReport = { status: 'unsupported', message: '', signatures: [], fileSize: bytes.length, warnings: [
    '仅本地验证文件签名及证书信息；不查询网络，不判断系统/根证书信任、吊销或 TSA 信任 / Local signature and certificate information only; no network, root/system trust, revocation or TSA trust checks',
    '证书当前有效期与签名数学结果独立；后续修改是否被允许未评估 / Current certificate validity is separate from cryptographic validity; permitted modifications were not evaluated',
  ] }
  try {
    if (!globalThis.crypto?.subtle) throw new PdfUnsupported('本地验签需要 HTTPS 或 localhost / Local verification requires HTTPS or localhost')
    if (new TextEncoder().encode(options.userId ?? '').length > 8191) throw new Error('SM2 userId 超过 8191 字节 / SM2 userId exceeds 8191 bytes')
    const sources = await parsePdfSignatures(bytes)
    if (!sources.length) { report.status = 'fail'; report.message = '未发现已签署的 PDF 签名域 / No signed PDF signature fields found'; return report }
    for (const source of sources) {
      const item: PdfSignatureReport = { name: source.name, format: 'unknown', subFilter: source.subFilter, range: [], revisionEnd: 0, hasLaterChanges: false, signatureStatus: 'unsupported', integrityStatus: 'unsupported', message: '', certificates: [], warnings: [...source.warnings] }
      report.signatures.push(item)
      try {
        const { range, content, revisionEnd } = contentBytes(bytes, source)
        item.range = range; item.revisionEnd = revisionEnd; item.hasLaterChanges = revisionEnd < bytes.length
        if (item.hasLaterChanges) item.warnings.push('该签名只保护较早修订，最终文件有后续内容 / This signature protects an earlier revision; the file contains later content')
        if (!source.visibleInFinal) item.warnings.push('此历史签名域在最终修订中已移除或替换 / This historical signature field was removed or replaced in the final revision')
        requireSupportedSubFilter(source.subFilter)
        const embeddedCert = source.certificate?.kind === 'string' ? source.certificate.bytes : source.certificate?.kind === 'array' && source.certificate.items?.[0]?.kind === 'string' ? source.certificate.items[0].bytes : undefined
        const result = await verifyPayload(unpadSignature(source.contents!.bytes!), content, source.subFilter, embeddedCert, options)
        item.format = result.format; item.signatureStatus = result.valid ? 'pass' : 'fail'
        item.integrityStatus = result.valid && result.contentValid ? 'pass' : 'fail'
        item.certificates = await Promise.all(result.certificates.map(describeCertificate))
        item.warnings.push(...result.warnings)
        item.message = !result.contentValid ? '文档摘要与签名记录不一致 / Document digest mismatch' : !result.valid ? '签名值校验失败 / Signature verification failed' : '所签修订的签名与摘要通过 / Signature and digest of the signed revision passed'
      } catch (error) {
        item.signatureStatus = error instanceof PdfUnsupported ? 'unsupported' : 'fail'
        item.integrityStatus = item.signatureStatus
        item.message = error instanceof Error ? error.message : 'PDF 签名校验失败 / PDF verification failed'
      }
    }
    const failed = report.signatures.some(item => item.signatureStatus === 'fail' || item.integrityStatus === 'fail')
    const unsupported = report.signatures.some(item => item.signatureStatus === 'unsupported' || item.integrityStatus === 'unsupported')
    const finalCovered = report.signatures.some(item => item.signatureStatus === 'pass' && item.integrityStatus === 'pass' && item.revisionEnd === bytes.length)
    report.status = failed ? 'fail' : unsupported ? 'unsupported' : finalCovered ? 'pass' : 'fail'
    report.message = failed ? '存在签名或文档完整性校验失败 / A signature or document integrity check failed' : unsupported ? '存在当前不支持的签名 / Some signatures are unsupported' : !finalCovered ? '历史签名有效，但最终文件包含未签名内容 / Historical signatures are valid, but final content is unsigned' : '签名数学校验通过，最终文件有签名覆盖；未评估证书信任或修改许可 / Cryptographic checks passed and final bytes are signed; trust and modification permissions were not evaluated'
  } catch (error) {
    report.status = error instanceof PdfUnsupported ? 'unsupported' : 'fail'
    report.message = error instanceof Error ? error.message : 'PDF 验签失败 / PDF verification failed'
  }
  return report
}
