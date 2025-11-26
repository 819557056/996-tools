<template>
  <RouterLink
    :to="tool.path"
    :class="cardClasses"
  >
    <div v-if="tool.isNew && !compact" class="absolute -top-2 -right-2 border border-teal-500 bg-teal-500/50 text-white text-xs font-medium px-8 py-1 transform rotate-45 translate-x-[20px] translate-y-[20px] shadow-md">
      NEW
    </div>

    <!-- Favorite Button -->
    <button
      @click.prevent.stop="toggleFavorite(tool.key)"
      class="absolute top-2 right-2 p-1.5 md:p-2 rounded-full hover:bg-accent transition-colors z-10 opacity-0 group-hover:opacity-100 focus:opacity-100"
      :class="{ 'opacity-100 text-yellow-500': isFavorite(tool.key) }"
      :title="isFavorite(tool.key) ? 'Remove from favorites' : 'Add to favorites'"
    >
      <Star class="h-4 w-4 md:h-5 md:w-5" :class="{ 'fill-current': isFavorite(tool.key) }" />
    </button>

    <div v-if="compact" class="flex flex-col h-full">
      <div class="flex items-center gap-3 mb-2">
        <div class="p-2 rounded-md bg-muted group-hover:bg-background transition-colors flex-shrink-0">
          <component :is="iconComponent" class="h-5 w-5 text-primary" />
        </div>
        <h3 class="font-semibold text-sm line-clamp-1 flex-1">{{ tool.label }}</h3>
      </div>
      <p class="text-xs text-muted-foreground line-clamp-2 mt-auto">
        {{ tool.description }}
      </p>
    </div>

    <template v-else>
      <div class="flex items-center justify-between mb-4">
        <div class="p-2 rounded-md bg-gray-100 dark:bg-gray-800">
          <component :is="iconComponent" class="h-6 w-6 text-primary" />
        </div>
        <ArrowRight class="h-5 w-5 opacity-0 group-hover:opacity-100 transition-opacity" />
      </div>

      <h3 class="font-semibold text-lg mb-2">{{ tool.label }}</h3>
      <p class="text-sm text-gray-600 dark:text-gray-400 line-clamp-2">
        {{ tool.description }}
      </p>

      <div class="mt-4 flex flex-wrap gap-2">
        <span
          v-for="badge in tool.badges"
          :key="badge"
          class="inline-flex items-center rounded-md border border-transparent bg-secondary text-secondary-foreground px-2.5 py-0.5 text-xs font-semibold transition-colors"
        >
          {{ badge }}
        </span>
      </div>
    </template>
  </RouterLink>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink } from 'vue-router'
import {
  ArrowRight,
  Text,
  Lock,
  Binary,
  Link as LinkIcon,
  QrCode,
  IdCard,
  FileJson,
  Star,
  Watch,
  Shield,
} from 'lucide-vue-next'
import { cn } from '@/lib/utils'
import type { Tool } from '@/lib/tools-data'
import { useFavoritesStore } from '@/stores/favorites'

interface Props {
  tool: Tool
  compact?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  compact: false
})
const favoritesStore = useFavoritesStore()
const { toggleFavorite, isFavorite } = favoritesStore

const iconComponent = computed(() => {
  const icons: Record<string, any> = {
    Text,
    Lock,
    Binary,
    Link: LinkIcon,
    QrCode,
    IdCard,
    FileJson,
    Watch,
    PKI: Shield,
  }
  return icons[props.tool.icon] || Text
})

const cardClasses = computed(() => {
  if (props.compact) {
    return cn(
      'group block p-4 border rounded-lg transition-all duration-200 hover:border-primary hover:shadow-md bg-card hover:bg-accent/50 relative overflow-hidden h-full flex flex-col'
    )
  }
  return cn(
    'group block p-6 border rounded-lg transition-all duration-200 hover:border-primary hover:shadow-md bg-card hover:bg-accent/50 relative overflow-hidden'
  )
})
</script>
