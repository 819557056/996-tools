<template>
  <div class="h-[calc(100vh-10rem)] flex flex-col gap-4">
    <!-- Toolbar -->
    <BaseCard class="p-4">
      <div class="flex flex-wrap gap-3 items-center">
        <BaseButton size="sm" @click="calculateDiff">
          <GitCompare class="w-4 h-4 mr-1" /> 对比
        </BaseButton>

        <div class="w-px h-6 bg-border"></div>

        <BaseButton size="sm" variant="outline" @click="formatJson('left')">
          <AlignLeft class="w-4 h-4 mr-1" /> 格式化左侧
        </BaseButton>

        <BaseButton size="sm" variant="outline" @click="formatJson('right')">
          <AlignRight class="w-4 h-4 mr-1" /> 格式化右侧
        </BaseButton>

        <div class="w-px h-6 bg-border"></div>

        <BaseButton size="sm" variant="outline" @click="swapSides">
          <ArrowLeftRight class="w-4 h-4 mr-1" /> 交换
        </BaseButton>

        <BaseButton size="sm" variant="outline" @click="copyToRight">
          <ArrowRight class="w-4 h-4 mr-1" /> 复制到右
        </BaseButton>

        <BaseButton size="sm" variant="outline" @click="copyToLeft">
          <ArrowLeft class="w-4 h-4 mr-1" /> 复制到左
        </BaseButton>

        <div class="flex-1"></div>

        <!-- Diff Stats -->
        <div v-if="diffStats.added + diffStats.modified + diffStats.removed > 0" class="flex items-center gap-3 text-xs">
          <div class="flex items-center gap-1 text-green-600 dark:text-green-400">
            <Plus class="w-3 h-3" />
            <span>{{ diffStats.added }}</span>
          </div>
          <div class="flex items-center gap-1 text-yellow-600 dark:text-yellow-400">
            <Pencil class="w-3 h-3" />
            <span>{{ diffStats.modified }}</span>
          </div>
          <div class="flex items-center gap-1 text-red-600 dark:text-red-400">
            <Minus class="w-3 h-3" />
            <span>{{ diffStats.removed }}</span>
          </div>
        </div>

        <BaseButton size="sm" variant="outline" @click="loadExample">
          示例
        </BaseButton>

        <BaseButton size="sm" variant="destructive" @click="clear">
          <Trash2 class="w-4 h-4 mr-1" /> 清空
        </BaseButton>
      </div>

      <div v-if="leftError || rightError" class="mt-3 space-y-2">
        <div v-if="leftError" class="p-2 text-xs text-red-600 bg-red-50 dark:bg-red-900/20 rounded border border-red-200 dark:border-red-800">
          <span class="font-medium">左侧错误:</span> {{ leftError }}
        </div>
        <div v-if="rightError" class="p-2 text-xs text-red-600 bg-red-50 dark:bg-red-900/20 rounded border border-red-200 dark:border-red-800">
          <span class="font-medium">右侧错误:</span> {{ rightError }}
        </div>
      </div>
    </BaseCard>

    <!-- Diff View -->
    <div v-if="showDiffView && leftJson && rightJson" class="flex-1 border rounded-md overflow-hidden shadow-sm">
      <VueMonacoDiffEditor
        :original="leftJson"
        :modified="rightJson"
        language="json"
        :theme="editorTheme"
        :options="diffEditorOptions"
        class="h-full w-full"
      />
    </div>

    <!-- Side by Side Editors -->
    <div v-else class="flex-1 grid grid-cols-2 gap-4 min-h-0">
      <!-- Left JSON -->
      <div class="flex flex-col gap-2">
        <div class="flex items-center gap-2 px-1">
          <FileJson class="w-4 h-4 text-muted-foreground" />
          <span class="text-sm font-medium">原始 JSON (左侧)</span>
        </div>
        <div class="flex-1 border rounded-md overflow-hidden shadow-sm relative">
          <div 
            v-if="!leftJson" 
            class="absolute inset-0 flex items-center justify-center pointer-events-none z-10 bg-background/50 backdrop-blur-[1px]"
          >
            <div class="text-muted-foreground/40 text-sm font-medium select-none flex flex-col items-center gap-2">
              <FileJson class="w-10 h-10 opacity-20" />
              <p>输入原始 JSON</p>
            </div>
          </div>
          <VueMonacoEditor
            v-model:value="leftJson"
            language="json"
            :theme="editorTheme"
            :options="editorOptions"
            class="h-full w-full"
          />
        </div>
      </div>

      <!-- Right JSON -->
      <div class="flex flex-col gap-2">
        <div class="flex items-center gap-2 px-1">
          <FileJson class="w-4 h-4 text-muted-foreground" />
          <span class="text-sm font-medium">对比 JSON (右侧)</span>
        </div>
        <div class="flex-1 border rounded-md overflow-hidden shadow-sm relative">
          <div 
            v-if="!rightJson" 
            class="absolute inset-0 flex items-center justify-center pointer-events-none z-10 bg-background/50 backdrop-blur-[1px]"
          >
            <div class="text-muted-foreground/40 text-sm font-medium select-none flex flex-col items-center gap-2">
              <FileJson class="w-10 h-10 opacity-20" />
              <p>输入对比 JSON</p>
            </div>
          </div>
          <VueMonacoEditor
            v-model:value="rightJson"
            language="json"
            :theme="editorTheme"
            :options="editorOptions"
            class="h-full w-full"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, defineAsyncComponent } from 'vue'
import { 
  GitCompare, ArrowLeftRight, ArrowLeft, ArrowRight,
  AlignLeft, AlignRight, FileJson, Trash2,
  Plus, Minus, Pencil
} from 'lucide-vue-next'
import BaseCard from '@/components/ui/BaseCard.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import { useJsonDiff } from './useJsonDiff'
import { useThemeStore } from '@/stores/theme'
import { storeToRefs } from 'pinia'

const {
  leftJson,
  rightJson,
  leftError,
  rightError,
  diffStats,
  showDiffView,
  formatJson,
  calculateDiff,
  swapSides,
  copyToRight,
  copyToLeft,
  loadExample,
  clear
} = useJsonDiff()

const VueMonacoEditor = defineAsyncComponent(() => import('@guolao/vue-monaco-editor').then(m => m.VueMonacoEditor))
const VueMonacoDiffEditor = defineAsyncComponent(() => import('@guolao/vue-monaco-editor').then(m => m.VueMonacoDiffEditor))

const themeStore = useThemeStore()
const { actualTheme } = storeToRefs(themeStore)

const editorTheme = computed(() => actualTheme.value === 'dark' ? 'vs-dark' : 'vs')

const editorOptions = {
  automaticLayout: true,
  formatOnPaste: true,
  formatOnType: true,
  minimap: { enabled: false },
  scrollBeyondLastLine: false,
  fontSize: 13,
  tabSize: 2,
}

const diffEditorOptions = {
  automaticLayout: true,
  renderSideBySide: true,
  minimap: { enabled: false },
  scrollBeyondLastLine: false,
  fontSize: 13,
  readOnly: true,
  enableSplitViewResizing: true,
}
</script>

