<template>
  <div class="h-[calc(100vh-10rem)] flex gap-4">
    <!-- Main Content -->
    <div class="flex-1 flex flex-col gap-4 min-w-0">
      <!-- Toolbar -->
      <BaseCard class="p-4">
        <div class="flex flex-wrap gap-3 items-center mb-3">
          <div class="flex items-center gap-2">
            <BaseLabel>查询引擎:</BaseLabel>
            <BaseSelect v-model="queryEngine" class="w-32">
              <option value="jsonpath">JSONPath</option>
              <option value="jmespath">JMESPath</option>
            </BaseSelect>
          </div>

          <div class="flex-1 flex items-center gap-2">
            <BaseLabel>查询表达式:</BaseLabel>
            <BaseInput 
              v-model="queryExpression" 
              placeholder="输入查询表达式，如 $.store.book[*].title"
              class="flex-1"
              @keydown.enter="executeQuery"
            />
          </div>

          <BaseButton size="sm" @click="executeQuery">
            <Search class="w-4 h-4 mr-1" /> 查询
          </BaseButton>

          <BaseButton size="sm" variant="outline" @click="copyResult">
            <Copy class="w-4 h-4 mr-1" /> 复制
          </BaseButton>

          <BaseButton size="sm" variant="outline" @click="loadExample">
            示例
          </BaseButton>
          
          <BaseButton size="sm" variant="destructive" @click="clear">
            <Trash2 class="w-4 h-4 mr-1" /> 清空
          </BaseButton>
        </div>

        <!-- Example Queries -->
        <div class="flex flex-wrap gap-2 items-center">
          <span class="text-xs text-muted-foreground">快速示例:</span>
          <button
            v-for="example in getExamples()"
            :key="example.query"
            @click="loadExampleQuery(example.query)"
            class="text-xs px-2 py-1 rounded bg-primary/10 hover:bg-primary/20 text-primary transition-colors"
          >
            {{ example.label }}
          </button>
        </div>

        <div v-if="error" class="mt-3 p-2 text-xs text-red-600 bg-red-50 dark:bg-red-900/20 rounded border border-red-200 dark:border-red-800">
          {{ error }}
        </div>
      </BaseCard>

      <!-- Editors Grid -->
      <div class="flex-1 grid grid-cols-2 gap-4 min-h-0">
        <!-- Input JSON -->
        <div class="flex flex-col gap-2">
          <div class="flex items-center gap-2 px-1">
            <Database class="w-4 h-4 text-muted-foreground" />
            <span class="text-sm font-medium">输入 JSON 数据</span>
          </div>
          <div class="flex-1 border rounded-md overflow-hidden shadow-sm relative">
            <div 
              v-if="!inputJson" 
              class="absolute inset-0 flex items-center justify-center pointer-events-none z-10 bg-background/50 backdrop-blur-[1px]"
            >
              <div class="text-muted-foreground/40 text-sm font-medium select-none flex flex-col items-center gap-2">
                <Database class="w-10 h-10 opacity-20" />
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

        <!-- Query Result -->
        <div class="flex flex-col gap-2">
          <div class="flex items-center gap-2 px-1">
            <FileOutput class="w-4 h-4 text-muted-foreground" />
            <span class="text-sm font-medium">查询结果</span>
          </div>
          <div class="flex-1 border rounded-md overflow-hidden shadow-sm relative">
            <div 
              v-if="!resultJson" 
              class="absolute inset-0 flex items-center justify-center pointer-events-none z-10 bg-background/50 backdrop-blur-[1px]"
            >
              <div class="text-muted-foreground/40 text-sm font-medium select-none flex flex-col items-center gap-2">
                <FileOutput class="w-10 h-10 opacity-20" />
                <p>查询结果将显示在这里</p>
              </div>
            </div>
            <VueMonacoEditor
              v-model:value="resultJson"
              language="json"
              :theme="editorTheme"
              :options="{ ...editorOptions, readOnly: true }"
              class="h-full w-full"
            />
          </div>
        </div>
      </div>
    </div>

    <!-- History Sidebar -->
    <div class="w-64 flex flex-col gap-4">
      <BaseCard class="p-4 flex-1 flex flex-col">
        <div class="flex items-center justify-between mb-3">
          <div class="flex items-center gap-2">
            <History class="w-4 h-4" />
            <span class="text-sm font-medium">查询历史</span>
          </div>
          <button 
            v-if="queryHistory.length > 0"
            @click="clearHistory"
            class="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            清空
          </button>
        </div>

        <div v-if="queryHistory.length === 0" class="flex-1 flex items-center justify-center text-xs text-muted-foreground">
          暂无历史记录
        </div>

        <div v-else class="flex-1 overflow-y-auto space-y-2">
          <button
            v-for="(item, index) in queryHistory"
            :key="index"
            @click="loadFromHistory(item)"
            class="w-full text-left p-2 rounded border border-border hover:bg-accent transition-colors group"
          >
            <div class="text-xs font-medium text-primary mb-1">
              {{ item.engine.toUpperCase() }}
            </div>
            <div class="text-xs text-muted-foreground break-all line-clamp-2 group-hover:text-foreground transition-colors">
              {{ item.expression }}
            </div>
          </button>
        </div>
      </BaseCard>

      <!-- Query Help -->
      <BaseCard class="p-4">
        <div class="flex items-center gap-2 mb-3">
          <HelpCircle class="w-4 h-4" />
          <span class="text-sm font-medium">语法说明</span>
        </div>
        <div class="text-xs text-muted-foreground space-y-2">
          <div v-if="queryEngine === 'jsonpath'">
            <div class="font-medium mb-1">JSONPath 语法:</div>
            <div class="space-y-1 font-mono">
              <div>$ - 根节点</div>
              <div>@ - 当前节点</div>
              <div>. - 子节点</div>
              <div>.. - 递归查找</div>
              <div>* - 通配符</div>
              <div>[n] - 数组索引</div>
              <div>[?(@.x)] - 过滤</div>
            </div>
          </div>
          <div v-else>
            <div class="font-medium mb-1">JMESPath 语法:</div>
            <div class="space-y-1 font-mono">
              <div>foo.bar - 访问属性</div>
              <div>foo[0] - 数组索引</div>
              <div>foo[*] - 展开数组</div>
              <div>[?x > `5`] - 过滤</div>
              <div>length() - 函数</div>
              <div>sort_by() - 排序</div>
            </div>
          </div>
        </div>
      </BaseCard>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, defineAsyncComponent } from 'vue'
import { 
  Search, Copy, Trash2, Database, FileOutput, 
  History, HelpCircle 
} from 'lucide-vue-next'
import BaseCard from '@/components/ui/BaseCard.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseLabel from '@/components/ui/BaseLabel.vue'
import BaseInput from '@/components/ui/BaseInput.vue'
import BaseSelect from '@/components/ui/BaseSelect.vue'
import { useJsonQuery } from './useJsonQuery'
import { useThemeStore } from '@/stores/theme'
import { storeToRefs } from 'pinia'

const {
  inputJson,
  queryExpression,
  resultJson,
  error,
  queryEngine,
  queryHistory,
  handleMount,
  executeQuery,
  loadFromHistory,
  clearHistory,
  copyResult,
  loadExample,
  clear,
  getExamples,
  loadExampleQuery
} = useJsonQuery()

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
</script>

