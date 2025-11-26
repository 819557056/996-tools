<template>
  <div class="h-[calc(100vh-12rem)] min-h-[600px] flex flex-col gap-4">
    <!-- 顶部说明/标题 -->
    <BaseCard class="p-4 flex-none">
      <h1 class="text-2xl font-bold mb-2">{{ t('tools.transcoding.title', '编码转换') }}</h1>
      <p class="text-sm text-muted-foreground">
        {{ t('tools.transcoding.description', '专业的现代化编码转换工具，支持 GBK/UTF-8 互转，Base64/Hex/Text 格式转换。') }}
      </p>
    </BaseCard>

    <!-- 主体区域 -->
    <div class="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-4 min-h-0">
      <!-- 左侧：输入区 -->
      <BaseCard class="p-4 flex flex-col h-full min-h-[400px]">
        <div class="flex flex-wrap items-center justify-between gap-2 mb-4">
          <div class="flex items-center gap-2">
            <BaseLabel class="mb-0 whitespace-nowrap">输入格式</BaseLabel>
            <div class="flex bg-muted p-1 rounded-md">
              <button
                v-for="fmt in formats"
                :key="fmt.value"
                @click="inputFormat = fmt.value"
                class="px-3 py-1 text-sm rounded-sm transition-all"
                :class="inputFormat === fmt.value ? 'bg-background shadow text-foreground' : 'text-muted-foreground hover:text-foreground'"
              >
                {{ fmt.label }}
              </button>
            </div>
          </div>
          
          <div class="flex items-center gap-2" v-if="inputFormat === 'text'">
            <BaseLabel class="mb-0 whitespace-nowrap">编码</BaseLabel>
            <BaseSelect v-model="inputEncoding" class="w-24 h-9 text-sm">
              <option value="utf-8">UTF-8</option>
              <option value="gbk">GBK</option>
            </BaseSelect>
          </div>
        </div>

        <div 
          class="relative flex-1 min-h-0"
          @dragover.prevent="isDragging = true"
          @dragleave.prevent="isDragging = false"
          @drop.prevent="handleDrop"
        >
          <BaseTextarea
            v-model="inputContent"
            class="h-full font-mono text-sm resize-none"
            :placeholder="t('common.placeholder')"
          />
          
          <!-- 拖拽遮罩 -->
          <div 
            v-if="isDragging"
            class="absolute inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center border-2 border-dashed border-primary rounded-md z-10 pointer-events-none"
          >
            <p class="text-lg font-medium text-primary">释放文件以加载内容</p>
          </div>
        </div>
        
        <div class="mt-2 text-xs text-muted-foreground flex justify-between">
           <span>支持拖拽文件</span>
           <span>{{ inputLengthInfo }}</span>
        </div>
      </BaseCard>

      <!-- 右侧：输出区 -->
      <BaseCard class="p-4 flex flex-col h-full min-h-[400px]">
        <div class="flex flex-wrap items-center justify-between gap-2 mb-4">
          <div class="flex items-center gap-2">
            <BaseLabel class="mb-0 whitespace-nowrap">输出格式</BaseLabel>
            <div class="flex bg-muted p-1 rounded-md">
              <button
                v-for="fmt in outputFormats"
                :key="fmt.value"
                @click="outputFormat = fmt.value"
                class="px-3 py-1 text-sm rounded-sm transition-all"
                :class="outputFormat === fmt.value ? 'bg-background shadow text-foreground' : 'text-muted-foreground hover:text-foreground'"
              >
                {{ fmt.label }}
              </button>
            </div>
          </div>

          <div class="flex items-center gap-2" v-if="outputFormat === 'text' || outputFormat === 'der'">
             <div class="flex items-center gap-2" v-if="outputFormat === 'text'">
              <BaseLabel class="mb-0 whitespace-nowrap">编码</BaseLabel>
              <BaseSelect v-model="outputEncoding" class="w-24 h-9 text-sm">
                <option value="utf-8">UTF-8</option>
                <option value="gbk">GBK</option>
              </BaseSelect>
            </div>
            <div v-if="outputFormat === 'der'">
               <BaseButton size="sm" @click="handleDownload">
                 <Download class="w-4 h-4 mr-1"/> 下载
               </BaseButton>
            </div>
          </div>
        </div>

        <div class="relative flex-1 min-h-0">
          <BaseTextarea
            :value="outputContent"
            readonly
            class="h-full font-mono text-sm resize-none bg-muted/30"
            placeholder="结果将显示在这里..."
          />
          <div v-if="error" class="absolute inset-0 flex items-center justify-center pointer-events-none">
             <div class="bg-destructive/10 text-destructive p-4 rounded-md backdrop-blur-sm max-w-[80%] text-center">
               {{ error }}
             </div>
          </div>
        </div>

        <div class="mt-2 flex justify-between items-center">
          <span class="text-xs text-muted-foreground">{{ outputLengthInfo }}</span>
          <div class="flex items-center gap-2">
            <BaseButton
              v-if="outputFormat === 'hex'"
              variant="outline"
              size="sm"
              @click="copyOutput(true)"
              :disabled="!outputContent"
              title="压缩复制（无空格换行）"
            >
              <Minimize2 class="w-4 h-4" />
            </BaseButton>
            <BaseButton
              variant="outline"
              size="sm"
              @click="copyOutput(false)"
              :disabled="!outputContent"
              :title="outputFormat === 'hex' ? '格式化复制' : t('common.copy')"
            >
              <Clipboard class="w-4 h-4" v-if="outputFormat !== 'hex'" />
              <AlignJustify class="w-4 h-4" v-else />
              <span v-if="outputFormat !== 'hex'" class="ml-1">{{ t('common.copy') }}</span>
            </BaseButton>
          </div>
        </div>
      </BaseCard>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { Clipboard, Download, AlignJustify, Minimize2 } from 'lucide-vue-next'
import BaseCard from '@/components/ui/BaseCard.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseTextarea from '@/components/ui/BaseTextarea.vue'
import BaseLabel from '@/components/ui/BaseLabel.vue'
import BaseSelect from '@/components/ui/BaseSelect.vue'
import { useTranscoding } from './useTranscoding'

const {
  t,
  formats,
  outputFormats,
  inputContent,
  inputFormat,
  inputEncoding,
  outputFormat,
  outputEncoding,
  error,
  inputLengthInfo,
  outputLengthInfo,
  outputContent,
  handleDownload,
  copyOutput,
  handleFileLoad
} = useTranscoding()

// UI State local to component (dragging is UI interaction)
const isDragging = ref(false)

function handleDrop(e: DragEvent) {
  isDragging.value = false
  const files = e.dataTransfer?.files
  if (!files || files.length === 0) return

  const file = files[0]
  const reader = new FileReader()
  
  reader.onload = (e) => {
    const result = e.target?.result as ArrayBuffer
    if (result) {
      handleFileLoad(file, result)
    }
  }
  
  reader.readAsArrayBuffer(file)
}
</script>

