<template>
  <textarea
    :value="modelValue"
    :placeholder="placeholder"
    :disabled="disabled"
    :readonly="readonly"
    :rows="rows"
    :class="textareaClasses"
    @input="handleInput"
  />
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { cn } from '@/lib/utils'

interface Props {
  modelValue?: string
  placeholder?: string
  disabled?: boolean
  readonly?: boolean
  rows?: number
}

const props = withDefaults(defineProps<Props>(), {
  placeholder: '',
  disabled: false,
  readonly: false,
  rows: 4,
})

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

const textareaClasses = computed(() => {
  return cn(
    'flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50'
  )
})

function handleInput(event: Event) {
  const target = event.target as HTMLTextAreaElement
  emit('update:modelValue', target.value)
}
</script>

