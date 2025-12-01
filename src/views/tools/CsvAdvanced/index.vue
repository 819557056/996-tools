<template>
  <div class="h-[calc(100vh-10rem)] flex flex-col gap-4">
    <!-- 工具栏 -->
    <BaseCard class="p-4">
      <div class="flex flex-wrap gap-2 items-center">
        <BaseButton @click="parseCsv" size="sm" variant="default">
          <FileSpreadsheet class="w-4 h-4 mr-1" /> 解析 CSV
        </BaseButton>

        <div class="w-px h-6 bg-border"></div>

        <BaseButton @click="activeTab = 'split'" size="sm" variant="outline" :class="{ 'bg-accent': activeTab === 'split' }">
          <Scissors class="w-4 h-4 mr-1" /> 分割
        </BaseButton>

        <BaseButton @click="activeTab = 'extract'" size="sm" variant="outline" :class="{ 'bg-accent': activeTab === 'extract' }">
          <Columns class="w-4 h-4 mr-1" /> 列操作
        </BaseButton>

        <BaseButton @click="activeTab = 'sql'" size="sm" variant="outline" :class="{ 'bg-accent': activeTab === 'sql' }">
          <Database class="w-4 h-4 mr-1" /> 转 SQL
        </BaseButton>

        <div class="flex-1"></div>

        <!-- 统计信息 -->
        <div v-if="isParsed" class="flex items-center gap-3 text-sm text-muted-foreground">
          <span>{{ stats.rows }} 行</span>
          <span>{{ stats.columns }} 列</span>
          <span>{{ formatSize(stats.size) }}</span>
        </div>

        <BaseButton @click="loadExample" size="sm" variant="outline">
          示例
        </BaseButton>

        <BaseButton @click="clear" size="sm" variant="destructive">
          <Trash2 class="w-4 h-4 mr-1" /> 清空
        </BaseButton>
      </div>

      <!-- 错误提示 -->
      <div v-if="parseError" class="mt-2 p-2 text-xs text-red-600 bg-red-50 dark:bg-red-900/20 rounded border border-red-200 dark:border-red-800">
        {{ parseError }}
      </div>
    </BaseCard>

    <!-- 主内容区 -->
    <div class="flex-1 grid grid-cols-2 gap-4 min-h-0">
      <!-- 左侧：CSV 输入 -->
      <div class="flex flex-col gap-3">
        <BaseCard class="flex-1 flex flex-col min-h-0">
          <div class="p-3 border-b flex items-center justify-between">
            <h3 class="text-sm font-medium">CSV 数据</h3>
            <label class="cursor-pointer">
              <input
                type="file"
                accept=".csv,text/csv"
                @change="handleFileSelect"
                class="hidden"
              />
              <BaseButton size="xs" variant="outline" as="span">
                <Upload class="w-3 h-3 mr-1" /> 上传文件
              </BaseButton>
            </label>
          </div>
          <div 
            class="flex-1 p-3 min-h-0 relative"
            @dragover="onDragOver"
            @dragleave="onDragLeave"
            @drop="onDrop"
          >
            <!-- 拖拽遮罩 -->
            <div 
              v-if="isDragging"
              class="absolute inset-3 border-2 border-dashed border-primary bg-primary/5 rounded flex items-center justify-center z-10 pointer-events-none"
            >
              <div class="text-center">
                <Upload class="w-12 h-12 mx-auto mb-2 text-primary" />
                <p class="text-sm font-medium text-primary">释放以上传 CSV 文件</p>
              </div>
            </div>
            
            <textarea
              v-model="csvContent"
              class="w-full h-full p-2 text-sm font-mono border rounded resize-none focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="粘贴 CSV 数据，拖拽 CSV 文件到此处，或点击右上角上传按钮..."
            ></textarea>
          </div>
        </BaseCard>

        <!-- 数据预览 -->
        <BaseCard v-if="isParsed" class="flex-shrink-0 max-h-64 overflow-hidden flex flex-col">
          <div class="p-2 border-b">
            <h3 class="text-xs font-medium">数据预览（前 5 行）</h3>
          </div>
          <div class="flex-1 overflow-auto">
            <table class="w-full text-xs">
              <thead class="bg-muted sticky top-0">
                <tr>
                  <th v-for="header in csvData.headers" :key="header" class="px-2 py-1 text-left font-medium border-b">
                    {{ header }}
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="(row, idx) in csvData.rows.slice(0, 5)" :key="idx" class="border-b hover:bg-accent/50">
                  <td v-for="header in csvData.headers" :key="header" class="px-2 py-1">
                    {{ row[header] }}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </BaseCard>
      </div>

      <!-- 右侧：操作区 -->
      <div class="flex flex-col gap-3 min-h-0">
        <!-- CSV 分割 -->
        <BaseCard v-if="activeTab === 'split'" class="flex-1 flex flex-col">
          <div class="p-3 border-b">
            <h3 class="text-sm font-medium">CSV 分割</h3>
          </div>
          <div class="flex-1 p-4 space-y-4 overflow-auto">
            <div>
              <BaseLabel class="mb-2">分割方式</BaseLabel>
              <div class="flex gap-2">
                <button
                  @click="splitType = 'lines'"
                  class="flex-1 px-3 py-2 text-sm border rounded transition-colors"
                  :class="splitType === 'lines' ? 'bg-primary text-primary-foreground' : 'hover:bg-accent'"
                >
                  按行数
                </button>
                <button
                  @click="splitType = 'size'"
                  class="flex-1 px-3 py-2 text-sm border rounded transition-colors"
                  :class="splitType === 'size' ? 'bg-primary text-primary-foreground' : 'hover:bg-accent'"
                >
                  按大小
                </button>
              </div>
            </div>

            <div>
              <BaseLabel class="mb-2">
                {{ splitType === 'lines' ? '每个文件行数' : '每个文件大小 (KB)' }}
              </BaseLabel>
              <BaseInput v-model.number="splitValue" type="number" :min="1" />
            </div>

            <div class="pt-2">
              <BaseButton @click="handleSplit" class="w-full">
                <Scissors class="w-4 h-4 mr-1" /> 开始分割
              </BaseButton>
            </div>

            <!-- 分割结果 -->
            <div v-if="splitResults.length > 0" class="pt-3 border-t">
              <div class="text-sm font-medium mb-2">分割结果（{{ splitResults.length }} 个文件）</div>
              <div class="space-y-2">
                <div v-for="(file, idx) in splitResults" :key="idx" class="flex items-center gap-2 p-2 border rounded text-xs">
                  <FileText class="w-4 h-4 flex-shrink-0" />
                  <span class="flex-1">part_{{ idx + 1 }}.csv</span>
                  <span class="text-muted-foreground">{{ getFileSize(file) }}</span>
                </div>
                <div class="text-xs text-muted-foreground px-2 py-1">
                  💡 所有文件将打包为一个 ZIP 压缩包下载
                </div>
                <BaseButton @click="downloadSplitFiles(splitResults)" size="sm" class="w-full">
                  <Download class="w-4 h-4 mr-1" /> 下载 ZIP 压缩包
                </BaseButton>
              </div>
            </div>
          </div>
        </BaseCard>

        <!-- 列提取与重排 -->
        <BaseCard v-if="activeTab === 'extract'" class="flex-1 flex flex-col">
          <div class="p-3 border-b">
            <h3 class="text-sm font-medium">列提取与重排</h3>
          </div>
          <div class="flex-1 p-4 space-y-4 overflow-auto">
            <div v-if="!isParsed" class="text-sm text-muted-foreground text-center py-8">
              请先解析 CSV 数据
            </div>
            <div v-else>
              <BaseLabel class="mb-2">选择列（勾选后可拖拽排序）</BaseLabel>
              <div class="text-xs text-muted-foreground mb-2 flex items-center gap-1">
                💡 提示：勾选的列可以拖动 
                <GripVertical class="w-3 h-3 inline" />
                 图标来调整顺序
              </div>
              <div class="space-y-2 max-h-64 overflow-auto">
                <div
                  v-for="(header, idx) in csvData.headers"
                  :key="header"
                  :draggable="selectedColumns.includes(header)"
                  @dragstart="onColumnDragStart(idx, header)"
                  @dragover.prevent="onColumnDragOver(idx)"
                  @drop="onColumnDrop(idx)"
                  @dragend="onColumnDragEnd"
                  class="flex items-center gap-2 p-2 border rounded transition-all"
                  :class="{
                    'hover:bg-accent/50': !isDraggingColumn,
                    'cursor-move': selectedColumns.includes(header),
                    'bg-primary/10 border-primary': draggedColumnIndex === idx,
                    'border-t-2 border-t-primary': dropTargetIndex === idx && draggedColumnIndex !== idx
                  }"
                >
                  <input
                    type="checkbox"
                    :checked="selectedColumns.includes(header)"
                    @change="toggleColumn(header)"
                    class="w-4 h-4"
                  />
                  <span class="flex-1 text-sm">{{ header }}</span>
                  <GripVertical 
                    class="w-4 h-4 text-muted-foreground transition-colors"
                    :class="selectedColumns.includes(header) ? 'cursor-move text-primary' : 'opacity-30'"
                  />
                </div>
              </div>

              <div class="pt-3">
                <BaseButton @click="handleExtract" class="w-full" :disabled="selectedColumns.length === 0">
                  <Columns class="w-4 h-4 mr-1" /> 提取选中列
                </BaseButton>
              </div>

              <!-- 提取结果 -->
              <div v-if="extractResult" class="pt-3 border-t">
                <div class="text-sm font-medium mb-2">提取结果</div>
                <textarea
                  :value="extractResult"
                  readonly
                  class="w-full h-32 p-2 text-xs font-mono border rounded bg-muted"
                ></textarea>
                <div class="flex gap-2 mt-2">
                  <BaseButton @click="copyToClipboard(extractResult)" size="sm" class="flex-1">
                    <Copy class="w-4 h-4 mr-1" /> 复制
                  </BaseButton>
                  <BaseButton @click="downloadFile(extractResult, 'extracted.csv')" size="sm" class="flex-1">
                    <Download class="w-4 h-4 mr-1" /> 下载
                  </BaseButton>
                </div>
              </div>
            </div>
          </div>
        </BaseCard>

        <!-- 转 SQL -->
        <BaseCard v-if="activeTab === 'sql'" class="flex-1 flex flex-col min-h-0">
          <div class="p-3 border-b">
            <h3 class="text-sm font-medium">转 SQL Insert 语句</h3>
          </div>
          <div class="flex-1 p-4 space-y-4 overflow-auto">
            <div v-if="!isParsed" class="text-sm text-muted-foreground text-center py-8">
              请先解析 CSV 数据
            </div>
            <div v-else class="space-y-4">
              <div>
                <BaseLabel class="mb-2">表名</BaseLabel>
                <BaseInput v-model="sqlTableName" placeholder="table_name" />
              </div>

              <div>
                <BaseLabel class="mb-2">批量插入大小</BaseLabel>
                <BaseInput v-model.number="sqlBatchSize" type="number" :min="1" />
                <p class="text-xs text-muted-foreground mt-1">
                  设为 1 表示单条插入，大于 1 表示批量插入
                </p>
              </div>

              <div>
                <BaseButton @click="handleSqlGenerate" class="w-full">
                  <Database class="w-4 h-4 mr-1" /> 生成 SQL
                </BaseButton>
              </div>

              <!-- SQL 结果 -->
              <div v-if="sqlResult" class="space-y-2">
                <div class="text-sm font-medium">生成的 SQL</div>
                <textarea
                  :value="sqlResult"
                  readonly
                  class="w-full h-64 p-2 text-xs font-mono border rounded bg-muted overflow-auto"
                ></textarea>
                <div class="flex gap-2">
                  <BaseButton @click="copyToClipboard(sqlResult)" size="sm" class="flex-1">
                    <Copy class="w-4 h-4 mr-1" /> 复制
                  </BaseButton>
                  <BaseButton @click="downloadFile(sqlResult, `${sqlTableName || 'insert'}.sql`)" size="sm" class="flex-1">
                    <Download class="w-4 h-4 mr-1" /> 下载
                  </BaseButton>
                </div>
              </div>
            </div>
          </div>
        </BaseCard>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import {
  FileSpreadsheet, Scissors, Columns, Database, Trash2, Download, Copy,
  FileText, GripVertical, Upload
} from 'lucide-vue-next'
import BaseCard from '@/components/ui/BaseCard.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseLabel from '@/components/ui/BaseLabel.vue'
import BaseInput from '@/components/ui/BaseInput.vue'
import { useCsvAdvanced } from './useCsvAdvanced'
import type { ColumnSelection } from './types'

