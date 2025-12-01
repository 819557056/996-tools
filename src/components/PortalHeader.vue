<template>
  <header class="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
    <div class="container flex h-16 items-center px-4 md:px-6 gap-4">
      <!-- Logo -->
      <RouterLink to="/" class="flex items-center space-x-2 mr-2 md:mr-4 flex-shrink-0 group">
        <Logo className="h-7 w-7 text-foreground group-hover:text-primary transition-colors" />
        <span class="font-bold text-xl tracking-tight hidden sm:inline-block">{{ siteConfig.name }}</span>
      </RouterLink>

      <!-- 主导航菜单 -->
      <nav class="hidden md:flex gap-6 items-center flex-1">
        <RouterLink
          to="/"
          class="text-sm font-medium transition-colors hover:text-primary"
          :class="{ 'text-primary': $route.path === '/' }"
        >
          {{ t('nav.home') }}
        </RouterLink>
        <RouterLink
          to="/portal/apps"
          class="text-sm font-medium transition-colors hover:text-primary"
          :class="{ 'text-primary': $route.path.startsWith('/portal/apps') }"
        >
          {{ locale === 'zh' ? '应用中心' : 'App Center' }}
        </RouterLink>
        <RouterLink
          to="/portal/articles"
          class="text-sm font-medium transition-colors hover:text-primary"
          :class="{ 'text-primary': $route.path.startsWith('/portal/articles') }"
        >
          {{ locale === 'zh' ? '文章' : 'Articles' }}
        </RouterLink>
      </nav>

      <!-- 搜索框 (桌面端) -->
      <div class="hidden md:flex flex-1 max-w-md lg:max-w-lg">
        <BaseButton
          variant="outline"
          class="relative h-9 w-full justify-start rounded-md bg-muted/50 text-sm font-normal text-muted-foreground shadow-none hover:bg-muted/80 sm:pr-12 md:w-full"
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
      <div class="flex items-center gap-2 md:gap-4 ml-auto flex-shrink-0">
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

        <!-- 移动端菜单按钮 -->
        <BaseButton
          variant="ghost"
          size="icon"
          class="md:hidden"
          @click="toggleMobileMenu"
          :title="locale === 'zh' ? '菜单' : 'Menu'"
        >
          <Menu v-if="!mobileMenuOpen" class="h-5 w-5" />
          <X v-else class="h-5 w-5" />
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

        <!-- 用户头像/登录按钮 -->
        <BaseButton
          variant="ghost"
          size="sm"
          class="hidden md:flex"
          @click="handleUserAction"
        >
          <User class="mr-2 h-4 w-4" />
          <span>{{ locale === 'zh' ? '登录' : 'Login' }}</span>
        </BaseButton>
      </div>
    </div>

    <!-- 移动端菜单 -->
    <Transition
      enter-active-class="transition ease-out duration-200"
      enter-from-class="opacity-0 -translate-y-1"
      enter-to-class="opacity-100 translate-y-0"
      leave-active-class="transition ease-in duration-150"
      leave-from-class="opacity-100 translate-y-0"
      leave-to-class="opacity-0 -translate-y-1"
    >
      <div v-if="mobileMenuOpen" class="md:hidden border-t bg-background">
        <nav class="container px-4 py-4 space-y-2">
          <RouterLink
            to="/"
            class="block px-3 py-2 text-sm font-medium rounded-md hover:bg-muted transition-colors"
            @click="closeMobileMenu"
          >
            {{ t('nav.home') }}
          </RouterLink>
          <RouterLink
            to="/portal/apps"
            class="block px-3 py-2 text-sm font-medium rounded-md hover:bg-muted transition-colors"
            @click="closeMobileMenu"
          >
            {{ locale === 'zh' ? '应用中心' : 'App Center' }}
          </RouterLink>
          <RouterLink
            to="/portal/articles"
            class="block px-3 py-2 text-sm font-medium rounded-md hover:bg-muted transition-colors"
            @click="closeMobileMenu"
          >
            {{ locale === 'zh' ? '文章' : 'Articles' }}
          </RouterLink>
          <div class="pt-2 border-t">
            <BaseButton
              variant="outline"
              class="w-full justify-start"
              @click="handleUserAction"
            >
              <User class="mr-2 h-4 w-4" />
              <span>{{ locale === 'zh' ? '登录' : 'Login' }}</span>
            </BaseButton>
          </div>
        </nav>
      </div>
    </Transition>

    <!-- 搜索命令面板 -->
    <SearchCommand ref="searchCommandRef" />
  </header>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import { Sun, Moon, Search as SearchIcon, Menu, X, User } from 'lucide-vue-next'
import { useI18n } from 'vue-i18n'
import { siteConfig } from '@/config/site'
import { useThemeStore } from '@/stores/theme'
import { storeToRefs } from 'pinia'
import BaseButton from './ui/BaseButton.vue'
import LocaleSelector from './LocaleSelector.vue'
import SearchCommand from './SearchCommand.vue'
import Logo from './Logo.vue'

const { t, locale } = useI18n()
const route = useRoute()
const themeStore = useThemeStore()
const { actualTheme } = storeToRefs(themeStore)
const { toggleTheme } = themeStore

const searchCommandRef = ref<InstanceType<typeof SearchCommand>>()
const mobileMenuOpen = ref(false)

const openSearch = () => {
  searchCommandRef.value?.open()
  closeMobileMenu()
}

const toggleMobileMenu = () => {
  mobileMenuOpen.value = !mobileMenuOpen.value
}

const closeMobileMenu = () => {
  mobileMenuOpen.value = false
}

const handleUserAction = () => {
  // TODO: 实现登录逻辑
  closeMobileMenu()
}
</script>

