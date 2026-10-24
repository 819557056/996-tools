import { PdfUnsupported, MAX_PDF_BYTES } from './types'

// A bounded, read-only PDF parser. Xref offsets select objects; signature-like text
// in page streams is never searched. Original byte spans bind Contents to ByteRange.
export interface PdfValue {
  kind: 'number' | 'name' | 'string' | 'array' | 'dict' | 'ref' | 'boolean' | 'null'
  start: number; end: number; value?: number | string | boolean; bytes?: Uint8Array
  items?: PdfValue[]; entries?: Map<string, PdfValue>; object?: number; generation?: number
}
interface Entry { type: number; offset: number; generation: number }
interface Revision { offset: number; end: number; entries: Map<number, Entry>; trailer: PdfValue }
interface ObjectValue { value: PdfValue; stream?: Uint8Array; offset: number }
export interface PdfSignatureSource {
  name: string; dictionary: PdfValue; contents?: PdfValue; byteRange?: PdfValue; certificate?: PdfValue
  subFilter: string; revisionEnds: number[]; visibleInFinal: boolean; warnings: string[]
}
const whitespace = (b: number) => [0, 9, 10, 12, 13, 32].includes(b)
const delimiter = (b: number) => whitespace(b) || [40, 41, 60, 62, 91, 93, 123, 125, 47, 37].includes(b)
const ascii = (bytes: Uint8Array) => new TextDecoder('latin1').decode(bytes)
const maximumObjects = 100000, maximumRevisions = 64

