import type { CertificateAddress, SubjectFields } from '../utils/ssl/config'

export type RootAlgorithm = 'rsa-2048' | 'rsa-4096' | 'sm2'
export type SiteAlgorithm = RootAlgorithm | 'rsa-3072' | 'ec-p256' | 'ec-p384'

export interface CertificateConfig {
  rootAlgorithm: RootAlgorithm
  rootDays: number
  subject: SubjectFields
  addresses: CertificateAddress[]
  days: number
  /** ISO time when explicitly scheduled; otherwise evaluated when generation starts. */
  start?: string
  clientAuth: boolean
  keySource: 'generate' | 'import'
  siteAlgorithm: SiteAlgorithm
}

export interface GenerationRequest {
  config: CertificateConfig
  keyPair?: { privatePem: string; publicPem: string }
}

export type GenerationStage = 'validate' | 'site-key' | 'root-key' | 'root-certificate' | 'site-certificate' | 'verify'
export const generationStages: { id: GenerationStage; label: string }[] = [
  { id: 'validate', label: '检查配置' },
  { id: 'site-key', label: '准备站点密钥并检查配对' },
  { id: 'root-key', label: '生成根 CA 密钥' },
  { id: 'root-certificate', label: '创建自签根证书' },
  { id: 'site-certificate', label: '签发 SSL 证书' },
  { id: 'verify', label: '核验证书签名与内容' }
]

export interface CertificateFile {
  name: string
  label: string
  description: string
  group: 'site' | 'root'
  secret: boolean
  /** DER uses bytes. PEM and readme use UTF-8 strings. */
  content: string | Uint8Array
}

export interface GenerationResult {
  files: CertificateFile[]
  rootName: string
  rootSubject: string
  siteAlgorithm: string
  signatureAlgorithm: string
  notBefore: string
  notAfter: string
  rootNotAfter: string
  fingerprint: string
  rootFingerprint: string
  checks: string[]
}

export type GenerationResponse =
  | { type: 'progress'; stage: GenerationStage }
  | { type: 'complete'; result: GenerationResult }
  | { type: 'error'; message: string }
