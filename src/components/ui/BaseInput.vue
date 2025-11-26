<template>
  <input
    :value="modelValue"
    :type="type"
    :placeholder="placeholder"
    :disabled="disabled"
    :readonly="readonly"
    :class="inputClasses"
    @input="handleInput"
    @change="handleChange"
    @blur="handleBlur"
  />
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { cn } from '@/lib/utils'

interface Props {
  modelValue?: string | number
  type?: string
  placeholder?: string
  disabled?: boolean
  readonly?: boolean
  error?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  type: 'text',
  placeholder: '',
  disabled: false,
  readonly: false,
  error: false,
})

const emit = defineEmits<{
  'update:modelValue': [value: string]
  change: [value: string]
  blur: [event: FocusEvent]
}>()

const inputClasses = computed(() => {
  return cn(
    'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
    props.error && 'border-destructive focus-visible:ring-destructive'
  )
})

function handleInput(event: Event) {
  const target = event.target as HTMLInputElement
  emit('update:modelValue', target.value)
}

function handleChange(event: Event) {
  const target = event.target as HTMLInputElement
  emit('change', target.value)
}

function handleBlur(event: FocusEvent) {
  emit('blur', event)
}
</script>

