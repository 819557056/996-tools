<script setup lang="ts">
import { onBeforeUnmount, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { ShieldCheck, FileCheck, Download } from 'lucide-vue-next'
import BaseButton from '@/components/ui/BaseButton.vue'
import PkiMaterialInput from '@/components/crypto/PkiMaterialInput.vue'
import EncodedOutput from '@/components/crypto/EncodedOutput.vue'
import { decodeMaterial } from '@/utils/crypto/material-format'
import { downloadBlob } from '@/utils/download'
import type { PdfReport, PdfStatus } from '@/utils/pdf/types'

const { locale } = useI18n()
const tr = (zh: string, en: string) => locale.value.startsWith('zh') ? zh : en
const file = ref<File>(), certificate = ref(''), publicKey = ref(''), userId = ref('1234567812345678')
const report = ref<PdfReport>(), busy = ref(false), error = ref(''), inputEpoch = ref(0)
let worker: Worker | undefined, revision = 0
function cancel() { revision++; worker?.terminate(); worker = undefined; busy.value = false }
function clear() { cancel(); inputEpoch.value++; file.value = undefined; certificate.value = ''; publicKey.value = ''; userId.value = '1234567812345678'; report.value = undefined; error.value = '' }
watch([file, certificate, publicKey, userId], () => { cancel(); report.value = undefined; error.value = '' }, { flush: 'sync' })
onBeforeUnmount(cancel)
const translated = (value: string) => {
  const split = value.indexOf(' / ')
  return split >= 0 && /[\u3400-\u9fff]/.test(value.slice(0, split)) ? tr(value.slice(0, split), value.slice(split + 3)) : value
}
const statusText = (status: PdfStatus) => status === 'pass' ? tr('通过', 'Passed') : status === 'fail' ? tr('未通过', 'Failed') : tr('暂不支持', 'Unsupported')
const statusClass = (status: PdfStatus) => status === 'pass' ? 'text-green-700 dark:text-green-400' : status === 'fail' ? 'text-destructive' : 'text-amber-700 dark:text-amber-400'
async function verify() {
  if (busy.value || !file.value) return
  report.value = undefined; error.value = ''; busy.value = true
  const id = ++revision
  try {
    if (!window.isSecureContext || !crypto.subtle) throw new Error(tr('请通过 HTTPS 或 localhost 打开', 'Open over HTTPS or localhost'))
    if (!file.value.size || file.value.size > 20 * 1024 * 1024) throw new Error(tr('请选择非空且不超过 20 MiB 的 PDF', 'Select a nonempty PDF up to 20 MiB'))
    const bytes = new Uint8Array(await file.value.arrayBuffer())
    if (id !== revision) return
    worker = new Worker(new URL('../../../workers/pdf-verify.worker.ts', import.meta.url), { type: 'module' })
    worker.onmessage = event => {
      if (id !== revision || event.data.id !== id) return
      if (event.data.error) error.value = event.data.error
      else report.value = event.data.result
      cancel()
    }
    worker.onerror = () => { if (id === revision) { error.value = tr('本地 PDF 验签失败', 'Local PDF verification failed'); cancel() } }
    worker.postMessage({ id, bytes, options: { certificate: certificate.value || undefined, publicKey: publicKey.value || undefined, userId: userId.value } }, [bytes.buffer])
  } catch (reason) { if (id === revision) { error.value = reason instanceof Error ? reason.message : String(reason); cancel() } }
}
function saveCertificate(hex: string, index: number) { downloadBlob(new Blob([decodeMaterial(hex, 'hex').slice().buffer]), `pdf-certificate-${index + 1}.cer`) }
function saveReport() { if (report.value) downloadBlob(new Blob([JSON.stringify(report.value, null, 2)], { type: 'application/json' }), 'pdf-verification.json') }
</script>

<template>
  <section class="max-w-6xl mx-auto space-y-6 min-w-0">
    <header class="space-y-3">
      <h1 class="text-2xl font-semibold tracking-tight">{{ tr('PDF 本地验签', 'Local PDF verification') }}</h1>
      <p class="text-sm text-muted-foreground">{{ tr('检查数字签名、文档摘要、证书和签名覆盖范围。', 'Inspect digital signatures, document digests, certificates and signed byte ranges.') }}</p>
      <p class="inline-flex items-center gap-2 text-sm text-primary"><ShieldCheck class="w-4 h-4 shrink-0" />{{ tr('浏览器本地处理，PDF 不上传，不连接证书服务', 'Processed locally; no PDF uploads or certificate-service requests') }}</p>
    </header>
    <div class="grid xl:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] gap-6 items-start">
      <form class="rounded-lg border bg-card p-4 md:p-6 space-y-5 min-w-0" @submit.prevent="verify">
        <fieldset :key="inputEpoch" :disabled="busy" class="space-y-5 min-w-0">
          <label class="block text-sm space-y-2"><span>{{ tr('PDF 文件（最多 20 MiB）', 'PDF file (up to 20 MiB)') }}</span><input type="file" accept=".pdf,application/pdf" class="tool-input" @change="file = ($event.target as HTMLInputElement).files?.[0]" /></label>
          <p v-if="file" class="text-xs break-all text-muted-foreground">{{ file.name }} · {{ file.size.toLocaleString() }} {{ tr('字节', 'bytes') }}</p>
          <details class="space-y-4"><summary class="text-sm cursor-pointer text-muted-foreground">{{ tr('外部验签材料（可选）', 'External verification material (optional)') }}</summary>
            <PkiMaterialInput v-model="certificate" :label="tr('签名者证书', 'Signer certificate')" header="CERTIFICATE" optional />
            <PkiMaterialInput v-model="publicKey" :label="tr('公钥', 'Public key')" header="PUBLIC KEY" optional :hint="tr('SPKI PEM / Base64 / Hex 或 SM2 裸公钥', 'SPKI PEM / Base64 / Hex or raw SM2 public key')" />
            <p class="text-xs text-muted-foreground">{{ tr('通常使用签名内嵌证书；缺少证书的历史签名可提供外部证书或公钥。', 'Embedded certificates are used by default. Supply a certificate or key for legacy signatures without one.') }}</p>
          </details>
          <details><summary class="text-sm cursor-pointer text-muted-foreground">{{ tr('SM2 参数', 'SM2 options') }}</summary><label class="block text-sm mt-3 space-y-2"><span>SM2 userId</span><input v-model="userId" class="tool-input" /></label></details>
        </fieldset>
        <div class="flex flex-wrap gap-2"><BaseButton :disabled="!file || busy"><FileCheck class="w-4 h-4 mr-1" />{{ busy ? tr('本地验签中…', 'Verifying locally…') : tr('验证 PDF', 'Verify PDF') }}</BaseButton><BaseButton v-if="busy" type="button" variant="outline" @click="cancel">{{ tr('取消', 'Cancel') }}</BaseButton><BaseButton v-else type="button" variant="ghost" @click="clear">{{ tr('清空材料', 'Clear materials') }}</BaseButton></div>
        <p v-if="error" role="alert" class="text-sm text-destructive break-words">{{ translated(error) }}</p>
        <p class="text-xs leading-relaxed text-muted-foreground">{{ tr('证书仅在本地解析和检查有效期；不查询外部信任或吊销状态，不验证 TSA 信任锚、吊销证据和长期有效性。', 'Certificates are parsed and checked for validity dates locally. External trust, revocation, TSA anchors and long-term validation are not checked.') }}</p>
        <RouterLink to="/tools/offline-revocation" class="inline-block text-xs text-primary underline">{{ tr('OCSP / CRL 离线工具', 'Offline OCSP / CRL tools') }}</RouterLink>
        <RouterLink to="/tools/certificate-chain" class="block text-xs text-primary underline">{{ tr('使用指定根证书单独验证离线证书链', 'Validate a chain separately using explicit trust anchors') }}</RouterLink>
      </form>
      <section class="rounded-lg border bg-card p-4 md:p-6 space-y-5 min-w-0" aria-live="polite">
        <div class="flex flex-wrap items-center justify-between gap-2"><h2 class="text-lg font-semibold">{{ tr('验签结果', 'Verification result') }}</h2><BaseButton v-if="report" size="sm" variant="outline" @click="saveReport"><Download class="w-4 h-4 mr-1" />{{ tr('下载报告', 'Download report') }}</BaseButton></div>
        <p v-if="!report" class="text-sm text-muted-foreground">{{ tr('选择 PDF 后运行。每个签名将分别显示数学验签、摘要和覆盖范围。', 'Choose a PDF and run verification. Each signature reports its cryptographic checks and byte coverage.') }}</p>
        <template v-else>
          <p role="status" class="font-medium break-words" :class="statusClass(report.status)">{{ translated(report.message) }}</p>
          <ul v-if="report.warnings.length" class="text-sm space-y-2 text-muted-foreground"><li v-for="(warning,index) in report.warnings" :key="index">{{ translated(warning) }}</li></ul>
          <article v-for="(signature,index) in report.signatures" :key="index" class="border-t pt-5 space-y-4 min-w-0" data-pdf-signature>
            <div class="flex flex-wrap justify-between gap-2"><h3 class="font-semibold break-all">{{ signature.name }}</h3><span class="text-xs text-muted-foreground">{{ signature.format }} · {{ signature.subFilter }}</span></div>
            <div class="grid sm:grid-cols-2 gap-3 text-sm">
              <div class="rounded border p-3 space-y-1"><p class="text-muted-foreground">{{ tr('数字签名', 'Digital signature') }}</p><p :class="statusClass(signature.signatureStatus)">{{ statusText(signature.signatureStatus) }}</p></div>
              <div class="rounded border p-3 space-y-1"><p class="text-muted-foreground">{{ tr('文档摘要与覆盖', 'Digest and coverage') }}</p><p :class="statusClass(signature.integrityStatus)">{{ statusText(signature.integrityStatus) }}</p></div>
            </div>
            <p class="text-sm break-words">{{ translated(signature.message) }}</p>
            <dl class="text-sm space-y-2"><div><dt class="text-muted-foreground">ByteRange</dt><dd class="font-mono text-xs break-all">[{{ signature.range.join(', ') }}]</dd></div><div><dt class="text-muted-foreground">{{ tr('签署版本结束位置 / 文件长度', 'Signed revision end / file length') }}</dt><dd>{{ signature.revisionEnd.toLocaleString() }} / {{ report.fileSize.toLocaleString() }}</dd></div><div><dt class="text-muted-foreground">{{ tr('签后数据', 'Data after this signature') }}</dt><dd>{{ signature.hasLaterChanges ? tr('存在后续数据，请结合各签名的覆盖范围判断', 'Later data exists; inspect the coverage of each signature') : tr('无', 'None') }}</dd></div></dl>
            <ul v-if="signature.warnings.length" class="text-xs space-y-1 text-muted-foreground"><li v-for="(warning,wi) in signature.warnings" :key="wi">{{ translated(warning) }}</li></ul>
            <details v-for="(cert,ci) in signature.certificates" :key="ci" class="border rounded p-3 space-y-3 min-w-0"><summary class="text-sm cursor-pointer break-all">{{ tr('证书', 'Certificate') }} · {{ cert.subject }}</summary>
              <dl class="text-xs space-y-2 break-all"><div><dt class="text-muted-foreground">{{ tr('签发者', 'Issuer') }}</dt><dd>{{ cert.issuer }}</dd></div><div><dt class="text-muted-foreground">{{ tr('序列号', 'Serial number') }}</dt><dd>{{ cert.serialNumber }}</dd></div><div><dt class="text-muted-foreground">{{ tr('算法', 'Algorithm') }}</dt><dd>{{ cert.algorithm }}</dd></div><div><dt class="text-muted-foreground">{{ tr('有效期', 'Validity') }}</dt><dd>{{ cert.validFrom }} — {{ cert.validTo }}</dd><dd :class="cert.withinValidity ? '' : 'text-destructive'">{{ cert.withinValidity ? tr('当前处于有效期内', 'Currently within validity') : tr('已过期或尚未生效', 'Expired or not yet valid') }}</dd></div><div><dt class="text-muted-foreground">SHA-256</dt><dd class="font-mono">{{ cert.sha256 }}</dd></div></dl>
              <EncodedOutput :value="cert.hex" kind="certificate" :label="tr('证书格式导出', 'Certificate export')" collapsible><template #actions><BaseButton type="button" variant="outline" size="sm" @click="saveCertificate(cert.hex, ci)">.cer</BaseButton></template></EncodedOutput>
            </details>
          </article>
          <details class="border-t pt-4"><summary class="text-xs text-muted-foreground cursor-pointer">{{ tr('原始报告（JSON）', 'Raw report (JSON)') }}</summary><pre class="text-xs whitespace-pre-wrap break-all mt-3 max-h-96 overflow-auto">{{ JSON.stringify(report, null, 2) }}</pre></details>
        </template>
      </section>
    </div>
  </section>
</template>
