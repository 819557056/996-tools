<template>
  <aside 
    class="fixed inset-y-0 left-0 z-50 border-r bg-background transition-all duration-300 ease-in-out"
    :class="collapsed ? 'w-16' : 'w-64'"
  >
    <div class="flex h-full flex-col scrollbar-thin">
      <!-- Logo & Search -->
      <div class="border-b p-4 space-y-4">
        <RouterLink to="/" class="flex items-center gap-2" :class="collapsed ? 'justify-center' : ''">
          <img src="@/assets/logo.png" alt="996 Logo" class="h-8 w-8 rounded-md object-contain flex-shrink-0" />
          <span v-if="!collapsed" class="font-semibold whitespace-nowrap overflow-hidden">{{ siteConfig.web }}</span>
        </RouterLink>
      </div>

      <!-- Navigation -->
      <div class="flex-1 overflow-auto p-4 scrollbar-thin" :class="collapsed ? 'px-2' : ''">
        <nav class="space-y-6">
          <!-- Favorites -->
          <div v-if="!collapsed">
            <h3 class="mb-2 px-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              {{ t('sidebar.favorites') }}
            </h3>
            <div v-if="favoritesList.length === 0" class="px-2 text-sm text-muted-foreground">
              {{ t('sidebar.noFavorites') }}
            </div>
            <div v-else class="space-y-1">
              <RouterLink
                v-for="toolKey in favoritesList"
                :key="toolKey"
                :to="toolsData[toolKey]?.path"
                class="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent hover:text-accent-foreground transition-colors"
              >
                <component :is="getIcon(toolsData[toolKey]?.icon)" class="h-4 w-4 flex-shrink-0" />
                <span>{{ toolsData[toolKey]?.label }}</span>
              </RouterLink>
            </div>
          </div>

          <!-- Tool Categories -->
          <div v-for="category in categories" :key="category.name">
            <h3 v-if="!collapsed" class="mb-2 px-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              {{ getCategoryName(category.name) }}
            </h3>
            <div class="space-y-1">
              <RouterLink
                v-for="tool in category.tools"
                :key="tool.path"
                :to="tool.path"
                class="flex items-center rounded-md py-1.5 text-sm hover:bg-accent hover:text-accent-foreground transition-colors group"
                :class="[
                  { 'bg-accent text-accent-foreground': isCurrentRoute(tool.path) },
                  collapsed ? 'justify-center px-2' : 'gap-2 px-2'
                ]"
                :title="collapsed ? t(`${tool.i18nKey}.title`, tool.label) : ''"
              >
                <component :is="getIcon(tool.icon)" class="h-4 w-4 flex-shrink-0" />
                <span v-if="!collapsed" class="flex-1">{{ t(`${tool.i18nKey}.title`, tool.label) }}</span>
                <span v-if="!collapsed && tool.isNew" class="inline-flex items-center rounded-md bg-primary/10 px-1.5 py-0.5 text-xs font-medium text-primary">
                  {{ t('sidebar.newBadge') }}
                </span>
              </RouterLink>
            </div>
          </div>
        </nav>
      </div>

      <!-- Bottom Actions -->
      <div class="border-t p-4" :class="collapsed ? 'px-2' : ''">
        <button
          @click="toggleTheme"
          class="flex w-full items-center rounded-md px-2 py-1.5 text-sm hover:bg-accent hover:text-accent-foreground transition-colors"
          :class="collapsed ? 'justify-center' : 'gap-2'"
          :title="collapsed ? (actualTheme === 'dark' ? t('sidebar.lightMode') : t('sidebar.darkMode')) : ''"
        >
          <Sun v-if="actualTheme === 'dark'" class="h-4 w-4 flex-shrink-0" />
          <Moon v-else class="h-4 w-4 flex-shrink-0" />
          <span v-if="!collapsed">{{ actualTheme === 'dark' ? t('sidebar.lightMode') : t('sidebar.darkMode') }}</span>
        </button>
      </div>
    </div>
  </aside>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { Sun, Moon, Text, Lock, Binary, Link as LinkIcon, QrCode, IdCard, FileJson } from 'lucide-vue-next'
import { siteConfig } from '@/config/site'
import { toolsData, getToolsByCategory } from '@/lib/tools-data'
import { useFavoritesStore } from '@/stores/favorites'
import { useThemeStore } from '@/stores/theme'
import { storeToRefs } from 'pinia'

defineProps<{
  collapsed?: boolean
}>()

const { t } = useI18n()
const route = useRoute()
const favoritesStore = useFavoritesStore()
const themeStore = useThemeStore()

const { favoritesList } = storeToRefs(favoritesStore)
const { actualTheme } = storeToRefs(themeStore)
const { toggleTheme } = themeStore

// 图标映射
const iconMap: Record<string, any> = {
  Text,
  Lock,
  Binary,
  Link: LinkIcon,
  QrCode,
  IdCard,
  FileJson,
}

function getIcon(iconName?: string) {
  return iconMap[iconName || 'Text'] || Text
}

function isCurrentRoute(path: string) {
  return route.path === path
}

// 获取分类显示名称
function getCategoryName(categoryKey: string) {
  const key = `sidebar.categories.${categoryKey}`
  return t(key)
}

// 按分类组织工具
const categories = computed(() => getToolsByCategory())
</script>

