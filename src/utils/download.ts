import { decodeMaterial } from '@/utils/crypto/material-format'

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename.replace(/[\\/<>:"|?*\x00-\x1f]/g, '_')
  document.body.appendChild(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
export function downloadBase64(value: string, filename: string, mime = 'application/octet-stream') {
  const bytes = decodeMaterial(value, 'base64')
  downloadBlob(new Blob([bytes.slice().buffer as ArrayBuffer], { type: mime }), filename)
}
