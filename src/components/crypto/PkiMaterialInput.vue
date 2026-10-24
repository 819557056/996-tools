<script setup lang="ts">
import { onBeforeUnmount, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { fromBER, Integer, OctetString, Sequence } from 'asn1js'
import { decodeMaterial, encodeSm2KeyDer, formatMaterial, type InputEncoding } from '@/utils/crypto/material-format'
const props = withDefaults(defineProps<{ label: string; header: string; hint?: string; multiple?: boolean; optional?: boolean }>(), { multiple: false, optional: false })
const model = defineModel<string>({ required: true })
const { locale } = useI18n()
const tr = (zh: string, en: string) => locale.value.startsWith('zh') ? zh : en
const error = ref(''), encoding = ref<InputEncoding>('auto')
let importVersion = 0
watch(model, () => { importVersion++; error.value = '' }, { flush: 'sync' })
onBeforeUnmount(() => { importVersion++ })
function asPem(bytes: Uint8Array, header = props.header): string {
  if (props.header === 'PRIVATE KEY') {
    if (bytes.length === 32) {
      bytes = encodeSm2KeyDer(bytes, 'sm2-private')
      header = 'PRIVATE KEY'
    } else {
      const parsed = fromBER(bytes)
      if (parsed.offset === bytes.length && parsed.result instanceof Sequence) {
        const values = parsed.result.valueBlock.value
        if (values.length === 2 && values[0] instanceof Sequence && values[1] instanceof OctetString) header = 'ENCRYPTED PRIVATE KEY'
        else if (values.length === 9 && values.every(value => value instanceof Integer)) header = 'RSA PRIVATE KEY'
        else if (values[0] instanceof Integer && values[1] instanceof OctetString) header = 'EC PRIVATE KEY'
      }
    }
  } else if (props.header === 'PUBLIC KEY' && bytes.length === 65 && bytes[0] === 4) {
    bytes = encodeSm2KeyDer(bytes, 'sm2-public')
    header = 'PUBLIC KEY'
  }
  return formatMaterial(bytes, { encoding: 'base64', header, lineLength: 64 })
}
function normalizeText(text: string, selectedEncoding: InputEncoding): string {
  if (text.trim().startsWith('-----BEGIN ') && (selectedEncoding === 'auto' || selectedEncoding === 'pem')) {
    const pattern = /-----BEGIN ([A-Z0-9]+(?:[ -][A-Z0-9]+)*)-----[\s\S]*?-----END \1-----/g
    const blocks = Array.from(text.matchAll(pattern))
    if (!blocks.length || text.replace(pattern, '').trim() || !props.multiple && blocks.length !== 1) throw new Error(tr('PEM 头尾不匹配或包含多余内容', 'Mismatched PEM headers or unexpected extra content'))
    if (blocks.length > 16) throw new Error(tr('最多 16 张证书', 'At most 16 certificates'))
    return blocks.map(block => {
      if (props.multiple && block[1] !== props.header) throw new Error(tr('证书包只能包含 CERTIFICATE', 'A certificate bundle must contain CERTIFICATE blocks'))
      return asPem(decodeMaterial(block[0], 'pem'), block[1])
    }).join('\n')
  }
  return asPem(decodeMaterial(text, selectedEncoding))
}
function normalize() {
  importVersion++
  if (!model.value.trim()) return
  try {
    model.value = normalizeText(model.value, encoding.value)
    encoding.value = 'auto'; error.value = ''
  } catch (reason) { error.value = (reason as Error).message }
}
async function read(event: Event) {
  const input = event.target as HTMLInputElement
  const files = Array.from(input.files ?? []); error.value = ''
  if (!files.length) return
  const version = ++importVersion, selectedEncoding = encoding.value
  try {
    if (files.length > 16 || files.some(file => file.size > 20 * 1024 * 1024)) throw new Error(tr('最多 16 个文件，每个不超过 20 MB', 'At most 16 files, 20 MB each'))
    if (files.some(file => file.size === 0)) throw new Error(tr('文件内容不能为空', 'Files must not be empty'))
    const texts = await Promise.all(files.map(async file => {
      const bytes = new Uint8Array(await file.arrayBuffer())
      let text = ''
      try { text = new TextDecoder('utf-8', { fatal: true }).decode(bytes).trim() } catch { /* Binary DER. */ }
      if (text.startsWith('-----BEGIN ') || text && /^[A-Za-z0-9+/=\s]+$/.test(text)) return normalizeText(text, text.startsWith('-----BEGIN ') ? 'pem' : selectedEncoding)
      return asPem(bytes)
    }))
    if (version !== importVersion) return
    if (props.multiple && (texts.join('\n').match(/-----BEGIN CERTIFICATE-----/g)?.length ?? 0) > 16) throw new Error(tr('最多 16 张证书', 'At most 16 certificates'))
    model.value = texts.join('\n'); encoding.value = 'auto'
  } catch (reason) { if (version === importVersion) error.value = (reason as Error).message }
  finally { input.value = '' }
}
</script>
<template>
  <div class="space-y-2 min-w-0">
    <label class="block space-y-2 text-sm font-medium">
      <span>{{ label }} <span v-if="optional" class="font-normal text-muted-foreground">({{ tr('可选', 'optional') }})</span></span>
      <textarea v-model="model" rows="4" autocomplete="off" spellcheck="false" class="tool-input font-mono text-xs" :placeholder="hint || 'PEM / Base64 / Hex'" @input="error = ''" />
    </label>
    <div class="flex flex-wrap gap-2 items-center text-xs">
      <label class="cursor-pointer text-primary underline underline-offset-4">{{ tr('从文件导入', 'Import file') }}<input type="file" class="sr-only" :multiple="multiple" :aria-label="tr('导入', 'Import') + ' ' + label" @change="read" /></label>
      <select v-model="encoding" :aria-label="label + ' ' + tr('输入格式', 'input encoding')" class="rounded border bg-background p-1"><option value="auto">{{ tr('自动识别', 'Auto') }}</option><option value="hex">Hex</option><option value="base64">Base64</option><option value="pem">PEM</option></select>
      <button type="button" class="text-primary underline underline-offset-4" @click="normalize">{{ tr('按所选格式转为 PEM', 'Normalize selected format to PEM') }}</button>
    </div>
    <p v-if="error" role="alert" class="text-xs text-destructive">{{ error }}</p>
  </div>
</template>
