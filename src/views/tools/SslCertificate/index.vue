<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { computed, nextTick, onBeforeUnmount, reactive, ref, watch } from 'vue'
import { useCertificateGenerator } from '@/composables/useCertificateGenerator'
import { downloadSiteBundle, downloadSslFile } from '@/utils/ssl/download'
import { generationStages, type CertificateConfig, type CertificateFile, type GenerationRequest } from '@/types/ssl'
import {
  ArrowLeft, ArrowRight, CalendarDays, Check,
  X, Cloud, Code2, Monitor, Download,
  ChevronDown, FileText, Globe, Info, KeyRound,
  LoaderCircle, LockKeyhole, Plus, CircleHelp, ShieldCheck,
  Settings2, Upload
} from 'lucide-vue-next'
import {
  dateInputValue, inspectPrivateKeyEnvelope, inspectPublicKeyEnvelope, parseCertificateAddress, subjectDisplay,
  rootCaProfiles, rootCaSubject,
  type CertificateAddress, type SubjectFields
} from '@/utils/ssl/config'

const { t } = useI18n()

type Scenario = 'local' | 'intranet' | 'custom'
const generator = useCertificateGenerator()
const { running, stage: generationStage, error: generationError, cancelled, result: generated } = generator
const activeStageIndex = computed(() => generationStages.findIndex(item => item.id === generationStage.value))
const downloaded = ref<string[]>([])
const downloading = ref(false)
const downloadError = ref('')
const root = ref<HTMLElement | null>(null)
const fileInput = ref<HTMLInputElement | null>(null)
const publicFileInput = ref<HTMLInputElement | null>(null)
const step = ref(1)
const scenario = ref<Scenario>('local')
const primaryAddress = ref('localhost')
const extraAddresses = ref<CertificateAddress[]>([{ value: '127.0.0.1', type: 'IP' }])
const pendingAddress = ref('')
const addressError = ref('')
const validityPreset = ref<number | 'custom'>(365)
const customDays = ref<number | string>(730)
const days = computed(() => validityPreset.value === 'custom' ? Number(customDays.value) : validityPreset.value)
const keySource = ref<'generate' | 'import'>('generate')
const rootAlgorithm = ref('rsa-2048')
const rootProfile = computed(() => rootCaProfiles.find(item => item.id === rootAlgorithm.value)!)
const rootSubjectText = computed(() => `CN=${rootProfile.value.commonName},ou=test,ou=xcf,c=cn`)
const rootDays = ref<number | string>(3650)
const importMethod = ref<'file' | 'paste'>('file')
const privateKeyText = ref('')
const publicKeyText = ref('')
const importedFile = ref<{ name: string; format: string; pem: string } | null>(null)
const importedPublicFile = ref<{ name: string; format: string; pem: string } | null>(null)
const fileError = ref('')
const publicFileError = ref('')
const readingFile = ref(false)
const readingPublicFile = ref(false)
let readVersion = 0
let publicReadVersion = 0
const advancedOpen = ref(false)
const helpOpen = ref(false)
const attempted = ref(false)
const algorithm = ref('rsa-2048')
const algorithms = [
  { id: 'rsa-2048', label: 'RSA · 2048 位', description: '通用兼容，适合大多数开发环境', hash: 'SHA-256' },
  { id: 'rsa-3072', label: 'RSA · 3072 位', description: '更大的密钥，生成需要稍长时间', hash: 'SHA-256' },
  { id: 'rsa-4096', label: 'RSA · 4096 位', description: '按已有系统的要求选择', hash: 'SHA-256' },
  { id: 'ec-p256', label: 'ECDSA · P-256', description: '密钥更小，适合现代浏览器和服务', hash: 'SHA-256' },
  { id: 'ec-p384', label: 'ECDSA · P-384', description: '更高强度的椭圆曲线密钥', hash: 'SHA-384' }
]
const selectedAlgorithm = computed(() => rootAlgorithm.value === 'sm2'
  ? { id: 'sm2', label: 'SM2 · 256 位', description: '面向支持国密算法的服务与客户端', hash: 'SM3' }
  : algorithms.find(item => item.id === algorithm.value)!)
