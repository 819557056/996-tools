<template>
  <div class="max-w-6xl mx-auto">
    <!-- 标题区域 -->
    <div class="mb-6">
      <h1 class="text-2xl font-bold mb-2">{{ t('tools.binary-viewer.title') }}</h1>
      <p class="text-sm text-muted-foreground">
        {{ t('tools.binary-viewer.description') }}
      </p>
    </div>

    <BaseCard class="p-6">
      <!-- 控制栏：每行字节数、偏移量、操作按钮 -->
      <div class="flex flex-wrap items-end gap-4 mb-4">
        <!-- 每行字节数 -->
        <div class="flex-1 min-w-[150px] space-y-2">
          <BaseLabel for="bytesPerLine">{{ t('tools.binary-viewer.bytesPerLine') }}</BaseLabel>
          <BaseInput
            id="bytesPerLine"
            v-model.number="bytesPerLine"
            type="number"
            min="8"
            max="32"
            step="8"
            :placeholder="t('tools.binary-viewer.bytesPerLinePlaceholder')"
          />
        </div>

        <!-- 起始偏移 -->
        <div class="flex-1 min-w-[150px] space-y-2">
          <BaseLabel for="startOffset">{{ t('tools.binary-viewer.startOffset') }}</BaseLabel>
          <BaseInput
            id="startOffset"
            v-model.number="startOffset"
            type="number"
            min="0"
            :placeholder="t('tools.binary-viewer.startOffsetPlaceholder')"
          />
        </div>

        <!-- 操作按钮 -->
        <div class="flex gap-2">
          <BaseButton
            variant="outline"
            size="default"
            @click="copyToClipboard"
            :disabled="!hexOutput"
          >
            <Clipboard class="h-4 w-4 mr-2" />
            {{ t('tools.binary-viewer.copy') }}
          </BaseButton>
          <BaseButton
            variant="outline"
            size="default"
            @click="handleClear"
            :disabled="!hexOutput && !fileInput && !textInput"
          >
            <X class="h-4 w-4 mr-2" />
            {{ t('tools.binary-viewer.clear') }}
          </BaseButton>
        </div>
      </div>

      <!-- 主显示区域：上传或输出 -->
      <div class="min-h-[400px]">
        <div v-if="!hexOutput">
          <!-- 模式切换 -->
          <div class="flex gap-6 text-sm mb-4">
            <label class="flex items-center cursor-pointer">
              <input v-model="inputMode" type="radio" value="file" class="mr-2" />
              <span>{{ t('tools.binary-viewer.modeFile') }}</span>
            </label>
            <label class="flex items-center cursor-pointer">
              <input v-model="inputMode" type="radio" value="text" class="mr-2" />
              <span>{{ t('tools.binary-viewer.modeText') }}</span>
            </label>
          </div>

          <!-- 文本输入 -->
          <div v-if="inputMode === 'text'" class="space-y-4">
            <BaseTextarea
              v-model="textInput"
              :placeholder="t('tools.binary-viewer.textInputPlaceholder')"
              :rows="12"
              class="font-mono text-xs"
            />
            <div class="flex justify-end">
              <BaseButton @click="processInput" :disabled="!textInput">
                <RefreshCw class="mr-2 h-4 w-4" />
                {{ t('tools.binary-viewer.process') }}
              </BaseButton>
            </div>
          </div>

          <!-- 文件上传 -->
          <div 
            v-else
            class="border-2 border-dashed rounded-lg p-12 text-center transition-colors cursor-pointer h-[400px] flex flex-col items-center justify-center"
            :class="isDragging ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'"
            @click="triggerFileInput"
            @dragover.prevent="handleDragOver"
            @dragleave.prevent="handleDragLeave"
            @drop.prevent="handleDrop"
          >
            <input 
              ref="fileInputRef"
              type="file"
              class="hidden"
              @change="handleFileChange"
            />
            <Upload class="mx-auto h-16 w-16 text-muted-foreground mb-4" />
            <p class="text-base text-foreground font-medium mb-2">
              {{ t('tools.binary-viewer.uploadHint') }}
            </p>
            <p v-if="fileInput" class="text-sm text-primary font-medium mt-2">
              {{ fileInput.name }} ({{ formatFileSize(fileInput.size) }})
            </p>
            <BaseButton v-else variant="outline" size="default" class="mt-4">
              {{ t('tools.binary-viewer.selectFile') }}
            </BaseButton>
          </div>
        </div>

        <!-- 输出区域（有输出时显示） -->
        <div v-else class="hex-viewer">
          <pre>{{ hexOutput }}</pre>
        </div>
      </div>
    </BaseCard>

    <!-- 关于说明 -->
    <BaseCard class="mt-6 p-6">
      <div class="space-y-3 text-sm">
        <p class="font-semibold text-base">{{ t('tools.binary-viewer.about.title') }}</p>
        
        <div>
          <p class="font-medium mb-2">{{ t('tools.binary-viewer.about.format') }}</p>
          <ul class="list-disc list-inside space-y-1 text-muted-foreground ml-2">
            <li>{{ t('tools.binary-viewer.about.formatItem1') }}</li>
            <li>{{ t('tools.binary-viewer.about.formatItem2') }}</li>
            <li>{{ t('tools.binary-viewer.about.formatItem3') }}</li>
          </ul>
        </div>
        
        <div>
          <p class="font-medium mb-2">{{ t('tools.binary-viewer.about.usage') }}</p>
          <ul class="list-disc list-inside space-y-1 text-muted-foreground ml-2">
            <li>{{ t('tools.binary-viewer.about.usageItem1') }}</li>
            <li>{{ t('tools.binary-viewer.about.usageItem2') }}</li>
            <li>{{ t('tools.binary-viewer.about.usageItem3') }}</li>
          </ul>
        </div>
      </div>
    </BaseCard>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { Clipboard, Upload, X, FileText, RefreshCw } from 'lucide-vue-next'
