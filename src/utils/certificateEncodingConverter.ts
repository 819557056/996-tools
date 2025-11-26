/**
 * 证书编码转换工具
 * 支持 PEM、BASE64、HEX、DER 格式之间的相互转换
 */

export type FormatType = 'PEM' | 'BASE64' | 'HEX' | 'DER' | null

/**
 * 检测编码格式
 * @param content 待检测的内容
 * @returns 检测到的格式类型
 */
export function detectFormat(content: string): FormatType {
  if (!content.trim()) {
    return null
  }
  
  // 检测 PEM 格式
  if (content.includes('-----BEGIN') && content.includes('-----END')) {
    return 'PEM'
  }
  
  const trimmed = content.trim()
  
  // 检测 HEX 格式（纯16进制字符串）
  const hexRegex = /^[0-9A-Fa-f\s]+$/
  if (hexRegex.test(trimmed)) {
    const cleaned = trimmed.replace(/\s/g, '')
    if (cleaned.length >= 20 && cleaned.length % 2 === 0) {
      return 'HEX'
    }
  }
  
  // 检测纯 Base64 格式（无 PEM 头尾）
  const base64Regex = /^[A-Za-z0-9+/=\s]+$/
  
  if (base64Regex.test(trimmed)) {
    try {
      const cleaned = trimmed.replace(/\s/g, '')
      if (cleaned.length % 4 === 0) {
        atob(cleaned.substring(0, Math.min(100, cleaned.length)))
        return 'BASE64'
      }
    } catch (e) {
      // 解码失败
    }
  }
  
  return null
}

/**
 * 检查是否为有效的 Base64 文本
 * @param text 待检查的文本
 * @returns 是否为有效的 Base64
 */
export function isValidBase64Text(text: string): boolean {
  const trimmed = text.trim()
  
  if (!/^[A-Za-z0-9+/\s]+={0,2}$/.test(trimmed)) {
    return false
  }
  
  const cleaned = trimmed.replace(/\s/g, '')
  
  if (cleaned.length < 20) {
    return false
  }
  
  if (cleaned.length % 4 !== 0) {
    return false
  }
  
  try {
    atob(cleaned.substring(0, Math.min(100, cleaned.length)))
    return true
  } catch (e) {
    return false
  }
}

/**
 * 检查是否为二进制文件内容
 * @param text 待检查的文本
 * @returns 是否为二进制内容
 */
export function isBinaryContent(text: string): boolean {
  const nonPrintableCount = Array.from(text).filter(char => {
    const code = char.charCodeAt(0)
    return code < 32 && code !== 9 && code !== 10 && code !== 13
  }).length
  
  return nonPrintableCount > text.length * 0.1
}

/**
 * ArrayBuffer 转 Base64
 * @param buffer ArrayBuffer
 * @returns Base64 字符串
 */
export function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  let binary = ''
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return btoa(binary)
}

/**
 * Base64 转 ArrayBuffer
 * @param base64 Base64 字符串
 * @returns ArrayBuffer
 */
export function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binaryString = atob(base64)
  const bytes = new Uint8Array(binaryString.length)
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i)
  }
  return bytes.buffer
}

/**
 * 检测证书类型
 * @param base64 Base64 编码的证书
 * @returns 证书类型
 */
export function detectCertificateType(base64: string): string {
  try {
    const decoded = atob(base64.substring(0, 100))
    if (decoded.includes('RSA')) {
      return 'RSA PRIVATE KEY'
    } else if (decoded.includes('EC')) {
      return 'EC PRIVATE KEY'
    } else if (decoded.includes('PRIVATE')) {
      return 'PRIVATE KEY'
    } else if (decoded.includes('PUBLIC')) {
      return 'PUBLIC KEY'
    }
  } catch (e) {
    // 如果解码失败，保持默认类型
  }
  return 'CERTIFICATE'
}

/**
 * PEM 转 Base64
 * @param pemText PEM 格式文本
 * @returns Base64 字符串
 */
export function pemToBase64(pemText: string): string {
  const base64 = pemText
    .replace(/-----BEGIN [^-]+-----/g, '')
    .replace(/-----END [^-]+-----/g, '')
    .replace(/\s/g, '')
  
  if (!base64) {
    throw new Error('无效的 PEM 格式')
  }
  
  return base64
}

