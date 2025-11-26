<template>
  <div class="flex h-screen overflow-hidden bg-background">
    <!-- Mobile Sidebar Overlay -->
    <div 
      v-if="isSidebarOpen" 
      class="fixed inset-0 z-40 bg-background/80 backdrop-blur-sm lg:hidden"
      @click="isSidebarOpen = false"
    ></div>

    <!-- Sidebar -->
    <AppSidebar 
      :collapsed="isSidebarCollapsed"
      :class="[
        isSidebarOpen ? 'translate-x-0' : '-translate-x-full',
        'lg:translate-x-0'
      ]"
    />

    <!-- Main Content -->
    <div 
      class="flex flex-1 flex-col transition-all duration-300 ease-in-out"
      :class="isSidebarCollapsed ? 'lg:ml-16' : 'lg:ml-64'"
      style="overflow-y: auto; overflow-x: visible;"
    >
      <!-- Top Bar -->
      <header class="border-b bg-background">
        <!-- 搜索命令面板 -->
        <SearchCommand ref="searchCommandRef" />
        
        <div class="flex h-14 items-center justify-between px-6">
          <div class="flex items-center gap-4 flex-1">
            <!-- Desktop sidebar toggle -->
            <button 
              class="hidden lg:flex hover:bg-accent hover:text-accent-foreground p-2 rounded-md transition-colors"
              @click="isSidebarCollapsed = !isSidebarCollapsed"
              :title="isSidebarCollapsed ? '展开侧边栏' : '折叠侧边栏'"
            >
              <PanelLeftClose v-if="!isSidebarCollapsed" class="h-5 w-5" />
              <PanelLeft v-else class="h-5 w-5" />
            </button>
            
            <!-- Mobile menu toggle -->
            <button 
              class="lg:hidden hover:bg-accent hover:text-accent-foreground p-2 rounded-md transition-colors"
              @click="isSidebarOpen = !isSidebarOpen"
            >
              <Menu class="h-5 w-5" />
            </button>

            <!-- 搜索框 -->
            <div class="w-full max-w-md hidden lg:block">
              <button
                @click="openSearch"
                class="relative inline-flex h-9 w-full items-center justify-start rounded-[0.5rem] border border-input bg-muted/50 px-4 py-2 text-sm font-normal text-muted-foreground shadow-none transition-colors hover:bg-muted/80 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 sm:pr-12"
              >
                <Search class="mr-2 h-4 w-4" />
                <span>{{ t('search.placeholder') }}</span>
                <kbd class="pointer-events-none absolute right-[0.3rem] top-[0.3rem] hidden h-6 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium opacity-100 sm:flex border-b-2 text-xs">
                  <span class="text-xs">Ctrl</span> K
                </kbd>
              </button>
            </div>
            
            <!-- 移动端搜索图标 -->
            <button 
              class="lg:hidden inline-flex items-center justify-center rounded-md p-2 hover:bg-accent hover:text-accent-foreground transition-colors"
              @click="openSearch"
            >
              <Search class="h-5 w-5" />
            </button>
          </div>
          
          <div class="flex items-center gap-4">
            <a
              href="https://github.com"
              target="_blank"
              class="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              About
            </a>
            
            <!-- 语言选择器 -->
            <LocaleSelector />
            
            <!-- 工具收藏按钮 -->
            <button
              v-if="currentTool"
              @click="toggleFavorite(currentTool.key)"
              class="inline-flex items-center justify-center rounded-md p-2 hover:bg-accent hover:text-accent-foreground transition-colors"
              :class="{ 'text-yellow-500': isFavorite(currentTool.key) }"
              :title="isFavorite(currentTool.key) ? '取消收藏' : '添加收藏'"
            >
              <Star class="h-5 w-5" :class="{ 'fill-current': isFavorite(currentTool.key) }" />
            </button>

            <!-- 主题切换按钮 -->
            <button
              @click="toggleTheme"
              class="inline-flex items-center justify-center rounded-md p-2 hover:bg-accent hover:text-accent-foreground transition-colors"
              :title="actualTheme === 'dark' ? '切换到浅色模式' : '切换到深色模式'"
            >
              <Sun v-if="actualTheme === 'dark'" class="h-5 w-5" />
              <Moon v-else class="h-5 w-5" />
            </button>
            
            <button class="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 bg-primary text-primary-foreground hover:bg-primary/90 h-9 px-3">
              <Gift class="h-4 w-4 mr-2" />
              Request a Tool
            </button>
          </div>
        </div>
      </header>

      <!-- Content Area -->
      <main class="flex-1 overflow-auto bg-muted/20">
        <div class="py-6 px-6">
          <RouterView />
        </div>
      </main>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { RouterView, useRoute } from 'vue-router'
import { Menu, Gift, Sun, Moon, Search, PanelLeftClose, PanelLeft, Star } from 'lucide-vue-next'
import { storeToRefs } from 'pinia'
import { useI18n } from 'vue-i18n'
import AppSidebar from '@/components/AppSidebar.vue'
import LocaleSelector from '@/components/LocaleSelector.vue'
import SearchCommand from '@/components/SearchCommand.vue'
import { useThemeStore } from '@/stores/theme'
import { useFavoritesStore } from '@/stores/favorites'
import { getToolByPath } from '@/lib/tools-data'

const { t } = useI18n()
const route = useRoute()
const themeStore = useThemeStore()
const favoritesStore = useFavoritesStore()
const { actualTheme } = storeToRefs(themeStore)
const { toggleTheme } = themeStore
const { toggleFavorite, isFavorite } = favoritesStore

const currentTool = computed(() => getToolByPath(route.path))

const searchCommandRef = ref<InstanceType<typeof SearchCommand>>()
const isSidebarOpen = ref(false)
const isSidebarCollapsed = ref(false)

const openSearch = () => {
  searchCommandRef.value?.open()
}
</script>

