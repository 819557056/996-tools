<template>
  <div class="h-[calc(100vh-10rem)] flex flex-col gap-4">
    <!-- 工具栏 -->
    <BaseCard class="p-4">
      <div class="flex flex-wrap gap-4 items-center">
        <!-- 编辑器类型切换 -->
        <div class="flex items-center gap-2">
          <BaseLabel class="text-sm">格式</BaseLabel>
          <div class="flex rounded-md border">
            <button
              @click="switchEditorType('yaml')"
              class="px-4 py-1.5 text-sm font-medium transition-colors"
              :class="editorType === 'yaml' 
                ? 'bg-primary text-primary-foreground' 
                : 'hover:bg-accent'"
            >
              YAML
            </button>
            <button
              @click="switchEditorType('toml')"
              class="px-4 py-1.5 text-sm font-medium border-l transition-colors"
              :class="editorType === 'toml' 
                ? 'bg-primary text-primary-foreground' 
                : 'hover:bg-accent'"
            >
              TOML
            </button>
            <button
              @click="switchEditorType('properties')"
              class="px-3 py-1.5 text-sm font-medium border-l transition-colors"
              :class="editorType === 'properties' 
                ? 'bg-primary text-primary-foreground' 
                : 'hover:bg-accent'"
            >
              Properties
            </button>
          </div>
        </div>

        <div class="w-px h-6 bg-border"></div>

        <!-- 操作按钮 -->
        <BaseButton @click="format" size="sm" variant="default">
          <Wand2 class="w-4 h-4 mr-1" /> 格式化
        </BaseButton>
        
        <BaseButton @click="validate" size="sm" variant="outline">
          <CheckCircle2 class="w-4 h-4 mr-1" /> 验证
        </BaseButton>

        <BaseButton 
          v-if="editorType === 'yaml' && indentationIssues.length > 0"
          @click="fixIndentation" 
          size="sm" 
          variant="outline"
        >
          <Wrench class="w-4 h-4 mr-1" /> 修复缩进
        </BaseButton>

        <div class="w-px h-6 bg-border"></div>

        <BaseButton @click="showConvertDialog = true" size="sm" variant="outline">
          <ArrowRightLeft class="w-4 h-4 mr-1" /> 转换
        </BaseButton>

        <BaseButton @click="copy" size="sm" variant="outline">
          <Copy class="w-4 h-4 mr-1" /> 复制
        </BaseButton>

        <BaseButton @click="download" size="sm" variant="outline">
          <Download class="w-4 h-4 mr-1" /> 下载
        </BaseButton>

        <div class="flex-1"></div>

        <!-- 状态指示器 -->
        <div class="flex items-center gap-2 text-sm">
          <div 
            class="flex items-center gap-1"
            :class="isValid ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'"
          >
            <div class="w-2 h-2 rounded-full" :class="isValid ? 'bg-green-500' : 'bg-red-500'"></div>
            <span>{{ isValid ? '有效' : '无效' }}</span>
          </div>
        </div>

        <BaseButton @click="loadExample" size="sm" variant="outline">
          示例
        </BaseButton>

        <BaseButton @click="clear" size="sm" variant="destructive">
          <Trash2 class="w-4 h-4 mr-1" /> 清空
        </BaseButton>
      </div>

      <!-- 错误提示 -->
      <div v-if="errors.length > 0" class="mt-3 space-y-1">
        <div 
          v-for="(error, idx) in errors.slice(0, 3)" 
          :key="idx"
          class="p-2 text-xs text-red-600 bg-red-50 dark:bg-red-900/20 rounded border border-red-200 dark:border-red-800 flex items-start gap-2"
        >
          <AlertCircle class="w-4 h-4 flex-shrink-0 mt-0.5" />
          <div>
            <span v-if="error.line" class="font-medium">第 {{ error.line }} 行: </span>
            <span>{{ error.message }}</span>
          </div>
        </div>
        <div v-if="errors.length > 3" class="text-xs text-muted-foreground pl-6">
          还有 {{ errors.length - 3 }} 个错误...
        </div>
      </div>

      <!-- 缩进警告 -->
      <div v-if="editorType === 'yaml' && indentationIssues.length > 0 && errors.length === 0" class="mt-3">
        <div class="p-2 text-xs text-yellow-600 bg-yellow-50 dark:bg-yellow-900/20 rounded border border-yellow-200 dark:border-yellow-800 flex items-start gap-2">
          <AlertTriangle class="w-4 h-4 flex-shrink-0 mt-0.5" />
          <div>
            <span class="font-medium">发现 {{ indentationIssues.length }} 处缩进问题</span>
            <div class="mt-1 space-y-0.5">
              <div v-for="(issue, idx) in indentationIssues.slice(0, 2)" :key="idx" class="text-[11px]">
                第 {{ issue.line }} 行: {{ issue.message }}
              </div>
            </div>
            <button 
              @click="fixIndentation"
              class="mt-1 text-yellow-700 dark:text-yellow-300 underline hover:no-underline"
            >
              点击自动修复
            </button>
          </div>
        </div>
      </div>

      <!-- YAML 提示 -->
      <div 
        v-if="editorType === 'yaml' && errors.length === 0 && indentationIssues.length === 0"
        class="mt-2 p-2 text-xs text-blue-600 bg-blue-50 dark:bg-blue-900/20 rounded border border-blue-200 dark:border-blue-800"
      >
        <strong>YAML 注意事项：</strong>使用 2 个空格缩进（不要使用 Tab），冒号后需要空格，注意列表的对齐
      </div>
    </BaseCard>

    <!-- 编辑器 -->
    <div class="flex-1 border rounded-md overflow-hidden shadow-sm flex flex-col min-h-0">
      <div class="bg-muted px-3 py-2 border-b flex items-center justify-between">
        <span class="text-sm font-medium">{{ editorType.toUpperCase() }} 编辑器</span>
        <div class="flex items-center gap-4 text-xs text-muted-foreground">
          <span>{{ stats.lines }} 行</span>
          <span>{{ stats.chars }} 字符</span>
          <span>{{ stats.words }} 单词</span>
        </div>
      </div>
      <div class="flex-1 min-h-0">
        <VueMonacoEditor
          v-model:value="content"
          :language="editorType === 'yaml' ? 'yaml' : 'ini'"
          :theme="editorTheme"
          :options="editorOptions"
          class="h-full"
          @mount="handleMount"
        />
      </div>
    </div>

    <!-- 转换对话框 -->
    <div 
      v-if="showConvertDialog"
      class="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
      @click.self="showConvertDialog = false"
    >
      <BaseCard class="w-full max-w-2xl max-h-[80vh] flex flex-col">
        <div class="p-4 border-b flex items-center justify-between">
          <h3 class="text-lg font-semibold">转换为 JSON</h3>
          <button @click="showConvertDialog = false" class="p-1 hover:bg-accent rounded">
            <X class="w-5 h-5" />
          </button>
        </div>
        <div class="flex-1 overflow-auto p-4">
          <div class="space-y-3">
            <div>
              <BaseLabel class="mb-2">JSON 输出</BaseLabel>
              <textarea
                :value="jsonOutput"
                readonly
                class="w-full h-64 p-3 text-sm font-mono border rounded-md bg-muted"
              ></textarea>
            </div>
            <div class="flex gap-2">
              <BaseButton @click="copyJsonOutput" size="sm" class="flex-1">
                <Copy class="w-4 h-4 mr-1" /> 复制 JSON
              </BaseButton>
              <BaseButton @click="downloadJson" size="sm" variant="outline" class="flex-1">
                <Download class="w-4 h-4 mr-1" /> 下载 JSON
              </BaseButton>
            </div>
            <div class="pt-3 border-t">
              <BaseLabel class="mb-2">从 JSON 导入</BaseLabel>
              <textarea
                v-model="jsonInput"
                placeholder="粘贴 JSON 内容..."
                class="w-full h-32 p-3 text-sm font-mono border rounded-md"
              ></textarea>
              <BaseButton @click="importJson" size="sm" class="mt-2">
                <Upload class="w-4 h-4 mr-1" /> 导入
              </BaseButton>
            </div>
          </div>
        </div>
      </BaseCard>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, defineAsyncComponent, ref, watch } from 'vue'
