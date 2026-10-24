import { verifyPdf, type PdfVerifyOptions } from '../utils/pdf/verify'
self.onmessage = async (event: MessageEvent<{ id: number; bytes: Uint8Array; options?: PdfVerifyOptions }>) => {
  const { id, bytes, options } = event.data
  try { self.postMessage({ id, result: await verifyPdf(bytes, options) }) }
  catch (error) { self.postMessage({ id, error: error instanceof Error ? error.message : 'PDF 验签失败 / PDF verification failed' }) }
}
