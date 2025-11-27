<template>
  <div class="h-[calc(100vh-10rem)] flex flex-col gap-4">
    <!-- Toolbar -->
    <BaseCard class="p-4">
      <div class="flex flex-wrap gap-2 items-center">
        <BaseButton size="sm" variant="outline" @click="formatJson">
          <RefreshCw class="w-4 h-4 mr-1" /> 格式化
        </BaseButton>
        
        <div class="w-px h-6 bg-border mx-1"></div>

        <BaseButton size="sm" variant="outline" @click="foldAll">
          <Minimize2 class="w-4 h-4 mr-1" /> 折叠
        </BaseButton>
        <BaseButton size="sm" variant="outline" @click="unfoldAll">
          <Maximize2 class="w-4 h-4 mr-1" /> 展开
        </BaseButton>
        
        <div class="w-px h-6 bg-border mx-1"></div>

        <BaseButton size="sm" variant="outline" @click="removeComments">
          <Eraser class="w-4 h-4 mr-1" /> 去除注释
        </BaseButton>

        <div class="w-px h-6 bg-border mx-1"></div>

        <BaseButton size="sm" variant="outline" @click="minifyAndCopy">
          <Copy class="w-4 h-4 mr-1" /> 压缩复制
        </BaseButton>
        <BaseButton size="sm" variant="outline" @click="minifyEscapeAndCopy">
          <Code2 class="w-4 h-4 mr-1" /> 转义复制
        </BaseButton>
        <BaseButton size="sm" variant="outline" @click="jsonToXmlAndCopy">
          <FileCode class="w-4 h-4 mr-1" /> 转XML复制
        </BaseButton>
        <BaseButton size="sm" variant="outline" @click="jsonToTsAndCopy">
          <FileType class="w-4 h-4 mr-1" /> 转TS复制
        </BaseButton>

        <div class="flex-1"></div>

        <BaseButton size="sm" variant="outline" @click="loadExample">
          示例
        </BaseButton>
        <BaseButton size="sm" variant="destructive" @click="clear">
          <Trash2 class="w-4 h-4 mr-1" /> 清空
        </BaseButton>
      </div>
      
      <div v-if="error" class="mt-2 p-2 text-xs text-red-600 bg-red-50 dark:bg-red-900/20 rounded border border-red-200 dark:border-red-800">
        {{ error }}
      </div>
    </BaseCard>

    <!-- Editor -->
    <div 
      class="flex-1 border rounded-md overflow-hidden shadow-sm relative"
      @dragover.prevent
      @drop.prevent="handleDrop"
    >
      <div 
        v-if="!content" 
        class="absolute inset-0 flex items-center justify-center pointer-events-none z-10 bg-background/50 backdrop-blur-[1px]"
      >
        <div class="text-muted-foreground/40 text-xl font-medium select-none flex flex-col items-center gap-2">
          <FileType class="w-12 h-12 opacity-20" />
          <p>输入 JSON 数据，或拖拽 JSON 文件到此处</p>
        </div>
      </div>
      <VueMonacoEditor
        v-model:value="content"
        language="json"
        :theme="editorTheme"
        :options="editorOptions"
        @mount="handleMount"
        class="h-full w-full"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, defineAsyncComponent } from 'vue'
import { 
  RefreshCw, 
  Minimize2, 
  Maximize2, 
  Eraser, 
  Copy, 
  Code2, 
  FileCode, 
  FileType, 
  Trash2 
} from 'lucide-vue-next'
import BaseCard from '@/components/ui/BaseCard.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import { useJsonFormatter } from './useJsonFormatter'
import { useThemeStore } from '@/stores/theme'
import { storeToRefs } from 'pinia'

const {
  content,
  error,
  handleMount,
  formatJson,
  removeComments,
  foldAll,
  unfoldAll,
  minifyAndCopy,
  minifyEscapeAndCopy,
  jsonToXmlAndCopy,
  jsonToTsAndCopy,
  loadExample,
  clear
} = useJsonFormatter()

// 异步加载 Monaco 编辑器，避免在其他页面或首屏时提前加载较大的编辑器代码
const VueMonacoEditor = defineAsyncComponent(() => import('@guolao/vue-monaco-editor').then(m => m.VueMonacoEditor))

const themeStore = useThemeStore()
const { actualTheme } = storeToRefs(themeStore)

const editorTheme = computed(() => actualTheme.value === 'dark' ? 'vs-dark' : 'vs')

const editorOptions = {
  automaticLayout: true,
  formatOnPaste: true,
  formatOnType: true,
  minimap: { enabled: false },
  scrollBeyondLastLine: false,
  fontSize: 14,
  tabSize: 2,
}

function handleDrop(e: DragEvent) {
  const file = e.dataTransfer?.files[0]
  if (file) {
    const reader = new FileReader()
    reader.onload = (e) => {
      if (e.target?.result) {
        content.value = e.target.result as string
        // Try to format after drop
        setTimeout(formatJson, 100)
      }
    }
    reader.readAsText(file)
  }
}
</script>
