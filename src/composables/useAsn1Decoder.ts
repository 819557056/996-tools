import { onBeforeUnmount, ref, shallowRef } from 'vue'
import type { Asn1Request, Asn1Result } from '@/utils/asn1/types'

export function useAsn1Decoder() {
  const result = shallowRef<Asn1Result | null>(null)
  const loading = ref(false)
  const error = ref('')
  let worker: Worker | undefined
  let timer: ReturnType<typeof setTimeout> | undefined
  let finish: ((value: Asn1Result | null) => void) | undefined
  function stop() {
    worker?.terminate(); worker = undefined
    clearTimeout(timer); timer = undefined
    loading.value = false
    finish?.(null); finish = undefined
  }
  function clear() { stop(); result.value = null; error.value = '' }
  async function decode(request: Asn1Request): Promise<Asn1Result | null> {
    stop(); error.value = ''; loading.value = true
    return new Promise(resolve => {
      finish = resolve
      try {
        worker = new Worker(new URL('../workers/asn1-decoder.worker.ts', import.meta.url), { type: 'module' })
        timer = setTimeout(() => { error.value = '解析用时过长，已停止。请缩小数据后重试。'; stop() }, 6000)
        worker.onmessage = ({ data }: MessageEvent<{ result?: Asn1Result; error?: string }>) => {
          if (data.result) { result.value = data.result; resolve(data.result) }
          else error.value = data.error || '无法解析，请检查输入格式。'
          stop()
        }
        worker.onerror = event => { event.preventDefault(); error.value = '解析线程未能启动，请刷新页面后重试。'; stop() }
        worker.postMessage(request)
      } catch { error.value = '浏览器无法启动本地解析线程。'; stop() }
    })
  }
  onBeforeUnmount(clear)
  return { result, loading, error, decode, clear, stop }
}
