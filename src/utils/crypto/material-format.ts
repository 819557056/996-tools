import * as asn1js from 'asn1js'

export type InputEncoding = 'auto' | 'hex' | 'base64' | 'pem'
export type MaterialKind = 'sm2-public' | 'sm2-private' | 'sm4-key' | 'certificate' | 'signature' | 'pkcs7' | 'envelope' | 'ciphertext' | 'iv' | 'binary' | 'public-key' | 'private-key' | 'rsa-private-key' | 'csr' | 'ocsp-request' | 'ocsp-response' | 'crl'
export type KeyStructure = 'raw' | 'der'

export function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('')
}

export function bytesToBase64(bytes: Uint8Array): string {
  let binary = ''
  for (let offset = 0; offset < bytes.length; offset += 8192) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 8192))
  }
  return btoa(binary)
}

/** Decode bytes, never Base64-encode the textual hexadecimal representation. */
export function decodeMaterial(value: string, encoding: InputEncoding = 'auto'): Uint8Array {
  if (!value.trim()) return new Uint8Array()
  let compact = value.replace(/\s/g, '')
  if (encoding === 'pem' || (encoding === 'auto' && value.trim().startsWith('-----BEGIN '))) {
    const match = value.trim().match(/^-----BEGIN ([A-Z0-9]+(?:[ -][A-Z0-9]+)*)-----\s*([A-Za-z0-9+/=\s]+)\s*-----END \1-----$/)
    if (!match) throw new Error('Invalid or mismatched BEGIN/END headers')
    compact = match[2].replace(/\s/g, '')
    encoding = 'base64'
  }
  if (encoding === 'hex' || (encoding === 'auto' && /^[0-9a-fA-F]+$/.test(compact))) {
    if (!/^(?:[0-9a-fA-F]{2})+$/.test(compact)) throw new Error('Hex requires complete byte pairs (0-9, A-F)')
    return Uint8Array.from(compact.match(/.{2}/g)!, byte => parseInt(byte, 16))
  }
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(compact) || compact.length % 4 === 1) {
    throw new Error('Invalid Base64 data')
  }
  let binary: string
  try {
    binary = atob(compact)
  } catch {
    throw new Error('Invalid Base64 data')
  }
  if (btoa(binary).replace(/=+$/, '') !== compact.replace(/=+$/, '')) {
    throw new Error('Invalid Base64 padding bits')
  }
  return Uint8Array.from(binary, character => character.charCodeAt(0))
}

export function materialToHex(value: string, encoding: InputEncoding = 'auto'): string {
  return bytesToHex(decodeMaterial(value, encoding))
}

function buffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.slice().buffer as ArrayBuffer
}

/** SPKI and PKCS#8 are real ASN.1 containers, not labels on raw key bytes. */
export function encodeSm2KeyDer(bytes: Uint8Array, kind: 'sm2-public' | 'sm2-private'): Uint8Array {
  const algorithm = new asn1js.Sequence({ value: [
    new asn1js.ObjectIdentifier({ value: '1.2.840.10045.2.1' }),
    new asn1js.ObjectIdentifier({ value: '1.2.156.10197.1.301' }),
  ] })
  if (kind === 'sm2-public') {
    if (bytes.length !== 65 || bytes[0] !== 4) throw new Error('SM2 public key must be 65 bytes, starting with 04')
    return new Uint8Array(new asn1js.Sequence({ value: [
      algorithm, new asn1js.BitString({ valueHex: buffer(bytes) }),
    ] }).toBER(false))
  }
  const curveOrder = 'fffffffeffffffffffffffffffffffff7203df6b21c6052b53bbf40939d54123'
  if (bytes.length !== 32 || bytes.every(byte => byte === 0) || bytesToHex(bytes) >= curveOrder) {
    throw new Error('SM2 private key must be a 32-byte scalar in the curve range')
  }
  const ecPrivateKey = new asn1js.Sequence({ value: [
    new asn1js.Integer({ value: 1 }),
    new asn1js.OctetString({ valueHex: buffer(bytes) }),
  ] })
  return new Uint8Array(new asn1js.Sequence({ value: [
    new asn1js.Integer({ value: 0 }), algorithm,
    new asn1js.OctetString({ valueHex: ecPrivateKey.toBER(false) }),
  ] }).toBER(false))
}

const RAW_LABELS: Record<MaterialKind, string> = {
  'sm2-public': 'SM2 RAW PUBLIC KEY', 'sm2-private': 'SM2 RAW PRIVATE KEY',
  'sm4-key': 'SM4 KEY', certificate: 'CERTIFICATE', signature: 'SM2 SIGNATURE',
  pkcs7: 'PKCS7', envelope: 'GM ENVELOPED DATA', ciphertext: 'ENCRYPTED DATA',
  'public-key': 'PUBLIC KEY', 'private-key': 'PRIVATE KEY', 'rsa-private-key': 'RSA PRIVATE KEY', csr: 'CERTIFICATE REQUEST',
  iv: 'INITIALIZATION VECTOR', binary: 'BINARY DATA',
  'ocsp-request': 'OCSP REQUEST', 'ocsp-response': 'OCSP RESPONSE', crl: 'X509 CRL',
}

export function materialLabel(kind: MaterialKind, structure: KeyStructure = 'raw'): string {
  if (structure === 'der' && kind === 'sm2-public') return 'PUBLIC KEY'
  if (structure === 'der' && kind === 'sm2-private') return 'PRIVATE KEY'
  return RAW_LABELS[kind]
}

export function formatMaterial(bytes: Uint8Array, options: {
  encoding: 'hex' | 'base64'
  header?: string
  lineLength?: number
  lineEnding?: 'LF' | 'CRLF'
  uppercase?: boolean
}): string {
  if (!bytes.length) return ''
  const lineLength = options.lineLength ?? 0
  if (!Number.isInteger(lineLength) || lineLength < 0 || lineLength > 256) throw new Error('Invalid line length')
  const eol = options.lineEnding === 'CRLF' ? '\r\n' : '\n'
  let text = options.encoding === 'hex' ? bytesToHex(bytes) : bytesToBase64(bytes)
  if (options.encoding === 'hex' && options.uppercase) text = text.toUpperCase()
  if (lineLength > 0) {
    const lines: string[] = []
    for (let offset = 0; offset < text.length; offset += lineLength) lines.push(text.slice(offset, offset + lineLength))
    text = lines.join(eol)
  }
  if (options.encoding === 'base64' && options.header) {
    if (!/^[A-Z0-9]+(?:[ -][A-Z0-9]+)*$/.test(options.header)) throw new Error('Invalid header label')
    text = `-----BEGIN ${options.header}-----${eol}${text}${eol}-----END ${options.header}-----`
  }
  return text
}
