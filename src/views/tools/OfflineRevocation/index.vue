<script setup lang="ts">
import { computed, onBeforeUnmount, reactive, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { Download, ShieldCheck } from 'lucide-vue-next'
import BaseButton from '@/components/ui/BaseButton.vue'
import PkiMaterialInput from '@/components/crypto/PkiMaterialInput.vue'
import EncodedOutput from '@/components/crypto/EncodedOutput.vue'
import { decodeMaterial } from '@/utils/crypto/material-format'
import { downloadBlob } from '@/utils/download'
import type { RevocationArtifact, RevocationInput, RevocationResult } from '@/utils/pki/revocation'

const { locale } = useI18n()
const tr = (zh: string, en: string) => locale.value.startsWith('zh') ? zh : en
const initial = (): RevocationInput => ({ mode: 'request-create', target: '', issuer: '', responder: '', privateKey: '', password: '', request: '', response: '', crl: '', hashAlgorithm: 'SHA-256', nonce: true, status: 'good', thisUpdate: new Date(Date.now() - 60000).toISOString(), nextUpdate: new Date(Date.now() + 86400000).toISOString(), revocationTime: new Date(Date.now() - 3600000).toISOString(), reason: 0, userId: '1234567812345678', certificateUserId: '1234567812345678' })
const form = reactive(initial()), busy = ref(false), error = ref(''), result = ref<RevocationResult>(), epoch = ref(0)
let worker: Worker | undefined, version = 0
const modes = [['request-create', '制作 OCSP 请求', 'Create OCSP request'], ['request-inspect', '解析 OCSP 请求', 'Inspect OCSP request'], ['response-create', '构造离线测试响应', 'Create offline test response'], ['response-verify', '解析并校验 OCSP 响应', 'Inspect and verify OCSP response'], ['crl-inspect', '解析并校验 CRL', 'Inspect and verify CRL']]
const needRequest = computed(() => ['request-inspect', 'response-create', 'response-verify'].includes(form.mode))
const needTarget = computed(() => ['request-create', 'response-verify', 'crl-inspect'].includes(form.mode))
const needResponder = computed(() => ['response-create', 'response-verify'].includes(form.mode))
function cancel() { version++; worker?.terminate(); worker = undefined; busy.value = false }
function clear() { cancel(); epoch.value++; Object.assign(form, initial()); error.value = ''; result.value = undefined }
watch(() => form.mode, () => { cancel(); epoch.value++; error.value = ''; result.value = undefined })
watch(form, () => { result.value = undefined }, { deep: true })
onBeforeUnmount(() => { cancel(); Object.assign(form, initial()) })
function execute() {
  if (busy.value) return
  error.value = ''; result.value = undefined
  if (!window.isSecureContext || !crypto.subtle) { error.value = tr('请通过 HTTPS 或 localhost 打开此工具', 'Open this tool over HTTPS or localhost'); return }
  busy.value = true
  const current = ++version
  try {
    worker = new Worker(new URL('../../../workers/revocation.worker.ts', import.meta.url), { type: 'module' })
    worker.onmessage = event => { if (current !== version) return; if (event.data.error) error.value = event.data.error; else result.value = event.data.result; cancel() }
    worker.onerror = () => { if (current === version) { error.value = tr('本地处理失败，请检查输入材料与浏览器支持', 'Local processing failed; check materials and browser support'); cancel() } }
    worker.postMessage({ ...form })
  } catch (reason) { error.value = (reason as Error).message; cancel() }
}
function download(artifact: RevocationArtifact) { downloadBlob(new Blob([decodeMaterial(artifact.hex, 'hex').slice().buffer]), artifact.filename) }
function useRequest(artifact: RevocationArtifact) { form.request = artifact.hex; form.mode = 'response-create' }
const labels: Record<string, [string, string]> = {
  signatureValid: ['签名有效', 'Signature valid'], authorized: ['签发者授权', 'Issuer authorization'], bindingValid: ['CertID 绑定', 'CertID binding'], nonceMatches: ['Nonce 绑定', 'Nonce binding'], noncePresent: ['请求含 Nonce', 'Request has nonce'], timeValid: ['时间检查', 'Time checks'], responder: ['响应者', 'Responder'], producedAt: ['响应生成时间', 'Produced at'], authorizationError: ['授权错误', 'Authorization error'], freshness: ['新鲜度范围', 'Freshness scope'], scope: ['校验范围', 'Verification scope'], warning: ['结果说明', 'Result note'], nonce: ['Nonce（Hex）', 'Nonce (Hex)'], signedRequest: ['请求附带签名', 'Signed request'], requestSignature: ['请求签名校验', 'Request signature check'], issuer: ['签发者', 'Issuer'], thisUpdate: ['本次更新时间', 'This update'], nextUpdate: ['下次更新时间', 'Next update'], revokedCount: ['吊销条目数', 'Revoked entry count'], targetSerial: ['目标序号（Hex）', 'Target serial (Hex)'], listed: ['目标列入此 CRL', 'Target listed in this CRL'], revocationTime: ['吊销时间', 'Revocation time'], reason: ['吊销原因代码', 'Reason code'], hashAlgorithm: ['CertID 摘要算法', 'CertID hash'], issuerNameHash: ['签发者名称摘要', 'Issuer name hash'], issuerKeyHash: ['签发者公钥摘要', 'Issuer key hash'], serialNumber: ['证书序号（Hex）', 'Serial number (Hex)'], status: ['响应声明状态', 'Asserted status'],
}
function display(value: unknown) {
  if (typeof value === 'boolean') return value ? tr('是', 'Yes') : tr('否', 'No')
  const text = String(value ?? ''), split = text.indexOf(' / ')
  if (split >= 0 && /[\u3400-\u9fff]/.test(text.slice(0, split))) return tr(text.slice(0, split), text.slice(split + 3))
  if (['good', 'revoked', 'unknown'].includes(text)) return ({ good: tr('good（响应声明未吊销）', 'good (asserted by responder)'), revoked: tr('revoked（响应声明已吊销）', 'revoked (asserted by responder)'), unknown: tr('unknown（状态未知）', 'unknown') })[text]
  return text
}
const fields = computed(() => Object.entries(result.value?.details ?? {}).filter(([key, value]) => key !== 'valid' && !Array.isArray(value) && value !== undefined && value !== '').map(([key, value]) => ({ key, label: labels[key] ? tr(...labels[key]) : key, value: display(value) })))
const records = computed(() => (result.value?.details.responses ?? result.value?.details.requests ?? []) as Record<string, unknown>[])
</script>

<template>
  <section class="max-w-6xl mx-auto space-y-6 min-w-0">
    <header class="space-y-3">
      <h1 class="text-2xl font-semibold">{{ tr('离线 OCSP / CRL', 'Offline OCSP / CRL') }}</h1>
      <p class="text-sm text-muted-foreground">{{ tr('制作 OCSP 请求，按请求签发测试响应，或校验已有响应与 CRL。所有材料由你提供。', 'Create OCSP requests, sign test responses, or verify imported responses and CRLs using your own materials.') }}</p>
      <p class="flex items-center gap-2 text-sm text-primary"><ShieldCheck class="w-4 h-4" />{{ tr('纯前端处理，不连接 OCSP、CRL 或 AIA 服务', 'Local browser processing; no OCSP, CRL or AIA service connections') }}</p>
      <p class="rounded-md border border-amber-500/40 bg-amber-500/5 p-3 text-sm">{{ tr('生成的 OCSP 响应仅用于离线测试，good / revoked / unknown 由你指定，不代表真实在线吊销状态。签名有效也不等于系统信任或实时有效。', 'Generated OCSP responses are offline test materials. You choose good / revoked / unknown; these are not live revocation results. A valid signature does not establish system trust or current status.') }}</p>
    </header>
    <div class="grid xl:grid-cols-2 gap-6 items-start">
      <form class="rounded-lg border bg-card p-4 md:p-6 space-y-5 min-w-0" @submit.prevent="execute">
        <fieldset :key="epoch" :disabled="busy" class="space-y-5 min-w-0">
          <label class="block text-sm space-y-2"><span>{{ tr('操作', 'Operation') }}</span><select v-model="form.mode" :aria-label="tr('操作', 'Operation')" class="tool-input"><option v-for="mode in modes" :key="mode[0]" :value="mode[0]">{{ tr(mode[1], mode[2]) }}</option></select></label>
          <PkiMaterialInput v-if="needTarget" v-model="form.target" :label="tr('目标证书', 'Target certificate')" header="CERTIFICATE" :optional="form.mode !== 'request-create'" />
          <PkiMaterialInput v-if="form.mode !== 'request-inspect'" v-model="form.issuer" :label="tr('签发者 CA 证书', 'Issuer CA certificate')" header="CERTIFICATE" />
          <PkiMaterialInput v-if="needRequest" v-model="form.request" :label="tr('OCSP 请求', 'OCSP request')" header="OCSP REQUEST" />
          <template v-if="form.mode === 'request-create'">
            <label class="block text-sm space-y-2"><span>{{ tr('CertID 摘要算法', 'CertID hash') }}</span><select v-model="form.hashAlgorithm" class="tool-input"><option>SHA-256</option><option>SHA-1</option></select></label>
            <label class="flex items-center gap-2 text-sm"><input v-model="form.nonce" type="checkbox" />{{ tr('添加随机 32 字节 Nonce', 'Include a random 32-byte nonce') }}</label>
          </template>
          <PkiMaterialInput v-if="needResponder" v-model="form.responder" :label="tr('响应者证书', 'Responder certificate')" header="CERTIFICATE" optional :hint="form.mode === 'response-create' ? tr('留空使用签发者；委托响应者需直接由该 CA 签发并具有 OCSP Signing EKU', 'Leave empty to use issuer; delegated responder must be directly issued by this CA with OCSP Signing EKU') : tr('可留空，从响应内嵌证书及签发者中匹配', 'Optional; otherwise match embedded certificates and issuer')" />
          <template v-if="form.mode === 'response-create'">
            <PkiMaterialInput v-model="form.privateKey" :label="tr('响应签名私钥', 'Response signing private key')" header="PRIVATE KEY" :hint="tr('SM2 / RSA / ECDSA；PKCS#8、加密 PKCS#8、PKCS#1、SEC1', 'SM2 / RSA / ECDSA; PKCS#8, encrypted PKCS#8, PKCS#1 or SEC1')" />
            <label class="block text-sm space-y-2"><span>{{ tr('私钥口令', 'Private key password') }}</span><input v-model="form.password" type="password" autocomplete="off" class="tool-input" /></label>
            <label class="block text-sm space-y-2"><span>{{ tr('测试响应状态（应用于请求中全部 CertID）', 'Test response status (all requested CertIDs)') }}</span><select v-model="form.status" class="tool-input"><option value="good">good</option><option value="revoked">revoked</option><option value="unknown">unknown</option></select></label>
            <label class="block text-sm space-y-2"><span>thisUpdate (ISO 8601)</span><input v-model="form.thisUpdate" required class="tool-input" /></label>
            <label class="block text-sm space-y-2"><span>{{ tr('nextUpdate（ISO 8601，可选）', 'nextUpdate (ISO 8601, optional)') }}</span><input v-model="form.nextUpdate" class="tool-input" /></label>
            <template v-if="form.status === 'revoked'">
              <label class="block text-sm space-y-2"><span>{{ tr('吊销时间（ISO 8601）', 'Revocation time (ISO 8601)') }}</span><input v-model="form.revocationTime" required class="tool-input" /></label>
              <label class="block text-sm space-y-2"><span>{{ tr('吊销原因', 'Revocation reason') }}</span><select v-model.number="form.reason" class="tool-input"><option :value="-1">{{ tr('省略原因', 'Omit reason') }}</option><option :value="0">0 · unspecified</option><option :value="1">1 · keyCompromise</option><option :value="2">2 · cACompromise</option><option :value="3">3 · affiliationChanged</option><option :value="4">4 · superseded</option><option :value="5">5 · cessationOfOperation</option><option :value="6">6 · certificateHold</option><option :value="8">8 · removeFromCRL</option><option :value="9">9 · privilegeWithdrawn</option><option :value="10">10 · aACompromise</option></select></label>
            </template>
            <p class="text-xs text-muted-foreground">{{ tr('请求中的 CertID 和 Nonce 将原样绑定到响应。必须拥有匹配的签发者或授权响应者私钥；不会替未知 CA 伪造响应。材料与口令仅保存在当前页面内存。', 'CertIDs and nonce remain bound to the request. A matching issuer or authorized responder key is required. Materials and passwords remain in page memory.') }}</p>
          </template>
          <PkiMaterialInput v-if="form.mode === 'response-verify'" v-model="form.response" :label="tr('OCSP 响应', 'OCSP response')" header="OCSP RESPONSE" />
          <template v-if="form.mode === 'crl-inspect'">
            <PkiMaterialInput v-model="form.crl" label="CRL" header="X509 CRL" />
            <p class="text-xs text-muted-foreground">{{ tr('支持完整直接 CRL 的离线签名、时间检查和目标序号查询。增量、间接或限定范围 CRL 会明确拒绝；未列入不等于实时未吊销。', 'Supports complete direct CRL signatures, times and serial lookup. Delta, indirect and scoped CRLs are rejected; absence does not establish current good status.') }}</p>
          </template>
          <details v-if="form.mode !== 'request-inspect'" class="text-sm"><summary class="cursor-pointer text-muted-foreground">{{ tr('SM2 参数', 'SM2 options') }}</summary><label v-if="form.mode !== 'request-create'" class="block mt-3 space-y-2"><span>{{ tr('OCSP / CRL 签名 userId', 'OCSP / CRL signature userId') }}</span><input v-model="form.userId" class="tool-input" /></label><label class="block mt-3 space-y-2"><span>{{ tr('证书签名 userId', 'Certificate signature userId') }}</span><input v-model="form.certificateUserId" class="tool-input" /></label></details>
        </fieldset>
        <div class="flex flex-wrap gap-2"><BaseButton :disabled="busy">{{ busy ? tr('本地处理中…', 'Processing locally…') : tr('运行', 'Run') }}</BaseButton><BaseButton v-if="busy" type="button" variant="outline" @click="cancel">{{ tr('取消', 'Cancel') }}</BaseButton><BaseButton v-else type="button" variant="ghost" @click="clear">{{ tr('清空材料', 'Clear materials') }}</BaseButton></div>
        <p v-if="error" role="alert" class="text-sm text-destructive break-words">{{ error }}</p>
      </form>
      <section class="rounded-lg border bg-card p-4 md:p-6 space-y-5 min-w-0" aria-live="polite">
        <h2 class="text-lg font-semibold">{{ tr('离线处理结果', 'Offline result') }}</h2>
        <p v-if="!result" class="text-sm text-muted-foreground">{{ tr('填写材料后运行。生成结果支持 Hex / Base64、头尾、换行与 DER 下载。', 'Enter materials and run. Generated results support Hex / Base64, headers, wrapping and DER downloads.') }}</p>
        <template v-else>
          <p v-if="result.valid !== undefined" role="status" class="font-medium" :class="result.valid ? 'text-green-700 dark:text-green-400' : 'text-destructive'">{{ result.valid ? tr('导入材料的离线检查通过', 'Offline material checks passed') : tr('离线检查未通过', 'Offline checks failed') }}</p>
          <dl class="space-y-3 text-sm"><div v-for="field in fields" :key="field.key" class="grid sm:grid-cols-[9rem_minmax(0,1fr)] gap-1"><dt class="text-muted-foreground">{{ field.label }}</dt><dd class="break-all whitespace-pre-wrap">{{ field.value }}</dd></div></dl>
          <div v-for="(entry, index) in records" :key="index" class="rounded-md border p-3 space-y-2 text-sm"><h3 class="font-medium">CertID {{ index + 1 }}</h3><div v-for="(value, key) in entry" :key="key" class="break-all"><template v-if="value !== undefined"><span class="text-muted-foreground">{{ labels[key] ? tr(...labels[key]) : key }}: </span>{{ display(value) }}</template></div></div>
          <EncodedOutput v-for="artifact in result.artifacts" :key="artifact.filename" :value="artifact.hex" :label="artifact.label" :kind="artifact.kind"><template #actions><BaseButton type="button" size="sm" variant="outline" @click="download(artifact)"><Download class="h-4 w-4 mr-1" />DER</BaseButton><BaseButton v-if="artifact.kind === 'ocsp-request'" type="button" size="sm" variant="outline" @click="useRequest(artifact)">{{ tr('用此请求构造响应', 'Create response for this request') }}</BaseButton></template></EncodedOutput>
        </template>
      </section>
    </div>
  </section>
</template>