import {
  Wand2, CheckCircle2, Wrench, ArrowRightLeft, Copy, Download, Trash2,
  AlertCircle, AlertTriangle, X, Upload
} from 'lucide-vue-next'
import BaseCard from '@/components/ui/BaseCard.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseLabel from '@/components/ui/BaseLabel.vue'
import { useYamlTomlEditor } from './useYamlTomlEditor'
import { useThemeStore } from '@/stores/theme'
import { useToast } from '@/composables/useToast'
import { storeToRefs } from 'pinia'

const VueMonacoEditor = defineAsyncComponent(
  () => import('@guolao/vue-monaco-editor').then(m => m.VueMonacoEditor)
)

const themeStore = useThemeStore()
const { actualTheme } = storeToRefs(themeStore)
const { toast } = useToast()

const editorTheme = computed(() => actualTheme.value === 'dark' ? 'vs-dark' : 'vs')

const {
  editorType,
  content,
  errors,
  indentationIssues,
  isValid,
  stats,
  format,
  validate,
  convertToJson,
  importFromJson,
  switchEditorType,
  fixIndentation,
  loadExample,
  copy,
  clear,
  download,
  handleMount
} = useYamlTomlEditor()

const editorOptions = {
  automaticLayout: true,
  minimap: { enabled: false },
  scrollBeyondLastLine: false,
  fontSize: 13,
  tabSize: 2,
  insertSpaces: true,
  wordWrap: 'on',
  lineNumbers: 'on',
  renderWhitespace: 'boundary',
  folding: true,
  detectIndentation: false
}

// 转换对话框
const showConvertDialog = ref(false)
const jsonInput = ref('')
const jsonOutput = ref('')

watch(() => showConvertDialog.value, (show) => {
  if (show) {
    jsonOutput.value = convertToJson()
    jsonInput.value = ''
  }
})

function copyJsonOutput() {
  if (!jsonOutput.value) return
  navigator.clipboard.writeText(jsonOutput.value)
  toast({ title: '复制成功', variant: 'success', duration: 2000 })
}

function downloadJson() {
  if (!jsonOutput.value) return
  const blob = new Blob([jsonOutput.value], { type: 'application/json' })
  const link = document.createElement('a')
  const url = URL.createObjectURL(blob)
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5)
  link.href = url
  link.download = `converted_${timestamp}.json`
  link.click()
  URL.revokeObjectURL(url)
}

function importJson() {
  if (!jsonInput.value.trim()) {
    toast({ title: 'JSON 内容为空', variant: 'warning', duration: 2000 })
    return
  }
  importFromJson(jsonInput.value)
  showConvertDialog.value = false
}
</script>
