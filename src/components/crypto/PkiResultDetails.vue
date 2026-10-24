<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { PkiMode } from '@/lib/local-pki-tools'

const props = defineProps<{ details: unknown; mode: PkiMode }>()
const { locale } = useI18n()
const tr = (zh: string, en: string) => locale.value.startsWith('zh') ? zh : en
type Data = Record<string, unknown>
const record = (value: unknown): Data => value && typeof value === 'object' && !Array.isArray(value) ? value as Data : {}
const list = (value: unknown): unknown[] => Array.isArray(value) ? value : []
const report = computed(() => record(props.details))
function translated(value: unknown) {
  const text = String(value ?? '')
  const separator = text.indexOf(' / ')
  return separator >= 0 && /[\u3400-\u9fff]/.test(text.slice(0, separator)) ? tr(text.slice(0, separator), text.slice(separator + 3)) : text
}
function date(value: unknown) {
  if (typeof value !== 'string') return ''
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? value : parsed.toISOString().replace('T', ' ').replace(/\.\d+Z$/, ' UTC')
}
const algorithms: Record<string, string> = {
  '1.2.156.10197.1.501': 'SM2 / SM3', '1.2.840.113549.1.1.11': 'RSA PKCS#1 v1.5 / SHA-256',
  '1.2.840.113549.1.1.5': 'RSA PKCS#1 v1.5 / SHA-1', '1.2.840.113549.1.1.10': 'RSA-PSS',
  '1.2.840.10045.4.3.2': 'ECDSA / SHA-256', '1.2.840.10045.4.3.3': 'ECDSA / SHA-384', '1.2.840.10045.4.3.4': 'ECDSA / SHA-512',
}
const fields = computed(() => {
  const entries: [string, string, string][] = [
    ['subject', '主体', 'Subject'], ['issuer', '签发者', 'Issuer'], ['algorithm', '公钥算法', 'Public key algorithm'],
    ['signatureAlgorithm', '签名算法', 'Signature algorithm'], ['signatureValid', '签名验证', 'Signature verification'],
    ['validFrom', '生效时间', 'Valid from'], ['validTo', '到期时间', 'Valid until'], ['withinValidity', '当前有效期', 'Current validity'],
    ['trust', '信任链检查', 'Trust chain check'], ['revocation', '吊销检查', 'Revocation check'], ['hostname', '主机名检查', 'Hostname check'],
    ['scope', '检查范围', 'Verification scope'],
  ]
  return entries.filter(([key]) => report.value[key] !== undefined).map(([key, zh, en]) => {
    const value = report.value[key]
    let text = String(value)
    if (key === 'validFrom' || key === 'validTo') text = date(value)
    else if (key === 'signatureValid') text = value ? tr('通过', 'Passed') : tr('未通过', 'Failed')
    else if (key === 'withinValidity') text = value ? tr('在有效期内', 'Within validity') : tr('已过期或尚未生效', 'Expired or not yet valid')
    else if (key === 'signatureAlgorithm') text = algorithms[text] ? `${algorithms[text]} (${text})` : text
    else if (['trust', 'revocation', 'hostname', 'scope'].includes(key)) text = translated(value)
    return { key, label: key === 'subject' && props.mode === 'csr-parse' ? tr('申请主体', 'Request subject') : tr(zh, en), text, failed: (key === 'signatureValid' || key === 'withinValidity') && value === false }
  })
})
const path = computed(() => list(report.value.path).map(record))
const issues = computed(() => list(report.value.issues).map(translated))
const extensionNames: Record<string, [string, string]> = {
  '2.5.29.19': ['基本约束', 'Basic constraints'], '2.5.29.15': ['密钥用途', 'Key usage'],
  '2.5.29.17': ['备用名称 SAN', 'Subject alternative names'], '2.5.29.37': ['扩展密钥用途', 'Extended key usage'],
  '2.5.29.14': ['主体密钥标识符', 'Subject key identifier'], '2.5.29.35': ['签发者密钥标识符', 'Authority key identifier'],
}
function ip(value: unknown) {
  const hex = String(record(record(value).valueBlock).valueHex ?? '')
  if (/^[a-f0-9]{8}$/i.test(hex)) return hex.match(/../g)!.map(byte => parseInt(byte, 16)).join('.')
  if (/^[a-f0-9]{32}$/i.test(hex)) return hex.match(/.{4}/g)!.map(group => parseInt(group, 16).toString(16)).join(':')
  return hex || tr('无法显示，请查看原始数据', 'See raw data')
}
function extensionSummary(extension: Data): string[] {
  const parsed = record(extension.parsedValue), oid = extension.extnID
  if (oid === '2.5.29.19') {
    const values = [parsed.cA ? tr('允许签发证书（CA）', 'Certificate authority (CA)') : tr('终端实体（非 CA）', 'End entity (not a CA)')]
    if (parsed.pathLenConstraint !== undefined) {
      const limit = typeof parsed.pathLenConstraint === 'number' ? parsed.pathLenConstraint : record(record(parsed.pathLenConstraint).valueBlock).valueDec
      values.push(`${tr('允许的下级 CA 层数', 'Maximum subordinate CA depth')}: ${limit ?? tr('见原始数据', 'See raw data')}`)
    }
    return values
  }
  if (oid === '2.5.29.17') return list(parsed.altNames).map(value => {
    const name = record(value), type = Number(name.type)
    const labels: Record<number, string> = { 1: 'Email', 2: 'DNS', 6: 'URI', 7: 'IP', 8: 'OID' }
    return `${labels[type] ?? tr('名称类型', 'Name type') + ' ' + type}: ${type === 7 ? ip(name.value) : typeof name.value === 'string' ? name.value : tr('见原始数据', 'See raw data')}`
  })
  if (oid === '2.5.29.15') {
    const hex = String(record(parsed.valueBlock).valueHex ?? '')
    const bytes = hex.match(/../g)?.map(byte => parseInt(byte, 16)) ?? []
    const usages: [string, string][] = [['数字签名', 'Digital signature'], ['内容承诺', 'Content commitment'], ['密钥加密', 'Key encipherment'], ['数据加密', 'Data encipherment'], ['密钥协商', 'Key agreement'], ['证书签发', 'Certificate signing'], ['CRL 签发', 'CRL signing'], ['仅加密', 'Encipher only'], ['仅解密', 'Decipher only']]
    return usages.flatMap(([zh, en], bit) => ((bytes[Math.floor(bit / 8)] ?? 0) & (0x80 >> bit % 8)) ? [tr(zh, en)] : [])
  }
  if (oid === '2.5.29.37') {
    const purposes: Record<string, [string, string]> = {
      '1.3.6.1.5.5.7.3.1': ['服务器认证', 'Server authentication'], '1.3.6.1.5.5.7.3.2': ['客户端认证', 'Client authentication'],
      '1.3.6.1.5.5.7.3.3': ['代码签名', 'Code signing'], '1.3.6.1.5.5.7.3.4': ['电子邮件保护', 'Email protection'],
      '1.3.6.1.5.5.7.3.8': ['时间戳签名', 'Time stamping'], '1.3.6.1.5.5.7.3.9': ['OCSP 签名', 'OCSP signing'],
    }
    return list(parsed.keyPurposes).map(value => purposes[String(value)] ? tr(...purposes[String(value)]) : String(value))
  }
  return []
}
const extensions = computed(() => list(report.value.extensions).flatMap(value => {
  const entry = record(value)
  return entry.extnID ? [entry] : list(entry.extensions).map(record)
}).map(extension => {
  const oid = String(extension.extnID), names = extensionNames[oid]
  return { oid, label: names ? tr(...names) : tr('其他扩展', 'Other extension'), critical: extension.critical === true, values: extensionSummary(extension) }
}))
</script>

