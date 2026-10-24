<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import type { InputEncoding } from '@/utils/crypto/material-format'

defineProps<{ modelValue: InputEncoding }>()
const emit = defineEmits<{ 'update:modelValue': [value: InputEncoding] }>()
const { t } = useI18n()
</script>

<template>
  <label class="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
    {{ t('cryptoOutput.inputEncoding') }}
    <select :value="modelValue" @change="emit('update:modelValue', ($event.target as HTMLSelectElement).value as InputEncoding)"
      class="h-8 rounded-md border border-input bg-background px-2 text-foreground">
      <option value="auto">{{ t('cryptoOutput.auto') }}</option>
      <option value="hex">Hex</option>
      <option value="base64">Base64</option>
      <option value="pem">Base64 + BEGIN/END</option>
    </select>
  </label>
</template>
