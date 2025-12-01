<template>
  <div class="h-[calc(100vh-10rem)] flex flex-col gap-4">
    <!-- Toolbar -->
    <BaseCard class="p-4">
      <div class="flex flex-wrap gap-3 items-center">
        <div class="flex items-center gap-2">
          <BaseLabel>目标语言:</BaseLabel>
          <BaseSelect v-model="selectedLanguage" @change="generate" class="w-40">
            <option value="typescript">TypeScript</option>
            <option value="go">Go</option>
            <option value="java">Java</option>
            <option value="python">Python</option>
            <option value="rust">Rust</option>
            <option value="protobuf">Protobuf</option>
          </BaseSelect>
        </div>

        <div class="flex items-center gap-2">
          <BaseLabel>类型名称:</BaseLabel>
          <BaseInput 
            v-model="rootTypeName" 
            placeholder="RootObject"
            class="w-40"
            @blur="generate"
          />
        </div>

        <div class="w-px h-6 bg-border"></div>

        <BaseButton size="sm" @click="generate">
          <Sparkles class="w-4 h-4 mr-1" /> 生成
        </BaseButton>

        <BaseButton size="sm" variant="outline" @click="copyOutput">
          <Copy class="w-4 h-4 mr-1" /> 复制
        </BaseButton>

        <div class="flex-1"></div>

        <BaseButton size="sm" variant="outline" @click="loadExample">
          示例
        </BaseButton>
        <BaseButton size="sm" variant="destructive" @click="clear">
          <Trash2 class="w-4 h-4 mr-1" /> 清空
        </BaseButton>
      </div>

      <div v-if="error" class="mt-3 p-2 text-xs text-red-600 bg-red-50 dark:bg-red-900/20 rounded border border-red-200 dark:border-red-800">
        {{ error }}
      </div>
    </BaseCard>

    <!-- Split View -->
    <div class="flex-1 grid grid-cols-2 gap-4 min-h-0">
      <!-- Input JSON -->
      <div class="flex flex-col gap-2">
        <div class="flex items-center gap-2 px-1">
          <FileJson class="w-4 h-4 text-muted-foreground" />
          <span class="text-sm font-medium">输入 JSON</span>
        </div>
        <div class="flex-1 border rounded-md overflow-hidden shadow-sm relative">
          <div 
            v-if="!inputJson" 
            class="absolute inset-0 flex items-center justify-center pointer-events-none z-10 bg-background/50 backdrop-blur-[1px]"
          >
            <div class="text-muted-foreground/40 text-sm font-medium select-none flex flex-col items-center gap-2">
              <FileJson class="w-10 h-10 opacity-20" />
              <p>输入 JSON 数据</p>
            </div>
          </div>
          <VueMonacoEditor
            v-model:value="inputJson"
            language="json"
            :theme="editorTheme"
            :options="editorOptions"
            @mount="handleMount"
            class="h-full w-full"
          />
        </div>
      </div>

      <!-- Output Code -->
      <div class="flex flex-col gap-2">
        <div class="flex items-center gap-2 px-1">
          <Code2 class="w-4 h-4 text-muted-foreground" />
          <span class="text-sm font-medium">生成代码</span>
        </div>
        <div class="flex-1 border rounded-md overflow-hidden shadow-sm relative">
          <div 
            v-if="!outputCode" 
            class="absolute inset-0 flex items-center justify-center pointer-events-none z-10 bg-background/50 backdrop-blur-[1px]"
          >
            <div class="text-muted-foreground/40 text-sm font-medium select-none flex flex-col items-center gap-2">
              <Code2 class="w-10 h-10 opacity-20" />
              <p>生成的代码将显示在这里</p>
            </div>
          </div>
          <VueMonacoEditor
            v-model:value="outputCode"
            :language="getLanguageMode()"
            :theme="editorTheme"
            :options="{ ...editorOptions, readOnly: true }"
            class="h-full w-full"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, defineAsyncComponent, watch } from 'vue'
import { FileJson, Code2, Sparkles, Copy, Trash2 } from 'lucide-vue-next'
import BaseCard from '@/components/ui/BaseCard.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseLabel from '@/components/ui/BaseLabel.vue'
import BaseInput from '@/components/ui/BaseInput.vue'
import BaseSelect from '@/components/ui/BaseSelect.vue'
import { useCodeGenerator } from './useCodeGenerator'
import { useThemeStore } from '@/stores/theme'
import { storeToRefs } from 'pinia'

const {
  inputJson,
  outputCode,
  error,
  selectedLanguage,
  rootTypeName,
  handleMount,
  generate,
  copyOutput,
  loadExample,
  clear
} = useCodeGenerator()

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
  fontSize: 13,
  tabSize: 2,
}

function getLanguageMode() {
  switch (selectedLanguage.value) {
    case 'typescript':
      return 'typescript'
    case 'go':
      return 'go'
    case 'java':
      return 'java'
    case 'python':
      return 'python'
    case 'rust':
      return 'rust'
    case 'protobuf':
      return 'protobuf'
    default:
      return 'typescript'
  }
}

// Auto-generate when input changes
watch(inputJson, () => {
  if (inputJson.value) {
    generate()
  }
}, { debounce: 500 } as any)
</script>

