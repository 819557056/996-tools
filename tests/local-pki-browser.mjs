import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { readFile } from 'node:fs/promises'
import { createPrivateKey, generateKeyPairSync } from 'node:crypto'
const require = createRequire(import.meta.url)
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright')
const browser = await chromium.launch({ headless: true, channel: process.env.PLAYWRIGHT_CHANNEL || 'msedge' })
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } })
const page = await context.newPage(), errors = [], apiRequests = []
const origin = process.env.PKI_UI_URL || 'http://127.0.0.1:2067'
page.on('pageerror', error => errors.push(error.message))
page.on('request', request => { if (request.url().includes('/api/')) apiRequests.push(request.url()) })
await context.addInitScript(() => { if (!localStorage.getItem('locale')) localStorage.setItem('locale', 'zh') })
const main = page.locator('main')
const goto = async path => { await page.goto(origin + '/tools/' + path); await main.locator('h1').waitFor() }
const pem = (hex, label) => `-----BEGIN ${label}-----\n${Buffer.from(hex, 'hex').toString('base64')}\n-----END ${label}-----`
async function run(name) {
  await main.getByRole('button', { name, exact: true }).click()
  await page.waitForFunction(() => document.querySelector('main [data-encoded-output]') || document.querySelector('main [role=status]') || document.querySelector('main [role=alert]'))
  const alert = main.locator('[role=alert]')
  assert.equal(await alert.count(), 0, await alert.allTextContents())
}
const artifact = label => main.getByRole('textbox', { name: label + ' hex', exact: true }).inputValue()
async function delayedImport(input, file, changePage) {
  // Hold reads until the clear/action change has finished; no timing-dependent sleep.
  await page.evaluate(() => {
    const original = File.prototype.arrayBuffer
    const pending = []
    window.__pkiFileReadGate = { pending, restore: () => { File.prototype.arrayBuffer = original } }
    File.prototype.arrayBuffer = function () {
      return new Promise((resolve, reject) => {
        pending.push(async () => {
          try { resolve(await original.call(this)) } catch (error) { reject(error) }
        })
      })
    }
  })
  await input.setInputFiles(file)
  await page.waitForFunction(() => window.__pkiFileReadGate.pending.length > 0)
  await changePage()
  await page.evaluate(async () => {
    const gate = window.__pkiFileReadGate
    try {
      await Promise.all(gate.pending.map(release => release()))
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))
    } finally { gate.restore(); delete window.__pkiFileReadGate }
  })
}
try {
  const paths = ['csr-create', 'csr-parse', 'pkcs12-create', 'self-signed-certificate', 'certificate-chain', 'certificate-verify', 'certificate-encrypt', 'certificate-envelope']
  for (const path of paths) {
    await goto(path)
    assert.equal(await main.getByText('浏览器本地处理，材料不上传服务器', { exact: true }).count(), 1)
    assert.equal(await main.getByText(/^tools\./).count(), 0)
  }
  assert.equal(await page.locator('aside').getByText('PKI 工作台', { exact: true }).count(), 0)
  await goto('pki-workbench'); assert.ok(page.url().endsWith('/csr-create'))
  await main.getByLabel('通用名称 CN', { exact: true }).fill('browser.example.test')
  await main.getByLabel('备用名称 SAN（每行一项）', { exact: true }).fill('dns:browser.example.test\nip:127.0.0.1')
  await run('生成 CSR')
  const csrHex = await artifact('CSR'), keyHex = await artifact('私钥 / Private key')
  const keyPem = pem(keyHex, 'PRIVATE KEY')
  assert.ok(keyHex.length > 64)
  await goto('csr-parse'); await main.getByRole('textbox', { name: 'CSR', exact: true }).fill(pem(csrHex, 'CERTIFICATE REQUEST'))
  await run('解析并验签'); assert.match(await main.getByRole('status').innerText(), /验证通过/)
  assert.equal(await main.getByText('申请主体', { exact: true }).count(), 1)
  assert.equal(await main.getByText('DNS: browser.example.test', { exact: true }).count(), 1)
  assert.equal(await main.getByText('IP: 127.0.0.1', { exact: true }).count(), 1)
  await goto('self-signed-certificate')
  const sec1 = generateKeyPairSync('ec', { namedCurve: 'prime256v1' }).privateKey.export({ type: 'sec1', format: 'der' })
  await main.getByLabel('导入 私钥', { exact: true }).setInputFiles({ name: 'private-sec1.der', mimeType: 'application/octet-stream', buffer: sec1 })
  await page.waitForFunction(() => Array.from(document.querySelectorAll('main textarea')).some(input => input.value.startsWith('-----BEGIN EC PRIVATE KEY-----')))
  const normalizedSec1 = await main.getByRole('textbox', { name: '私钥 (可选)', exact: true }).inputValue()
  assert.deepEqual(createPrivateKey(normalizedSec1).export({ type: 'sec1', format: 'der' }), sec1)
  const encryptedKey = createPrivateKey(keyPem).export({ type: 'pkcs8', format: 'pem', cipher: 'aes-256-cbc', passphrase: 'import-password-123' })
  await main.getByRole('textbox', { name: '私钥 (可选)', exact: true }).fill(String(encryptedKey))
  await main.getByLabel('私钥口令（加密 PKCS#8）', { exact: true }).fill('import-password-123')
  await main.getByLabel('通用名称 CN', { exact: true }).fill('browser.example.test')
  await run('生成自签证书')
  const certHex = await artifact('证书 / Certificate'), certPem = pem(certHex, 'CERTIFICATE')
  await goto('certificate-verify'); await main.getByRole('textbox', { name: '证书', exact: true }).fill(certPem)
  await run('验证'); assert.match(await main.getByRole('status').innerText(), /验证通过/)
  await main.getByRole('textbox', { name: '证书', exact: true }).fill('invalid')
  assert.equal(await main.getByRole('status').count(), 0)
  await goto('certificate-chain')
  await main.getByRole('textbox', { name: '证书', exact: true }).fill(certPem)
  await main.getByLabel('导入 明确受信任的根证书', { exact: true }).setInputFiles([
    { name: 'root-base64.txt', mimeType: 'text/plain', buffer: Buffer.from(Buffer.from(certHex, 'hex').toString('base64')) },
    { name: 'root-hex.txt', mimeType: 'text/plain', buffer: Buffer.from(certHex) },
  ])
  await page.waitForFunction(() => Array.from(document.querySelectorAll('main textarea')).some(input => (input.value.match(/-----BEGIN CERTIFICATE-----/g) || []).length === 2))
  await run('验证'); assert.match(await main.getByRole('status').innerText(), /验证通过/)
  // Empty -> empty clear must invalidate reads even though the model value never changes.
  await main.getByRole('button', { name: '清空材料', exact: true }).click()
  const roots = main.getByRole('textbox', { name: '明确受信任的根证书', exact: true })
  assert.equal(await roots.inputValue(), '')
  await delayedImport(main.getByLabel('导入 明确受信任的根证书', { exact: true }), {
    name: 'delayed-root.pem', mimeType: 'text/plain', buffer: Buffer.from(certPem),
  }, async () => {
    assert.equal(await roots.inputValue(), '')
    await main.getByRole('button', { name: '清空材料', exact: true }).click()
  })
  assert.equal(await roots.inputValue(), '')
  await goto('certificate-envelope')
  await main.getByLabel('操作', { exact: true }).selectOption('open')
  await delayedImport(main.getByLabel('导入 私钥', { exact: true }), {
    name: 'delayed-private-key.pem', mimeType: 'text/plain', buffer: Buffer.from(keyPem),
  }, () => main.getByLabel('操作', { exact: true }).selectOption('create'))
  await main.getByLabel('操作', { exact: true }).selectOption('open')
  assert.equal(await main.getByRole('textbox', { name: '私钥', exact: true }).inputValue(), '')
  // The separate binary ciphertext importer must obey the same lifecycle boundary.
  await delayedImport(main.getByLabel('导入二进制文件', { exact: true }), {
    name: 'delayed-envelope.bin', mimeType: 'application/octet-stream', buffer: Buffer.from([1, 2, 3, 4]),
  }, () => main.getByLabel('操作', { exact: true }).selectOption('create'))
  await main.getByLabel('操作', { exact: true }).selectOption('open')
  assert.equal(await main.getByRole('textbox', { name: '密文 / 信封', exact: true }).inputValue(), '')
  assert.equal(await main.locator('[role=alert]').count(), 0)
  await goto('pkcs12-create')
  await main.getByRole('textbox', { name: '私钥', exact: true }).fill(keyPem)
  await main.getByRole('textbox', { name: '证书及证书链', exact: true }).fill(certPem)
  await main.getByLabel('保护口令', { exact: true }).fill('browser-test-123')
  await run('创建 PFX / P12')
  const pfxDownload = page.waitForEvent('download'); await main.getByRole('button', { name: '.pfx', exact: true }).click()
  const download = await pfxDownload; assert.equal(download.suggestedFilename(), 'identity.pfx'); assert.ok((await readFile(await download.path())).length > 500)
  for (const route of ['certificate-encrypt', 'certificate-envelope']) {
    await goto(route)
    await main.getByRole('textbox', { name: '证书', exact: true }).fill(certPem)
    await main.getByRole('textbox', { name: '原文（UTF-8）', exact: true }).fill('浏览器本地测试 🔐')
    await run('加密')
    const ciphertext = await artifact(route === 'certificate-encrypt' ? '密文 / Ciphertext' : 'CMS EnvelopedData')
    await main.getByLabel('操作', { exact: true }).selectOption('open')
    await main.getByRole('textbox', { name: '私钥', exact: true }).fill(keyPem)
    await main.getByRole('textbox', { name: '密文 / 信封', exact: true }).fill(ciphertext)
    await run('解密')
    assert.equal(await main.getByRole('textbox', { name: 'UTF-8 明文', exact: true }).inputValue(), '浏览器本地测试 🔐')
  }
  await page.setViewportSize({ width: 390, height: 844 })
  await page.evaluate(() => { localStorage.setItem('locale', 'en'); localStorage.setItem('theme', 'dark') })
  for (const path of paths) {
    await goto(path)
    assert.equal(await main.getByText('Processed in your browser; materials are not uploaded', { exact: true }).count(), 1)
    assert.ok(await main.evaluate(element => element.scrollWidth <= window.innerWidth + 1), path + ' has horizontal overflow')
  }
  await page.setViewportSize({ width: 1440, height: 1000 })
  await page.evaluate(() => { localStorage.setItem('locale', 'zh'); localStorage.setItem('theme', 'light') })
  await goto('csr-parse')
  await main.getByRole('textbox', { name: 'CSR', exact: true }).fill(pem(csrHex, 'CERTIFICATE REQUEST'))
  await run('解析并验签')
  assert.equal(await main.getByText('申请主体', { exact: true }).count(), 1)
  assert.equal(await main.getByText('DNS: browser.example.test', { exact: true }).count(), 1)
  assert.equal(await main.locator('[data-pki-details] details').getAttribute('open'), null)
  if (process.env.PKI_SCREENSHOT) await page.screenshot({ path: process.env.PKI_SCREENSHOT, fullPage: true })
  assert.deepEqual(errors, []); assert.deepEqual(apiRequests, [])
  console.log('PASS: 8 independent routes, encrypted-key import, mixed Base64/Hex certificate files, cancelled delayed imports, readable CSR/SAN results, CSR/certificate/PFX/chain/verification/encryption/envelope workflows, Chinese/English mobile layouts; zero backend API requests')
} finally { await browser.close() }
