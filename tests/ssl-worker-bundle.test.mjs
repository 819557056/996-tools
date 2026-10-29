import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readdir, readFile } from 'node:fs/promises'
import { webcrypto } from 'node:crypto'
import vm from 'node:vm'

test('production certificate worker boots without window or Node module/require', async () => {
  const assets = new URL('../dist/assets/', import.meta.url)
  const filename = (await readdir(assets, { recursive: true })).find(name => /(?:^|[/\\])ssl-certificate\.worker-[^/\\]+\.js$/.test(name))
  assert.ok(filename, 'Run npm run build first')
  const source = await readFile(new URL(filename, assets), 'utf8')
  const context = {
    crypto: webcrypto, navigator: { userAgent: 'Worker bundle test' },
    URL, TextEncoder, TextDecoder, atob, btoa,
    postMessage() {}, close() {}
  }
  context.self = context
  // Deliberately no window, process, require or module: catches Node-only
  // initialization that dev prebundling can mask. Browser issuance is also
  // checked against the actual production page.
  vm.runInNewContext(source, context, { filename: 'certificate-worker.js', timeout: 5000 })
  assert.equal(typeof context.onmessage, 'function')
})