class Reader {
  position: number
  nodes = 0
  constructor(readonly bytes: Uint8Array, position = 0, readonly absolute = true) { this.position = position }
  skip() {
    while (this.position < this.bytes.length) {
      if (whitespace(this.bytes[this.position])) { this.position++; continue }
      if (this.bytes[this.position] !== 37) break
      while (this.position < this.bytes.length && ![10, 13].includes(this.bytes[this.position])) this.position++
    }
  }
  word() {
    this.skip(); const start = this.position
    while (this.position < this.bytes.length && !delimiter(this.bytes[this.position])) this.position++
    if (start === this.position) throw new Error('无效的 PDF 标记 / Invalid PDF token')
    return ascii(this.bytes.subarray(start, this.position))
  }
  expect(word: string) { if (this.word() !== word) throw new Error(`PDF 缺少 ${word} / Expected ${word}`) }
  number() {
    const text = this.word(), value = Number(text)
    if (!/^\d+$/.test(text) || !Number.isSafeInteger(value)) throw new Error('PDF 需要安全整数 / Expected safe PDF integer')
    return value
  }
  value(depth = 0): PdfValue {
    if (depth > 64 || ++this.nodes > maximumObjects * 20) throw new PdfUnsupported('PDF 对象嵌套或数量过多 / PDF object limits exceeded')
    this.skip(); const start = this.position, byte = this.bytes[this.position++]
    const result = (kind: PdfValue['kind'], extra: Partial<PdfValue> = {}): PdfValue => ({ kind, start: this.absolute ? start : -1, end: this.absolute ? this.position : -1, ...extra })
    if (byte === 47) {
      const chars: number[] = []
      while (this.position < this.bytes.length && !delimiter(this.bytes[this.position])) {
        if (this.bytes[this.position] === 35) {
          const hex = ascii(this.bytes.subarray(this.position + 1, this.position + 3))
          if (!/^[a-f0-9]{2}$/i.test(hex)) throw new Error('无效的 PDF 名称转义 / Invalid PDF name escape')
          chars.push(parseInt(hex, 16)); this.position += 3
        } else chars.push(this.bytes[this.position++])
      }
      return result('name', { value: ascii(Uint8Array.from(chars)) })
    }
    if (byte === 91) {
      const items: PdfValue[] = []
      for (;;) { this.skip(); if (this.bytes[this.position] === 93) { this.position++; break }; items.push(this.value(depth + 1)) }
      return result('array', { items })
    }
    if (byte === 60 && this.bytes[this.position] === 60) {
      this.position++; const entries = new Map<string, PdfValue>()
      for (;;) {
        this.skip()
        if (this.bytes[this.position] === 62 && this.bytes[this.position + 1] === 62) { this.position += 2; break }
        const key = this.value(depth + 1)
        if (key.kind !== 'name' || entries.has(key.value as string)) throw new Error('PDF 字典名称无效或重复 / Invalid or duplicate PDF dictionary key')
        entries.set(key.value as string, this.value(depth + 1))
      }
      return result('dict', { entries })
    }
    if (byte === 60) {
      let hex = ''
      while (this.position < this.bytes.length && this.bytes[this.position] !== 62) {
        const character = this.bytes[this.position++]
        if (whitespace(character)) continue
        const text = String.fromCharCode(character)
        if (!/[a-f0-9]/i.test(text)) throw new Error('PDF 十六进制字符串无效 / Invalid PDF hex string')
        hex += text
      }
      if (this.bytes[this.position++] !== 62) throw new Error('PDF 字符串不完整 / Truncated PDF string')
      if (hex.length % 2) hex += '0'
      return result('string', { bytes: Uint8Array.from(hex.match(/../g)?.map(item => parseInt(item, 16)) ?? []) })
    }
    if (byte === 40) {
      const bytes: number[] = []; let nesting = 1
      while (this.position < this.bytes.length && nesting) {
        let character = this.bytes[this.position++]
        if (character === 92) {
          character = this.bytes[this.position++]
          if (character === 13 || character === 10) { if (character === 13 && this.bytes[this.position] === 10) this.position++; continue }
          const escaped: Record<number, number> = { 110: 10, 114: 13, 116: 9, 98: 8, 102: 12 }
          if (escaped[character] !== undefined) character = escaped[character]
          else if (character >= 48 && character <= 55) {
            let octal = String.fromCharCode(character)
            for (let i = 0; i < 2 && this.bytes[this.position] >= 48 && this.bytes[this.position] <= 55; i++) octal += String.fromCharCode(this.bytes[this.position++])
            character = parseInt(octal, 8) & 255
          }
        } else if (character === 40) nesting++
        else if (character === 41) { if (--nesting === 0) break }
        else if (character === 13) { if (this.bytes[this.position] === 10) this.position++; character = 10 }
        bytes.push(character)
      }
      if (nesting) throw new Error('PDF 字符串不完整 / Truncated PDF string')
      return result('string', { bytes: Uint8Array.from(bytes) })
    }
    this.position = start
    const word = this.word()
    if (word === 'null') return result('null')
    if (word === 'true' || word === 'false') return result('boolean', { value: word === 'true' })
    if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(word)) throw new Error('不支持或损坏的 PDF 对象 / Unsupported or malformed PDF object')
    const value = Number(word)
    if (!Number.isFinite(value)) throw new Error('无效 PDF 数字 / Invalid PDF number')
    const numberEnd = this.position
    if (/^\d+$/.test(word)) {
      try {
        const generation = this.number()
        if (this.word() === 'R') {
          if (!Number.isSafeInteger(value)) throw new Error('Invalid PDF reference')
          return result('ref', { object: value, generation })
        }
      } catch { /* A number need not be followed by an indirect reference. */ }
      this.position = numberEnd
    }
    return result('number', { value })
  }
}

const entry = (dict: PdfValue, key: string) => dict.entries?.get(key)
const integer = (value: PdfValue | undefined) => {
  if (value?.kind !== 'number' || !Number.isSafeInteger(value.value) || (value.value as number) < 0) throw new Error('PDF 需要非负整数 / Expected nonnegative PDF integer')
  return value.value as number
}
const name = (value: PdfValue | undefined) => value?.kind === 'name' ? value.value as string : ''
export function pdfText(value?: PdfValue) {
  if (value?.kind !== 'string') return ''
  const bytes = value.bytes!
  return bytes[0] === 254 && bytes[1] === 255 ? new TextDecoder('utf-16be').decode(bytes.subarray(2)) : ascii(bytes)
}

