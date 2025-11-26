<template>
  <header class="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
    <!-- 搜索命令面板 -->
    <SearchCommand ref="searchCommandRef" />
    
    <div class="container flex h-14 items-center px-4 md:px-8 gap-4">
      <!-- Logo -->
      <RouterLink to="/" class="flex items-center space-x-2 mr-2 md:mr-4 flex-shrink-0 group">
        <Logo className="h-6 w-6 text-foreground group-hover:text-primary transition-colors" />
        <span class="font-bold text-xl tracking-tight hidden sm:inline-block">{{ siteConfig.name }}</span>
      </RouterLink>

      <!-- 搜索按钮 (桌面端) - 移到 Logo 右侧 -->
      <div class="hidden md:flex flex-1 max-w-md lg:max-w-lg">
        <BaseButton
          variant="outline"
          class="relative h-9 w-full justify-start rounded-[0.5rem] bg-muted/50 text-sm font-normal text-muted-foreground shadow-none hover:bg-muted/80 sm:pr-12 md:w-full"
          @click="openSearch"
        >
          <SearchIcon class="mr-2 h-4 w-4" />
          <span>{{ t('search.placeholder') }}</span>
          <kbd class="pointer-events-none absolute right-[0.3rem] top-[0.3rem] hidden h-6 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium opacity-100 sm:flex">
            <span class="text-xs">Ctrl</span>K
          </kbd>
        </BaseButton>
      </div>

      <!-- 右侧功能区 -->
      <div class="flex items-center gap-4 ml-auto flex-shrink-0">
        <nav class="hidden md:flex gap-6 items-center mr-2">
          <RouterLink
            to="/"
            class="text-sm font-medium transition-colors hover:text-primary"
          >
            {{ t('nav.home') }}
          </RouterLink>
          <a
            :href="siteConfig.links.github"
            target="_blank"
            class="text-sm font-medium transition-colors hover:text-primary"
          >
            GitHub
          </a>
        </nav>

        <!-- 移动端搜索图标 -->
        <BaseButton
          variant="ghost"
          size="icon"
          class="md:hidden"
          @click="openSearch"
          :title="t('search.title')"
        >
          <SearchIcon class="h-5 w-5" />
        </BaseButton>
        
        <LocaleSelector />
        <BaseButton
          variant="ghost"
          size="icon"
          @click="toggleTheme"
          :title="actualTheme === 'dark' ? t('nav.lightMode') : t('nav.darkMode')"
        >
          <Sun v-if="actualTheme === 'dark'" class="h-5 w-5" />
          <Moon v-else class="h-5 w-5" />
        </BaseButton>
      </div>
    </div>
  </header>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { RouterLink } from 'vue-router'
import { Sun, Moon, Search as SearchIcon } from 'lucide-vue-next'
import { useI18n } from 'vue-i18n'
import { siteConfig } from '@/config/site'
import { useThemeStore } from '@/stores/theme'
import { storeToRefs } from 'pinia'
import BaseButton from './ui/BaseButton.vue'
import LocaleSelector from './LocaleSelector.vue'
import SearchCommand from './SearchCommand.vue'
import Logo from './Logo.vue'

const { t } = useI18n()
const themeStore = useThemeStore()
const { actualTheme } = storeToRefs(themeStore)
const { toggleTheme } = themeStore

const searchCommandRef = ref<InstanceType<typeof SearchCommand>>()

const openSearch = () => {
  searchCommandRef.value?.open()
}
</script>

