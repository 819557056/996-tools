import type { CertificateFile } from '../../types/ssl'
import { downloadBlob } from '../download'

export function downloadSslFile(file: CertificateFile) {
  const bytes = typeof file.content === 'string' ? new TextEncoder().encode(file.content) : file.content
  downloadBlob(new Blob([bytes.slice().buffer as ArrayBuffer], { type: file.name.endsWith('.der') ? 'application/pkix-cert' : 'application/octet-stream' }), file.name)
}

export async function downloadSiteBundle(files: CertificateFile[]) {
  const { default: JSZip } = await import('jszip')
  const archive = new JSZip()
  // Root CA files stay separate from the deployable site archive.
  for (const file of files.filter(item => item.group === 'site')) archive.file(file.name, file.content)
  downloadBlob(await archive.generateAsync({ type: 'blob', compression: 'DEFLATE' }), 'ssl-site-bundle.zip')
}
