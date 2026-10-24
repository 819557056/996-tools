import { runPki, type PkiInput } from '../utils/pki/operations'
self.onmessage = async (event: MessageEvent<PkiInput>) => {
  try { self.postMessage({ result: await runPki(event.data) }) }
  catch (error) { self.postMessage({ error: error instanceof Error ? error.message : '操作失败 / Operation failed' }) }
}
