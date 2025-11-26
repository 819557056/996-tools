<template>
  <div class="fixed bottom-4 right-4 z-50 space-y-2">
    <Toast
      v-for="toast in toasts"
      :key="toast.id"
      :visible="toast.visible"
      :title="toast.title"
      :description="toast.description"
      :variant="toast.variant"
      :duration="0"
      @close="removeToast(toast.id)"
    />
  </div>
</template>

<script setup lang="ts">
import { useToast } from '@/composables/useToast'
import Toast from './ui/Toast.vue'

const { toasts, removeToast } = useToast()
</script>

