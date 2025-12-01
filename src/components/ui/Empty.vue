<template>
  <div class="flex flex-col items-center justify-center py-12 px-4 text-center">
    <div class="mb-4">
      <component
        :is="icon"
        class="h-16 w-16 text-muted-foreground/50 mx-auto"
      />
    </div>
    <h3 class="text-lg font-semibold mb-2">{{ title }}</h3>
    <p v-if="description" class="text-sm text-muted-foreground max-w-md">
      {{ description }}
    </p>
    <slot />
  </div>
</template>

<script setup lang="ts">
import { Inbox } from 'lucide-vue-next'

interface Props {
  title: string
  description?: string
  icon?: any
}

withDefaults(defineProps<Props>(), {
  icon: Inbox
})
</script>

