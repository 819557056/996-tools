// GB/T 32905 SM3 compression with bounded (64-byte) buffering.
// update() accepts message bytes, never a textual hex representation.
const rotate = (n: number, bits: number) => (n << (bits & 31)) | (n >>> ((32 - bits) & 31))
const p0 = (n: number) => n ^ rotate(n, 9) ^ rotate(n, 17)
const p1 = (n: number) => n ^ rotate(n, 15) ^ rotate(n, 23)
export class Sm3Stream {
  private state = new Int32Array([0x7380166f,0x4914b2b9,0x172442d7,0xda8a0600,0xa96f30bc,0x163138aa,0xe38dee4d,0xb0fb0e4e])
  private buffer = new Uint8Array(64)
  private used = 0
  private length = 0
  private finished = false

  update(bytes: Uint8Array): this {
    if (this.finished) throw new Error('Digest already finalized')
    this.length += bytes.length
    if (!Number.isSafeInteger(this.length)) throw new Error('Input too large')
    let offset = 0
    if (this.used) {
      const take = Math.min(64 - this.used, bytes.length)
      this.buffer.set(bytes.subarray(0, take), this.used); this.used += take; offset += take
      if (this.used === 64) { this.compress(this.buffer); this.used = 0 }
    }
    while (offset + 64 <= bytes.length) { this.compress(bytes.subarray(offset, offset + 64)); offset += 64 }
    if (offset < bytes.length) { this.buffer.set(bytes.subarray(offset)); this.used = bytes.length - offset }
    return this
  }
  digest(): string {
    if (this.finished) throw new Error('Digest already finalized')
    const tail = new Uint8Array(this.used < 56 ? 64 : 128)
    tail.set(this.buffer.subarray(0, this.used)); tail[this.used] = 0x80
    const view = new DataView(tail.buffer)
    const bits = BigInt(this.length) * 8n
    view.setUint32(tail.length - 8, Number(bits >> 32n)); view.setUint32(tail.length - 4, Number(bits & 0xffffffffn))
    for (let i = 0; i < tail.length; i += 64) this.compress(tail.subarray(i, i + 64))
    this.finished = true
    return Array.from(this.state, n => (n >>> 0).toString(16).padStart(8, '0')).join('')
  }
  private compress(block: Uint8Array) {
    const w = new Int32Array(68)
    const view = new DataView(block.buffer, block.byteOffset, block.byteLength)
    for (let j = 0; j < 16; j++) w[j] = view.getInt32(j * 4)
    for (let j = 16; j < 68; j++) w[j] = p1(w[j-16] ^ w[j-9] ^ rotate(w[j-3],15)) ^ rotate(w[j-13],7) ^ w[j-6]
    let [a,b,c,d,e,f,g,h] = this.state
    for (let j = 0; j < 64; j++) {
      const a12 = rotate(a, 12)
      const ss1 = rotate((a12 + e + rotate(j < 16 ? 0x79cc4519 : 0x7a879d8a, j)) | 0, 7)
      const ff = j < 16 ? a ^ b ^ c : (a & b) | (a & c) | (b & c)
      const gg = j < 16 ? e ^ f ^ g : (e & f) | (~e & g)
      const tt1 = (ff + d + (ss1 ^ a12) + (w[j] ^ w[j+4])) | 0
      const tt2 = (gg + h + ss1 + w[j]) | 0
      d = c; c = rotate(b,9); b = a; a = tt1
      h = g; g = rotate(f,19); f = e; e = p0(tt2)
    }
    const next = [a,b,c,d,e,f,g,h]
    for (let j = 0; j < 8; j++) this.state[j] ^= next[j]
  }
}
