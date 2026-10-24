<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { Copy, Download } from 'lucide-vue-next'
import BaseButton from '@/components/ui/BaseButton.vue'
import { useToast } from '@/composables/useToast'
import { decodeMaterial, encodeSm2KeyDer, formatMaterial, materialLabel, type InputEncoding, type MaterialKind } from '@/utils/crypto/material-format'

const props = withDefaults(defineProps<{
  value: string
  label: string
  kind?: MaterialKind
  sourceEncoding?: InputEncoding
  rows?: number
  collapsible?: boolean
}>(), { kind: 'binary', sourceEncoding: 'hex', rows: 5, collapsible: false })

const { t } = useI18n()
const toast = useToast()
const encoding = ref<'hex' | 'base64'>('hex')
const structure = ref<'raw' | 'der'>('raw')
const headers = ref(false)
const lineLength = ref(0)
const lineEnding = ref<'LF' | 'CRLF'>('LF')
const uppercase = ref(false)
const isKey = computed(() => props.kind === 'sm2-public' || props.kind === 'sm2-private')
const labelText = computed(() => materialLabel(props.kind, structure.value))
const standardPem = computed(() => props.kind === 'certificate' || props.kind === 'pkcs7' || ['public-key', 'private-key', 'rsa-private-key', 'csr', 'ocsp-request', 'ocsp-response', 'crl'].includes(props.kind) || (isKey.value && structure.value === 'der'))
const result = computed(() => {
  try {
    let bytes = decodeMaterial(props.value, props.sourceEncoding)
    if (bytes.length && structure.value === 'der' && (props.kind === 'sm2-public' || props.kind === 'sm2-private')) {
      bytes = encodeSm2KeyDer(bytes, props.kind)
    }
    return { text: formatMaterial(bytes, {
      encoding: encoding.value, header: headers.value ? labelText.value : undefined,
      lineLength: lineLength.value, lineEnding: lineEnding.value, uppercase: uppercase.value,
    }), error: '' }
  } catch (error) {
    return { text: '', error: error instanceof Error ? error.message : t('cryptoOutput.invalid') }
  }
})

async function copy() {
  if (!result.value.text) return
  try {
    await navigator.clipboard.writeText(result.value.text)
    toast.success(t('cryptoOutput.copied'))
  } catch {
    toast.error(t('cryptoOutput.copyFailed'))
  }
}

function download() {
  if (!result.value.text) return
  const extension = encoding.value === 'hex' ? 'hex' : headers.value && standardPem.value ? 'pem' : 'txt'
  const url = URL.createObjectURL(new Blob([result.value.text], { type: 'text/plain;charset=utf-8' }))
  const link = document.createElement('a')
  link.href = url
  link.download = `${props.kind}-${structure.value}.${extension}`
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
</script>

<template>
  <component :is="collapsible ? 'details' : 'section'" class="min-w-0 space-y-3" :aria-label="label" data-encoded-output>
    <summary v-if="collapsible" class="cursor-pointer text-sm font-medium text-primary py-1">
      {{ t('cryptoOutput.formatExport') }} · {{ label }}
    </summary>
    <div class="flex flex-wrap items-center justify-between gap-2">
      <span class="text-sm font-medium">{{ label }}</span>
      <div class="flex flex-wrap gap-1">
        <slot name="actions" />
        <BaseButton size="sm" variant="ghost" :disabled="!result.text" @click="copy">
          <Copy class="w-4 h-4 mr-1" />{{ t('cryptoOutput.copy') }}
        </BaseButton>
        <BaseButton size="sm" variant="outline" :disabled="!result.text" @click="download">
          <Download class="w-4 h-4 mr-1" />{{ t('cryptoOutput.download') }}
        </BaseButton>
      </div>
    </div>
    <div class="flex flex-wrap items-end gap-3 rounded-md bg-muted/40 p-3 text-xs">
      <label v-if="isKey" class="space-y-1">
        <span class="block text-muted-foreground">{{ t('cryptoOutput.structure') }}</span>
        <select v-model="structure" class="format-select">
          <option value="raw">{{ t('cryptoOutput.rawKey') }}</option>
          <option value="der">{{ kind === 'sm2-public' ? 'SPKI (DER)' : 'PKCS#8 (DER)' }}</option>
        </select>
      </label>
      <label class="space-y-1">
        <span class="block text-muted-foreground">{{ t('cryptoOutput.encoding') }}</span>
        <select v-model="encoding" class="format-select">
          <option value="hex">Hex</option>
          <option value="base64">Base64</option>
        </select>
      </label>
      <label class="space-y-1">
        <span class="block text-muted-foreground">{{ t('cryptoOutput.wrapping') }}</span>
        <select v-model.number="lineLength" class="format-select">
          <option :value="0">{{ t('cryptoOutput.noWrap') }}</option>
          <option v-for="length in [32, 64, 76]" :key="length" :value="length">{{ t('cryptoOutput.columns', { count: length }) }}</option>
        </select>
      </label>
      <label class="space-y-1">
        <span class="block text-muted-foreground">{{ t('cryptoOutput.lineEnding') }}</span>
        <select v-model="lineEnding" class="format-select"><option>LF</option><option>CRLF</option></select>
      </label>
      <label v-if="encoding === 'base64'" class="flex items-center gap-2 min-h-8 cursor-pointer">
        <input v-model="headers" type="checkbox" class="accent-primary" />{{ t('cryptoOutput.headers') }}
      </label>
      <label v-else class="flex items-center gap-2 min-h-8 cursor-pointer">
        <input v-model="uppercase" type="checkbox" class="accent-primary" />{{ t('cryptoOutput.uppercase') }}
      </label>
    </div>
    <p v-if="encoding === 'base64' && headers && !standardPem" class="text-xs text-muted-foreground">
      {{ t('cryptoOutput.customHeader', { label: labelText }) }}
    </p>
    <textarea :value="result.text" readonly :rows="rows" :aria-label="`${label} ${encoding}`" wrap="off" spellcheck="false"
      class="w-full min-w-0 rounded-md border border-input bg-muted/30 px-3 py-2 font-mono text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring overflow-x-auto" />
    <p v-if="result.error" role="alert" class="text-sm text-red-600 break-all">{{ t('cryptoOutput.invalid') }}: {{ result.error }}</p>
  </component>
</template>

<style scoped>
.format-select { @apply block h-8 rounded-md border border-input bg-background px-2 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-ring; }
</style>
