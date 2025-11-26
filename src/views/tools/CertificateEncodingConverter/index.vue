<template>
  <div class="w-full">
    <BaseCard class="p-6">
      <!-- 标题区域 -->
      <div class="mb-6">
        <h1 class="text-2xl font-bold mb-2">{{ t('tools.certificate-encoding-converter.title') }}</h1>
        <p class="text-sm text-muted-foreground">
          {{ t('tools.certificate-encoding-converter.description') }}
        </p>
      </div>

      <!-- 主要内容区域 - 使用三栏布局 -->
      <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <!-- 左侧：输入区域 -->
        <div class="space-y-3">
          <div class="flex justify-between items-center">
            <BaseLabel>{{ t('tools.certificate-encoding-converter.input') }}</BaseLabel>
            <span 
              v-if="detectedInputFormat" 
              class="px-3 py-1 text-sm font-medium rounded-md"
              :class="getFormatBadgeClass(detectedInputFormat)"
            >
              {{ detectedInputFormat }}
            </span>
          </div>
          
          <!-- 文件拖拽区 -->
          <div 
            class="relative border-2 border-dashed rounded-lg transition-colors"
            :class="isDragging ? 'border-primary bg-primary/5' : 'border-border'"
            @dragover="handleDragOver"
            @dragleave="handleDragLeave"
            @drop="handleDrop"
          >
            <div v-if="!input" class="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-muted-foreground z-10 p-4">
              <svg class="w-12 h-12 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <p class="text-sm font-medium">{{ t('tools.certificate-encoding-converter.dropHint') }}</p>
              <p class="text-xs mt-1">{{ t('tools.certificate-encoding-converter.dropHintSub') }}</p>
            </div>
            <BaseTextarea
              v-model="input"
              :placeholder="t('tools.certificate-encoding-converter.inputPlaceholder')"
              :rows="20"
              class="relative z-20"
            />
          </div>
          
          <div v-if="inputFileName" class="flex items-center gap-2 p-2 rounded-md bg-muted text-sm">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
            </svg>
            <span>{{ inputFileName }}</span>
          </div>
        </div>

        <!-- 中间：转换选项 -->
        <div class="space-y-4">
          <div>
            <BaseLabel class="mb-3 block">{{ t('tools.certificate-encoding-converter.targetFormat') }}</BaseLabel>
            
            <div class="space-y-2">
              <label 
                v-for="format in targetFormats" 
                :key="format"
                class="flex items-center justify-between p-4 rounded-lg border cursor-pointer transition-all hover:shadow-md"
                :class="targetFormat === format ? 'border-primary bg-primary/5 shadow-sm' : 'border-border hover:border-primary/50'"
              >
                <div class="flex items-center space-x-3">
                  <input
                    type="radio"
                    :value="format"
                    v-model="targetFormat"
                    class="w-4 h-4 text-primary"
                  />
                  <span class="text-base font-medium">{{ format }}</span>
                </div>
                <span 
                  v-if="targetFormat === format"
                  class="text-xs px-2 py-1 rounded bg-primary/10 text-primary"
                >
                  {{ t('tools.certificate-encoding-converter.selected') }}
                </span>
              </label>
            </div>
          </div>

          <!-- 转换信息提示 -->
          <div v-if="conversionInfo" class="p-3 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
            <div class="flex items-center gap-2 text-sm text-blue-700 dark:text-blue-300">
              <svg class="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>{{ conversionInfo }}</span>
            </div>
          </div>

          <BaseButton
            @click="convert"
            :disabled="!canConvert"
            class="w-full"
          >
            <svg v-if="targetFormat !== 'DER'" class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
            </svg>
            <svg v-else class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            {{ targetFormat === 'DER' ? 
               t('tools.certificate-encoding-converter.downloadDer') : 
               t('tools.certificate-encoding-converter.convert') }}
          </BaseButton>

          <!-- 分隔线 -->
          <div class="flex items-center my-4">
            <div class="flex-1 border-t border-border"></div>
            <span class="px-3 text-xs text-muted-foreground">{{ t('tools.certificate-encoding-converter.downloadSection') }}</span>
            <div class="flex-1 border-t border-border"></div>
          </div>

          <!-- 文件扩展名选择 -->
          <div class="space-y-2">
            <BaseLabel class="text-sm">{{ t('tools.certificate-encoding-converter.fileExtension') }}</BaseLabel>
            <div class="flex gap-2">
              <label 
                v-for="ext in ['crt', 'cer', 'der']" 
                :key="ext"
                class="flex-1 flex items-center justify-center px-3 py-2 rounded-md border cursor-pointer transition-colors text-sm"
                :class="fileExtension === ext ? 'border-primary bg-primary/5 text-primary' : 'border-border hover:bg-accent'"
              >
                <input
                  type="radio"
                  :value="ext"
                  v-model="fileExtension"
                  class="sr-only"
                />
                <span>.{{ ext }}</span>
              </label>
            </div>
          </div>

          <BaseButton
            @click="downloadOutput"
            :disabled="!output"
            variant="outline"
            class="w-full"
          >
            <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            {{ t('tools.certificate-encoding-converter.downloadOutput') }}
          </BaseButton>

          <BaseButton
            @click="clearAll"
            :disabled="!input && !output"
            variant="outline"
            class="w-full"
          >
            <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
            {{ t('tools.certificate-encoding-converter.clearAll') }}
          </BaseButton>

          <div v-if="errorMessage" class="p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
            <div class="flex items-start gap-2">
              <svg class="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div class="text-sm">
                <p class="font-semibold text-red-600 dark:text-red-400">{{ t('tools.certificate-encoding-converter.error') }}</p>
                <p class="text-red-600 dark:text-red-400 mt-1">{{ errorMessage }}</p>
              </div>
            </div>
          </div>
        </div>

        <!-- 右侧：输出区域 -->
        <div class="space-y-3">
          <div class="flex justify-between items-center">
            <BaseLabel>{{ t('tools.certificate-encoding-converter.output') }}</BaseLabel>
            <span 
              v-if="outputFormat" 
              class="px-3 py-1 text-sm font-medium rounded-md"
              :class="getFormatBadgeClass(outputFormat)"
            >
              {{ outputFormat }}
            </span>
          </div>
          <BaseTextarea
            v-model="output"
            :placeholder="t('tools.certificate-encoding-converter.outputPlaceholder')"
            :rows="20"
            readonly
          />
        </div>
      </div>

      <!-- 底部说明 -->
      <div class="mt-8 pt-6 border-t text-sm text-muted-foreground space-y-4">
        <div>
          <h3 class="font-semibold text-foreground mb-2">{{ t('tools.certificate-encoding-converter.about.title') }}</h3>
        </div>
        
        <div>
          <strong class="text-foreground">{{ t('tools.certificate-encoding-converter.about.pemTitle') }}</strong>
          <p class="mt-1">{{ t('tools.certificate-encoding-converter.about.pemDescription') }}</p>
        </div>
        
        <div>
          <strong class="text-foreground">{{ t('tools.certificate-encoding-converter.about.base64Title') }}</strong>
          <p class="mt-1">{{ t('tools.certificate-encoding-converter.about.base64Description') }}</p>
        </div>
        
        <div>
          <strong class="text-foreground">{{ t('tools.certificate-encoding-converter.about.derTitle') }}</strong>
          <p class="mt-1">{{ t('tools.certificate-encoding-converter.about.derDescription') }}</p>
        </div>
        
        <div>
          <strong class="text-foreground">{{ t('tools.certificate-encoding-converter.about.hexTitle') }}</strong>
          <p class="mt-1">{{ t('tools.certificate-encoding-converter.about.hexDescription') }}</p>
        </div>
        
        <div>
          <strong class="text-foreground">{{ t('tools.certificate-encoding-converter.about.usage') }}</strong>
          <ul class="mt-1 ml-5 list-disc space-y-1">
            <li>{{ t('tools.certificate-encoding-converter.about.usageItem1') }}</li>
            <li>{{ t('tools.certificate-encoding-converter.about.usageItem2') }}</li>
            <li>{{ t('tools.certificate-encoding-converter.about.usageItem3') }}</li>
            <li>{{ t('tools.certificate-encoding-converter.about.usageItem4') }}</li>
          </ul>
        </div>
      </div>
    </BaseCard>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import BaseCard from '@/components/ui/BaseCard.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseTextarea from '@/components/ui/BaseTextarea.vue'
import BaseLabel from '@/components/ui/BaseLabel.vue'
import { useCertificateEncodingConverter } from './useCertificateEncodingConverter'

const {
  t,
  input,
  output,
  targetFormat,
  errorMessage,
  inputFileName,
  fileExtension,
  targetFormats,
  detectedInputFormat,
  outputFormat,
  canConvert,
  conversionInfo,
  convert,
  clearAll,
  downloadOutput,
  handleFileLoad,
  getFormatBadgeClass
} = useCertificateEncodingConverter()

// UI State
const isDragging = ref(false)

// UI Handlers
function handleDragOver(e: DragEvent) {
  e.preventDefault()
  isDragging.value = true
}

function handleDragLeave(e: DragEvent) {
  e.preventDefault()
  isDragging.value = false
}

async function handleDrop(e: DragEvent) {
  e.preventDefault()
  isDragging.value = false
  
  const files = e.dataTransfer?.files
  if (!files || files.length === 0) {
    return
  }
  
  await handleFileLoad(files[0])
}
</script>