const {
  csvContent,
  csvData,
  isParsed,
  parseError,
  stats,
  parseCsv,
  splitCsv,
  extractColumns,
  csvToSqlInsert,
  downloadSplitFiles,
  downloadFile,
  copyToClipboard,
  loadExample,
  clear,
  handleDrop,
  handleFileSelect
} = useCsvAdvanced()

// 拖拽状态
const isDragging = ref(false)

// 处理拖拽事件，包装 composable 函数并管理拖拽状态
function onDrop(event: DragEvent) {
  isDragging.value = false
  handleDrop(event)
}

function onDragOver(event: DragEvent) {
  event.preventDefault()
  isDragging.value = true
}

function onDragLeave(event: DragEvent) {
  // 只有当离开整个区域时才重置
  const rect = (event.currentTarget as HTMLElement).getBoundingClientRect()
  const x = event.clientX
  const y = event.clientY
  
  if (x <= rect.left || x >= rect.right || y <= rect.top || y >= rect.bottom) {
    isDragging.value = false
  }
}

// 活动标签
const activeTab = ref<'split' | 'extract' | 'sql'>('split')

// 分割相关
const splitType = ref<'lines' | 'size'>('lines')
const splitValue = ref(100)
const splitResults = ref<string[]>([])

function handleSplit() {
  splitResults.value = splitCsv({ type: splitType.value, value: splitValue.value })
}

