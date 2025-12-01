<template>
  <div class="h-[calc(100vh-10rem)] flex flex-col gap-4">
    <!-- 工具栏 -->
    <BaseCard class="p-4">
      <div class="flex flex-wrap gap-4 items-center">
        <!-- 格式选择 -->
        <div class="flex items-center gap-2">
          <BaseLabel class="text-sm">源格式</BaseLabel>
          <BaseSelect v-model="sourceFormat" class="w-32">
            <option v-for="opt in formatOptions" :key="opt.value" :value="opt.value">
              {{ opt.label }}
            </option>
          </BaseSelect>
        </div>

        <button 
          @click="swapFormats"
          class="p-2 hover:bg-accent rounded transition-colors"
          title="交换格式"
        >
          <ArrowLeftRight class="w-5 h-5" />
        </button>

        <div class="flex items-center gap-2">
          <BaseLabel class="text-sm">目标格式</BaseLabel>
          <BaseSelect v-model="targetFormat" class="w-32">
            <option v-for="opt in formatOptions" :key="opt.value" :value="opt.value">
              {{ opt.label }}
            </option>
          </BaseSelect>
        </div>

        <div class="w-px h-6 bg-border"></div>

        <!-- 操作按钮 -->
        <BaseButton @click="convert" size="sm" variant="default">
          <RefreshCw class="w-4 h-4 mr-1" :class="{ 'animate-spin': isConverting }" /> 转换
        </BaseButton>
        
        <BaseButton @click="toggleAutoConvert" size="sm" variant="outline">
          <Zap class="w-4 h-4 mr-1" :class="{ 'text-yellow-500': autoConvertEnabled }" /> 
          {{ autoConvertEnabled ? '自动转换' : '手动转换' }}
        </BaseButton>

        <BaseButton @click="copyResult" size="sm" variant="outline">
          <Copy class="w-4 h-4 mr-1" /> 复制结果
        </BaseButton>

        <BaseButton @click="downloadResult" size="sm" variant="outline">
          <Download class="w-4 h-4 mr-1" /> 下载
        </BaseButton>

        <div class="flex-1"></div>

        <BaseButton @click="loadExample" size="sm" variant="outline">
          示例
        </BaseButton>

        <BaseButton @click="clear" size="sm" variant="destructive">
          <Trash2 class="w-4 h-4 mr-1" /> 清空
        </BaseButton>
      </div>

      <!-- 错误提示 -->
      <div 
        v-if="error" 
        class="mt-2 p-2 text-xs text-red-600 bg-red-50 dark:bg-red-900/20 rounded border border-red-200 dark:border-red-800"
      >
        {{ error }}
      </div>

      <!-- 格式说明 -->
      <div 
        v-if="formatDescription && !error" 
        class="mt-2 p-2 text-xs text-blue-600 bg-blue-50 dark:bg-blue-900/20 rounded border border-blue-200 dark:border-blue-800"
      >
        <strong>提示：</strong>{{ formatDescription }}
      </div>
    </BaseCard>

    <!-- 双编辑器布局 -->
    <div class="flex-1 grid grid-cols-2 gap-4 min-h-0">
      <!-- 源编辑器 -->
      <div class="border rounded-md overflow-hidden shadow-sm flex flex-col">
        <div class="bg-muted px-3 py-2 border-b flex items-center justify-between">
          <span class="text-sm font-medium">源数据 ({{ sourceFormat.toUpperCase() }})</span>
          <BaseButton 
            @click="formatSource" 
            size="xs" 
            variant="ghost"
            v-if="canFormat(sourceFormat)"
          >
            <Wand2 class="w-3 h-3 mr-1" /> 格式化
          </BaseButton>
        </div>
        <div class="flex-1 min-h-0">
          <VueMonacoEditor
            v-model:value="sourceContent"
            :language="getEditorLanguage(sourceFormat)"
            :theme="editorTheme"
            :options="editorOptions"
            class="h-full"
            @change="onSourceChange"
          />
        </div>
      </div>

      <!-- 目标编辑器 -->
      <div class="border rounded-md overflow-hidden shadow-sm flex flex-col">
        <div class="bg-muted px-3 py-2 border-b flex items-center justify-between">
          <span class="text-sm font-medium">转换结果 ({{ targetFormat.toUpperCase() }})</span>
          <div class="flex gap-1">
            <BaseButton 
              @click="formatTarget" 
              size="xs" 
              variant="ghost"
              v-if="canFormat(targetFormat)"
            >
              <Wand2 class="w-3 h-3 mr-1" /> 格式化
            </BaseButton>
          </div>
        </div>
        <div class="flex-1 min-h-0">
          <VueMonacoEditor
            v-model:value="targetContent"
            :language="getEditorLanguage(targetFormat)"
            :theme="editorTheme"
            :options="{ ...editorOptions, readOnly: false }"
            class="h-full"
          />
        </div>
      </div>
    </div>

    <!-- 转换矩阵快捷方式 -->
    <BaseCard class="p-3">
      <div class="text-xs text-muted-foreground mb-2">快速转换：</div>
      <div class="flex flex-wrap gap-2">
        <button
          v-for="conversion in quickConversions"
          :key="`${conversion.from}-${conversion.to}`"
          @click="selectConversion(conversion.from, conversion.to)"
          class="px-3 py-1 text-xs rounded border hover:bg-accent transition-colors"
          :class="{ 'bg-accent': sourceFormat === conversion.from && targetFormat === conversion.to }"
        >
          {{ conversion.label }}
        </button>
      </div>
    </BaseCard>
  </div>
</template>

<script setup lang="ts">
import { computed, defineAsyncComponent } from 'vue'
import {
  RefreshCw, ArrowLeftRight, Copy, Download, Trash2, 
  Zap, Wand2
} from 'lucide-vue-next'
import BaseCard from '@/components/ui/BaseCard.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseLabel from '@/components/ui/BaseLabel.vue'
import BaseSelect from '@/components/ui/BaseSelect.vue'
import { useFormatConverter } from './useFormatConverter'
import { useThemeStore } from '@/stores/theme'
import { storeToRefs } from 'pinia'

const VueMonacoEditor = defineAsyncComponent(
  () => import('@guolao/vue-monaco-editor').then(m => m.VueMonacoEditor)
)

const themeStore = useThemeStore()
const { actualTheme } = storeToRefs(themeStore)

const editorTheme = computed(() => actualTheme.value === 'dark' ? 'vs-dark' : 'vs')

const {
  sourceFormat,
  targetFormat,
  sourceContent,
  targetContent,
  error,
  autoConvertEnabled,
  isConverting,
  formatOptions,
  formatDescription,
  quickConversions,
  convert,
  swapFormats,
  toggleAutoConvert,
  copyResult,
  downloadResult,
  formatSource,
  formatTarget,
  loadExample,
  clear,
  selectConversion,
  onSourceChange,
  canFormat,
  getEditorLanguage
} = useFormatConverter()

const editorOptions = {
  automaticLayout: true,
  minimap: { enabled: false },
  scrollBeyondLastLine: false,
  fontSize: 13,
  tabSize: 2,
  wordWrap: 'on',
  lineNumbers: 'on',
  renderWhitespace: 'selection',
  folding: true
}
</script>
