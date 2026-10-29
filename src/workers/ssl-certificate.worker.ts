import { CertificateInputError, generateCertificates } from '../utils/ssl/generator'
import type { GenerationRequest, GenerationResponse } from '../types/ssl'

const worker = self as unknown as {
  onmessage: ((event: MessageEvent<GenerationRequest>) => void) | null
  postMessage(message: GenerationResponse): void
  close(): void
}
worker.onmessage = async ({ data }) => {
  try {
    const result = await generateCertificates(data, stage => worker.postMessage({ type: 'progress', stage }))
    worker.postMessage({ type: 'complete', result })
  } catch (error) {
    worker.postMessage({ type: 'error', message: error instanceof CertificateInputError ? error.message : '证书生成或核验失败，请检查密钥文件或重试。错误内容未包含密钥数据。' })
  } finally {
    data.keyPair = undefined
    worker.close()
  }
}