const dn = reactive<SubjectFields>({ CN: '', O: '', OU: '', C: '', ST: '', L: '' })
const scheduleStart = ref(false)
const startDate = ref(dateInputValue(new Date()))
const clockNow = ref(new Date())
const clientAuth = ref(false)
const parsedPrimary = computed(() => parseCertificateAddress(primaryAddress.value))
const addresses = computed(() => {
  const primary = parsedPrimary.value.address
  const values = primary ? [primary, ...extraAddresses.value] : extraAddresses.value
  return values.filter((address, index) => values.findIndex(other => other.value === address.value) === index)
})
const subject = computed<SubjectFields>(() => ({
  CN: dn.CN.trim() || parsedPrimary.value.address?.value || primaryAddress.value.trim(),
  O: dn.O.trim(), OU: dn.OU.trim(), C: dn.C.toUpperCase().trim(), ST: dn.ST.trim(), L: dn.L.trim()
}))
const subjectText = computed(() => subjectDisplay(subject.value))
const notBefore = computed(() => generated.value ? new Date(generated.value.notBefore) : scheduleStart.value ? new Date(`${startDate.value}T00:00:00`) : new Date(clockNow.value.getTime() - 5 * 60_000))
const notAfter = computed(() => generated.value ? new Date(generated.value.notAfter) : new Date(notBefore.value.getTime() + days.value * 86_400_000))
const rootNotAfter = computed(() => generated.value ? new Date(generated.value.rootNotAfter) : new Date(notBefore.value.getTime() + Number(rootDays.value) * 86_400_000))
const validDays = computed(() => Number.isInteger(days.value) && days.value >= 1 && days.value <= 3650)
const validDate = computed(() => !scheduleStart.value || /^\d{4}-\d{2}-\d{2}$/.test(startDate.value) && Number.isFinite(notBefore.value.getTime()) && notBefore.value.getFullYear() >= 2000 && notBefore.value.getFullYear() <= 2099)
const countryError = computed(() => subject.value.C && !/^[A-Z]{2}$/.test(subject.value.C) ? '国家 / 地区代码需要两个英文字母，例如 CN。' : '')
const pasteInfo = computed(() => privateKeyText.value.trim() ? inspectPrivateKeyEnvelope(privateKeyText.value) : null)
const publicPasteInfo = computed(() => publicKeyText.value.trim() ? inspectPublicKeyEnvelope(publicKeyText.value) : null)
const keyInfo = computed(() => importMethod.value === 'file' ? importedFile.value : pasteInfo.value?.format ? { name: '粘贴的私钥', format: pasteInfo.value.format } : null)
const publicKeyInfo = computed(() => importMethod.value === 'file' ? importedPublicFile.value : publicPasteInfo.value?.format ? { name: '粘贴的公钥', format: publicPasteInfo.value.format } : null)
const keyError = computed(() => keySource.value === 'import' && !keyInfo.value ? (importMethod.value === 'paste' ? pasteInfo.value?.error : fileError.value) || '请选择私钥文件，或切换到粘贴私钥。' : '')
const publicKeyError = computed(() => keySource.value === 'import' && !publicKeyInfo.value ? (importMethod.value === 'paste' ? publicPasteInfo.value?.error : publicFileError.value) || '请同时提供与私钥配套的公钥文件或公钥文本。' : '')
const algorithmLabel = computed(() => generated.value?.siteAlgorithm || (keySource.value === 'generate' ? selectedAlgorithm.value.label : '生成时识别导入密钥'))
const extraCount = computed(() => [dn.CN, dn.O, dn.OU, dn.C, dn.ST, dn.L].filter(item => item.trim()).length + Number(algorithm.value !== 'rsa-2048' && rootAlgorithm.value !== 'sm2') + Number(scheduleStart.value) + Number(clientAuth.value) + Number(Number(rootDays.value) !== 3650))
const wildcard = computed(() => addresses.value.some(address => address.value.startsWith('*.')))
const canAddIpv6 = computed(() => primaryAddress.value === 'localhost' && !addresses.value.some(address => address.value === '::1'))
const canAddWww = computed(() => parsedPrimary.value.address?.type === 'DNS' && !primaryAddress.value.startsWith('*.') && !primaryAddress.value.startsWith('www.') && primaryAddress.value.includes('.') && !addresses.value.some(address => address.value === `www.${parsedPrimary.value.address?.value}`))
const expectedFiles = computed(() => generated.value?.files.filter(file => file.group === 'site') || [])
const rootFiles = computed(() => generated.value?.files.filter(file => file.group === 'root') || [])
const fieldErrors = computed(() => ({
  primary: parsedPrimary.value.error || '',
  validity: validDays.value ? '' : '有效期请输入 1–3650 之间的整数天数。',
  country: countryError.value,
  date: !validDate.value ? '请选择 2000–2099 年之间的完整生效日期。' : notAfter.value.getTime() <= Date.now() ? '所选有效期已经结束，请调整生效日期或有效天数。' : '',
  key: keyError.value,
  publicKey: publicKeyError.value,
  rootValidity: !Number.isInteger(Number(rootDays.value)) || Number(rootDays.value) < 1 || Number(rootDays.value) > 10950
    ? '根证书有效期请输入 1–10950 之间的整数天数。'
    : Number(rootDays.value) < days.value ? '根证书有效期不能短于 SSL 证书，请增加根证书有效期。' : ''
}))

function formatDate(date: Date, withTime = false) {
  if (!Number.isFinite(date.getTime()) || !validDays.value) return '待设置'
  return new Intl.DateTimeFormat('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit', ...(withTime ? { hour: '2-digit', minute: '2-digit', timeZoneName: 'short' as const } : {}) }).format(date)
}
function selectScenario(value: Scenario) {
  scenario.value = value
  primaryAddress.value = value === 'local' ? 'localhost' : value === 'intranet' ? '192.168.1.10' : ''
  extraAddresses.value = value === 'local' ? [{ value: '127.0.0.1', type: 'IP' }] : []
  pendingAddress.value = ''
  addressError.value = ''
  attempted.value = false
}
function normalizePrimary() {
  if (parsedPrimary.value.address) primaryAddress.value = parsedPrimary.value.address.value
}
function addAddress(value = pendingAddress.value): boolean {
  const parsed = parseCertificateAddress(value)
  if (parsed.error) { addressError.value = parsed.error; return false }
  if (addresses.value.some(address => address.value === parsed.address!.value)) {
    addressError.value = '这个地址已包含在证书中，无需重复添加。'
    return false
  }
  extraAddresses.value.push(parsed.address!)
  pendingAddress.value = ''
  addressError.value = ''
  return true
}
function clearPrivateKey() {
  readVersion++
  importedFile.value = null
  privateKeyText.value = ''
  fileError.value = ''
  readingFile.value = false
  if (fileInput.value) fileInput.value.value = ''
}
function clearPublicKey() {
  publicReadVersion++
  importedPublicFile.value = null
  publicKeyText.value = ''
  publicFileError.value = ''
  readingPublicFile.value = false
  if (publicFileInput.value) publicFileInput.value.value = ''
}
function clearImportedKey() { clearPrivateKey(); clearPublicKey() }
watch([keySource, importMethod], clearImportedKey)
onBeforeUnmount(clearImportedKey)

async function readPrivateKey(file?: File) {
  if (!file) return
  const version = ++readVersion
  importedFile.value = null
  fileError.value = ''
  readingFile.value = false
  if (file.size > 256 * 1024) { fileError.value = '文件超过 256 KB，请选择 PEM 私钥文件。'; return }
  readingFile.value = true
  try {
    const pem = await file.text()
    const envelope = inspectPrivateKeyEnvelope(pem)
    if (version !== readVersion) return
    if (envelope.error) fileError.value = envelope.error
    else importedFile.value = { name: file.name, format: envelope.format, pem }
  } catch {
    if (version === readVersion) fileError.value = '无法读取文件，请重新选择本地 PEM 文件。'
  } finally {
    if (version === readVersion) readingFile.value = false
  }
}
function onFileChange(event: Event) { void readPrivateKey((event.target as HTMLInputElement).files?.[0]) }
function onDrop(event: DragEvent) { void readPrivateKey(event.dataTransfer?.files[0]) }

async function readPublicKey(file?: File) {
  if (!file) return
  const version = ++publicReadVersion
  importedPublicFile.value = null
  publicFileError.value = ''
  readingPublicFile.value = false
  if (file.size > 256 * 1024) { publicFileError.value = '文件超过 256 KB，请选择 PEM 公钥文件。'; return }
  readingPublicFile.value = true
  try {
    const pem = await file.text()
    const envelope = inspectPublicKeyEnvelope(pem)
    if (version !== publicReadVersion) return
    if (envelope.error) publicFileError.value = envelope.error
    else importedPublicFile.value = { name: file.name, format: envelope.format, pem }
  } catch {
    if (version === publicReadVersion) publicFileError.value = '无法读取公钥文件，请重新选择。'
  } finally {
    if (version === publicReadVersion) readingPublicFile.value = false
  }
}
function onPublicFileChange(event: Event) { void readPublicKey((event.target as HTMLInputElement).files?.[0]) }
function onPublicDrop(event: DragEvent) { void readPublicKey(event.dataTransfer?.files[0]) }

