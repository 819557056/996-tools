<template>
  <RouterLink
    :to="site.url || `/portal/sites/${site.slug}`"
    class="group block p-6 border rounded-lg transition-all hover:border-primary hover:shadow-md bg-card relative overflow-hidden h-full"
  >
    <!-- 渐变背景 -->
    <div :class="`absolute inset-0 bg-gradient-to-br ${site.color || 'from-primary/10 to-primary/5'} opacity-0 group-hover:opacity-100 transition-opacity`"></div>
    
    <div class="relative z-10">
      <!-- Icon -->
      <div class="flex items-center justify-between mb-4">
        <div class="p-3 rounded-lg bg-primary/10 group-hover:bg-primary/20 transition-colors">
          <component
            :is="getIconComponent(site.icon)"
            class="h-6 w-6 text-primary"
          />
        </div>
        <ArrowRight
          class="h-5 w-5 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground"
        />
      </div>

      <!-- Title -->
      <h3 class="font-semibold text-lg mb-2 group-hover:text-primary transition-colors">
        {{ site.name }}
      </h3>

      <!-- Description -->
      <p class="text-sm text-muted-foreground mb-4 leading-relaxed">
        {{ site.description }}
      </p>

      <!-- Stats -->
      <div class="flex items-center justify-between text-xs text-muted-foreground">
        <span class="flex items-center gap-1">
          <Wrench class="h-3 w-3" />
          {{ site.toolCount || 0 }} {{ locale === 'zh' ? '个工具' : 'tools' }}
        </span>
        <span class="text-primary font-medium">
          {{ locale === 'zh' ? '访问' : 'Visit' }} →
        </span>
      </div>
    </div>
  </RouterLink>
</template>

<script setup lang="ts">
import { RouterLink } from 'vue-router'
import { ArrowRight, Wrench } from 'lucide-vue-next'
import * as LucideIcons from 'lucide-vue-next'
import { useI18n } from 'vue-i18n'

interface Site {
  slug: string
  name: string
  description: string
  icon: string
  toolCount?: number
  url?: string
  color?: string
}

interface Props {
  site: Site
}

defineProps<Props>()

const { locale } = useI18n()

const getIconComponent = (iconName: string) => {
  const IconComponent = (LucideIcons as any)[iconName] || LucideIcons.Box
  return IconComponent
}
</script>

