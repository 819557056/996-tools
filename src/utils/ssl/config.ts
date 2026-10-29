export type AddressType = 'DNS' | 'IP'
export interface CertificateAddress { value: string; type: AddressType }
export type AddressResult = { address: CertificateAddress; error?: never } | { address?: never; error: string }

/** Normalize only host names and IPs. A URL is not a subject alternative name. */
export function parseCertificateAddress(input: string): AddressResult {
  const raw = input.trim()
  if (!raw) return { error: '请填写一个域名或 IP 地址。' }
  if (/[\s/?#@]/.test(raw)) return { error: '只填写域名或 IP，不需要 https://、端口或路径。' }
  if (raw.includes(':')) {
    try {
      const candidate = raw.startsWith('[') && raw.endsWith(']') ? raw.slice(1, -1) : raw
      const host = new URL(`https://[${candidate}]/`).hostname
      if (!host.startsWith('[')) throw new Error('Invalid IPv6')
      return { address: { value: host.slice(1, -1).toLowerCase(), type: 'IP' } }
    } catch {
      return { error: '请填写完整的 IPv6 地址，或去掉域名后面的端口。' }
    }
  }
  if (/^[\d.]+$/.test(raw)) {
    const parts = raw.split('.')
    if (parts.length !== 4 || parts.some(part => !/^(0|[1-9]\d{0,2})$/.test(part) || Number(part) > 255)) {
      return { error: 'IPv4 需要 4 段 0–255 的数字，例如 192.168.1.10。' }
    }
    return { address: { value: raw, type: 'IP' } }
  }
  const wildcard = raw.startsWith('*.')
  const name = (wildcard ? raw.slice(2) : raw).replace(/\.$/, '')
  if (!name || /[*%\\\[\]]/.test(name)) return { error: '域名格式不正确；通配符只支持 *.example.com 这样的写法。' }
  let ascii: string
  try { ascii = new URL(`https://${name}/`).hostname.toLowerCase() }
  catch { return { error: '请检查域名格式，例如 example.com。' } }
  const labels = ascii.split('.')
  if (ascii.length > 253 || labels.some(label => !/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(label))) {
    return { error: '域名各段需要 1–63 个字母、数字或短横线，且不能以短横线开头或结尾。' }
  }
  // URL may silently turn hexadecimal or shortened numeric hosts into IPv4.
  if (/^[\d.]+$/.test(ascii)) return { error: '请使用完整的十进制 IPv4 地址，例如 127.0.0.1。' }
  if (wildcard && labels.length < 2) return { error: '通配符需要完整域名，例如 *.example.com。' }
  return { address: { value: `${wildcard ? '*.' : ''}${ascii}`, type: 'DNS' } }
}

export interface SubjectFields { CN: string; O: string; OU: string; C: string; ST: string; L: string }

/** RFC 4514 display escaping. Real issuance must use structured name values. */
export function subjectDisplay(subject: SubjectFields): string {
  return (['CN', 'O', 'OU', 'L', 'ST', 'C'] as const)
    .filter(key => subject[key].trim())
    .map(key => {
      const value = subject[key].trim().replace(/([,+"\\<>;=])/g, '\\$1').replace(/^#/, '\\#')
      return `${key}=${value}`
    }).join(', ')
}

export function dateInputValue(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

/** Fast UI precheck. The worker performs full ASN.1 parsing and key-pair validation. */
export function inspectPrivateKeyEnvelope(text: string): { format: string; error: string } {
  if (text.length > 256 * 1024) return { format: '', error: '私钥文本过大，请使用小于 256 KB 的 PEM 文件。' }
  if (/ENCRYPTED|Proc-Type:\s*4,ENCRYPTED/i.test(text)) {
    return { format: '', error: '这是加密私钥。目前仅支持未加密 PEM，请先在自己的设备上解密，再导入。' }
  }
  const match = text.trim().match(/^-----BEGIN (PRIVATE KEY|RSA PRIVATE KEY|EC PRIVATE KEY)-----\s+([A-Za-z0-9+/=\s]+)\s+-----END \1-----$/)
  if (!match) return { format: '', error: '请提供完整 PEM 私钥（含 BEGIN / END PRIVATE KEY），证书或公钥不能替代私钥。' }
  const body = match[2].replace(/\s/g, '')
  if (body.length < 32 || body.length % 4 !== 0 || !/^[A-Za-z0-9+/]+={0,2}$/.test(body)) {
    return { format: '', error: 'PEM 内的 Base64 内容不完整，请重新选择文件或完整粘贴。' }
  }
  return { format: { 'PRIVATE KEY': 'PKCS#8', 'RSA PRIVATE KEY': 'PKCS#1 · RSA', 'EC PRIVATE KEY': 'SEC1 · EC' }[match[1]] || 'PEM', error: '' }
}

export function inspectPublicKeyEnvelope(text: string): { format: string; error: string } {
  if (text.length > 256 * 1024) return { format: '', error: '公钥文本过大，请使用小于 256 KB 的 PEM 文件。' }
  const match = text.trim().match(/^-----BEGIN (PUBLIC KEY|RSA PUBLIC KEY)-----\s+([A-Za-z0-9+/=\s]+)\s+-----END \1-----$/)
  if (!match) return { format: '', error: '请提供 PEM 公钥（BEGIN PUBLIC KEY 或 BEGIN RSA PUBLIC KEY），不要在这里放入私钥或证书。' }
  const body = match[2].replace(/\s/g, '')
  if (body.length < 32 || body.length % 4 !== 0 || !/^[A-Za-z0-9+/]+={0,2}$/.test(body)) {
    return { format: '', error: '公钥 PEM 内的 Base64 内容不完整，请重新选择文件或完整粘贴。' }
  }
  return { format: match[1] === 'PUBLIC KEY' ? 'SPKI' : 'PKCS#1 · RSA 公钥', error: '' }
}

// An ordered RDN list is required: a Record<string, string> would lose the second OU.
export const rootCaProfiles = [
  { id: 'rsa-2048', label: 'RSA 2048', note: '通用推荐', commonName: 'RSA2048-Test-CA', signature: 'SHA256withRSA', hash: 'SHA-256' },
  { id: 'rsa-4096', label: 'RSA 4096', note: '更长密钥', commonName: 'RSA4096-Test-CA', signature: 'SHA256withRSA', hash: 'SHA-256' },
  { id: 'sm2', label: 'SM2', note: '国密环境', commonName: 'SM2-Test-CA', signature: 'SM3withSM2', hash: 'SM3' }
] as const

export function rootCaSubject(commonName: string) {
  return [
    { type: 'CN', value: commonName },
    { type: 'OU', value: 'test' },
    { type: 'OU', value: 'xcf' },
    { type: 'C', value: 'cn' }
  ]
}
