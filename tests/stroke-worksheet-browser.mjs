import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { PDFDocument } from 'pdf-lib'

const require = createRequire(import.meta.url)
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright')
const origin = process.env.PKI_UI_URL || 'http://127.0.0.1:5319'
const browser = await chromium.launch({ headless: true, channel: process.env.PLAYWRIGHT_CHANNEL || 'msedge' })
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } })
const errors = []
const remote = []
page.on('pageerror', error => errors.push(error.message))
page.on('request', request => {
  const url = new URL(request.url())
  if (url.protocol.startsWith('http') && url.origin !== origin) remote.push(url.origin)
})

try {
  await page.goto(`${origin}/tools/stroke-worksheet`)
  await page.locator('.page-paper svg').first().waitFor()
  assert.ok(await page.locator('.page-paper').count() >= 2)

  await page.getByLabel('练习内容').fill('永')
  await page.locator('.page-paper').first().waitFor()
  await page.waitForFunction(() => document.querySelectorAll('.page-paper').length === 1)
  const cells = page.locator('.page-paper [data-row-index="0"] > [data-cell-kind]')
  const fullCount = await cells.nth(0).locator('path').count()
  assert.ok(fullCount > 1)
  assert.equal(await cells.nth(1).locator('path').count(), 1)
  assert.equal(await cells.nth(2).locator('path').count(), 2)
  assert.equal(await cells.nth(fullCount + 1).locator('path').count(), fullCount)

  await page.getByLabel('格子大小').selectOption('24')
  assert.equal(await page.locator('.page-paper svg').first().getAttribute('viewBox'), '0 0 210 297')
  if (process.env.STROKE_SCREENSHOT) await page.screenshot({ path: process.env.STROKE_SCREENSHOT, fullPage: true })
  await page.emulateMedia({ media: 'print' })
  const printSize = await page.locator('#worksheet-print .print-page').first().evaluate(element => {
    const rectangle = element.getBoundingClientRect()
    return { width: rectangle.width, height: rectangle.height }
  })
  assert.ok(Math.abs(printSize.width - 793.7) < 2)
  assert.ok(Math.abs(printSize.height - 1122.5) < 2)
  const pdf = await PDFDocument.load(await page.pdf({ preferCSSPageSize: true, printBackground: true }))
  assert.equal(pdf.getPageCount(), 1)
  assert.ok(Math.abs(pdf.getPage(0).getWidth() - 595.28) < 2)
  assert.ok(Math.abs(pdf.getPage(0).getHeight() - 841.89) < 2)
  await page.emulateMedia({ media: 'screen' })
  await page.getByLabel('练习内容').fill('𠮷永')
  await page.getByText('没有笔画数据的字：').waitFor()
  assert.equal(await page.locator('.page-paper').count(), 1)
  await page.setViewportSize({ width: 390, height: 844 })
  await page.evaluate(() => { localStorage.setItem('theme', 'dark'); localStorage.setItem('locale', 'en') })
  await page.reload()
  await page.locator('.page-paper svg').first().waitFor()
  assert.equal(await page.locator('main h1').innerText(), 'Chinese stroke worksheet')
  assert.ok(await page.locator('main').evaluate(element => element.scrollWidth <= window.innerWidth + 1))
  assert.equal(await page.locator('main').getByText(/^tools\.strokeWorksheet\./).count(), 0)
  assert.deepEqual(errors, [])
  assert.deepEqual(remote, [])
  console.log('PASS: stroke sequence, offline data, and A4 print output')
} finally {
  await browser.close()
}
