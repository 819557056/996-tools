import { decodeAsn1 } from '../utils/asn1/decoder'
import { exportAsn1 } from '../utils/asn1/export'
import type { Asn1Request, Asn1ExportRequest } from '../utils/asn1/types'

self.onmessage = (event: MessageEvent<Asn1Request | Asn1ExportRequest>) => {
  try {
    if ('action' in event.data && event.data.action === 'export') self.postMessage({ text: exportAsn1(event.data) })
    else self.postMessage({ result: decodeAsn1(event.data as Asn1Request) })
  } catch (error) {
    // Parser messages contain offsets and format errors, never input contents.
    const message = error instanceof Error ? error.message : '无法解析这份数据。'
    self.postMessage({ error: message.slice(0, 240) })
  } finally { self.close() }
}
