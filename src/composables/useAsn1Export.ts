import { onBeforeUnmount, ref } from 'vue'
import type { Asn1ExportRequest } from '@/utils/asn1/types'

export function useAsn1Export() {
  const busy = ref(false)
  let cancel: (() => void) | undefined
  function exportText(request: Asn1ExportRequest): Promise<string> {
    cancel?.()
    busy.value = true
    return new Promise((resolve, reject) => {
      let worker: Worker | undefined
      let timer: ReturnType<typeof setTimeout> | undefined
      const finish = (text?: string, error?: string) => {
        worker?.terminate(); clearTimeout(timer); cancel = undefined; busy.value = false
        if (error) reject(new Error(error))
        else resolve(text ?? '')
      }
      cancel = () => finish(undefined, '复制操作已取消。')
      try {
        worker = new Worker(new URL('../workers/asn1-decoder.worker.ts', import.meta.url), { type: 'module' })
        timer = setTimeout(() => finish(undefined, '节点内容过大，生成用时过长。请下载原始数据。'), 6000)
        worker.onmessage = ({ data }: MessageEvent<{ text?: string; error?: string }>) => finish(data.text, data.error)
        worker.onerror = event => { event.preventDefault(); finish(undefined, '无法生成节点内容，请重试。') }
        worker.postMessage(request)
      } catch { finish(undefined, '无法启动本地复制线程，请刷新后重试。') }
    })
  }
  onBeforeUnmount(() => cancel?.())
  return { busy, exportText }
}
