import { ASN1 } from '@lapo/asn1js'
import { Base64 } from '@lapo/asn1js/base64.js'
import { Hex } from '@lapo/asn1js/hex.js'
import { Defs } from '@lapo/asn1js/defs.js'
import { STANDARD_OID_NAMES } from '../certificateOids'
import { ASN1_MAX_BYTES, type Asn1Request, type Asn1Result, type Asn1Node } from './types'

function decodeText(text: string, format: Asn1Request['format']) {
  const value = text.trim()
  if (!value) throw new Error('请粘贴 ASN.1 数据，或选择一个本地文件。')
  if (format === 'pem' || format === 'auto' && value.includes('-----BEGIN ')) {
    const blocks = [...value.matchAll(/-----BEGIN ([A-Z0-9 #.-]+)-----[\s\S]*?-----END \1-----/g)]
    if (!blocks.length) throw new Error('PEM 头尾不完整，请检查 BEGIN 和 END 行。')
    if (value.replace(/-----BEGIN ([A-Z0-9 #.-]+)-----[\s\S]*?-----END \1-----/g, '').trim()) throw new Error('PEM 块以外存在额外内容，请检查输入。')
    const parts = blocks.map(block => Uint8Array.from(Base64.unarmor(block[0])))
    const bytes = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0))
    let offset = 0
    for (const part of parts) { bytes.set(part, offset); offset += part.length }
    return { bytes, format: blocks.length > 1 ? `PEM · ${blocks.length} 个对象` : 'PEM' }
  }
  if (format === 'hex' || format === 'auto' && /^[\da-fA-F\s]+$/.test(value)) {
    return { bytes: Uint8Array.from(Hex.decode(value)), format: 'HEX' }
  }
  return { bytes: Uint8Array.from(Base64.decode(value)), format: 'Base64' }
}

export function decodeAsn1(request: Asn1Request): Asn1Result {
  const started = performance.now()
  if ((request.text?.length || request.bytes?.length || 0) > ASN1_MAX_BYTES) throw new Error('数据超过 2 MB，请选择较小的 ASN.1 文件。')
  let input: { bytes: Uint8Array; format: string }
  if (request.bytes) {
    const text = new TextDecoder().decode(request.bytes)
    const isText = /^[\s\x20-\x7e]*$/.test(text)
    input = isText ? decodeText(text, request.format) : { bytes: request.bytes, format: 'DER / BER' }
  } else input = decodeText(request.text || '', request.format)
  if (!input.bytes.length) throw new Error('没有可解析的字节，请检查数据内容。')
  const roots: ASN1[] = []
  let offset = 0
  while (offset < input.bytes.length) {
    const root = ASN1.decode(input.bytes, offset)
    if (root.posEnd() <= offset) throw new Error('数据未能完整解析，请检查编码格式。')
    roots.push(root)
    offset = root.posEnd()
    if (roots.length > 100) throw new Error('一次最多解析 100 个顶层对象。')
  }
  const nodes: Asn1Node[] = []
  const names: string[] = []
  for (const root of roots) {
    let definition = request.definition === 'none' ? undefined : Defs.commonTypes.find(item => item.description === request.definition)
    if (request.definition === 'auto') {
      let score = 0.6
      for (const candidate of Defs.commonTypes) {
        try {
          const match = Defs.match(root, candidate)
          const ratio = match.recognized / match.total
          // A high overall score can hide an incompatible required field.
          const compatible = [root, ...(root.sub || [])].every(node => !node.def?.mismatch)
          if (compatible && ratio > score) { score = ratio; definition = candidate }
        } catch { /* Unsupported definitions must not prevent raw ASN.1 inspection. */ }
      }
    }
    try { Defs.match(root, definition || null) }
    catch { definition = undefined; Defs.match(root, null) }
    if (definition) names.push(definition.description)
    const visit = (node: ASN1, parent: string | null, depth: number): string => {
      if (nodes.length >= 12000 || depth > 80) throw new Error('结构过大或嵌套过深，请分段解析。')
      const id = `node-${nodes.length}`
      let value: string
      try { value = (node.content(180) || '').slice(0, 600) } catch { value = '内容无法解码，仍可查看原始字节。' }
      const oid = node.typeName() === 'OBJECT_IDENTIFIER' ? value.split('\n')[0] : ''
      const result: Asn1Node = {
        id, parent, depth, type: node.typeName().replace(/_/g, ' '),
        tagClass: node.tag.tagClass, tagNumber: String(node.tag.tagNumber), constructed: node.tag.tagConstructed,
        encapsulated: !node.tag.tagConstructed && !!node.sub?.length, indefinite: node.length < 0,
        offset: node.posStart(), lengthOffset: node.posLen(), contentOffset: node.posContent(), end: node.posEnd(),
        header: node.header, contentLength: Math.abs(node.length), value,
        field: node.def?.id || '', schema: node.def?.name || '', definitionMismatch: !!node.def?.mismatch,
        oid, oidName: oid ? STANDARD_OID_NAMES[oid] || value.split('\n').slice(1).join(' · ') : '', children: [],
      }
      nodes.push(result)
      result.children = (node.sub || []).map(child => visit(child, id, depth + 1))
      return id
    }
    visit(root, null, 0)
  }
  return { ...input, nodes, roots: nodes.filter(node => !node.parent).map(node => node.id),
    definition: [...new Set(names)].join(' / ') || '通用 ASN.1',
    elapsed: Math.max(1, Math.round(performance.now() - started)), hasIndefinite: nodes.some(node => node.indefinite) }
}
