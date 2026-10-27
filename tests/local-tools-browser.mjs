// Static-site regression checks; no Java service is required.
import { createRequire } from 'node:module'
import { readFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import assert from 'node:assert/strict'

const require = createRequire(import.meta.url)
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright')
const origin = process.env.PKI_UI_URL || 'http://127.0.0.1:5319'
const browser = await chromium.launch({ headless: true, channel: process.env.PLAYWRIGHT_CHANNEL || 'msedge' })
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, permissions: ['clipboard-read', 'clipboard-write'] })
await context.addInitScript(() => {
  if (!localStorage.getItem('locale')) localStorage.setItem('locale', 'zh')
  if (!localStorage.getItem('favorites')) localStorage.setItem('favorites', JSON.stringify(['ofdSeal', 'signatureDebugger', 'sealGenerator', 'keyStore', 'pdfSeal', 'pkiWorkbench', 'fileDigest']))
})
const page = await context.newPage(), errors = [], remote = []
page.on('pageerror', error => errors.push(error.message))
page.on('request', request => {
  const url = new URL(request.url())
  if (url.pathname.startsWith('/api/') || (url.protocol.startsWith('http') && url.origin !== origin)) remote.push(request.url())
})
const main = page.locator('main')
const goto = async path => { await page.goto(origin + '/tools/' + path); await main.locator('h1').waitFor() }
try {
  await page.goto(origin)
  await main.waitFor()
  const links = await page.locator('aside nav a[href^="/tools/"]').evaluateAll(elements => [...new Set(elements.map(element => element.getAttribute('href')))])
  assert.equal(links.length, 37)
  for (const path of ['ofd-seal', 'signature-debugger', 'seal-generator']) {
    assert.equal(links.includes('/tools/' + path), false)
    await page.goto(origin + '/tools/' + path)
    await page.waitForURL(origin + '/')
  }
  const favorites = await page.evaluate(() => JSON.parse(localStorage.getItem('favorites')))
  assert.deepEqual(favorites, ['pdfVerify', 'csrCreate', 'fileDigest'])
  assert.equal(await page.getByText(/OFD 签章验签|OFD 签章诊断|电子印章制作|Java 服务处理/).count(), 0)
  console.log('PASS: 37 local tools; removed entries, legacy redirects and favorite migration')

  for (const path of ['pdf-verify', 'offline-revocation', 'self-signed-certificate', 'file-digest', 'oid-explorer']) {
    await goto(path)
    assert.equal(await main.getByText(/^(eseal|localTools|tools)\./).count(), 0)
  }
  await goto('file-digest')
  for (const bytes of [Buffer.alloc(0), Buffer.from('abc'), Buffer.alloc(1024 * 1024 + 7, 0xff)]) {
    await main.locator('input[type=file]').setInputFiles({ name: 'digest.bin', mimeType: 'application/octet-stream', buffer: bytes })
    await main.getByRole('button', { name: '计算摘要', exact: true }).click()
    await main.locator('[data-encoded-output]').first().waitFor()
    for (const algorithm of ['MD5', 'SHA1', 'SHA256', 'SM3']) assert.equal(await main.getByLabel(`${algorithm} hex`, { exact: true }).inputValue(), createHash(algorithm.toLowerCase()).update(bytes).digest('hex'))
  }
  await goto('oid-explorer')
  await main.getByPlaceholder('搜索 OID、名称或说明').fill('1.2.156.10197.1.501')
  await main.getByText('SM3withSM2', { exact: true }).waitFor()
  console.log('PASS: local Worker digests for empty/short/chunk-boundary files and OID lookup')

  await goto('self-signed-certificate')
  await main.getByLabel('通用名称 CN', { exact: true }).fill('Browser integration')
  await main.getByRole('button', { name: '生成自签证书', exact: true }).click()
  const encoded = main.locator('[data-encoded-output]').first()
  await encoded.waitFor()
  const original = await encoded.locator('textarea').inputValue()
  await encoded.locator('select').nth(0).selectOption('base64')
  await encoded.locator('select').nth(1).selectOption('64')
  await encoded.locator('select').nth(2).selectOption('CRLF')
  await encoded.locator('input[type=checkbox]').check()
  await encoded.getByRole('button', { name: '复制当前格式', exact: true }).click()
  const clipboard = await page.evaluate(() => navigator.clipboard.readText())
  assert.ok(clipboard.startsWith('-----BEGIN '))
  assert.equal(Buffer.from(clipboard.replace(/-----[^\r\n]+-----/g, '').replace(/\s/g, ''), 'base64').toString('hex'), original)
  const downloadPromise = page.waitForEvent('download')
  await encoded.getByRole('button', { name: '下载当前格式', exact: true }).click()
  const text = await readFile(await (await downloadPromise).path(), 'utf8')
  assert.ok(text.includes('\r\n')); assert.equal(text.replace(/\r\n/g, '').includes('\n'), false)
  assert.equal(Buffer.from(text.replace(/-----[^\r\n]+-----/g, '').replace(/\s/g, ''), 'base64').toString('hex'), original)
  console.log('PASS: local PKI, Base64/PEM headers, clipboard and CRLF download')

  await page.setViewportSize({ width: 390, height: 844 })
  await page.evaluate(() => { localStorage.setItem('theme', 'dark'); localStorage.setItem('locale', 'en') })
  for (const path of ['pdf-verify', 'offline-revocation', 'self-signed-certificate', 'file-digest', 'oid-explorer']) {
    await goto(path)
    assert.equal(await page.locator('html').getAttribute('class'), 'dark')
    assert.ok(await main.evaluate(element => element.scrollWidth <= window.innerWidth + 1))
    assert.equal(await main.getByText(/^(eseal|localTools|tools)\./).count(), 0)
  }
  assert.deepEqual(errors, []); assert.deepEqual(remote, [])
  console.log('PASS: mobile/dark/English layouts; zero API/external requests')
} finally { await browser.close() }