async function decodeStream(object: ObjectValue): Promise<Uint8Array> {
  if (!object.stream) throw new Error('缺少 PDF 流 / Missing PDF stream')
  let data = object.stream
  const filter = entry(object.value, 'Filter')
  if (filter) {
    const filters = filter.kind === 'array' ? filter.items! : [filter]
    if (filters.length !== 1 || !['FlateDecode', 'Fl'].includes(name(filters[0]))) throw new PdfUnsupported('暂不支持该 PDF 流过滤器 / Unsupported PDF stream filter')
    const reader = new Blob([Uint8Array.from(data).buffer]).stream().pipeThrough(new DecompressionStream('deflate')).getReader()
    const chunks: Uint8Array[] = []; let length = 0
    try {
      for (;;) {
        const { value, done } = await reader.read(); if (done) break
        length += value.length
        if (length > MAX_PDF_BYTES) throw new PdfUnsupported('PDF 解压数据超过上限 / PDF decompression limit exceeded')
        chunks.push(value)
      }
    } finally { await reader.cancel() }
    data = new Uint8Array(length); let offset = 0
    for (const chunk of chunks) { data.set(chunk, offset); offset += chunk.length }
  }
  let parameters = entry(object.value, 'DecodeParms')
  if (parameters?.kind === 'array') parameters = parameters.items![0]
  if (parameters && parameters.kind !== 'null') {
    if (parameters.kind !== 'dict') throw new PdfUnsupported('不支持间接流解码参数 / Unsupported stream decode parameters')
    const predictor = entry(parameters, 'Predictor') ? integer(entry(parameters, 'Predictor')) : 1
    if (predictor !== 1) {
      const columns = entry(parameters, 'Columns') ? integer(entry(parameters, 'Columns')) : 1
      const colors = entry(parameters, 'Colors') ? integer(entry(parameters, 'Colors')) : 1
      const bits = entry(parameters, 'BitsPerComponent') ? integer(entry(parameters, 'BitsPerComponent')) : 8
      if (predictor < 10 || predictor > 15 || colors !== 1 || bits !== 8 || !columns || columns > 256 || data.length % (columns + 1)) throw new PdfUnsupported('不支持 PDF 流预测器 / Unsupported PDF stream predictor')
      const output = new Uint8Array(data.length / (columns + 1) * columns)
      for (let source = 0, target = 0; source < data.length;) {
        const type = data[source++]
        if (type > 4) throw new Error('无效 PNG 流预测器 / Invalid PNG predictor')
        for (let column = 0; column < columns; column++, target++) {
          const left = column ? output[target - 1] : 0, up = target >= columns ? output[target - columns] : 0, upperLeft = target >= columns && column ? output[target - columns - 1] : 0
          const estimate = left + up - upperLeft
          const distances = [Math.abs(estimate - left), Math.abs(estimate - up), Math.abs(estimate - upperLeft)]
          const paeth = distances[0] <= distances[1] && distances[0] <= distances[2] ? left : distances[1] <= distances[2] ? up : upperLeft
          output[target] = data[source++] + (type === 0 ? 0 : type === 1 ? left : type === 2 ? up : type === 3 ? Math.floor((left + up) / 2) : paeth)
        }
      }
      data = output
    }
  }
  return data
}

function indirect(bytes: Uint8Array, offset: number, expected?: { object: number; generation: number }): ObjectValue {
  if (offset < 0 || offset >= bytes.length) throw new Error('PDF 对象偏移越界 / PDF object offset out of bounds')
  const reader = new Reader(bytes, offset)
  const object = reader.number(), generation = reader.number(); reader.expect('obj')
  if (expected && (object !== expected.object || generation !== expected.generation)) throw new Error('PDF 对象引用不匹配 / PDF object reference mismatch')
  const value = reader.value(); reader.skip()
  const token = reader.word()
  if (token === 'endobj') return { value, offset }
  if (token !== 'stream' || value.kind !== 'dict') throw new Error('PDF 对象未正确结束 / Invalid PDF object ending')
  if (bytes[reader.position] === 13) reader.position++
  if (bytes[reader.position++] !== 10) throw new PdfUnsupported('不支持 PDF 流起始格式 / Unsupported PDF stream delimiter')
  const lengthValue = entry(value, 'Length')
  if (lengthValue?.kind !== 'number') throw new PdfUnsupported('索引和对象流需要直接长度 / Direct stream length required for index/object streams')
  const length = integer(lengthValue), end = reader.position + length
  if (end > bytes.length) throw new Error('PDF 流长度越界 / PDF stream length out of bounds')
  const stream = bytes.subarray(reader.position, end); reader.position = end
  reader.expect('endstream'); reader.expect('endobj')
  return { value, stream, offset }
}

