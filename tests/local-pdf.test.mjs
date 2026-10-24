import { test, after } from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { mkdir, mkdtemp, readFile, rm } from 'node:fs/promises'
import { join, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createHash } from 'node:crypto'
import * as a from 'asn1js'
import * as p from 'pkijs'
import { PDFDocument, PDFName, PDFHexString } from 'pdf-lib'

const root = fileURLToPath(new URL('..', import.meta.url)), tempRoot = resolve(root, 'tmp')
await mkdir(tempRoot, { recursive: true })
const temp = await mkdtemp(join(tempRoot, 'local-pdf-'))
after(async () => { assert.ok(resolve(temp).startsWith(tempRoot + sep)); await rm(temp, { recursive: true, force: true }) })
const require = createRequire(import.meta.url)
const { build } = createRequire(require.resolve('vite/package.json'))('esbuild')
await build({ stdin: { contents: "export * from './src/utils/pdf/verify.ts';export * from './src/utils/pdf/parser.ts'", resolveDir: root }, bundle: true, packages: 'external', platform: 'node', format: 'cjs', outfile: join(temp, 'pdf.cjs') })
const { verifyPdf, parsePdfSignatures, MAX_PDF_BYTES } = require(join(temp, 'pdf.cjs'))
const fixture = async name => Uint8Array.from(await readFile(join(root, 'tests/fixtures/pdf', name)))
const text = bytes => Buffer.from(bytes).toString('latin1')
function replace(bytes, from, to) {
  assert.equal(from.length, to.length, 'Mutation must preserve byte offsets')
  const index = text(bytes).indexOf(from); assert.ok(index >= 0, `Missing fixture token ${from}`)
  const output = Uint8Array.from(bytes); output.set(Buffer.from(to, 'latin1'), index); return output
}
function simplePdf(objects, trailer = '') {
  let body = '%PDF-1.7\n', offsets = [0]
  for (const [index, object] of objects.entries()) { offsets.push(Buffer.byteLength(body, 'latin1')); body += `${index + 1} 0 obj\n${object}\nendobj\n` }
  const xref = Buffer.byteLength(body, 'latin1')
  body += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.slice(1).map(offset => `${String(offset).padStart(10, '0')} 00000 n \n`).join('')}trailer\n<< /Size ${objects.length + 1} /Root 1 0 R ${trailer} >>\nstartxref\n${xref}\n%%EOF\n`
  return Uint8Array.from(Buffer.from(body, 'latin1'))
}
async function mutateCms(file, mutate) {
  const bytes = await fixture(file), source = (await parsePdfSignatures(bytes))[0]
  const info = new p.ContentInfo({ schema: a.fromBER(source.contents.bytes).result }), signed = new p.SignedData({ schema: info.content })
  mutate(signed)
  info.content = signed.toSchema(true)
  const changed = Buffer.from(info.toSchema().toBER(false)).toString('hex'), reserved = source.contents.end - source.contents.start - 2
  assert.ok(changed.length <= reserved)
  bytes.set(Buffer.from(changed.padEnd(reserved, '0')), source.contents.start + 1)
  return bytes
}

for (const [file, format] of [
  ['sm2-cms.pdf', 'CMS'], ['sm2-ses.pdf', 'SES'], ['sm2-raw.pdf', 'RAW_SM2'],
  ['rsa-cms.pdf', 'CMS'], ['ecdsa-cms.pdf', 'CMS'], ['rsa-direct-cms.pdf', 'CMS'],
  ['rsa-pss-cms.pdf', 'CMS'],
  ['sm2-xref-stream.pdf', 'CMS'], ['sm2-service-cms.pdf', 'CMS'], ['sm2-service-ses.pdf', 'SES'],
]) test(`Independent Java fixture ${file}: verifies original bytes and extracts offline certificate`, async () => {
  const bytes = await fixture(file), before = Uint8Array.from(bytes)
  const report = await verifyPdf(bytes)
  assert.equal(report.status, 'pass', JSON.stringify(report))
  assert.equal(report.signatures.length, 1)
  const item = report.signatures[0]
  assert.equal(item.format, format); assert.equal(item.signatureStatus, 'pass'); assert.equal(item.integrityStatus, 'pass')
  assert.equal(item.revisionEnd, bytes.length); assert.equal(item.hasLaterChanges, false)
  assert.equal(item.certificates.length, 1)
  assert.equal(item.certificates[0].sha256, createHash('sha256').update(Buffer.from(item.certificates[0].hex, 'hex')).digest('hex'))
  assert.equal(typeof item.certificates[0].withinValidity, 'boolean')
  assert.deepEqual(bytes, before, 'Verification must not alter signed source bytes')
})

test('Two incremental signatures retain separate coverage and verify both signers', async () => {
  const bytes = await fixture('two-signatures.pdf'), report = await verifyPdf(bytes)
  assert.equal(report.status, 'pass', JSON.stringify(report))
  assert.equal(report.signatures.length, 2)
  assert.ok(report.signatures.every(item => item.signatureStatus === 'pass' && item.integrityStatus === 'pass'))
  assert.equal(report.signatures[0].hasLaterChanges, true)
  assert.equal(report.signatures[1].hasLaterChanges, false)
  assert.ok(report.signatures[0].revisionEnd < report.signatures[1].revisionEnd)
  assert.notEqual(report.signatures[0].certificates[0].sha256, report.signatures[1].certificates[0].sha256)
})

test('Content tampering fails CMS/SES digest or legacy signature without claiming trust', async () => {
  for (const file of ['sm2-cms.pdf', 'rsa-cms.pdf', 'ecdsa-cms.pdf', 'sm2-service-ses.pdf', 'sm2-raw.pdf']) {
    const original = await fixture(file), changed = Uint8Array.from(original)
    changed[7] = changed[7] === 55 ? 54 : 55 // PDF version change keeps its syntax valid.
    const report = await verifyPdf(changed)
    assert.equal(report.status, 'fail', file)
    assert.equal(report.signatures[0].integrityStatus, 'fail', file)
  }
})

test('Unsigned append preserves the old signature but fails final-file coverage', async () => {
  const bytes = await fixture('sm2-cms.pdf'), appended = new Uint8Array(bytes.length + 18)
  appended.set(bytes); appended.set(new TextEncoder().encode('\n% unsigned change'), bytes.length)
  const report = await verifyPdf(appended)
  assert.equal(report.status, 'fail')
  assert.equal(report.signatures[0].signatureStatus, 'pass')
  assert.equal(report.signatures[0].hasLaterChanges, true)
  assert.match(report.message, /unsigned/)
})

test('ByteRange must match actual Contents, stay within bounds and end at its signed revision', async () => {
  const bytes = await fixture('sm2-cms.pdf'), source = (await parsePdfSignatures(bytes))[0]
  const rangeText = text(bytes.subarray(source.byteRange.start, source.byteRange.end))
  const values = source.byteRange.items.map(item => item.value)
  for (const mutation of [
    rangeText.replace(String(values[1]), String(values[1] - 1)),
    rangeText.replace(String(values[2]), '9'.repeat(String(values[2]).length)),
    rangeText.replace(String(values[3]), String(values[3] - 1)),
  ]) {
    const report = await verifyPdf(replace(bytes, rangeText, mutation))
    assert.equal(report.status, 'fail'); assert.equal(report.signatures[0].signatureStatus, 'fail')
    assert.match(report.signatures[0].message, /ByteRange/)
  }
})

test('Nonzero Contents padding is rejected; the ASN.1 length determines payload end', async () => {
  const bytes = await fixture('sm2-cms.pdf'), source = (await parsePdfSignatures(bytes))[0]
  bytes[source.contents.end - 2] = 49
  const report = await verifyPdf(bytes)
  assert.equal(report.status, 'fail'); assert.match(report.signatures[0].message, /Nonzero/)
})

test('Unknown SubFilter reports unsupported without silently falling back to raw SM2', async () => {
  const bytes = await fixture('sm2-cms.pdf')
  const report = await verifyPdf(replace(bytes, 'adbe.pkcs7.detached', 'unknown.sig.formatx'))
  assert.equal(report.status, 'unsupported'); assert.equal(report.signatures[0].signatureStatus, 'unsupported')
})

test('Wrong SM2 user ID and mismatched external certificate are rejected', async () => {
  assert.equal((await verifyPdf(await fixture('sm2-cms.pdf'), { userId: 'wrong-id' })).status, 'fail')
  const cert = Buffer.from(await fixture('sm2-signer.cer')).toString('base64')
  assert.equal((await verifyPdf(await fixture('rsa-cms.pdf'), { certificate: cert })).status, 'fail')
})

test('Signature-like text in a stream is never mistaken for a signature field', async () => {
  const fake = '/ByteRange [0 1 3 2] /Contents <3000> /SubFilter /GM.sm2seal'
  const bytes = simplePdf(['<< /Type /Catalog /Pages 2 0 R >>', '<< /Type /Pages /Kids [] /Count 0 >>', `<< /Length ${fake.length} >>\nstream\n${fake}\nendstream`])
  const report = await verifyPdf(bytes)
  assert.equal(report.status, 'fail'); assert.equal(report.signatures.length, 0)
})

test('Encrypted, hybrid xref and oversized documents report unsupported', async () => {
  for (const trailer of ['/Encrypt 2 0 R', '/XRefStm 1']) {
    const bytes = simplePdf(['<< /Type /Catalog >>', '<< >>'], trailer)
    assert.equal((await verifyPdf(bytes)).status, 'unsupported')
  }
  assert.equal((await verifyPdf(new Uint8Array(MAX_PDF_BYTES + 1))).status, 'unsupported')
})

test('Duplicate dictionary keys and cyclic references fail closed', async () => {
  const duplicate = simplePdf(['<< /Type /Catalog /AcroForm 2 0 R >>', '<< /Fields [] /Fields [] >>'])
  assert.equal((await verifyPdf(duplicate)).status, 'fail')
  const cyclic = simplePdf(['<< /Type /Catalog /AcroForm 2 0 R >>', '<< /Fields [3 0 R] >>', '<< /T (cycle) /Kids [3 0 R] >>'])
  assert.equal((await verifyPdf(cyclic)).status, 'fail')
})

test('Compressed signature dictionaries explicitly report unsupported', async () => {
  const document = await PDFDocument.create(), context = document.context
  document.addPage()
  const signature = context.register(context.obj({ Type: 'Sig', SubFilter: 'adbe.pkcs7.detached', ByteRange: [0, 1, 3, 1], Contents: PDFHexString.of('3000') }))
  const field = context.register(context.obj({ FT: 'Sig', T: PDFHexString.fromText('Compressed'), V: signature }))
  document.catalog.set(PDFName.of('AcroForm'), context.register(context.obj({ Fields: [field] })))
  const report = await verifyPdf(await document.save({ useObjectStreams: true }))
  assert.equal(report.status, 'unsupported', JSON.stringify(report))
  assert.match(report.message, /Compressed signature/)
})

test('Malformed SM2 DER signature tags are rejected even when sm-crypto would accept them', async () => {
  const bytes = await fixture('sm2-cms.pdf'), source = (await parsePdfSignatures(bytes))[0]
  const parsed = a.fromBER(source.contents.bytes), info = new p.ContentInfo({ schema: parsed.result }), signed = new p.SignedData({ schema: info.content })
  const signature = new Uint8Array(signed.signerInfos[0].signature.getValue())
  signature[0] = 0x31 // SET instead of SEQUENCE: same bytes/length, invalid signature encoding.
  signed.signerInfos[0].signature = new a.OctetString({ valueHex: signature.buffer })
  info.content = signed.toSchema(true)
  const changed = Buffer.from(info.toSchema().toBER(false)).toString('hex')
  const reserved = source.contents.end - source.contents.start - 2
  assert.ok(changed.length <= reserved)
  bytes.set(Buffer.from(changed.padEnd(reserved, '0')), source.contents.start + 1)
  const report = await verifyPdf(bytes)
  assert.equal(report.status, 'fail'); assert.equal(report.signatures[0].signatureStatus, 'fail')
})

test('Malformed input and unsigned PDFs never return a successful report', async () => {
  assert.notEqual((await verifyPdf(new Uint8Array())).status, 'pass')
  assert.equal((await verifyPdf(new TextEncoder().encode('not a pdf'))).status, 'fail')
  assert.equal((await verifyPdf(await fixture('unsigned.pdf'))).status, 'fail')
})

test('PDF CMS digest is independently reproducible from original byte ranges', async () => {
  const bytes = await fixture('rsa-cms.pdf'), source = (await parsePdfSignatures(bytes))[0]
  const range = source.byteRange.items.map(item => item.value)
  const asn1 = a.fromBER(source.contents.bytes)
  const signed = new p.SignedData({ schema: new p.ContentInfo({ schema: asn1.result }).content })
  const expected = signed.signerInfos[0].signedAttrs.attributes.find(attr => attr.type === '1.2.840.113549.1.9.4').values[0].valueBlock.valueHexView
  const actual = createHash('sha256').update(bytes.subarray(0, range[1])).update(bytes.subarray(range[2], range[2] + range[3])).digest()
  assert.deepEqual(actual, Buffer.from(expected))
})

test('CMS digestAlgorithms and signer digest parameters cannot hide contradictory encodings', async () => {
  for (const mutate of [
    signed => { signed.digestAlgorithms[0].algorithmParams = new a.OctetString({ valueHex: new Uint8Array([1, 2, 3]).buffer }) },
    signed => { signed.signerInfos[0].digestAlgorithm.algorithmParams = new a.OctetString({ valueHex: new Uint8Array([1]).buffer }) },
    signed => { signed.digestAlgorithms.push(new p.AlgorithmIdentifier({ algorithmId: signed.digestAlgorithms[0].algorithmId, algorithmParams: new a.OctetString() })) },
  ]) {
    const report = await verifyPdf(await mutateCms('rsa-cms.pdf', mutate))
    assert.equal(report.status, 'fail')
    assert.match(JSON.stringify(report), /absent or NULL|Duplicate CMS digest/)
  }
  for (const parameters of [undefined, new a.Null()]) {
    const report = await verifyPdf(await mutateCms('rsa-cms.pdf', signed => {
      if (parameters) signed.digestAlgorithms[0].algorithmParams = parameters
      else delete signed.digestAlgorithms[0].algorithmParams
    }))
    assert.equal(report.status, 'pass', JSON.stringify(report))
  }
})

test('RSA-PSS validates nested hash and MGF hash parameters instead of ignoring them', async () => {
  for (const field of ['hash', 'mgfHash']) {
    const report = await verifyPdf(await mutateCms('rsa-pss-cms.pdf', signed => {
      const signer = signed.signerInfos[0], params = new p.RSASSAPSSParams({ schema: signer.signatureAlgorithm.algorithmParams })
      if (field === 'hash') params.hashAlgorithm.algorithmParams = new a.OctetString({ valueHex: new Uint8Array([1]).buffer })
      else {
        const hash = new p.AlgorithmIdentifier({ schema: params.maskGenAlgorithm.algorithmParams })
        hash.algorithmParams = new a.OctetString({ valueHex: new Uint8Array([2]).buffer })
        params.maskGenAlgorithm.algorithmParams = hash.toSchema()
      }
      signer.signatureAlgorithm.algorithmParams = params.toSchema()
    }))
    assert.equal(report.status, 'fail')
    assert.match(JSON.stringify(report), /RSA-PSS.*parameters must be absent or NULL/)
  }
})

test('CMS aggregates known invalid signers ahead of unsupported signers in either order', async () => {
  for (const reverse of [false, true]) for (const failure of ['signature', 'digest']) {
    const report = await verifyPdf(await mutateCms('rsa-cms.pdf', signed => {
      const known = signed.signerInfos[0], unknown = new p.SignerInfo({ schema: a.fromBER(known.toSchema().toBER(false)).result })
      unknown.signatureAlgorithm.algorithmId = '1.2.3.4.5'
      if (failure === 'signature') known.signature.valueBlock.valueHexView[0] ^= 1
      else known.signedAttrs.attributes.find(attr => attr.type === '1.2.840.113549.1.9.4').values[0].valueBlock.valueHexView[0] ^= 1
      signed.signerInfos = reverse ? [unknown, known] : [known, unknown]
    }))
    assert.equal(report.status, 'fail', JSON.stringify({ reverse, failure, report }))
    assert.equal(report.signatures[0].integrityStatus, 'fail')
    assert.ok(report.signatures[0].warnings.some(warning => warning.includes('Unsupported CMS')))
  }
  const onlyUnsupported = await verifyPdf(await mutateCms('rsa-cms.pdf', signed => { signed.signerInfos[0].signatureAlgorithm.algorithmId = '1.2.3.4.5' }))
  assert.equal(onlyUnsupported.status, 'unsupported')
})

test('Unknown and RSA-PSS-restricted SPKI are unsupported, not invalid signatures', async () => {
  for (const algorithmId of ['1.2.3.4.5', '1.2.840.113549.1.1.10']) {
    const report = await verifyPdf(await mutateCms('rsa-cms.pdf', signed => {
      const cert = signed.certificates[0]
      cert.subjectPublicKeyInfo.algorithm = new p.AlgorithmIdentifier({ algorithmId })
      cert.tbsView = new Uint8Array(cert.toSchema(true).valueBlock.value[0].toBER(false))
    }))
    assert.equal(report.status, 'unsupported', JSON.stringify(report))
    assert.match(report.signatures[0].message, /Unsupported signer public key/)
  }
})

test('Unsupported raw RSA SubFilter is classified before trying to parse ASN.1 Contents', async () => {
  const original = await fixture('rsa-cms.pdf'), source = (await parsePdfSignatures(original))[0]
  const bytes = replace(original, 'adbe.pkcs7.detached', 'adbe.x509.rsa_sha1 ')
  bytes.fill(102, source.contents.start + 1, source.contents.end - 1) // Raw signature starts with 0xff.
  const report = await verifyPdf(bytes)
  assert.equal(report.status, 'unsupported')
  assert.match(report.signatures[0].message, /Unsupported PDF SubFilter/)
})

test('ECDSA AlgorithmIdentifier parameters must be absent', async () => {
  const report = await verifyPdf(await mutateCms('ecdsa-cms.pdf', signed => { signed.signerInfos[0].signatureAlgorithm.algorithmParams = new a.Null() }))
  assert.equal(report.status, 'fail')
  assert.match(JSON.stringify(report), /ECDSA signature parameters must be absent/)
})

test('Signed attributes reject a nonminimal nested DER length before cryptographic verification', async () => {
  const report = await verifyPdf(await mutateCms('rsa-cms.pdf', signed => {
    signed.signerInfos[0].signedAttrs.attributes.find(attr => attr.type === '1.2.840.113549.1.9.4').values[0].lenBlock.longFormUsed = true
  }))
  assert.equal(report.status, 'fail')
  assert.match(JSON.stringify(report), /Nonminimal signed-attribute DER length/)
})
