import CryptoJS from 'crypto-js'
import { Sm3Stream } from '../utils/crypto/sm3-stream'

self.onmessage = async (event: MessageEvent<File>) => {
  try {
    const file = event.data
    const hashes = [CryptoJS.algo.MD5.create(), CryptoJS.algo.SHA1.create(), CryptoJS.algo.SHA256.create()]
    const sm3 = new Sm3Stream()
    const chunkSize = 1024 * 1024
    for (let offset = 0; offset < file.size; offset += chunkSize) {
      const bytes = new Uint8Array(await file.slice(offset, offset + chunkSize).arrayBuffer())
      const words: number[] = []
      for (let i = 0; i < bytes.length; i++) words[i >>> 2] = (words[i >>> 2] || 0) | bytes[i] << (24 - (i % 4) * 8)
      const chunk = CryptoJS.lib.WordArray.create(words, bytes.length)
      for (const hash of hashes) hash.update(chunk)
      sm3.update(bytes)
      self.postMessage({ progress: Math.min(100, Math.round((offset + bytes.length) / file.size * 100)) })
    }
    self.postMessage({ progress: 100, result: { MD5: hashes[0].finalize().toString(), SHA1: hashes[1].finalize().toString(), SHA256: hashes[2].finalize().toString(), SM3: sm3.digest() } })
  } catch (error) { self.postMessage({ error: error instanceof Error ? error.message : 'Digest failed' }) }
}