async function goToStep(value: number) {
  if (running.value) return
  step.value = value
  await nextTick()
  const heading = root.value?.querySelector<HTMLElement>('[data-step-heading]')
  heading?.focus({ preventScroll: true })
  root.value?.scrollIntoView({ behavior: 'instant', block: 'start' })
}
async function reviewConfiguration() {
  attempted.value = true
  if (pendingAddress.value.trim() && !addAddress()) return
  normalizePrimary()
  clockNow.value = new Date()
  if (Object.values(fieldErrors.value).some(Boolean)) {
    if (fieldErrors.value.country || fieldErrors.value.date || fieldErrors.value.rootValidity) advancedOpen.value = true
    await nextTick()
    root.value?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus()
    return
  }
  await goToStep(2)
}
async function generateNow() {
  const config: CertificateConfig = {
    rootAlgorithm: rootAlgorithm.value as CertificateConfig['rootAlgorithm'], rootDays: Number(rootDays.value),
    subject: { ...subject.value }, addresses: addresses.value.map(item => ({ ...item })), days: days.value,
    start: scheduleStart.value ? new Date(`${startDate.value}T00:00:00`).toISOString() : undefined,
    clientAuth: clientAuth.value, keySource: keySource.value, siteAlgorithm: selectedAlgorithm.value.id as CertificateConfig['siteAlgorithm']
  }
  const request: GenerationRequest = { config }
  if (keySource.value === 'import') request.keyPair = {
    privatePem: importMethod.value === 'file' ? importedFile.value?.pem || '' : privateKeyText.value,
    publicPem: importMethod.value === 'file' ? importedPublicFile.value?.pem || '' : publicKeyText.value
  }
  const completion = generator.generate(request)
  await nextTick()
  root.value?.scrollIntoView({ behavior: 'instant', block: 'start' })
  const result = await completion
  request.keyPair = undefined
  if (result) {
    clearImportedKey()
    downloaded.value = []
    await goToStep(3)
  }
}
function saveFile(file: CertificateFile) {
  downloadSslFile(file)
  if (!downloaded.value.includes(file.name)) downloaded.value.push(file.name)
}
async function saveBundle() {
  if (!generated.value || downloading.value) return
  downloading.value = true
  downloadError.value = ''
  try { await downloadSiteBundle(generated.value.files) }
  catch { downloadError.value = '打包下载失败，请重试或逐个下载文件。' }
  finally { downloading.value = false }
}
function editConfiguration() {
  generator.clear()
  downloaded.value = []
  attempted.value = false
  void goToStep(1)
}
function downloadConfiguration() {
  const config = {
    schemaVersion: 1,
    mode: 'local-generation',
    certificateType: 'private-ca-issued-tls-server',
    issuer: { source: 'generate-test-root', algorithm: rootAlgorithm.value, subject: rootCaSubject(rootProfile.value.commonName), validityDays: Number(rootDays.value), signature: rootProfile.value.signature, ca: true, pathLength: 0 },
    subject: subject.value,
    subjectAltNames: addresses.value,
    validity: { days: days.value, start: scheduleStart.value ? notBefore.value.toISOString() : 'on-generation', clockSkewMinutes: scheduleStart.value ? 0 : 5 },
    key: keySource.value === 'generate' ? { source: 'generate', algorithm: selectedAlgorithm.value.id } : { source: 'import-key-pair', algorithm: 'detect-on-import', requirePublicPrivateMatch: true },
    extensions: { ca: false, extendedKeyUsage: clientAuth.value ? ['serverAuth', 'clientAuth'] : ['serverAuth'] }
  }
  const url = URL.createObjectURL(new Blob([JSON.stringify(config, null, 2)], { type: 'application/json;charset=utf-8' }))
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = 'ssl-certificate-config.json'
  anchor.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
</script>

<template>
  <div ref="root" class="ssl-workspace">
    <header class="ssl-page-header"><h1>{{ t('tools.sslCertificate.title') }}</h1><p>{{ t('tools.sslCertificate.description') }}</p></header>
    <div class="ssl-context-bar">
      <div class="ssl-context-copy"><span class="ssl-preview-label">本地生成</span><span>创建测试根 CA，签发自己的 HTTPS 证书。</span></div>
      <span class="ssl-local-label"><LockKeyhole /> 数据仅在当前浏览器处理</span>
    </div>

    <nav class="ssl-steps" aria-label="证书生成步骤">
      <div v-for="(title, index) in ['填写证书信息', '确认生成配置', '生成与下载']" :key="title" class="ssl-step" :class="{ current: step === index + 1, complete: step > index + 1 }" :aria-current="step === index + 1 ? 'step' : undefined">
        <span class="ssl-step-number"><Check v-if="step > index + 1" /><template v-else>{{ index + 1 }}</template></span>
        <span>{{ title }}</span><span v-if="index < 2" class="ssl-step-line" />
      </div>
    </nav>

    <div class="ssl-layout">
      <section class="ssl-main-panel" aria-label="证书生成配置">
        <form v-if="step === 1" class="ssl-form" novalidate @submit.prevent="reviewConfiguration">
          <section class="ssl-form-section ssl-first-section">
            <div class="ssl-section-heading"><div><h2 data-step-heading tabindex="-1">从使用场景开始</h2><p>选一个接近的场景，我们帮你填好常用设置。</p></div><span class="ssl-subtle-label">新手友好</span></div>
            <div class="ssl-scenarios" role="group" aria-label="使用场景">
              <button type="button" class="ssl-scenario" :class="{ selected: scenario === 'local' }" :aria-pressed="scenario === 'local'" @click="selectScenario('local')"><Monitor /><strong>本地开发</strong><small>localhost / 本机调试</small><Check v-if="scenario === 'local'" class="ssl-choice-check" /></button>
              <button type="button" class="ssl-scenario" :class="{ selected: scenario === 'intranet' }" :aria-pressed="scenario === 'intranet'" @click="selectScenario('intranet')"><Cloud /><strong>内网服务</strong><small>局域网 IP / 内部域名</small><Check v-if="scenario === 'intranet'" class="ssl-choice-check" /></button>
              <button type="button" class="ssl-scenario" :class="{ selected: scenario === 'custom' }" :aria-pressed="scenario === 'custom'" @click="selectScenario('custom')"><Globe /><strong>自定义地址</strong><small>自行填写域名或 IP</small><Check v-if="scenario === 'custom'" class="ssl-choice-check" /></button>
            </div>
          </section>

          <section class="ssl-form-section ssl-root-section">
            <div class="ssl-section-heading"><div><h2><ShieldCheck /> 由哪个根证书来签发？</h2><p>先创建一个测试根 CA，再由它签发你的 SSL 证书。</p></div></div>
            <div class="ssl-root-options" role="group" aria-label="根 CA 算法">
              <button v-for="profile in rootCaProfiles" :key="profile.id" type="button" :class="{ selected: rootAlgorithm === profile.id }" :aria-pressed="rootAlgorithm === profile.id" @click="rootAlgorithm = profile.id"><span><strong>{{ profile.label }}</strong><Check v-if="rootAlgorithm === profile.id" /></span><small>{{ profile.note }}</small></button>
            </div>
            <div class="ssl-root-dn"><span>根证书身份 <small>DN</small></span><code>{{ rootSubjectText }}</code></div>
            <p v-if="rootAlgorithm === 'sm2'" class="ssl-sm2-note"><Info /> SM2 使用 SM3 签名，需要支持国密算法的服务端和客户端。</p>
            <p v-else class="ssl-field-hint">根证书有效期 {{ rootDays }} 天，可在高级选项修改。测试设备信任根证书后，可验证它签发的站点证书。</p>
          </section>

          <section class="ssl-form-section">
            <div class="ssl-section-heading"><div><h2><Globe /> 为哪些地址启用 HTTPS？</h2><p>填写你在浏览器里访问服务时使用的地址。</p></div></div>
            <div class="ssl-field">
              <label for="ssl-primary">主要域名或 IP <span class="ssl-required">*</span></label>
              <div class="ssl-address-input"><span><LockKeyhole /> https://</span><input id="ssl-primary" v-model="primaryAddress" class="ssl-input" spellcheck="false" autocomplete="off" placeholder="例如 example.com 或 192.168.1.10" :aria-invalid="attempted && !!fieldErrors.primary" aria-describedby="ssl-primary-hint" @blur="normalizePrimary" @keydown.enter.prevent="normalizePrimary" /></div>
              <p v-if="attempted && fieldErrors.primary" class="ssl-error" role="alert">{{ fieldErrors.primary }}</p>
              <p id="ssl-primary-hint" class="ssl-field-hint">会自动用作证书名称（CN），并加入证书覆盖的地址。</p>
            </div>
            <div class="ssl-field ssl-last-field">
              <div class="ssl-label-row"><label for="ssl-extra">其他访问地址 <span class="ssl-optional">选填</span></label><button class="ssl-text-button ssl-small-button" type="button" @click="helpOpen = !helpOpen" :aria-expanded="helpOpen"><CircleHelp /> 什么是 SAN</button></div>
              <p v-if="helpOpen" class="ssl-inline-explanation">使用者备用名称（SAN）就是这张证书覆盖的全部地址。用 IP 访问就加 IP，用域名访问就加域名；浏览器会检查访问地址是否在这里。</p>
              <div class="ssl-address-tags" aria-label="已包含的地址">
                <span v-for="address in addresses" :key="address.value" class="ssl-address-tag"><span class="ssl-address-kind">{{ address.type }}</span><span>{{ address.value }}</span><span v-if="address.value === parsedPrimary.address?.value" class="ssl-primary-tag">主地址</span><button v-else type="button" :aria-label="`移除地址 ${address.value}`" @click="extraAddresses = extraAddresses.filter(item => item.value !== address.value)"><X /></button></span>
                <span v-if="!addresses.length" class="ssl-field-hint">添加地址后，会在这里显示。</span>
              </div>
              <div class="ssl-add-address"><input id="ssl-extra" v-model="pendingAddress" class="ssl-input" spellcheck="false" autocomplete="off" placeholder="再添加一个域名、IP 或 *.example.com" :aria-invalid="!!addressError" aria-describedby="ssl-san-error" @input="addressError = ''" @keydown.enter.prevent="addAddress()" /><button class="ssl-secondary-button" type="button" @click="addAddress()"><Plus /> 添加</button></div>
              <p v-if="addressError" id="ssl-san-error" class="ssl-error" role="alert">{{ addressError }}</p>
              <button v-if="canAddIpv6" class="ssl-text-button ssl-suggestion" type="button" @click="addAddress('::1')"><Plus /> 同时支持 IPv6 本机地址 ::1</button>
              <button v-else-if="canAddWww" class="ssl-text-button ssl-suggestion" type="button" @click="addAddress(`www.${parsedPrimary.address!.value}`)"><Plus /> 同时包含 www.{{ parsedPrimary.address?.value }}</button>
              <p v-if="wildcard" class="ssl-field-hint">*.example.com 覆盖一级子域名；如需访问 example.com，请再单独添加。</p>
            </div>
          </section>

          <section class="ssl-form-section">
            <div class="ssl-section-heading"><div><h2><CalendarDays /> 证书需要用多久？</h2><p>到期后需要重新生成并替换证书。</p></div></div>
            <div class="ssl-period-options" role="group" aria-label="证书有效期">
              <button type="button" :class="{ selected: validityPreset === 90 }" :aria-pressed="validityPreset === 90" @click="validityPreset = 90">90 天 <span>短期测试</span></button>
              <button type="button" :class="{ selected: validityPreset === 365 }" :aria-pressed="validityPreset === 365" @click="validityPreset = 365">365 天 <span>常用</span></button>
              <button type="button" :class="{ selected: validityPreset === 'custom' }" :aria-pressed="validityPreset === 'custom'" @click="validityPreset = 'custom'">自定义</button>
            </div>
            <div v-if="validityPreset === 'custom'" class="ssl-custom-days"><label for="ssl-days">有效天数</label><input id="ssl-days" v-model="customDays" type="number" min="1" max="3650" step="1" class="ssl-input" :aria-invalid="!validDays" /><span>天（1–3650）</span></div>
            <p v-if="!validDays" class="ssl-error" role="alert">{{ fieldErrors.validity }}</p>
            <p class="ssl-date-line"><CalendarDays /> {{ formatDate(notBefore) }} <span>至</span> {{ formatDate(notAfter) }}<span v-if="!scheduleStart"> · 生成时立即生效</span></p>
          </section>

          <section class="ssl-form-section ssl-key-section">
            <div class="ssl-section-heading"><div><h2><KeyRound /> 站点密钥怎么准备？</h2><p>证书里包含站点公钥，部署时与站点私钥配套使用。</p></div></div>
            <div class="ssl-key-options" role="group" aria-label="密钥来源">
              <button class="ssl-key-choice" type="button" :class="{ selected: keySource === 'generate' }" :aria-pressed="keySource === 'generate'" @click="keySource = 'generate'"><span class="ssl-radio-dot" /><span><strong>自动生成密钥对 <em>推荐</em></strong><small>自动准备公钥和私钥</small></span></button>
              <button class="ssl-key-choice" type="button" :class="{ selected: keySource === 'import' }" :aria-pressed="keySource === 'import'" @click="keySource = 'import'"><span class="ssl-radio-dot" /><span><strong>使用已有密钥对</strong><small>同时提供公钥和私钥</small></span></button>
            </div>
            <p v-if="keySource === 'generate'" class="ssl-key-default"><Check /> 已选 {{ selectedAlgorithm.label }}{{ rootAlgorithm === 'sm2' ? '，与国密根证书配套。' : '，可在高级选项中更改。' }}</p>
            <div v-else class="ssl-import-panel">
              <div class="ssl-import-tabs" role="group" aria-label="导入方式"><button type="button" :class="{ active: importMethod === 'file' }" :aria-pressed="importMethod === 'file'" @click="importMethod = 'file'">选择文件</button><button type="button" :class="{ active: importMethod === 'paste' }" :aria-pressed="importMethod === 'paste'" @click="importMethod = 'paste'">粘贴密钥对</button></div>
              <h3 class="ssl-import-field-title"><KeyRound /> 站点私钥 <span>必填</span></h3>
              <template v-if="importMethod === 'file'">
                <input ref="fileInput" type="file" accept=".pem,.key,.txt" class="ssl-hidden-input" tabindex="-1" aria-label="选择 PEM 私钥文件" @change="onFileChange" />
                <button class="ssl-dropzone" type="button" :disabled="readingFile" :aria-invalid="!!fileError || attempted && !!keyError" @click="fileInput?.click()" @dragover.prevent @drop.prevent="onDrop"><Upload /><strong>{{ readingFile ? '正在本地读取…' : importedFile ? importedFile.name : '点击选择，或将私钥文件拖到这里' }}</strong><span>{{ importedFile ? `已读取 ${importedFile.format} 封装` : 'PEM 格式 · .key / .pem · 最大 256 KB' }}</span></button>
                <button v-if="importedFile" type="button" class="ssl-text-button ssl-remove-file" @click="clearPrivateKey"><X /> 移除私钥</button>
                <p v-if="fileError" class="ssl-error" role="alert">{{ fileError }}</p>
              </template>
              <template v-else><label class="ssl-sr-only" for="ssl-private-key">PEM 私钥文本</label><textarea id="ssl-private-key" v-model="privateKeyText" class="ssl-input ssl-key-textarea" spellcheck="false" autocomplete="off" placeholder="-----BEGIN PRIVATE KEY-----&#10;在这里粘贴完整的 PEM 私钥&#10;-----END PRIVATE KEY-----" :aria-invalid="!!pasteInfo?.error || attempted && !!keyError" /><p v-if="pasteInfo?.error" class="ssl-error" role="alert">{{ pasteInfo.error }}</p><p v-else-if="pasteInfo?.format" class="ssl-field-hint">已读取 {{ pasteInfo.format }} 封装。</p></template>
              <p v-if="attempted && keyError && !fileError && !pasteInfo?.error" class="ssl-error" role="alert">{{ keyError }}</p>
              <h3 class="ssl-import-field-title ssl-public-key-title"><ShieldCheck /> 站点公钥 <span>必填</span></h3>
              <template v-if="importMethod === 'file'">
                <input ref="publicFileInput" type="file" accept=".pem,.pub,.txt" class="ssl-hidden-input" tabindex="-1" aria-label="选择 PEM 公钥文件" @change="onPublicFileChange" />
                <button class="ssl-dropzone" type="button" :disabled="readingPublicFile" :aria-invalid="!!publicFileError || attempted && !!publicKeyError" @click="publicFileInput?.click()" @dragover.prevent @drop.prevent="onPublicDrop"><Upload /><strong>{{ readingPublicFile ? '正在本地读取…' : importedPublicFile ? importedPublicFile.name : '点击选择，或将公钥文件拖到这里' }}</strong><span>{{ importedPublicFile ? `已读取 ${importedPublicFile.format} 封装` : 'PEM 格式 · .pub / .pem · 最大 256 KB' }}</span></button>
                <button v-if="importedPublicFile" type="button" class="ssl-text-button ssl-remove-file" @click="clearPublicKey"><X /> 移除公钥</button>
                <p v-if="publicFileError" class="ssl-error" role="alert">{{ publicFileError }}</p>
              </template>
              <template v-else><label class="ssl-sr-only" for="ssl-public-key">PEM 公钥文本</label><textarea id="ssl-public-key" v-model="publicKeyText" class="ssl-input ssl-key-textarea" spellcheck="false" autocomplete="off" placeholder="-----BEGIN PUBLIC KEY-----&#10;在这里粘贴与私钥配套的 PEM 公钥&#10;-----END PUBLIC KEY-----" :aria-invalid="!!publicPasteInfo?.error || attempted && !!publicKeyError" /><p v-if="publicPasteInfo?.error" class="ssl-error" role="alert">{{ publicPasteInfo.error }}</p><p v-else-if="publicPasteInfo?.format" class="ssl-field-hint">已读取 {{ publicPasteInfo.format }} 封装。</p></template>
              <p v-if="attempted && publicKeyError && !publicFileError && !publicPasteInfo?.error" class="ssl-error" role="alert">{{ publicKeyError }}</p>
              <div class="ssl-key-pair-note"><LockKeyhole /><p>两份文件只在当前浏览器读取。生成时先验证公私钥是否配对，再把公钥写入 SSL 证书，由根 CA 私钥签发。支持未加密的 PEM 密钥。</p></div>
            </div>
          </section>

          <div class="ssl-advanced" :class="{ open: advancedOpen }">
            <button class="ssl-advanced-toggle" type="button" :aria-expanded="advancedOpen" aria-controls="ssl-advanced-content" @click="advancedOpen = !advancedOpen"><Settings2 /><span><strong>高级选项 <span v-if="extraCount" class="ssl-changed-count">{{ extraCount }} 项已调整</span></strong><small>证书身份（DN）、密钥算法、生效时间与用途</small></span><ChevronDown class="ssl-expand-icon" /></button>
            <div v-if="advancedOpen" id="ssl-advanced-content" class="ssl-advanced-content">
              <div class="ssl-advanced-heading"><h3>证书属于谁？ <span>主题 DN</span></h3><p>个人开发保留默认即可；单位信息可以按需填写。</p></div>
              <div class="ssl-field"><label for="ssl-cn">证书名称 <span class="ssl-field-code">CN</span></label><input id="ssl-cn" v-model="dn.CN" class="ssl-input" :placeholder="parsedPrimary.address?.value || '默认跟随主要域名或 IP'" maxlength="128" /><p class="ssl-field-hint">留空时跟随主地址；修改名称不会改变证书覆盖的 SAN 地址。</p></div>
              <div class="ssl-fields-grid">
                <div class="ssl-field"><label for="ssl-org">组织 / 公司 <span class="ssl-field-code">O</span></label><input id="ssl-org" v-model="dn.O" class="ssl-input" placeholder="例如：示例科技有限公司" maxlength="128" /></div>
                <div class="ssl-field"><label for="ssl-ou">部门 <span class="ssl-field-code">OU</span></label><input id="ssl-ou" v-model="dn.OU" class="ssl-input" placeholder="例如：研发部" maxlength="128" /></div>
                <div class="ssl-field"><label for="ssl-country">国家 / 地区代码 <span class="ssl-field-code">C</span></label><input id="ssl-country" v-model="dn.C" class="ssl-input" placeholder="例如 CN（中国）" maxlength="2" :aria-invalid="!!countryError" @blur="dn.C = dn.C.toUpperCase().trim()" /><p v-if="countryError" class="ssl-error" role="alert">{{ countryError }}</p></div>
                <div class="ssl-field"><label for="ssl-state">省 / 州 <span class="ssl-field-code">ST</span></label><input id="ssl-state" v-model="dn.ST" class="ssl-input" placeholder="例如：浙江省" maxlength="128" /></div>
                <div class="ssl-field"><label for="ssl-city">城市 <span class="ssl-field-code">L</span></label><input id="ssl-city" v-model="dn.L" class="ssl-input" placeholder="例如：杭州市" maxlength="128" /></div>
              </div>
              <div class="ssl-dn-preview"><span>DN 预览</span><code>{{ subjectText || '填写地址后自动生成' }}</code></div>

              <div class="ssl-advanced-heading ssl-advanced-divider"><h3>站点密钥算法</h3></div>
              <div v-if="keySource === 'generate' && rootAlgorithm !== 'sm2'" class="ssl-field"><label class="ssl-sr-only" for="ssl-algorithm">站点密钥算法</label><select id="ssl-algorithm" v-model="algorithm" class="ssl-input"><option v-for="item in algorithms" :key="item.id" :value="item.id">{{ item.label }}{{ item.id === 'rsa-2048' ? '（推荐）' : '' }}</option></select><p class="ssl-field-hint">{{ selectedAlgorithm.description }}。证书签名算法由根 CA 决定：{{ rootProfile.signature }}。</p></div>
              <p v-else-if="keySource === 'generate'" class="ssl-inline-explanation">SM2 根证书预设使用 SM2 站点密钥，证书签名算法为 SM3withSM2。</p>
              <p v-else class="ssl-inline-explanation">站点公私钥的算法和长度由文件本身决定，生成时检查二者是否匹配。{{ rootAlgorithm === 'sm2' ? '此国密预设需要提供 SM2 密钥对。' : '本预设支持 RSA 或 ECDSA 站点密钥对。' }}</p>

              <div class="ssl-advanced-heading ssl-advanced-divider"><h3>根 CA 有效期</h3><p>根证书必须覆盖它签发的 SSL 证书的完整有效期。</p></div>
              <div class="ssl-field"><label for="ssl-root-days">根证书有效天数</label><input id="ssl-root-days" v-model="rootDays" class="ssl-input" type="number" min="1" max="10950" step="1" :aria-invalid="!!fieldErrors.rootValidity" /><p v-if="fieldErrors.rootValidity" class="ssl-error" role="alert">{{ fieldErrors.rootValidity }}</p><p class="ssl-field-hint">根证书与站点证书同时生效，根证书到期：{{ formatDate(rootNotAfter) }}。</p></div>

              <div class="ssl-advanced-heading ssl-advanced-divider"><h3>生效时间与用途</h3></div>
              <label class="ssl-checkbox"><input v-model="scheduleStart" type="checkbox" /><span>指定生效日期</span></label>
              <div v-if="scheduleStart" class="ssl-field ssl-start-date"><label for="ssl-start">生效日期（本地时间 00:00）</label><input id="ssl-start" v-model="startDate" class="ssl-input" type="date" min="2000-01-01" max="2099-12-31" :aria-invalid="!!fieldErrors.date" /><p v-if="fieldErrors.date" class="ssl-error" role="alert">{{ fieldErrors.date }}</p></div>
              <label class="ssl-checkbox"><input v-model="clientAuth" type="checkbox" /><span>同时用于客户端身份验证 <small>clientAuth · 双向 TLS 测试</small></span></label>
              <p class="ssl-field-hint">默认用于 HTTPS 服务端（serverAuth），不具备签发其他证书的 CA 权限。</p>
            </div>
          </div>

          <footer class="ssl-form-footer"><span><LockKeyhole /> 配置信息不会发送到服务器</span><button class="ssl-primary-button" type="submit" :disabled="readingFile || readingPublicFile">下一步，确认配置 <ArrowRight /></button></footer>
        </form>

        <section v-else-if="step === 2" class="ssl-review-section">
          <div class="ssl-section-heading"><div><span class="ssl-section-kicker">即将使用的配置</span><h2 class="ssl-stage-title" data-step-heading tabindex="-1">确认一下，这就是你需要的证书</h2><p>这些设置会决定证书的身份、适用地址和使用期限。</p></div></div>
          <div v-if="running" class="ssl-generation-progress" role="status" aria-live="polite" :aria-busy="running">
            <div class="ssl-progress-heading"><LoaderCircle class="ssl-spin" /><strong>{{ generationStages[activeStageIndex]?.label }}…</strong><button type="button" class="ssl-text-button" @click="generator.cancel">取消生成</button></div>
            <ol><li v-for="(item, index) in generationStages" :key="item.id" :class="{ done: index < activeStageIndex, active: index === activeStageIndex }"><Check v-if="index < activeStageIndex" /><span v-else class="ssl-progress-dot" />{{ item.label }}</li></ol>
            <p>请保持页面打开。RSA4096 密钥生成可能需要更长时间。</p>
          </div>
          <div v-if="generationError" class="ssl-generation-error" role="alert"><Info /><div><strong>暂未生成证书</strong><p>{{ generationError }}</p><p>可以返回修改配置或密钥，再重新生成。</p></div></div>
          <p v-if="cancelled" class="ssl-cancelled-note" role="status">已取消生成，配置仍保留。你可以修改配置或重新生成。</p>
          <div class="ssl-review-identity"><span class="ssl-review-icon"><ShieldCheck /></span><div><strong>{{ subject.CN }}</strong><span>由 {{ rootProfile.commonName }} 签发</span></div><span class="ssl-preview-label">配置预览</span></div>
          <dl class="ssl-review-list">
            <div><dt>根证书 <span>CA</span></dt><dd><strong>{{ rootProfile.label }} · 自动生成</strong><code>{{ rootSubjectText }}</code><small>有效 {{ rootDays }} 天，至 {{ formatDate(rootNotAfter) }} · CA = true</small></dd></div>
            <div><dt>覆盖的地址 <span>SAN</span></dt><dd><span v-for="address in addresses" :key="address.value" class="ssl-review-address"><span class="ssl-address-kind">{{ address.type }}</span>{{ address.value }}</span></dd></div>
            <div><dt>有效期</dt><dd><strong>{{ days }} 天</strong><span>{{ formatDate(notBefore, true) }}<br />至 {{ formatDate(notAfter, true) }}</span></dd></div>
            <div><dt>站点密钥来源</dt><dd>{{ keySource === 'generate' ? '自动生成一对新的公钥和私钥' : `私钥：${keyInfo?.name}` }}<template v-if="keySource === 'import'"><span>公钥：{{ publicKeyInfo?.name }}</span><small>{{ keyInfo?.format }} / {{ publicKeyInfo?.format }} 封装已读取；生成前会核验密钥配对。</small></template></dd></div>
            <div><dt>站点密钥算法</dt><dd>{{ algorithmLabel }}<small v-if="keySource === 'import'">生成时解析并采用实际密钥算法</small></dd></div>
            <div><dt>证书签名算法</dt><dd>{{ rootProfile.signature }}<small>使用根 CA 的私钥签名</small></dd></div>
            <div><dt>证书身份 <span>DN</span></dt><dd><code>{{ subjectText }}</code></dd></div>
            <div><dt>证书用途</dt><dd>HTTPS 服务端{{ clientAuth ? '、客户端身份验证' : '' }}<small>CA = false · {{ clientAuth ? 'serverAuth + clientAuth' : 'serverAuth' }}</small></dd></div>
          </dl>
          <div class="ssl-trust-note"><Info /><div><strong>在测试设备上信任根 CA，即可验证它签发的站点证书</strong><p>{{ rootAlgorithm === 'sm2' ? 'SM2 需要国密浏览器或支持国密算法的客户端。' : '新生成的测试根 CA 不在浏览器默认信任库中，需要手动导入。' }}根私钥用于签发证书，请单独保管；公开网站应使用受信任的公共 CA。</p></div></div>
          <p class="ssl-preview-notice">每次生成都会创建一个新的根 CA。完成后请及时下载，离开或刷新页面会清除本次结果。</p>
          <footer class="ssl-stage-footer"><button type="button" class="ssl-secondary-button" :disabled="running" @click="goToStep(1)"><ArrowLeft /> 返回修改</button><button type="button" class="ssl-primary-button" :disabled="running" @click="generateNow"><LoaderCircle v-if="running" class="ssl-spin" /><ShieldCheck v-else /> {{ running ? '正在本地生成…' : '生成根 CA 和 SSL 证书' }}</button></footer>
        </section>

        <section v-else-if="generated" class="ssl-result-section">
          <div class="ssl-result-intro"><span class="ssl-result-symbol"><ShieldCheck /></span><span class="ssl-success-label"><Check /> 签名与密钥配对校验通过</span><h2 data-step-heading tabindex="-1">根证书和 SSL 证书已生成</h2><p>有效期至 {{ formatDate(notAfter) }}，请下载并保存本次文件。</p></div>
          <div class="ssl-bundle-download"><div><strong>先下载站点部署包</strong><p>含站点证书、公钥、{{ keySource === 'generate' ? '私钥及' : '' }}使用说明。</p></div><button type="button" class="ssl-primary-button" @click="saveBundle" :disabled="downloading"><Download /> {{ downloading ? '正在打包…' : '下载站点证书包' }}</button></div>
          <p v-if="downloadError" class="ssl-error" role="alert">{{ downloadError }}</p>
          <h3 class="ssl-file-group-title">站点部署文件</h3>
          <div class="ssl-result-files"><div v-for="file in expectedFiles" :key="file.name" class="ssl-result-file"><span class="ssl-file-symbol"><KeyRound v-if="file.secret" /><FileText v-else-if="file.name.endsWith('.txt')" /><ShieldCheck v-else /></span><div><strong>{{ file.name }} <span>{{ file.label }}</span></strong><p>{{ file.description }}</p></div><button type="button" class="ssl-file-download" :aria-label="`下载 ${file.name}`" :title="downloaded.includes(file.name) ? '再次下载' : '下载文件'" @click="saveFile(file)"><Download /><span>下载</span></button></div></div>
          <p v-if="keySource === 'import'" class="ssl-field-hint">使用已有私钥时，部署时继续使用原文件，无需再下载一份私钥。</p>
          <h3 class="ssl-file-group-title ssl-root-files-title">根 CA 文件 <span>单独下载与备份</span></h3>
          <div class="ssl-result-files"><div v-for="file in rootFiles" :key="file.name" class="ssl-result-file"><span class="ssl-file-symbol"><KeyRound v-if="file.secret" /><ShieldCheck v-else /></span><div><strong>{{ file.name }} <span>{{ file.label }}</span></strong><p>{{ file.description }}</p></div><button type="button" class="ssl-file-download" :aria-label="`下载 ${file.name}`" :title="downloaded.includes(file.name) ? '再次下载' : '下载文件'" @click="saveFile(file)"><Download /><span>下载</span></button></div></div>
          <p class="ssl-storage-note"><LockKeyhole /> 私钥文件未加密，请妥善保存。根 CA 文件需要单独下载；刷新、离开页面或返回调整会清除本次结果。</p>
          <details class="ssl-verification-details"><summary>查看证书信息与校验结果</summary><dl><div><dt>站点密钥</dt><dd>{{ generated.siteAlgorithm }}</dd></div><div><dt>签名算法</dt><dd>{{ generated.signatureAlgorithm }}</dd></div><div><dt>站点有效期</dt><dd>{{ formatDate(notBefore, true) }} — {{ formatDate(notAfter, true) }}</dd></div><div><dt>根证书到期</dt><dd>{{ formatDate(rootNotAfter, true) }}</dd></div><div><dt>根证书 DN</dt><dd><code>{{ generated.rootSubject }}</code></dd></div><div><dt>站点 SHA-256 指纹</dt><dd><code>{{ generated.fingerprint }}</code></dd></div><div><dt>根证书 SHA-256 指纹</dt><dd><code>{{ generated.rootFingerprint }}</code></dd></div></dl><ul><li v-for="check in generated.checks" :key="check"><Check /> {{ check }}</li></ul></details>
          <div class="ssl-use-guide"><h3>接下来怎么使用？</h3><ol><li><span>1</span><div><strong>把站点证书和站点私钥配置到服务中</strong><p>{{ rootAlgorithm === 'sm2' ? '使用支持国密算法的服务端，按其要求配置签名证书；单张 SM2 证书不包含 TLCP 双证书。' : 'Nginx 配置 ssl_certificate 和 ssl_certificate_key；Vite 配置 server.https。详细示例在 README.txt 中。' }}</p></div></li><li><span>2</span><div><strong>将根证书导入测试设备的信任库</strong><p>导入 {{ rootProfile.commonName }}.crt，然后通过 SAN 中的地址访问服务。每次生成的根 CA 都不同，需要重新信任。</p></div></li><li><span>3</span><div><strong>单独备份根私钥</strong><p>根私钥用于签发证书，请单独保管。当前页面每次创建新根 CA。</p></div></li></ol></div>
          <footer class="ssl-stage-footer"><button class="ssl-secondary-button" type="button" @click="editConfiguration"><ArrowLeft /> 返回调整</button><button class="ssl-secondary-button" type="button" @click="downloadConfiguration"><Download /> 下载当前配置</button></footer><p class="ssl-export-hint">JSON 配置文件，不含私钥内容。</p>
        </section>
      </section>

      <aside class="ssl-aside" aria-label="证书实时预览">
        <div class="ssl-chain-preview">
        <div class="ssl-root-preview"><div class="ssl-root-preview-icon"><ShieldCheck /></div><div><span>测试根 CA · {{ rootProfile.label }}</span><strong>{{ rootProfile.commonName }}</strong><small>自签根证书 · {{ rootDays }} 天</small></div></div>
        <div class="ssl-issuer-connector"><span /><ChevronDown /><small>使用根私钥签发 SSL 证书</small></div>
        <div class="ssl-certificate-preview">
          <div class="ssl-certificate-head"><span><ShieldCheck /> 你的证书</span><span class="ssl-live"><span /> {{ generated ? '已生成并核验' : '实时预览' }}</span></div>
          <div class="ssl-certificate-identity"><div class="ssl-certificate-seal"><ShieldCheck /></div><span>签发给</span><h2>{{ subject.CN || '等待填写地址' }}</h2><p>{{ subject.O || 'SSL / TLS 服务端证书' }}</p><span class="ssl-self-signed">测试根 CA 签发 · 站点证书</span></div>
          <div class="ssl-certificate-body"><div class="ssl-preview-detail"><span>覆盖地址 <small>{{ addresses.length }} 个</small></span><ul><li v-for="address in addresses" :key="address.value"><span class="ssl-address-kind">{{ address.type }}</span><code>{{ address.value }}</code></li><li v-if="!addresses.length" class="ssl-empty-preview">填写后自动显示</li></ul></div><div class="ssl-preview-detail ssl-preview-validity"><span>有效期 <small>{{ validDays ? `${days} 天` : '待设置' }}</small></span><strong>{{ formatDate(notBefore) }} <span>—</span> {{ formatDate(notAfter) }}</strong></div><div class="ssl-preview-bottom"><div><span>密钥算法</span><strong>{{ algorithmLabel }}</strong></div><div><span>密钥来源</span><strong>{{ keySource === 'generate' ? '自动生成' : '已有密钥对' }}</strong></div></div></div>
          <div class="ssl-certificate-foot"><LockKeyhole /> {{ generated ? '已通过根证书验签' : running ? '正在本地生成' : '配置预览，尚未签发' }}</div>
        </div>
        </div>

        <div class="ssl-deliverables"><h3>{{ generated ? '你已获得' : '你将获得' }}</h3><div><ShieldCheck /><span>测试根证书与单独保管的根私钥</span></div><div><ShieldCheck /><span>由根 CA 签发的 SSL 证书</span></div><div><KeyRound /><span>{{ keySource === 'generate' ? '一份配套的站点私钥' : '继续使用你已有的站点密钥对' }}</span></div><div><FileText /><span>一份简单的使用说明</span></div></div>
        <div class="ssl-aside-help"><span class="ssl-help-icon"><Info /></span><div><h3>根证书和 SSL 证书有什么区别？</h3><p>根 CA 负责签发；SSL 证书负责证明站点身份。测试设备信任根 CA 后，才能验证它签发的站点证书。</p><button type="button" class="ssl-text-button" @click="helpOpen = !helpOpen" :aria-expanded="helpOpen">{{ helpOpen ? '收起概念说明' : '了解公钥、私钥与 SAN' }} <ChevronDown /></button><div v-if="helpOpen" class="ssl-glossary"><p><strong>公钥</strong>：写入站点证书，用于验证身份或协商加密连接。</p><p><strong>站点私钥</strong>：与公钥配对，部署在你管理的服务中。</p><p><strong>根私钥</strong>：给站点证书签名，应单独保存。</p><p><strong>SAN</strong>：证书覆盖的域名和 IP，浏览器用它核对访问地址。</p></div></div></div>
        <div class="ssl-local-footnote"><Code2 /><span>纯前端生成 · 无需启动后端<br /><small>密钥与证书仅保存在当前页面内存中</small></span></div>
      </aside>
    </div>
  </div>
</template>

<style scoped src="./style.css"></style>