/**
 * Base64 转 PEM
 * @param base64Text Base64 文本
 * @returns PEM 格式文本
 */
export function base64ToPem(base64Text: string): string {
  const base64 = base64Text.replace(/\s/g, '')
  
  if (!base64) {
    throw new Error('无效的 Base64 格式')
  }
  
  const type = detectCertificateType(base64)
  const formattedBase64 = base64.match(/.{1,64}/g)?.join('\n') || base64
  
  return `-----BEGIN ${type}-----\n${formattedBase64}\n-----END ${type}-----`
}

/**
 * Base64 转 HEX
 * @param base64Text Base64 文本
 * @returns HEX 字符串
 */
export function base64ToHex(base64Text: string): string {
  const base64 = base64Text.replace(/\s/g, '')
  
  if (!base64) {
    throw new Error('无效的 Base64 格式')
  }
  
  try {
    const binaryString = atob(base64)
    let hex = ''
    for (let i = 0; i < binaryString.length; i++) {
      const byte = binaryString.charCodeAt(i)
      hex += byte.toString(16).padStart(2, '0').toUpperCase()
    }
    
    return formatHex(hex)
  } catch (e) {
    throw new Error('无效的 Base64 格式')
  }
}

/**
 * HEX 转 Base64
 * @param hexText HEX 文本
 * @returns Base64 字符串
 */
export function hexToBase64(hexText: string): string {
  const hex = hexText.replace(/\s/g, '')
  
  if (!hex || hex.length % 2 !== 0) {
    throw new Error('无效的 HEX 格式')
  }
  
  if (!/^[0-9A-Fa-f]+$/.test(hex)) {
    throw new Error('无效的 HEX 格式')
  }
  
  try {
    let binaryString = ''
    for (let i = 0; i < hex.length; i += 2) {
      const byte = parseInt(hex.substr(i, 2), 16)
      binaryString += String.fromCharCode(byte)
    }
    
    return btoa(binaryString)
  } catch (e) {
    throw new Error('无效的 HEX 格式')
  }
}

/**
 * PEM 转 HEX
 * @param pemText PEM 格式文本
 * @returns HEX 字符串
 */
export function pemToHex(pemText: string): string {
  const base64 = pemToBase64(pemText)
  return base64ToHex(base64)
}

/**
 * HEX 转 PEM
 * @param hexText HEX 文本
 * @returns PEM 格式文本
 */
export function hexToPem(hexText: string): string {
  const base64 = hexToBase64(hexText)
  return base64ToPem(base64)
}

/**
 * 格式化 HEX 字符串（每行64个字符）
 * @param hex HEX 字符串
 * @returns 格式化后的 HEX 字符串
 */
export function formatHex(hex: string): string {
  const lines = []
  for (let i = 0; i < hex.length; i += 64) {
    lines.push(hex.substr(i, 64))
  }
  return lines.join('\n')
}

/**
 * 执行格式转换
 * @param inputValue 输入值
 * @param sourceFormat 源格式
 * @param targetFormat 目标格式
 * @returns 转换后的字符串
 */
export function performConversion(
  inputValue: string, 
  sourceFormat: FormatType, 
  targetFormat: FormatType
): string {
  // 转换逻辑映射
  const conversionMap: Record<string, () => string> = {
    'PEM-BASE64': () => pemToBase64(inputValue),
    'PEM-HEX': () => pemToHex(inputValue),
    'BASE64-PEM': () => base64ToPem(inputValue),
    'BASE64-HEX': () => base64ToHex(inputValue),
    'HEX-PEM': () => hexToPem(inputValue),
    'HEX-BASE64': () => hexToBase64(inputValue),
    'DER-PEM': () => base64ToPem(inputValue), // DER 实际上就是 Base64
    'DER-BASE64': () => inputValue.replace(/\s/g, ''),
    'DER-HEX': () => base64ToHex(inputValue),
  }
  
  const key = `${sourceFormat}-${targetFormat}`
  const converter = conversionMap[key]
  
  if (!converter) {
    throw new Error('不支持的转换类型')
  }
  
  return converter()
}

