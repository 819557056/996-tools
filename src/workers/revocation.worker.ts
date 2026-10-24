import { runRevocation, type RevocationInput } from '../utils/pki/revocation'
self.onmessage = async (event: MessageEvent<RevocationInput>) => {
  try { self.postMessage({ result: await runRevocation(event.data) }) }
  catch (error) { self.postMessage({ error: error instanceof Error ? error.message : '离线处理失败 / Offline processing failed' }) }
}
