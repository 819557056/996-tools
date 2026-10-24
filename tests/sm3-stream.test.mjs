import test from 'node:test'
import assert from 'node:assert/strict'
import { createHash, randomBytes } from 'node:crypto'
import { Sm3Stream } from '../src/utils/crypto/sm3-stream.ts'

test('SM3 standard vectors and streaming boundaries match OpenSSL', () => {
  for (const input of [Buffer.alloc(0), Buffer.from('abc'), Buffer.from('abcd'.repeat(16)), ...[1,55,56,63,64,65,127,128,129,1024,1048579].map(n => randomBytes(n))]) {
    const expected = createHash('sm3').update(input).digest('hex')
    for (const size of [1,7,63,64,65,4096]) {
      const hash = new Sm3Stream()
      for (let i = 0; i < input.length; i += size) hash.update(input.subarray(i, i + size))
      assert.equal(hash.digest(), expected, `length ${input.length}, chunk ${size}`)
      assert.throws(() => hash.digest())
    }
  }
})
