<template>
  <Teleport to="body">
    <Transition
      enter-active-class="transition-opacity duration-200"
      leave-active-class="transition-opacity duration-150"
      enter-from-class="opacity-0"
      leave-to-class="opacity-0"
    >
      <div
        v-if="isOpen"
        class="fixed inset-0 z-[100] bg-black/50 backdrop-blur-sm"
        @click="close"
      >
        <div class="fixed inset-0 overflow-y-auto">
          <div class="flex min-h-full items-start justify-center p-4 pt-[15vh]">
            <Transition
              enter-active-class="transition-all duration-200"
              leave-active-class="transition-all duration-150"
              enter-from-class="opacity-0 scale-95 translate-y-[-10px]"
              leave-to-class="opacity-0 scale-95 translate-y-[-10px]"
            >
              <div
                v-if="isOpen"
                class="relative w-full max-w-2xl rounded-lg border bg-background shadow-2xl"
                @click.stop
              >
                <!-- 搜索输入框 -->
                <div class="flex items-center border-b px-4">
                  <Search class="h-5 w-5 text-muted-foreground" />
                  <input
                    ref="searchInputRef"
                    v-model="searchQuery"
                    type="text"
                    :placeholder="t('search.placeholder')"
                    class="flex-1 bg-transparent py-4 px-3 text-base outline-none placeholder:text-muted-foreground"
                    @keydown.down.prevent="selectNext"
                    @keydown.up.prevent="selectPrevious"
                    @keydown.enter.prevent="navigateToSelected"
                    @keydown.esc="close"
                  />
                  <div class="flex items-center gap-1 text-xs text-muted-foreground">
                    <kbd class="pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium opacity-100">
                      ESC
                    </kbd>
                  </div>
                </div>

                <!-- 搜索结果 -->
                <div class="max-h-[400px] overflow-y-auto p-2">
                  <div v-if="filteredTools.length === 0" class="py-8 text-center text-sm text-muted-foreground">
                    {{ t('search.noResults') }}
                  </div>
                  
                  <div v-else class="space-y-1">
                    <div
                      v-for="(tool, index) in filteredTools"
                      :key="tool.path"
                      :class="[
                        'flex items-center gap-3 rounded-md px-3 py-2.5 cursor-pointer transition-colors',
                        selectedIndex === index 
                          ? 'bg-accent text-accent-foreground' 
                          : 'hover:bg-accent/50'
                      ]"
                      @click="navigateToTool(tool)"
                      @mouseenter="selectedIndex = index"
                    >
                      <div class="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                        <component :is="getIcon(tool.icon)" class="h-5 w-5" />
                      </div>
                      <div class="flex-1 overflow-hidden">
                        <div class="flex items-center gap-2">
                          <div class="font-medium truncate">{{ tool.label }}</div>
                          <Badge v-if="tool.isNew" variant="secondary" class="text-xs">
                            {{ t('sidebar.newBadge') }}
                          </Badge>
                        </div>
                        <div class="text-sm text-muted-foreground truncate">
                          {{ tool.description }}
                        </div>
                      </div>
                      <div class="flex items-center gap-1">
                        <kbd class="pointer-events-none hidden sm:inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium opacity-100">
                          <span class="text-xs">↵</span>
                        </kbd>
                      </div>
                    </div>
                  </div>
                </div>

                <!-- 底部提示 -->
                <div class="border-t px-4 py-2 text-xs text-muted-foreground">
                  <div class="flex items-center justify-between">
                    <div class="flex items-center gap-4">
                      <span class="flex items-center gap-1">
                        <kbd class="pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium">
                          ↑↓
                        </kbd>
                        {{ t('search.navigate') }}
                      </span>
                      <span class="flex items-center gap-1">
                        <kbd class="pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium">
                          ↵
                        </kbd>
                        {{ t('search.select') }}
                      </span>
                    </div>
                    <span>{{ filteredTools.length }} {{ t('search.results') }}</span>
                  </div>
                </div>
              </div>
            </Transition>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { Search, Text, Lock, Binary, Link, QrCode, IdCard, FileJson } from 'lucide-vue-next'
import { toolsData, type Tool } from '@/lib/tools-data'
import Badge from './ui/Badge.vue'

const { t } = useI18n()
const router = useRouter()

const isOpen = ref(false)
const searchQuery = ref('')
const selectedIndex = ref(0)
const searchInputRef = ref<HTMLInputElement>()

// 图标映射
const iconMap: Record<string, any> = {
  Text,
  Lock,
  Binary,
  Link,
  QrCode,
  IdCard,
  FileJson,
}

const getIcon = (iconName: string) => {
  return iconMap[iconName] || Text
}

// 搜索过滤
const filteredTools = computed(() => {
  const query = searchQuery.value.toLowerCase().trim()
  
  if (!query) {
    return Object.values(toolsData)
  }
  
  return Object.values(toolsData).filter((tool) => {
    return (
      tool.label.toLowerCase().includes(query) ||
      tool.description.toLowerCase().includes(query) ||
      tool.badges.some(badge => badge.toLowerCase().includes(query)) ||
      tool.category.toLowerCase().includes(query)
    )
  })
})

// 重置选中索引
watch(searchQuery, () => {
  selectedIndex.value = 0
})

// 打开搜索框
const open = () => {
  isOpen.value = true
  // 等待 DOM 更新后聚焦输入框
  setTimeout(() => {
    searchInputRef.value?.focus()
  }, 100)
}

// 关闭搜索框
const close = () => {
  isOpen.value = false
  searchQuery.value = ''
  selectedIndex.value = 0
}

// 选择下一个
const selectNext = () => {
  if (selectedIndex.value < filteredTools.value.length - 1) {
    selectedIndex.value++
  }
}

// 选择上一个
const selectPrevious = () => {
  if (selectedIndex.value > 0) {
    selectedIndex.value--
  }
}

// 导航到选中的工具
const navigateToSelected = () => {
  if (filteredTools.value.length > 0) {
    navigateToTool(filteredTools.value[selectedIndex.value])
  }
}

// 导航到工具
const navigateToTool = (tool: Tool) => {
  router.push(tool.path)
  close()
}

// 键盘快捷键
const handleKeydown = (e: KeyboardEvent) => {
  // Ctrl+K 或 Cmd+K
  if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
    e.preventDefault()
    if (isOpen.value) {
      close()
    } else {
      open()
    }
  }
}

onMounted(() => {
  window.addEventListener('keydown', handleKeydown)
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeydown)
})

// 暴露给父组件
defineExpose({
  open,
  close,
})
</script>

