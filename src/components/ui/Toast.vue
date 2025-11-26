<template>
  <Teleport to="body">
    <Transition name="toast">
      <div
        v-if="visible"
        :class="toastClasses"
        @click="close"
      >
        <div class="flex items-start gap-2">
          <component :is="iconComponent" v-if="iconComponent" class="h-5 w-5 flex-shrink-0" />
          <div class="flex-1">
            <p v-if="title" class="font-semibold">{{ title }}</p>
            <p v-if="description" class="text-sm" :class="{ 'mt-1': title }">{{ description }}</p>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { CheckCircle, XCircle, AlertCircle, Info } from 'lucide-vue-next'

interface Props {
  visible: boolean
  title?: string
  description?: string
  variant?: 'success' | 'error' | 'warning' | 'info'
  duration?: number
}

const props = withDefaults(defineProps<Props>(), {
  variant: 'info',
  duration: 3000,
})

const emit = defineEmits<{
  close: []
}>()

const iconComponent = computed(() => {
  const icons = {
    success: CheckCircle,
    error: XCircle,
    warning: AlertCircle,
    info: Info,
  }
  return icons[props.variant]
})

const toastClasses = computed(() => {
  const baseClasses = 'fixed bottom-4 right-4 z-50 min-w-[300px] max-w-md rounded-lg border p-4 shadow-lg cursor-pointer'
  const variants = {
    success: 'bg-green-50 border-green-200 text-green-900 dark:bg-green-900/20 dark:border-green-800 dark:text-green-100',
    error: 'bg-red-50 border-red-200 text-red-900 dark:bg-red-900/20 dark:border-red-800 dark:text-red-100',
    warning: 'bg-yellow-50 border-yellow-200 text-yellow-900 dark:bg-yellow-900/20 dark:border-yellow-800 dark:text-yellow-100',
    info: 'bg-blue-50 border-blue-200 text-blue-900 dark:bg-blue-900/20 dark:border-blue-800 dark:text-blue-100',
  }
  return `${baseClasses} ${variants[props.variant]}`
})

let timeoutId: number | null = null

watch(() => props.visible, (newVisible) => {
  if (newVisible && props.duration > 0) {
    if (timeoutId) clearTimeout(timeoutId)
    timeoutId = window.setTimeout(() => {
      close()
    }, props.duration)
  }
})

function close() {
  if (timeoutId) clearTimeout(timeoutId)
  emit('close')
}
</script>

<style scoped>
.toast-enter-active,
.toast-leave-active {
  transition: all 0.3s ease;
}

.toast-enter-from {
  transform: translateX(100%);
  opacity: 0;
}

.toast-leave-to {
  transform: translateX(100%);
  opacity: 0;
}
</style>

