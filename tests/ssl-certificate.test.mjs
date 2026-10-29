import { after } from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { mkdir, mkdtemp, rm } from 'node:fs/promises'
import { resolve, join, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const require = createRequire(import.meta.url)
const { build } = createRequire(require.resolve('vite/package.json'))('esbuild')
const project = fileURLToPath(new URL('..', import.meta.url))
const tempRoot = resolve(project, 'tmp')
await mkdir(tempRoot, { recursive: true })
const temp = await mkdtemp(join(tempRoot, 'ssl-tests-'))
after(async () => {
  assert.ok(resolve(temp).startsWith(tempRoot + sep))
  await rm(temp, { recursive: true, force: true })
})
await build({ entryPoints: [join(project, 'tests/helpers/ssl-certificate-cases.ts')], bundle: true, packages: 'external', platform: 'node', format: 'cjs', outfile: join(temp, 'cases.cjs') })
require(join(temp, 'cases.cjs'))
