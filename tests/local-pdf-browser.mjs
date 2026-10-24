import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { readFile, mkdtemp, rm, mkdir } from 'node:fs/promises'
import { resolve, join, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const require = createRequire(import.meta.url), root = fileURLToPath(new URL('..', import.meta.url))
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright')
const { build } = createRequire(require.resolve('vite/package.json'))('esbuild')
const tempRoot = resolve(root, 'tmp'); await mkdir(tempRoot, { recursive: true })
const temp = await mkdtemp(join(tempRoot, 'local-pdf-browser-'))
const browser = await chromium.launch({ headless: true, channel: process.env.PLAYWRIGHT_CHANNEL || 'msedge' })
const origin = process.env.PKI_UI_URL || 'http://127.0.0.1:5319'
try {
  await build({ stdin: { contents: "export * from './src/utils/pki/core.ts'", resolveDir: root }, bundle: true, packages: 'external', platform: 'node', format: 'cjs', outfile: join(temp, 'core.cjs') })
  const api = require(join(temp, 'core.cjs'))
  const issuerKey = await api.generateIdentity('SM2'), leafKey = await api.generateIdentity('SM2')
  const issuerBytes = await api.createCertificate(issuerKey, { commonName: 'Browser OCSP issuer', ca: true })
  const issuer = api.certificate(api.pem(issuerBytes, 'CERTIFICATE'))
  const leafBytes = await api.createCertificate(leafKey, { commonName: 'Browser OCSP leaf' }, { certificate: issuer, identity: issuerKey })
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } }), errors = [], remote = []
  page.on('pageerror', error => errors.push(error.message))
  page.on('request', request => { const url = new URL(request.url()); if (url.pathname.startsWith('/api/') || (url.protocol.startsWith('http') && url.origin !== origin)) remote.push(request.url()) })
  await page.addInitScript(() => { if (!localStorage.getItem('locale')) localStorage.setItem('locale', 'zh') })
  const main = page.locator('main')
  const goto = async route => { await page.goto(origin + '/tools/' + route); await main.locator('h1').waitFor() }
  const pdfInput = () => main.getByLabel('PDF 文件（最多 20 MiB）', { exact: true })
  const verify = async () => { await main.getByRole('button', { name: '验证 PDF', exact: true }).click(); await main.getByRole('status').waitFor(); assert.equal(await main.getByRole('alert').count(), 0) }
  await goto('pdf-seal'); assert.ok(page.url().endsWith('/pdf-verify'))
  assert.equal(await main.getByRole('button', { name: '签名', exact: true }).count(), 0)
  for (const file of ['sm2-service-cms.pdf', 'sm2-service-ses.pdf', 'sm2-raw.pdf', 'rsa-cms.pdf', 'rsa-pss-cms.pdf', 'ecdsa-cms.pdf', 'sm2-xref-stream.pdf', 'two-signatures.pdf']) {
    await pdfInput().setInputFiles(join(root, 'tests/fixtures/pdf', file)); await verify()
    assert.match(await main.getByRole('status').innerText(), /签名数学校验通过/)
    assert.equal(await main.locator('[data-pdf-signature]').count(), file === 'two-signatures.pdf' ? 2 : 1)
  }
  const signedBytes = await readFile(join(root, 'tests/fixtures/pdf/sm2-service-ses.pdf'))
  await pdfInput().setInputFiles({ name: 'appended.pdf', mimeType: 'application/pdf', buffer: Buffer.concat([signedBytes, Buffer.from('\n% unprotected change\n')]) }); await verify()
  assert.doesNotMatch(await main.getByRole('status').innerText(), /^签名数学校验通过/)
  await pdfInput().setInputFiles(join(root, 'tests/fixtures/pdf/unsigned.pdf')); await verify()
  assert.match(await main.getByRole('status').innerText(), /未发现/)
  await pdfInput().setInputFiles(join(root, 'tests/fixtures/pdf/sm2-service-ses.pdf')); await verify()
  const reportDownload = page.waitForEvent('download'); await main.getByRole('button', { name: '下载报告', exact: true }).click()
  const downloaded = JSON.parse(await readFile(await (await reportDownload).path(), 'utf8')); assert.equal(downloaded.status, 'pass')
  if (process.env.PKI_SCREENSHOT) await page.screenshot({ path: process.env.PKI_SCREENSHOT, fullPage: true })
  await main.getByRole('button', { name: '清空材料', exact: true }).click(); assert.equal(await main.getByRole('status').count(), 0)

  await goto('offline-revocation')
  await main.getByRole('textbox', { name: '目标证书', exact: true }).fill(api.pem(leafBytes, 'CERTIFICATE'))
  await main.getByRole('textbox', { name: '签发者 CA 证书', exact: true }).fill(api.pem(issuerBytes, 'CERTIFICATE'))
  const run = async artifact => {
    await main.getByRole('button', { name: '运行', exact: true }).click()
    await page.waitForFunction(() => document.querySelector('main [data-encoded-output]') || document.querySelector('main [role=status]') || document.querySelector('main [role=alert]'))
    assert.equal(await main.getByRole('alert').count(), 0, await main.getByRole('alert').allTextContents())
    if (artifact) return main.locator('[data-encoded-output] textarea').inputValue()
  }
  const request = await run(true)
  await main.getByRole('button', { name: '用此请求构造响应', exact: true }).click()
  await main.getByRole('textbox', { name: '响应签名私钥', exact: true }).fill(api.pem(issuerKey.privateDer, 'PRIVATE KEY'))
  const response = await run(true)
  assert.ok(response.length > 100)
  await main.getByLabel('操作', { exact: true }).selectOption('response-verify')
  await main.getByRole('textbox', { name: 'OCSP 请求', exact: true }).fill(request)
  await main.getByRole('textbox', { name: 'OCSP 响应', exact: true }).fill(response)
  await run(false); assert.match(await main.getByRole('status').innerText(), /检查通过/)
  assert.equal(await main.getByText('Nonce 绑定', { exact: true }).count(), 1)
  await page.setViewportSize({ width: 390, height: 844 })
  await page.evaluate(() => { localStorage.setItem('locale', 'en'); localStorage.setItem('theme', 'dark') })
  for (const route of ['pdf-verify', 'offline-revocation']) {
    await goto(route)
    assert.ok(await main.evaluate(element => element.scrollWidth <= window.innerWidth + 1), route + ' overflow')
    assert.equal(await main.getByText(/^tools\./).count(), 0)
  }
  assert.deepEqual(errors, []); assert.deepEqual(remote, [])
  console.log('PASS: PDF Worker verifies eight fixtures, detects unsigned/appended files, exports report; offline OCSP request → response → verification; mobile/English; zero API/external requests')
} finally {
  await browser.close()
  assert.ok(resolve(temp).startsWith(tempRoot + sep)); await rm(temp, { recursive: true, force: true })
}
