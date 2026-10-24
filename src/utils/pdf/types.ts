export type PdfStatus = 'pass' | 'fail' | 'unsupported'
export interface PdfVerifyOptions { certificate?: string; publicKey?: string; userId?: string }
export interface PdfCertificateInfo {
  subject: string; issuer: string; serialNumber: string; algorithm: string
  validFrom: string; validTo: string; withinValidity: boolean; sha256: string; hex: string
}
export interface PdfSignatureReport {
  name: string; format: 'CMS' | 'SES' | 'RAW_SM2' | 'unknown'; subFilter: string
  range: number[]; revisionEnd: number; hasLaterChanges: boolean
  signatureStatus: PdfStatus; integrityStatus: PdfStatus; message: string
  certificates: PdfCertificateInfo[]; warnings: string[]
}
export interface PdfReport {
  status: PdfStatus; message: string; signatures: PdfSignatureReport[]; warnings: string[]; fileSize: number
}
export class PdfUnsupported extends Error { constructor(message: string) { super(message); this.name = 'PdfUnsupported' } }
export const MAX_PDF_BYTES = 20 * 1024 * 1024