function revisionEnd(bytes: Uint8Array, after: number, xref: number) {
  const reader = new Reader(bytes, after); reader.expect('startxref')
  if (reader.number() !== xref) throw new Error('PDF 修订交叉引用不匹配 / PDF revision xref mismatch')
  while (whitespace(bytes[reader.position])) reader.position++
  if (ascii(bytes.subarray(reader.position, reader.position + 5)) !== '%%EOF') throw new Error('PDF 修订缺少 EOF / PDF revision EOF missing')
  reader.position += 5
  if (bytes[reader.position] === 13) reader.position++
  if (bytes[reader.position] === 10) reader.position++
  return reader.position
}

async function readRevision(bytes: Uint8Array, offset: number): Promise<Revision> {
  const reader = new Reader(bytes, offset), entries = new Map<number, Entry>()
  const first = reader.word()
  let trailer: PdfValue, end: number
  if (first === 'xref') {
    for (;;) {
      reader.skip(); const saved = reader.position
      if (reader.word() === 'trailer') break
      reader.position = saved
      const start = reader.number(), count = reader.number()
      if (count > maximumObjects || start + count > maximumObjects) throw new PdfUnsupported('PDF 交叉引用数量过多 / PDF xref size limit')
      for (let i = 0; i < count; i++) {
        const objectOffset = reader.number(), generation = reader.number(), flag = reader.word()
        if (!['n', 'f'].includes(flag) || entries.has(start + i)) throw new Error('PDF 交叉引用重复或损坏 / Invalid or duplicate xref entry')
        entries.set(start + i, { type: flag === 'n' ? 1 : 0, offset: objectOffset, generation })
      }
    }
    trailer = reader.value(); end = revisionEnd(bytes, reader.position, offset)
  } else {
    const object = indirect(bytes, offset)
    trailer = object.value
    if (name(entry(trailer, 'Type')) !== 'XRef') throw new Error('startxref 没有指向交叉引用 / startxref does not point to xref')
    const widths = entry(trailer, 'W')?.items?.map(integer)
    if (!widths || widths.length !== 3 || widths.some(width => width > 6) || widths.reduce((sum, item) => sum + item, 0) === 0) throw new PdfUnsupported('不支持交叉引用流宽度 / Unsupported xref stream widths')
    const size = integer(entry(trailer, 'Size')), index = entry(trailer, 'Index')?.items?.map(integer) ?? [0, size]
    if (size > maximumObjects || index.length % 2) throw new PdfUnsupported('PDF 交叉引用范围不支持 / Unsupported xref index')
    const decoded = await decodeStream(object); let cursor = 0
    for (let part = 0; part < index.length; part += 2) {
      if (index[part] + index[part + 1] > maximumObjects) throw new PdfUnsupported('PDF 交叉引用数量过多 / PDF xref size limit')
      for (let i = 0; i < index[part + 1]; i++) {
        const values = widths.map((width, column) => {
          if (cursor + width > decoded.length) throw new Error('PDF 交叉引用流不完整 / Truncated xref stream')
          let value = width ? 0 : column === 0 ? 1 : 0
          for (let byte = 0; byte < width; byte++) value = value * 256 + decoded[cursor++]
          return value
        })
        const number = index[part] + i
        if (entries.has(number) || ![0, 1, 2].includes(values[0])) throw new PdfUnsupported('未知或重复的交叉引用项 / Unsupported xref entry')
        entries.set(number, { type: values[0], offset: values[1], generation: values[2] })
      }
    }
    if (cursor !== decoded.length) throw new Error('交叉引用流存在多余数据 / Trailing xref stream data')
    // Locate the end of this known stream object using its declared byte length.
    const tail = new Reader(bytes, object.value.end); tail.expect('stream')
    if (bytes[tail.position] === 13) tail.position++
    if (bytes[tail.position++] !== 10) throw new Error('Invalid stream delimiter')
    tail.position += object.stream!.length; tail.expect('endstream'); tail.expect('endobj')
    end = revisionEnd(bytes, tail.position, offset)
  }
  if (trailer.kind !== 'dict') throw new Error('PDF trailer 无效 / Invalid PDF trailer')
  if (entry(trailer, 'Encrypt')) throw new PdfUnsupported('暂不支持加密 PDF，请提供未加密原件 / Encrypted PDFs are unsupported')
  if (entry(trailer, 'XRefStm')) throw new PdfUnsupported('暂不支持混合交叉引用 PDF / Hybrid xref PDFs are unsupported')
  return { offset, end, entries, trailer }
}

