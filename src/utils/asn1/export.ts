import { ASN1 } from '@lapo/asn1js'
import { ASN1_MAX_BYTES, type Asn1ExportRequest } from './types'

/** Always export original bytes; UI previews may have been shortened. */
export function exportAsn1(request: Asn1ExportRequest): string {
  const { bytes, offset, part, encoding } = request
  if (!bytes.length || bytes.length > ASN1_MAX_BYTES || !Number.isInteger(offset) || offset < 0 || offset >= bytes.length) {
    throw new Error('节点数据不可用，请重新解析。')
  }
  const node = ASN1.decode(bytes, offset)
  if (encoding === 'readable') return node.content() ?? (node.typeName() === 'NULL' ? 'NULL' : '')
  if (encoding === 'tree') return node.toPrettyString()
  const ranges = {
    node: [node.posStart(), node.posEnd()],
    tag: [node.posStart(), node.posLen()],
    length: [node.posLen(), node.posContent()],
    // BER end-of-contents belongs to the encoding, not the value octets.
    value: [node.posContent(), node.posEnd() - (node.length < 0 ? 2 : 0)],
  }
  const [start, end] = ranges[part]
  const data = bytes.subarray(start, end)
  if (encoding === 'hex' || encoding === 'hex-compact') {
    return Array.from(data, byte => byte.toString(16).toUpperCase().padStart(2, '0')).join(encoding === 'hex' ? ' ' : '')
  }
  let binary = ''
  for (let pos = 0; pos < data.length; pos += 8192) binary += String.fromCharCode(...data.subarray(pos, pos + 8192))
  const base64 = btoa(binary)
  return encoding === 'base64url' ? base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '') : base64
}
