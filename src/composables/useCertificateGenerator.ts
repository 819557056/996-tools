import { onBeforeUnmount, ref, shallowRef } from 'vue'
import type { GenerationRequest, GenerationResponse, GenerationResult, GenerationStage } from '../types/ssl'

export function useCertificateGenerator() {
  const running = ref(false)
  const stage = ref<GenerationStage>('validate')
  const error = ref('')
  const cancelled = ref(false)
  const result = shallowRef<GenerationResult | null>(null)
  let worker: Worker | null = null
  let settle: ((result: GenerationResult | null) => void) | null = null

  function finish(value: GenerationResult | null) {
    worker?.terminate()
    worker = null
    running.value = false
    const resolve = settle
    settle = null
    resolve?.(value)
  }
  function cancel() {
    cancelled.value = running.value
    finish(null)
  }
  function clear() {
    cancel()
    result.value = null
    error.value = ''
    cancelled.value = false
  }
  function generate(request: GenerationRequest): Promise<GenerationResult | null> {
    if (running.value) return Promise.resolve(null)
    clear()
    if (!window.isSecureContext || !globalThis.crypto?.subtle || typeof Worker === 'undefined') {
      error.value = '当前环境不支持本地生成。请用最新版 Chrome / Edge，通过 HTTPS 或 localhost 打开。'
      return Promise.resolve(null)
    }
    running.value = true
    stage.value = 'validate'
    return new Promise(resolve => {
      settle = resolve
      try {
        worker = new Worker(new URL('../workers/ssl-certificate.worker.ts', import.meta.url), { type: 'module' })
        worker.onmessage = ({ data }: MessageEvent<GenerationResponse>) => {
          if (data.type === 'progress') stage.value = data.stage
          else if (data.type === 'complete') {
            result.value = data.result
            finish(data.result)
          } else {
            error.value = data.message
            finish(null)
          }
        }
        worker.onerror = event => {
          event.preventDefault()
          error.value = '本地生成线程启动失败或已中断，请刷新页面后重试。密钥未发送到服务器。'
          finish(null)
        }
        // Plain structured-clone payload only; never persist secrets or send them over a network.
        worker.postMessage(request)
      } catch {
        error.value = '无法启动本地生成，请检查浏览器是否支持 Web Worker。'
        finish(null)
      }
    })
  }
  onBeforeUnmount(clear)
  return { running, stage, error, cancelled, result, generate, cancel, clear }
}