export async function parsePdfSignatures(bytes: Uint8Array): Promise<PdfSignatureSource[]> {
  if (!bytes.length || bytes.length > MAX_PDF_BYTES) throw new PdfUnsupported('PDF 文件须为 1 字节至 20 MB / PDF size must be 1 byte to 20 MB')
  if (!ascii(bytes.subarray(0, 8)).startsWith('%PDF-')) throw new Error('不是 PDF 文件 / Not a PDF file')
  // Only the PDF footer is located textually. All signature discovery is structural.
  const tailStart = Math.max(0, bytes.length - 65536), tail = ascii(bytes.subarray(tailStart))
  const markers = [...tail.matchAll(/startxref[\x00\t\n\f\r ]+(\d+)[\x00\t\n\f\r ]+%%EOF/g)]
  if (!markers.length) throw new Error('PDF 缺少交叉引用尾标 / Missing PDF xref footer')
  let offset = Number(markers[markers.length - 1][1])
  const revisions: Revision[] = [], seen = new Set<number>()
  while (true) {
    if (!Number.isSafeInteger(offset) || seen.has(offset) || offset < 0 || offset >= bytes.length) throw new Error('PDF 修订引用循环或越界 / Invalid PDF revision chain')
    if (revisions.length >= maximumRevisions) throw new PdfUnsupported('PDF 修订数量超过 64 / More than 64 PDF revisions')
    seen.add(offset); const revision = await readRevision(bytes, offset); revisions.unshift(revision)
    const previous = entry(revision.trailer, 'Prev')
    if (!previous) break
    const before = integer(previous)
    if (before >= offset) throw new Error('PDF Prev 必须指向较早修订 / PDF Prev must point backwards')
    offset = before
  }
  const effective = new Map<number, Entry>(), found = new Map<number, PdfSignatureSource>()
  let root: PdfValue | undefined
  for (const [revisionIndex, revision] of revisions.entries()) {
    for (const [number, value] of revision.entries) effective.set(number, value)
    root = entry(revision.trailer, 'Root') ?? root
    const cache = new Map<number, PdfValue>(), loading = new Set<number>()
    const resolve = async (value: PdfValue | undefined, depth = 0): Promise<PdfValue | undefined> => {
      if (!value || value.kind !== 'ref') return value
      if (depth > 64 || loading.has(value.object!)) throw new Error('PDF 对象引用循环 / Cyclic PDF object reference')
      const objectNumber = value.object!, descriptor = effective.get(objectNumber)
      if (!descriptor || descriptor.type === 0) throw new Error('PDF 对象引用不存在 / Missing referenced PDF object')
      if (cache.has(objectNumber)) return cache.get(objectNumber)
      loading.add(objectNumber)
      try {
        let parsed: PdfValue
        if (descriptor.type === 1) {
          if (descriptor.generation !== value.generation || descriptor.offset >= revision.end) throw new Error('PDF 对象版本或偏移错误 / Invalid PDF object generation/offset')
          const object = indirect(bytes, descriptor.offset, { object: objectNumber, generation: descriptor.generation })
          parsed = object.value
        } else {
          if (value.generation !== 0) throw new Error('对象流引用代数须为零 / Object stream generation must be zero')
          const streamEntry = effective.get(descriptor.offset)
          if (!streamEntry || streamEntry.type !== 1) throw new Error('PDF 对象流引用无效 / Invalid object stream reference')
          const object = indirect(bytes, streamEntry.offset, { object: descriptor.offset, generation: streamEntry.generation })
          if (name(entry(object.value, 'Type')) !== 'ObjStm') throw new Error('引用并非对象流 / Expected ObjStm')
          const decoded = await decodeStream(object), first = integer(entry(object.value, 'First')), count = integer(entry(object.value, 'N'))
          if (count > maximumObjects || first > decoded.length || descriptor.generation >= count) throw new Error('无效 PDF 对象流索引 / Invalid object stream index')
          const header = new Reader(decoded, 0, false), objects: { number: number; offset: number }[] = []
          for (let index = 0; index < count; index++) objects.push({ number: header.number(), offset: header.number() })
          header.skip()
          if (header.position !== first || new Set(objects.map(item => item.number)).size !== count || objects.some((item, index) => first + item.offset >= decoded.length || (index > 0 && item.offset <= objects[index - 1].offset))) throw new Error('PDF 对象流头无效 / Invalid object stream header')
          const selected = objects[descriptor.generation]
          if (selected.number !== objectNumber) throw new Error('PDF 对象流对象编号不匹配 / Object stream object number mismatch')
          const objectReader = new Reader(decoded, first + selected.offset, false)
          parsed = objectReader.value(); objectReader.skip()
          const boundary = descriptor.generation + 1 < count ? first + objects[descriptor.generation + 1].offset : decoded.length
          if (objectReader.position !== boundary) throw new Error('PDF 对象流内容重叠 / Object stream contents overlap')
        }
        if (parsed.kind === 'ref') parsed = (await resolve(parsed, depth + 1))!
        cache.set(objectNumber, parsed); return parsed
      } finally { loading.delete(objectNumber) }
    }
    const catalog = await resolve(root)
    if (catalog?.kind !== 'dict' || name(entry(catalog, 'Type')) !== 'Catalog') throw new Error('PDF Catalog 无效 / Invalid PDF catalog')
    const form = await resolve(entry(catalog, 'AcroForm'))
    if (!form) continue
    if (form.kind !== 'dict') throw new Error('PDF AcroForm 无效 / Invalid PDF AcroForm')
    if (entry(form, 'XFA')) throw new PdfUnsupported('暂不支持 XFA PDF / XFA PDFs are unsupported')
    const fields = await resolve(entry(form, 'Fields'))
    if (fields?.kind !== 'array') throw new Error('PDF 签名域列表无效 / Invalid PDF fields array')
    const visited = new Set<PdfValue>(); let fieldCount = 0
    const walk = async (reference: PdfValue, parentName = '', parentType = '', depth = 0): Promise<void> => {
      if (depth > 32 || ++fieldCount > 2048) throw new PdfUnsupported('PDF 表单字段数量或深度超限 / PDF field limits exceeded')
      const field = await resolve(reference)
      if (field?.kind !== 'dict' || visited.has(field)) throw new Error('PDF 表单字段无效或循环 / Invalid or cyclic PDF field')
      visited.add(field)
      const ownName = pdfText(await resolve(entry(field, 'T'))), fieldName = [parentName, ownName].filter(Boolean).join('.')
      const type = name(await resolve(entry(field, 'FT'))) || parentType
      const value = await resolve(entry(field, 'V'))
      if (type === 'Sig' && value && value.kind !== 'null') {
        if (value.kind !== 'dict') throw new Error('PDF 签名值不是字典 / PDF signature value is not a dictionary')
        if (value.start < 0) throw new PdfUnsupported('签名字典位于压缩对象流，无法绑定原始 Contents / Compressed signature dictionaries are unsupported')
        let item = found.get(value.start)
        if (!item) {
          const contents = entry(value, 'Contents')
          if (contents?.kind === 'ref') throw new PdfUnsupported('签名 Contents 必须为直接字节字符串 / Indirect signature Contents is unsupported')
          item = { name: fieldName || `Signature ${found.size + 1}`, dictionary: value, contents, byteRange: entry(value, 'ByteRange'), certificate: await resolve(entry(value, 'Cert')), subFilter: name(entry(value, 'SubFilter')), revisionEnds: [], visibleInFinal: false, warnings: [] }
          found.set(value.start, item)
          if (found.size > 64) throw new PdfUnsupported('最多验证 64 个 PDF 签名 / At most 64 PDF signatures')
          if (entry(value, 'Reference')) item.warnings.push('DocMDP/FieldMDP 允许修改策略未检查 / Modification permissions were not checked')
        }
        item.revisionEnds.push(revision.end)
        if (revisionIndex === revisions.length - 1) item.visibleInFinal = true
      }
      const kids = await resolve(entry(field, 'Kids'))
      if (kids) {
        if (kids.kind !== 'array') throw new Error('PDF Kids 无效 / Invalid PDF field Kids')
        for (const child of kids.items!) await walk(child, fieldName, type, depth + 1)
      }
    }
    for (const field of fields.items!) await walk(field)
  }
  return [...found.values()]
}