<template>
  <div class="space-y-5 text-sm min-w-0" data-pki-details>
    <dl v-if="fields.length" class="divide-y divide-border">
      <div v-for="field in fields" :key="field.key" class="grid sm:grid-cols-[8rem_minmax(0,1fr)] gap-1 sm:gap-3 py-2">
        <dt class="text-muted-foreground">{{ field.label }}</dt>
        <dd class="min-w-0 break-words" :class="{ 'text-destructive': field.failed }">{{ field.text }}</dd>
      </div>
    </dl>
    <section v-if="extensions.length" class="space-y-3">
      <h3 class="font-medium">{{ tr('申请的证书扩展', 'Requested certificate extensions') }}</h3>
      <div v-for="(extension, index) in extensions" :key="extension.oid + index" class="border-l-2 border-border pl-3 space-y-1">
        <div class="flex flex-wrap items-baseline gap-x-2"><span class="font-medium">{{ extension.label }}</span><span class="text-xs text-muted-foreground">{{ extension.oid }}{{ extension.critical ? tr(' · 关键扩展', ' · Critical') : '' }}</span></div>
        <ul v-if="extension.values.length" class="space-y-1"><li v-for="(value, valueIndex) in extension.values" :key="valueIndex" class="break-words">{{ value }}</li></ul>
        <p v-else class="text-xs text-muted-foreground">{{ tr('扩展内容请展开原始数据查看。', 'Expand the raw data to inspect this extension.') }}</p>
      </div>
    </section>
    <section v-if="path.length" class="space-y-3">
      <h3 class="font-medium">{{ tr('已验证的证书链', 'Validated certificate chain') }}</h3>
      <ol class="space-y-4">
        <li v-for="(certificate, index) in path" :key="index" class="border-l-2 border-primary/40 pl-3 space-y-1">
          <p class="text-xs font-medium text-primary">{{ index === path.length - 1 ? tr('指定信任锚', 'Selected trust anchor') : index === 0 ? tr('待验证证书', 'Target certificate') : tr('中间证书', 'Intermediate certificate') }}</p>
          <p class="font-medium break-words">{{ certificate.subject }}</p>
          <p class="break-words text-muted-foreground">{{ tr('签发者', 'Issuer') }}: {{ certificate.issuer }}</p>
          <p class="text-xs text-muted-foreground break-words">{{ date(certificate.validFrom) }} — {{ date(certificate.validTo) }}</p>
        </li>
      </ol>
    </section>
    <section v-if="issues.length" class="space-y-2">
      <h3 class="font-medium text-destructive">{{ tr('未通过的原因', 'Reasons verification failed') }}</h3>
      <ul class="list-disc pl-5 space-y-1"><li v-for="(issue, index) in issues" :key="index" class="break-words">{{ issue }}</li></ul>
    </section>
    <p v-if="mode === 'csr-parse'" class="text-xs text-muted-foreground">{{ tr('CSR 验签检查申请内容与公钥的签名关系，不代表证书已签发或受信任。', 'CSR verification checks the request signature against its public key; it does not indicate that a certificate has been issued or trusted.') }}</p>
    <details class="border-t pt-3">
      <summary class="cursor-pointer text-muted-foreground">{{ tr('原始数据（JSON）', 'Raw data (JSON)') }}</summary>
      <pre class="mt-3 max-h-96 overflow-auto text-xs whitespace-pre-wrap break-all rounded bg-muted/40 p-3">{{ JSON.stringify(details, null, 2) }}</pre>
    </details>
  </div>
</template>
