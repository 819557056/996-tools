import { cp, realpath } from 'node:fs/promises'
import { resolve } from 'node:path'

const publicDirectory = resolve('public')
const generatedDataDirectory = resolve(publicDirectory, 'hanzi-strokes')
const outputDirectory = resolve('dist')
const dataDirectory = await realpath(resolve('node_modules/hanzi-writer-data'))

// Vite's public copy is disabled so the compression plugins do not process
// thousands of individual stroke files. Restore ordinary public files first.
await cp(publicDirectory, outputDirectory, {
  recursive: true,
  filter: source => resolve(source) !== generatedDataDirectory,
})
await cp(dataDirectory, resolve(outputDirectory, 'hanzi-strokes'), { recursive: true })
console.log('Copied local Hanzi stroke data into dist/hanzi-strokes')
