import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFile, readdir } from 'node:fs/promises'
import vm from 'node:vm'

const assets = new URL('../dist/assets/', import.meta.url)
const file = (await readdir(assets, { recursive: true })).find(name => /(?:^|[/\\])asn1-decoder\.worker-[^/\\]+\.js$/.test(name))
assert.ok(file, 'Run pnpm build before testing the production worker')
const source = await readFile(new URL(file, assets), 'utf8')

function decode(input) {
  let response
  let closed = false
  const context = { TextDecoder, performance, Uint8Array, btoa,
    postMessage(value) { response = value }, close() { closed = true } }
  context.self = context
  // No DOM, Node runtime or network APIs are available to the bundled parser.
  vm.runInNewContext(source, context, { timeout: 5000 })
  context.input = { format: 'auto', definition: 'auto', ...input }
  vm.runInNewContext('self.onmessage({data: input})', context, { timeout: 5000 })
  assert.ok(closed)
  return response
}

const generic = '30 1B 02 01 2A 0C 0A 48 65 6C 6C 6F 20 41 53 4E 31 06 07 2A 86 48 CE 3D 02 01 01 01 FF'

test('generic ASN.1 stays generic and preserves exact TLV offsets', () => {
  const { result, error } = decode({ text: generic })
  assert.equal(error, undefined)
  assert.equal(result.definition, '通用 ASN.1')
  assert.equal(result.nodes.length, 5)
  assert.ok(result.nodes.every(node => !node.field))
  const textNode = result.nodes.find(node => node.type === 'UTF8String')
  assert.equal(textNode.value, 'Hello ASN1')
  assert.equal(textNode.offset, 5)
  assert.equal(textNode.lengthOffset, 6)
  assert.equal(textNode.contentOffset, 7)
  assert.equal(textNode.end, 17)
  assert.equal(result.nodes.at(-1).end, result.bytes.length)
})

test('binary DER, Base64 and multiple PEM blocks produce the same objects', () => {
  const bytes = Buffer.from(generic.replaceAll(' ', ''), 'hex')
  const base64 = bytes.toString('base64')
  const pem = `-----BEGIN ASN1-----\n${base64}\n-----END ASN1-----`
  for (const input of [{ bytes: new Uint8Array(bytes) }, { text: base64, format: 'base64' }]) {
    const { result } = decode(input)
    assert.equal(Buffer.from(result.bytes).toString('hex'), bytes.toString('hex'))
    assert.equal(result.roots.length, 1)
  }
  const { result } = decode({ text: `${pem}\n${pem}` })
  assert.equal(result.roots.length, 2)
  assert.equal(result.nodes[5].offset, bytes.length)
})

test('BER indefinite lengths remain inspectable', () => {
  const { result } = decode({ text: '30 80 02 01 2A 00 00' })
  assert.equal(result.hasIndefinite, true)
  assert.equal(result.nodes[0].end, 7)
  assert.equal(result.nodes[1].value, '42')
})

test('malformed, empty and oversized inputs return actionable errors', () => {
  for (const text of ['', '30 05 02 01', '-----BEGIN CERTIFICATE-----\nAAAA', '0'.repeat(2 * 1024 * 1024 + 1)]) {
    const response = decode({ text })
    assert.equal(response.result, undefined)
    assert.ok(response.error)
  }
})

function copy(text, offset, part, encoding) {
  const response = decode({ action: 'export', bytes: new Uint8Array(Buffer.from(text.replaceAll(' ', ''), 'hex')), offset, part, encoding })
  assert.equal(response.error, undefined)
  return response.text
}

test('every copy format preserves exact node, tag, length and value bytes', () => {
  const expected = { node: '0c0a48656c6c6f2041534e31', tag: '0c', length: '0a', value: '48656c6c6f2041534e31' }
  for (const [part, hex] of Object.entries(expected)) {
    assert.equal(copy(generic, 5, part, 'hex').replaceAll(' ', '').toLowerCase(), hex)
    assert.equal(copy(generic, 5, part, 'hex-compact'), hex.toUpperCase())
    assert.equal(copy(generic, 5, part, 'base64'), Buffer.from(hex, 'hex').toString('base64'))
    assert.equal(copy(generic, 5, part, 'base64url'), Buffer.from(hex, 'hex').toString('base64url'))
  }
  assert.equal(copy(generic, 5, 'value', 'readable'), 'Hello ASN1')
  assert.match(copy(generic, 0, 'node', 'tree'), /UTF8String @5\+10: Hello ASN1/)
})

test('copy handles BER terminators, high tag numbers, long lengths and empty values', () => {
  assert.equal(copy('30 80 02 01 2A 00 00', 0, 'node', 'hex'), '30 80 02 01 2A 00 00')
  assert.equal(copy('30 80 02 01 2A 00 00', 0, 'value', 'hex'), '02 01 2A')
  assert.equal(copy('30 80 02 01 2A 00 00', 0, 'length', 'hex'), '80')
  assert.equal(copy('9F 81 01 01 FF', 0, 'tag', 'hex'), '9F 81 01')
  assert.equal(copy('04 81 80' + 'FB'.repeat(128), 0, 'length', 'hex'), '81 80')
  assert.equal(copy('05 00', 0, 'value', 'base64'), '')
  assert.equal(copy('03 02 03 F8', 0, 'value', 'hex'), '03 F8')
  assert.equal(copy('04 02 FB FF', 0, 'value', 'base64url'), '-_8')
})

test('copy uses full content, independently of the shortened UI preview', () => {
  const text = 'x'.repeat(2000)
  const encoded = '0C8207D0' + Buffer.from(text).toString('hex')
  const { result } = decode({ text: encoded })
  assert.ok(result.nodes[0].value.length < text.length)
  assert.equal(copy(encoded, 0, 'value', 'readable'), text)
  assert.equal(Buffer.from(copy(encoded, 0, 'value', 'base64'), 'base64').toString(), text)
})
