<template>
  <nav v-if="items.length > 0" class="container px-4 py-3" aria-label="Breadcrumb">
    <ol class="flex items-center space-x-2 text-sm">
      <li>
        <RouterLink
          to="/"
          class="text-muted-foreground hover:text-primary transition-colors"
        >
          <Home class="h-4 w-4" />
          <span class="sr-only">{{ t('nav.home') }}</span>
        </RouterLink>
      </li>
      <li v-for="(item, index) in items" :key="index" class="flex items-center">
        <ChevronRight class="h-4 w-4 text-muted-foreground mx-2" />
        <RouterLink
          v-if="item.to && index < items.length - 1"
          :to="item.to"
          class="text-muted-foreground hover:text-primary transition-colors"
        >
          {{ item.label }}
        </RouterLink>
        <span
          v-else
          class="text-foreground font-medium"
          :aria-current="index === items.length - 1 ? 'page' : undefined"
        >
          {{ item.label }}
        </span>
      </li>
    </ol>
  </nav>
</template>

<script setup lang="ts">
import { RouterLink } from 'vue-router'
import { Home, ChevronRight } from 'lucide-vue-next'
import { useI18n } from 'vue-i18n'

interface BreadcrumbItem {
  label: string
  to?: string
}

interface Props {
  items: BreadcrumbItem[]
}

defineProps<Props>()

const { t } = useI18n()
</script>

