<script setup lang="ts">
import { computed, onBeforeUnmount, reactive, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { ShieldCheck, Download } from 'lucide-vue-next'
import BaseButton from '@/components/ui/BaseButton.vue'
import PkiMaterialInput from '@/components/crypto/PkiMaterialInput.vue'
import PkiResultDetails from '@/components/crypto/PkiResultDetails.vue'
import EncodedOutput from '@/components/crypto/EncodedOutput.vue'
import { localPkiTools, type PkiMode } from '@/lib/local-pki-tools'
import { decodeMaterial } from '@/utils/crypto/material-format'
import { downloadBlob } from '@/utils/download'
import type { PkiInput, PkiResult, PkiArtifact } from '@/utils/pki/operations'
import { MAX_CONTENT_BYTES, MAX_ENCODED_BYTES } from '@/utils/pki/limits'

const props = defineProps<{ mode: PkiMode }>()
const { locale } = useI18n()
const tr = (zh: string, en: string) => locale.value.startsWith('zh') ? zh : en
const tool = computed(() => localPkiTools.find(item => item.mode === props.mode)!)
const fresh = (): PkiInput => ({ mode: props.mode, action: 'create', algorithm: 'SM2', rsaBits: 2048, commonName: '', organization: '', country: 'CN', sans: '', ca: false, days: 365, privateKey: '', privateKeyPassword: '', cert: '', issuer: '', roots: '', intermediates: '', csr: '', password: '', alias: 'signer', content: new Uint8Array(), encoded: '', encoding: 'auto', signatureMode: 'SM2', userId: '1234567812345678' })
const form = reactive(fresh()), busy = ref(false), error = ref(''), result = ref<PkiResult>(), contentText = ref(''), contentFile = ref<File>(), useFile = ref(false)
const inputEpoch = ref(0)
const createMode = computed(() => ['csr-create', 'self-signed-certificate'].includes(props.mode))
const cipherMode = computed(() => ['certificate-encrypt', 'certificate-envelope'].includes(props.mode))
const needCert = computed(() => !['csr-create', 'csr-parse', 'self-signed-certificate'].includes(props.mode) && !(props.mode === 'certificate-encrypt' && form.action === 'open'))
const needKey = computed(() => createMode.value || props.mode === 'pkcs12-create' || cipherMode.value && form.action === 'open')
const needContent = computed(() => cipherMode.value && form.action === 'create' || props.mode === 'certificate-verify' && form.action === 'data')
const needEncoded = computed(() => cipherMode.value && form.action === 'open' || props.mode === 'certificate-verify' && form.action === 'data')
const actionLabel = computed(() => props.mode === 'csr-create' ? tr('生成 CSR', 'Create CSR') : props.mode === 'csr-parse' ? tr('解析并验签', 'Inspect and verify') : props.mode === 'self-signed-certificate' ? tr('生成自签证书', 'Create certificate') : props.mode === 'pkcs12-create' ? tr('创建 PFX / P12', 'Create PFX / P12') : cipherMode.value ? form.action === 'open' ? tr('解密', 'Decrypt') : tr('加密', 'Encrypt') : tr('验证', 'Verify'))
let worker: Worker | undefined
let requestVersion = 0
let encodedImportVersion = 0
function cancel() { requestVersion++; worker?.terminate(); worker = undefined; busy.value = false }
function reset() { cancel(); inputEpoch.value++; encodedImportVersion++; Object.assign(form, fresh()); form.action = props.mode === 'certificate-verify' ? 'certificate' : 'create'; result.value = undefined; error.value = ''; contentText.value = ''; contentFile.value = undefined; useFile.value = false }
watch(() => props.mode, reset, { immediate: true })
watch(() => form.action, () => { cancel(); inputEpoch.value++; encodedImportVersion++; result.value = undefined; error.value = '' })
watch(() => form.encoded, () => { encodedImportVersion++ }, { flush: 'sync' })
watch([form, contentText, contentFile, useFile], () => { result.value = undefined }, { deep: true })
onBeforeUnmount(reset)
async function execute() {
  if (busy.value) return
  result.value = undefined; error.value = ''; busy.value = true
  const version = ++requestVersion
  try {
    if (!window.isSecureContext || !crypto.subtle) throw new Error(tr('请通过 HTTPS 或 localhost 打开此工具', 'Open this tool over HTTPS or localhost'))
    const file = contentFile.value
    if (needContent.value && useFile.value && !file) throw new Error(tr('请选择原文文件', 'Select a content file'))
    if (file && file.size > MAX_CONTENT_BYTES) throw new Error(tr('原文文件不能超过 20 MB', 'Content files must not exceed 20 MB'))
    const content = needContent.value ? useFile.value ? new Uint8Array(await file!.arrayBuffer()) : new TextEncoder().encode(contentText.value) : new Uint8Array()
    if (version !== requestVersion) return
    const input: PkiInput = { ...form, mode: props.mode, content }
    worker = new Worker(new URL('../../../workers/pki.worker.ts', import.meta.url), { type: 'module' })
    worker.onmessage = event => { if (version !== requestVersion) return; if (event.data.error) error.value = event.data.error; else result.value = event.data.result; cancel() }
    worker.onerror = () => { if (version !== requestVersion) return; error.value = tr('本地计算失败，请检查浏览器是否支持 Web Crypto', 'Local computation failed; check Web Crypto support'); cancel() }
    worker.postMessage(input)
  } catch (reason) { if (version === requestVersion) { error.value = reason instanceof Error ? reason.message : String(reason); cancel() } }
}
function save(artifact: PkiArtifact, extension?: string) {
  const bytes = decodeMaterial(artifact.hex, 'hex')
  downloadBlob(new Blob([bytes.slice().buffer]), extension ? artifact.filename.replace(/\.[^.]+$/, extension) : artifact.filename)
}
function chooseContent(event: Event) { contentFile.value = (event.target as HTMLInputElement).files?.[0] }
async function chooseEncoded(event: Event) {
  const input = event.target as HTMLInputElement, file = input.files?.[0]; if (!file) return
  const version = ++encodedImportVersion
  try {
    if (file.size > MAX_ENCODED_BYTES) throw new Error(tr('密文 / 信封文件不能超过 21 MB', 'Ciphertext / envelope files must not exceed 21 MB'))
    const bytes = new Uint8Array(await file.arrayBuffer())
    if (version !== encodedImportVersion) return
    // Signature and ciphertext imports are binary files; text encodings use the text box.
    form.encoded = Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join(''); form.encoding = 'hex'
  } catch (reason) { if (version === encodedImportVersion) error.value = (reason as Error).message }
  finally { input.value = '' }
}
</script>

<template>
  <section class="max-w-6xl mx-auto space-y-6 min-w-0" :key="mode">
    <header class="space-y-3">
      <h1 class="text-2xl font-semibold tracking-tight">{{ tr(tool.title, tool.en) }}</h1>
      <p class="text-sm text-muted-foreground">{{ tr(tool.description, tool.enDescription) }}</p>
      <p class="inline-flex items-center gap-2 text-sm text-primary"><ShieldCheck class="w-4 h-4 shrink-0" />{{ tr('浏览器本地处理，材料不上传服务器', 'Processed in your browser; materials are not uploaded') }}</p>
    </header>
    <div class="grid xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-6 items-start">
      <form class="rounded-lg border bg-card p-4 md:p-6 space-y-5 min-w-0" @submit.prevent="execute">
        <fieldset :key="inputEpoch" :disabled="busy" class="space-y-5 min-w-0">
          <label v-if="cipherMode || mode === 'certificate-verify'" class="block text-sm space-y-2"><span>{{ tr('操作', 'Operation') }}</span>
            <select v-model="form.action" :aria-label="tr('操作', 'Operation')" class="tool-input">
              <template v-if="cipherMode"><option value="create">{{ tr('加密 / 制作信封', 'Encrypt / create envelope') }}</option><option value="open">{{ tr('解密 / 解开信封', 'Decrypt / open envelope') }}</option></template>
              <template v-else><option value="certificate">{{ tr('验证证书自身签名', 'Verify certificate signature') }}</option><option value="data">{{ tr('使用证书验证数据签名', 'Verify data using a certificate') }}</option></template>
            </select>
          </label>
          <template v-if="createMode">
            <div class="grid sm:grid-cols-2 gap-4">
              <label class="block text-sm space-y-2"><span>{{ tr('新密钥算法', 'New key algorithm') }}</span><select v-model="form.algorithm" :aria-label="tr('新密钥算法', 'New key algorithm')" class="tool-input"><option>SM2</option><option>RSA</option><option>ECDSA</option></select></label>
              <label v-if="form.algorithm === 'RSA'" class="block text-sm space-y-2"><span>{{ tr('RSA 位长', 'RSA bits') }}</span><select v-model.number="form.rsaBits" class="tool-input"><option :value="2048">2048</option><option :value="3072">3072</option><option :value="4096">4096</option></select></label>
            </div>
            <p class="text-xs text-muted-foreground">{{ tr('留空私钥会生成新密钥；导入私钥时自动识别其算法。ECDSA 新密钥使用 P-256。', 'Leave the key empty to generate one; imported keys determine the algorithm. New ECDSA keys use P-256.') }}</p>
          </template>
          <template v-if="needKey">
            <PkiMaterialInput v-model="form.privateKey" :label="tr('私钥', 'Private key')" header="PRIVATE KEY" :optional="createMode" :hint="tr('PKCS#8（支持口令加密）/ RSA PKCS#1 / EC SEC1；SM2 也支持 32 字节裸 Hex', 'PKCS#8 (password encryption supported) / RSA PKCS#1 / EC SEC1; SM2 also accepts 32-byte raw Hex')" />
            <label class="block text-sm space-y-2"><span>{{ tr('私钥口令（加密 PKCS#8）', 'Private key password (encrypted PKCS#8)') }}</span><input v-model="form.privateKeyPassword" type="password" autocomplete="off" class="tool-input" /></label>
            <p class="text-xs text-muted-foreground">{{ tr('用于解锁导入的私钥；未加密私钥留空。材料和口令仅保留在当前页面内存中。', 'Unlocks an imported key; leave empty for an unencrypted key. Materials and passwords stay only in this page’s memory.') }}</p>
          </template>
          <template v-if="createMode">
            <label class="block text-sm space-y-2"><span>{{ tr('通用名称 CN', 'Common name CN') }}</span><input v-model="form.commonName" required maxlength="256" placeholder="example.test" class="tool-input" /></label>
            <div class="grid sm:grid-cols-2 gap-4"><label class="block text-sm space-y-2"><span>{{ tr('组织 O', 'Organization O') }}</span><input v-model="form.organization" class="tool-input" /></label><label class="block text-sm space-y-2"><span>{{ tr('国家 C', 'Country C') }}</span><input v-model="form.country" maxlength="2" class="tool-input" /></label></div>
            <label class="block text-sm space-y-2"><span>{{ tr('备用名称 SAN（每行一项）', 'Subject alternative names (one per line)') }}</span><textarea v-model="form.sans" rows="3" class="tool-input" placeholder="dns:example.test&#10;ip:127.0.0.1" /></label>
            <label class="flex items-center gap-2 text-sm"><input v-model="form.ca" type="checkbox" />{{ tr('CA 证书用途', 'CA certificate usage') }}</label>
            <label v-if="mode === 'self-signed-certificate'" class="block text-sm space-y-2"><span>{{ tr('有效期（天）', 'Validity (days)') }}</span><input v-model.number="form.days" type="number" min="1" max="36500" required class="tool-input" /></label>
          </template>
          <PkiMaterialInput v-if="needCert" v-model="form.cert" :label="mode === 'pkcs12-create' ? tr('证书及证书链', 'Certificate and chain') : tr('证书', 'Certificate')" header="CERTIFICATE" :multiple="mode === 'pkcs12-create'" />
          <PkiMaterialInput v-if="mode === 'csr-parse'" v-model="form.csr" label="CSR" header="CERTIFICATE REQUEST" />
          <PkiMaterialInput v-if="mode === 'certificate-verify' && form.action === 'certificate'" v-model="form.issuer" :label="tr('签发者证书（自签证书可留空）', 'Issuer certificate (optional for self-signed)')" header="CERTIFICATE" optional />
          <template v-if="mode === 'certificate-chain'">
            <PkiMaterialInput v-model="form.intermediates" :label="tr('中间证书', 'Intermediate certificates')" header="CERTIFICATE" multiple optional />
            <PkiMaterialInput v-model="form.roots" :label="tr('明确受信任的根证书', 'Explicitly trusted root certificates')" header="CERTIFICATE" multiple />
            <p class="text-xs text-muted-foreground">{{ tr('验证所选信任根下的签名、有效期、CA、KeyUsage 和路径长度。不读取系统信任库，不检查吊销或主机名；不支持的策略约束会返回失败。', 'Checks signatures, validity, CA, KeyUsage and path length under your selected anchors. Does not read system trust, check revocation or hostnames; unsupported policy constraints fail.') }}</p>
          </template>
          <template v-if="mode === 'pkcs12-create'">
            <label class="block text-sm space-y-2"><span>{{ tr('别名', 'Alias') }}</span><input v-model="form.alias" required class="tool-input" /></label>
            <label class="block text-sm space-y-2"><span>{{ tr('保护口令', 'Protection password') }}</span><input v-model="form.password" type="password" required autocomplete="new-password" class="tool-input" /></label>
            <p class="text-xs text-muted-foreground">{{ tr('此口令保护新建的 PFX / P12，与上方导入私钥的口令独立。PFX 与 P12 是同一容器格式。私钥使用 AES-256 加密，SHA-256 MAC 保护容器完整性。', 'This password protects the new PFX / P12 independently of the imported key password above. PFX and P12 use the same container format. Keys are encrypted with AES-256; SHA-256 MAC protects container integrity.') }}</p>
          </template>
          <template v-if="needContent">
            <label class="flex gap-2 items-center text-sm"><input v-model="useFile" type="checkbox" />{{ tr('使用原文文件（最多 20 MB）', 'Use a content file (up to 20 MB)') }}</label>
            <label v-if="useFile" class="block text-sm space-y-2"><span>{{ tr('原文文件', 'Content file') }}</span><input type="file" class="tool-input" @change="chooseContent" /></label>
            <label v-else class="block text-sm space-y-2"><span>{{ tr('原文（UTF-8）', 'Content (UTF-8)') }}</span><textarea v-model="contentText" rows="4" class="tool-input" /></label>
          </template>
          <template v-if="needEncoded">
            <label class="block text-sm space-y-2"><span>{{ mode === 'certificate-verify' ? tr('签名值', 'Signature') : tr('密文 / 信封', 'Ciphertext / envelope') }}</span><textarea v-model="form.encoded" rows="4" class="tool-input font-mono text-xs" /></label>
            <div class="flex flex-wrap gap-3 text-sm"><label>{{ tr('输入编码', 'Input encoding') }}<select v-model="form.encoding" class="tool-input"><option value="auto">{{ tr('自动', 'Auto') }}</option><option value="hex">Hex</option><option value="base64">Base64</option><option value="pem">PEM</option></select></label><label class="text-primary underline cursor-pointer self-end">{{ tr('导入二进制文件', 'Import binary file') }}<input type="file" class="sr-only" @change="chooseEncoded" /></label></div>
            <p v-if="cipherMode" class="text-xs text-muted-foreground">{{ tr('原文最多 20 MB，密文 / 信封最多 21 MB。', 'Content: up to 20 MB; ciphertext / envelope: up to 21 MB.') }}</p>
          </template>
          <label v-if="mode === 'certificate-verify' && form.action === 'data'" class="block text-sm space-y-2"><span>{{ tr('签名算法', 'Signature algorithm') }}</span><select v-model="form.signatureMode" class="tool-input"><option value="SM2">SM2 / SM3 (DER / r||s)</option><option value="RSA-SHA256">RSA PKCS#1 v1.5 / SHA-256</option><option value="RSA-PSS-SHA256">RSA-PSS / SHA-256 (salt=32)</option><option value="ECDSA-SHA256">ECDSA / SHA-256 (DER)</option></select></label>
          <details v-if="!cipherMode" class="text-sm"><summary class="cursor-pointer text-muted-foreground">{{ tr('SM2 参数', 'SM2 options') }}</summary><label class="block mt-3 space-y-2"><span>SM2 userId</span><input v-model="form.userId" class="tool-input" /></label></details>
          <p v-if="mode === 'certificate-encrypt'" class="text-xs text-muted-foreground">{{ tr('RSA 使用 OAEP / SHA-256，适合短数据；SM2 输出 ASN.1 DER 密文。大文件请使用证书数字信封。', 'RSA uses OAEP / SHA-256 for short data; SM2 outputs ASN.1 DER ciphertext. Use a digital envelope for large files.') }}</p>
          <p v-if="mode === 'certificate-envelope'" class="text-xs text-muted-foreground">{{ tr('单接收者 CMS：RSA-OAEP + AES-256-CBC 或 SM2 + SM4-CBC。信封提供保密性，不包含发送者签名；解密成功不等于已验签。', 'Single-recipient CMS: RSA-OAEP + AES-256-CBC or SM2 + SM4-CBC. Envelopes provide confidentiality without a sender signature; decryption is not signature verification.') }}</p>
        </fieldset>
        <div class="flex flex-wrap gap-2"><BaseButton :disabled="busy">{{ busy ? tr('本地计算中…', 'Computing locally…') : actionLabel }}</BaseButton><BaseButton v-if="busy" type="button" variant="outline" @click="cancel">{{ tr('取消', 'Cancel') }}</BaseButton><BaseButton v-else type="button" variant="ghost" @click="reset">{{ tr('清空材料', 'Clear materials') }}</BaseButton></div>
        <p v-if="error" role="alert" class="text-sm text-destructive break-words">{{ error }}</p>
      </form>
      <section class="rounded-lg border bg-card p-4 md:p-6 space-y-5 min-w-0" aria-live="polite">
        <h2 class="text-lg font-semibold">{{ tr('处理结果', 'Result') }}</h2>
        <p v-if="!result" class="text-sm text-muted-foreground">{{ tr('完成左侧输入后运行。结果可切换 Hex / Base64、头尾和换行，并下载原始二进制文件。', 'Run after entering your materials. Results support Hex / Base64, headers, wrapping and original binary downloads.') }}</p>
        <template v-else>
          <p v-if="result.status !== undefined" role="status" class="font-medium" :class="result.status ? 'text-green-700 dark:text-green-400' : 'text-destructive'">{{ result.status ? tr('验证通过（仅限下列检查范围）', 'Verification passed (within the scope below)') : tr('验证未通过', 'Verification failed') }}</p>
          <p v-if="mode === 'self-signed-certificate'" class="text-sm text-muted-foreground">{{ tr('自签证书不会自动获得操作系统或浏览器信任。', 'Self-signed certificates are not automatically trusted by operating systems or browsers.') }}</p>
          <PkiResultDetails v-if="result.details" :details="result.details" :mode="mode" />
          <label v-if="result.plaintext !== undefined" class="block text-sm space-y-2"><span>{{ tr('UTF-8 明文', 'UTF-8 plaintext') }}</span><textarea readonly :value="result.plaintext" rows="5" class="tool-input" /></label>
          <EncodedOutput v-for="artifact in result.artifacts" :key="artifact.filename" :value="artifact.hex" :label="artifact.label" :kind="artifact.kind">
            <template #actions><BaseButton size="sm" type="button" variant="outline" @click="save(artifact)"><Download class="w-4 h-4 mr-1" />{{ artifact.filename }}</BaseButton><BaseButton v-if="mode === 'pkcs12-create'" size="sm" type="button" variant="outline" @click="save(artifact, '.pfx')">.pfx</BaseButton></template>
          </EncodedOutput>
        </template>
      </section>
    </div>
  </section>
</template>
