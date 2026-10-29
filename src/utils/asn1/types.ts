export type InputFormat = 'auto' | 'pem' | 'base64' | 'hex'
export type Asn1Part = 'node' | 'tag' | 'length' | 'value'
export type Asn1Encoding = 'hex' | 'hex-compact' | 'base64' | 'base64url' | 'readable' | 'tree'
export interface Asn1ExportRequest {
  action: 'export'
  bytes: Uint8Array
  offset: number
  part: Asn1Part
  encoding: Asn1Encoding
}
export interface Asn1Request {
  text?: string
  bytes?: Uint8Array
  format: InputFormat
  definition: string
}
export interface Asn1Node {
  id: string
  parent: string | null
  depth: number
  type: string
  tagClass: number
  tagNumber: string
  constructed: boolean
  encapsulated: boolean
  indefinite: boolean
  offset: number
  lengthOffset: number
  contentOffset: number
  end: number
  header: number
  contentLength: number
  value: string
  field: string
  schema: string
  definitionMismatch: boolean
  oid: string
  oidName: string
  children: string[]
}
export interface Asn1Result {
  bytes: Uint8Array
  nodes: Asn1Node[]
  roots: string[]
  format: string
  definition: string
  elapsed: number
  hasIndefinite: boolean
}
export const ASN1_MAX_BYTES = 2 * 1024 * 1024
export const definitionOptions = [
  { value: 'auto', label: '自动匹配定义' },
  { value: 'none', label: '原始 ASN.1 结构' },
  { value: 'X.509 certificate', label: 'X.509 证书' },
  { value: 'X.509 public key info', label: '公钥 · SPKI' },
  { value: 'CMS / PKCS#7 envelope', label: 'CMS / PKCS#7' },
  { value: 'PKCS#1 RSA private key', label: 'RSA 私钥 · PKCS#1' },
  { value: 'PKCS#8 private key', label: '私钥 · PKCS#8' },
  { value: 'PKCS#10 certification request', label: '证书请求 · CSR' },
  { value: 'X.509 certificate revocation list', label: '吊销列表 · CRL' },
]
