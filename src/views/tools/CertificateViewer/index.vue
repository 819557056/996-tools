<template>
  <div class="max-w-6xl mx-auto space-y-6">
    <!-- 输入区域 -->
    <BaseCard class="p-6">
      <div class="flex justify-between items-start mb-4">
        <div>
          <h2 class="text-xl font-semibold flex items-center gap-2">
            <FileText class="h-5 w-5" />
            证书输入
          </h2>
          <p class="text-sm text-muted-foreground mt-1">
            支持 PEM、Base64、HEX 格式，或直接上传文件 (.crt, .cer, .pem, .der)
          </p>
        </div>
        <div class="flex gap-2">
          
          <BaseButton 
            variant="outline" 
            size="sm"
            @click="clearAll" 
            :disabled="!input && !certificateInfo"
          >
            <X class="mr-2 h-4 w-4" />
            清空
          </BaseButton>
        </div>
      </div>

      <!-- 输入控件 -->
      <div class="space-y-4">
        <!-- 模式切换 -->
        <div class="flex gap-6 text-sm">
          <label class="flex items-center cursor-pointer">
            <input v-model="inputMode" type="radio" value="text" class="mr-2" />
            <span>文本输入</span>
          </label>
          <label class="flex items-center cursor-pointer">
            <input v-model="inputMode" type="radio" value="file" class="mr-2" />
            <span>文件上传</span>
          </label>
        </div>

        <!-- 文本输入 -->
        <div v-if="inputMode === 'text'" class="space-y-4">
          <div
            class="relative border-2 border-dashed rounded-lg transition-colors"
            :class="isDragging ? 'border-primary bg-primary/5' : 'border-border'"
            @dragover.prevent="handleDragOver"
            @dragleave.prevent="handleDragLeave"
            @drop.prevent="handleDrop"
          >
            <BaseTextarea
              v-model="input"
              placeholder="在此粘贴证书内容，或拖放文件..."
              :rows="showInput ? 6 : 2"
              class="border-0 font-mono text-xs resize-y"
              @focus="showInput = true"
            />
          </div>
          <div class="flex justify-end">
            <BaseButton @click="parseCert" :disabled="!input.trim()">
              <RefreshCw class="mr-2 h-4 w-4" />
              解析证书
            </BaseButton>
          </div>
        </div>

        <!-- 文件上传 -->
        <div v-else class="space-y-4">
          <div
            class="border-2 border-dashed rounded-lg p-8 text-center transition-colors cursor-pointer hover:border-primary/50"
            :class="isDragging ? 'border-primary bg-primary/5' : 'border-border'"
            @dragover.prevent="handleDragOver"
            @dragleave.prevent="handleDragLeave"
            @drop.prevent="handleDrop"
            @click="triggerFileInput"
          >
            <Upload class="mx-auto h-10 w-10 text-muted-foreground mb-3" />
            <div class="text-sm font-medium">点击或拖放文件到此处</div>
            <div v-if="fileName" class="text-sm text-primary mt-2 font-mono bg-primary/10 inline-block px-2 py-1 rounded">
              {{ fileName }}
            </div>
          </div>
          <input
            ref="fileInputRef"
            type="file"
            accept=".crt,.cer,.pem,.der"
            class="hidden"
            @change="onFileChange"
          />
        </div>
      </div>

      <!-- 错误信息 -->
      <div v-if="errorMessage" class="mt-4 p-3 bg-destructive/10 border border-destructive/20 rounded text-sm flex items-center gap-2 text-destructive">
        <AlertCircle class="h-4 w-4 flex-shrink-0" />
        {{ errorMessage }}
      </div>
    </BaseCard>

    <!-- 证书展示区域 -->
    <div v-if="certificateInfo" class="grid grid-cols-1 gap-6">
      <!-- 顶部状态栏 -->
      <BaseCard class="p-4 flex items-center justify-between bg-card">
        <div class="flex items-center gap-4">
          <div class="p-3 rounded-full" :class="isValidCert ? 'bg-green-100 dark:bg-green-900/30' : 'bg-red-100 dark:bg-red-900/30'">
            <CheckCircle v-if="isValidCert" class="h-8 w-8 text-green-600 dark:text-green-400" />
            <AlertCircle v-else class="h-8 w-8 text-red-600 dark:text-red-400" />
          </div>
          <div>
            <h1 class="text-lg font-bold">{{ certificateInfo.subject.CN || '未知证书' }}</h1>
            <div class="flex gap-2 text-xs mt-1">
              <span class="px-2 py-0.5 rounded bg-muted font-mono text-muted-foreground">
                {{ certificateInfo.serialNumber }}
              </span>
              <span v-if="isSM2" class="px-2 py-0.5 rounded bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 font-medium">
                国密 SM2
              </span>
            </div>
          </div>
        </div>
        <div class="text-right text-sm">
          <div :class="isValidCert ? 'text-green-600' : 'text-red-600'" class="font-medium">
            {{ isValidCert ? '证书有效' : '证书无效/过期' }}
          </div>
          <div class="text-muted-foreground text-xs mt-1">
            {{ formatDate(certificateInfo.validTo) }} 到期
          </div>
        </div>
      </BaseCard>

      <!-- 主要内容 Tabs -->
      <div class="bg-card rounded-xl border shadow-sm overflow-hidden flex flex-col h-[600px]">
        <!-- Tab Headers -->
        <div class="flex border-b bg-muted/30">
          <button
            v-for="tab in tabs"
            :key="tab.value"
            @click="activeTab = tab.value"
            class="px-6 py-3 text-sm font-medium transition-all border-r last:border-r-0 hover:bg-background focus:outline-none"
            :class="activeTab === tab.value ? 'bg-background text-primary border-b-2 border-b-primary -mb-[2px]' : 'text-muted-foreground'"
          >
            {{ tab.label }}
          </button>
        </div>

        <!-- Tab Content -->
        <div class="flex-1 overflow-hidden relative">
          
          <!-- 常规信息 -->
          <div v-if="activeTab === 'general'" class="p-6 overflow-y-auto h-full space-y-6">
            <div class="grid md:grid-cols-2 gap-6">
              <!-- 颁发给 -->
              <div class="space-y-3">
                <h3 class="text-sm font-semibold text-muted-foreground uppercase tracking-wider">颁发给</h3>
                <div class="bg-muted/30 p-4 rounded-lg border space-y-2">
                  <div class="flex justify-between">
                    <span class="text-muted-foreground text-sm">通用名称 (CN)</span>
                    <span class="font-medium text-sm">{{ certificateInfo.subject.CN || '-' }}</span>
                  </div>
                  <div class="flex justify-between">
                    <span class="text-muted-foreground text-sm">组织 (O)</span>
                    <span class="font-medium text-sm">{{ certificateInfo.subject.O || '-' }}</span>
                  </div>
                  <div class="flex justify-between">
                    <span class="text-muted-foreground text-sm">部门 (OU)</span>
                    <span class="font-medium text-sm">{{ certificateInfo.subject.OU || '-' }}</span>
                  </div>
                </div>
              </div>

              <!-- 颁发者 -->
              <div class="space-y-3">
                <h3 class="text-sm font-semibold text-muted-foreground uppercase tracking-wider">颁发者</h3>
                <div class="bg-muted/30 p-4 rounded-lg border space-y-2">
                  <div class="flex justify-between">
                    <span class="text-muted-foreground text-sm">通用名称 (CN)</span>
                    <span class="font-medium text-sm">{{ certificateInfo.issuer.CN || '-' }}</span>
                  </div>
                  <div class="flex justify-between">
                    <span class="text-muted-foreground text-sm">组织 (O)</span>
                    <span class="font-medium text-sm">{{ certificateInfo.issuer.O || '-' }}</span>
                  </div>
                  <div class="flex justify-between">
                    <span class="text-muted-foreground text-sm">部门 (OU)</span>
                    <span class="font-medium text-sm">{{ certificateInfo.issuer.OU || '-' }}</span>
                  </div>
                </div>
              </div>
            </div>

            <div class="grid md:grid-cols-2 gap-6">
              <!-- 有效期 -->
              <div class="space-y-3">
                <h3 class="text-sm font-semibold text-muted-foreground uppercase tracking-wider">有效期</h3>
                <div class="bg-muted/30 p-4 rounded-lg border space-y-2">
                  <div class="flex justify-between">
                    <span class="text-muted-foreground text-sm">颁发日期</span>
                    <span class="font-medium text-sm">{{ formatDate(certificateInfo.validFrom) }}</span>
                  </div>
                  <div class="flex justify-between">
                    <span class="text-muted-foreground text-sm">截止日期</span>
                    <span class="font-medium text-sm">{{ formatDate(certificateInfo.validTo) }}</span>
                  </div>
                </div>
              </div>

              <!-- 指纹 -->
              <div class="space-y-3">
                <h3 class="text-sm font-semibold text-muted-foreground uppercase tracking-wider">SHA-1 指纹</h3>
                <div class="bg-muted/30 p-4 rounded-lg border font-mono text-xs break-all">
                  {{ certificateInfo.fingerprints.sha1 }}
                </div>
              </div>
            </div>
          </div>

          <!-- 详细信息 (Windows 风格列表) -->
          <div v-else-if="activeTab === 'details'" class="flex flex-col h-full">
            <!-- 列表区 -->
            <div class="flex-1 overflow-y-auto border-b">
              <table class="w-full text-sm text-left">
                <thead class="bg-muted/50 text-xs uppercase text-muted-foreground sticky top-0 z-10 backdrop-blur-sm">
                  <tr>
                    <th class="px-4 py-2 font-medium w-1/3">字段</th>
                    <th class="px-4 py-2 font-medium">值</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-border">
                  <tr 
                    v-for="(item, idx) in detailItems" 
                    :key="idx"
                    @click="selectedDetail = item"
                    class="cursor-pointer hover:bg-muted/50 transition-colors"
                    :class="selectedDetail === item ? 'bg-primary/10 hover:bg-primary/15' : ''"
                  >
                    <td class="px-4 py-2 font-medium flex items-center gap-2">
                      <span v-if="item.critical" class="text-yellow-500" title="关键扩展">⚠️</span>
                      {{ item.label }}
                    </td>
                    <td class="px-4 py-2 text-muted-foreground truncate max-w-[300px] font-mono text-xs">
                      {{ item.previewValue }}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <!-- 详情展示区 -->
            <div class="h-[200px] bg-muted/10 p-4 flex flex-col border-t">
              <div class="flex justify-between items-center mb-2">
                <span class="text-xs font-semibold text-muted-foreground">
                  {{ selectedDetail?.label || '选择一项查看详情' }}
                </span>
                <BaseButton 
                  v-if="selectedDetail" 
                  variant="ghost" 
                  size="sm" 
                  @click="copyText(selectedDetail.fullValue, selectedDetail.label)"
                >
                  <Clipboard class="h-3 w-3 mr-1" />
                  复制
                </BaseButton>
              </div>
              <textarea
                readonly
                class="w-full h-full bg-transparent border rounded p-2 font-mono text-xs resize-none focus:outline-none focus:ring-1 focus:ring-primary"
                :value="selectedDetail?.fullValue || ''"
              ></textarea>
            </div>
          </div>

          <!-- 原始数据 -->
          <div v-else-if="activeTab === 'raw'" class="p-6 overflow-y-auto h-full space-y-6">
            <div>
              <div class="flex justify-between items-center mb-2">
                <h3 class="text-sm font-semibold">PEM 格式</h3>
                <BaseButton variant="outline" size="sm" @click="copyText(certificateInfo.raw.pem, 'PEM')">
                  <Clipboard class="h-3 w-3 mr-1" /> 复制
                </BaseButton>
              </div>
              <BaseTextarea :value="certificateInfo.raw.pem" readonly :rows="12" class="font-mono text-xs" />
            </div>
            <div>
              <div class="flex justify-between items-center mb-2">
                <h3 class="text-sm font-semibold">DER (Hex)</h3>
                <BaseButton variant="outline" size="sm" @click="copyText(certificateInfo.raw.der, 'DER')">
                  <Clipboard class="h-3 w-3 mr-1" /> 复制
                </BaseButton>
              </div>
              <BaseTextarea :value="certificateInfo.raw.der" readonly :rows="8" class="font-mono text-xs" />
            </div>
          </div>

        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { 
  FileText, Upload, BookOpen, X, AlertCircle, CheckCircle, Clipboard, RefreshCw 
} from 'lucide-vue-next'
import BaseCard from '@/components/ui/BaseCard.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseTextarea from '@/components/ui/BaseTextarea.vue'
import { useCertificateViewer } from './useCertificateViewer'

const {
  input,
  inputMode,
  showInput,
  certificateInfo,
  errorMessage,
  activeTab,
  fileName,
  selectedDetail,
  tabs,
  isValidCert,
  isSM2,
  detailItems,
  parseCert,
  loadExample,
  handleFileUpload,
  clearAll,
  copyText,
  formatDate
} = useCertificateViewer()

// UI State
const fileInputRef = ref<HTMLInputElement>()
const isDragging = ref(false)

// UI Handlers
function onFileChange(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (file) {
    handleFileUpload(file)
  }
}

function triggerFileInput() {
  fileInputRef.value?.click()
}

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
  const file = e.dataTransfer?.files[0]
  if (file) {
    handleFileUpload(file)
  }
}
</script>

