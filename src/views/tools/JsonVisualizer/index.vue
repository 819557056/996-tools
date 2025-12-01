<template>
  <div class="h-[calc(100vh-10rem)] flex gap-4">
    <!-- Left Panel: JSON Input -->
    <div class="w-96 flex flex-col gap-4">
      <BaseCard class="p-4">
        <div class="space-y-3">
          <div class="flex items-center gap-2">
            <BaseLabel>可视化类型:</BaseLabel>
            <BaseSelect v-model="visualizationType" class="flex-1">
              <option value="tree">树状图</option>
              <option value="graph">关系图谱</option>
              <option value="sunburst">旭日图</option>
            </BaseSelect>
          </div>

          <div class="flex gap-2">
            <BaseButton size="sm" @click="visualize" class="flex-1">
              <Eye class="w-4 h-4 mr-1" /> 可视化
            </BaseButton>
            <BaseButton size="sm" variant="outline" @click="exportImage">
              <Download class="w-4 h-4 mr-1" /> 导出
            </BaseButton>
          </div>

          <div class="flex gap-2">
            <BaseButton size="sm" variant="outline" @click="loadExample" class="flex-1">
              示例
            </BaseButton>
            <BaseButton size="sm" variant="destructive" @click="clear">
              <Trash2 class="w-4 h-4 mr-1" /> 清空
            </BaseButton>
          </div>

          <div v-if="error" class="p-2 text-xs text-red-600 bg-red-50 dark:bg-red-900/20 rounded border border-red-200 dark:border-red-800">
            {{ error }}
          </div>
        </div>
      </BaseCard>

      <!-- JSON Input -->
      <div class="flex-1 flex flex-col gap-2 min-h-0">
        <div class="flex items-center gap-2 px-1">
          <FileJson class="w-4 h-4 text-muted-foreground" />
          <span class="text-sm font-medium">JSON 数据</span>
        </div>
        <div class="flex-1 border rounded-md overflow-hidden shadow-sm relative">
          <div 
            v-if="!inputJson" 
            class="absolute inset-0 flex items-center justify-center pointer-events-none z-10 bg-background/50 backdrop-blur-[1px]"
          >
            <div class="text-muted-foreground/40 text-sm font-medium select-none flex flex-col items-center gap-2">
              <FileJson class="w-10 h-10 opacity-20" />
              <p class="text-center px-4">输入 JSON 数据</p>
            </div>
          </div>
          <VueMonacoEditor
            v-model:value="inputJson"
            language="json"
            :theme="editorTheme"
            :options="editorOptions"
            class="h-full w-full"
          />
        </div>
      </div>

      <!-- Help Panel -->
      <BaseCard class="p-4">
        <div class="flex items-center gap-2 mb-2">
          <Info class="w-4 h-4" />
          <span class="text-sm font-medium">提示</span>
        </div>
        <div class="text-xs text-muted-foreground space-y-1">
          <div><strong>树状图:</strong> 清晰展示层级结构</div>
          <div><strong>关系图谱:</strong> 显示节点关系</div>
          <div><strong>旭日图:</strong> 径向层次可视化</div>
        </div>
      </BaseCard>
    </div>

    <!-- Right Panel: Visualization -->
    <div class="flex-1 flex flex-col gap-2 min-w-0">
      <div class="flex items-center gap-2 px-1">
        <Network class="w-4 h-4 text-muted-foreground" />
        <span class="text-sm font-medium">可视化视图</span>
        <span v-if="visualizationType === 'tree'" class="text-xs text-muted-foreground">(点击节点展开/折叠)</span>
        <span v-if="visualizationType === 'graph'" class="text-xs text-muted-foreground">(可拖拽和缩放)</span>
        <span v-if="visualizationType === 'sunburst'" class="text-xs text-muted-foreground">(点击节点聚焦)</span>
      </div>
      <div class="flex-1 border rounded-md overflow-hidden shadow-sm bg-white dark:bg-gray-950 relative">
        <div 
          v-if="!inputJson" 
          class="absolute inset-0 flex items-center justify-center pointer-events-none z-10"
        >
          <div class="text-muted-foreground/40 text-lg font-medium select-none flex flex-col items-center gap-3">
            <Network class="w-16 h-16 opacity-20" />
            <p>可视化结果将显示在这里</p>
          </div>
        </div>
        <div 
          ref="chartContainer" 
          class="w-full h-full"
        ></div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, defineAsyncComponent, onMounted, onUnmounted, ref } from 'vue'
import { 
  FileJson, Eye, Download, Trash2, Network, Info
} from 'lucide-vue-next'
import BaseCard from '@/components/ui/BaseCard.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseLabel from '@/components/ui/BaseLabel.vue'
import BaseSelect from '@/components/ui/BaseSelect.vue'
import { useJsonVisualizer } from './useJsonVisualizer'
import { useThemeStore } from '@/stores/theme'
import { storeToRefs } from 'pinia'

const {
  inputJson,
  error,
  visualizationType,
  visualize,
  exportImage,
  loadExample,
  clear,
  initChart,
  dispose
} = useJsonVisualizer()

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
  fontSize: 12,
  tabSize: 2,
}

const chartContainer = ref<HTMLElement | null>(null)

onMounted(() => {
  if (chartContainer.value) {
    initChart(chartContainer.value)
  }
})

onUnmounted(() => {
  dispose()
})
</script>