// 列提取相关
const selectedColumns = ref<string[]>([])
const extractResult = ref('')

function toggleColumn(column: string) {
  const idx = selectedColumns.value.indexOf(column)
  if (idx > -1) {
    selectedColumns.value.splice(idx, 1)
  } else {
    selectedColumns.value.push(column)
  }
}

// 拖拽排序相关
const draggedColumnIndex = ref<number | null>(null)
const draggedColumnName = ref<string>('')
const dropTargetIndex = ref<number | null>(null)
const isDraggingColumn = ref(false)

function onColumnDragStart(index: number, columnName: string) {
  // 只有选中的列才能拖拽
  if (!selectedColumns.value.includes(columnName)) {
    return
  }
  
  draggedColumnIndex.value = index
  draggedColumnName.value = columnName
  isDraggingColumn.value = true
}

function onColumnDragOver(index: number) {
  if (draggedColumnIndex.value === null) return
  dropTargetIndex.value = index
}

function onColumnDrop(dropIndex: number) {
  if (draggedColumnIndex.value === null || !draggedColumnName.value) return
  
  const dragIndex = draggedColumnIndex.value
  
  if (dragIndex !== dropIndex) {
    // 重新排列 headers 数组
    const headers = [...csvData.value.headers]
    const [draggedItem] = headers.splice(dragIndex, 1)
    headers.splice(dropIndex, 0, draggedItem)
    csvData.value.headers = headers
    
    // 如果该列被选中，更新 selectedColumns 中的引用
    // 不需要特别处理，因为我们是通过列名而不是索引来引用的
  }
  
  onColumnDragEnd()
}

function onColumnDragEnd() {
  draggedColumnIndex.value = null
  draggedColumnName.value = ''
  dropTargetIndex.value = null
  isDraggingColumn.value = false
}

function handleExtract() {
  // 按照 headers 数组的顺序来提取选中的列
  const orderedSelectedColumns = csvData.value.headers.filter(
    header => selectedColumns.value.includes(header)
  )
  
  const selections: ColumnSelection[] = orderedSelectedColumns.map((col, idx) => ({
    column: col,
    order: idx
  }))
  
  extractResult.value = extractColumns(selections)
}

// SQL 生成相关
const sqlTableName = ref('my_table')
const sqlBatchSize = ref(1)
const sqlResult = ref('')

function handleSqlGenerate() {
  sqlResult.value = csvToSqlInsert({
    tableName: sqlTableName.value,
    includeColumns: [],
    batchSize: sqlBatchSize.value
  })
}

// 工具函数
function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function getFileSize(content: string): string {
  // 计算字符串的字节大小（UTF-8编码）
  const bytes = new TextEncoder().encode(content).length
  return formatSize(bytes)
}
</script>