import BaseCard from '@/components/ui/BaseCard.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseInput from '@/components/ui/BaseInput.vue'
import BaseLabel from '@/components/ui/BaseLabel.vue'
import BaseTextarea from '@/components/ui/BaseTextarea.vue'
import { useBinaryViewer } from './useBinaryViewer'

const { 
  t, 
  inputMode,
  fileInput, 
  textInput,
  hexOutput, 
  bytesPerLine, 
  startOffset, 
  processInput, 
  copyToClipboard, 
  clearAll, 
  formatFileSize 
} = useBinaryViewer()

// ========== UI State ==========
const fileInputRef = ref<HTMLInputElement>()
const isDragging = ref(false)

// ========== UI Interaction ==========
function triggerFileInput() {
  fileInputRef.value?.click()
}

async function handleFileChange(event: Event) {
  const target = event.target as HTMLInputElement
  const file = target.files?.[0]
  if (file) {
    fileInput.value = file
    await processInput()
  }
}

function handleDragOver(event: DragEvent) {
  event.preventDefault()
  isDragging.value = true
}

function handleDragLeave(event: DragEvent) {
  event.preventDefault()
  isDragging.value = false
}

async function handleDrop(event: DragEvent) {
  event.preventDefault()
  isDragging.value = false
  
  const file = event.dataTransfer?.files[0]
  if (file) {
    fileInput.value = file
    await processInput()
  }
}

function handleClear() {
  clearAll()
  if (fileInputRef.value) {
    fileInputRef.value.value = ''
  }
}
</script>

<style scoped>
.hex-viewer {
  @apply bg-muted rounded-lg p-4 overflow-x-auto min-h-[400px] max-h-[600px];
}

.hex-viewer pre {
  @apply m-0 font-mono text-xs leading-relaxed whitespace-pre;
}

/* 深色模式样式 */
:root.dark .hex-viewer {
  @apply bg-zinc-900;
}

:root.dark .hex-viewer pre {
  @apply text-zinc-300;
}
</style>

