<template>
  <div class="max-w-6xl mx-auto">
    <div class="mb-8 text-center">
      <h1 class="text-3xl font-bold mb-2">二维码</h1>
      <p class="text-muted-foreground">
        在线生成二维码，支持文本、网址、WiFi等多种格式，可自定义颜色、Logo和样式
      </p>
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-12 gap-8">
      <!-- Left Column: Controls -->
      <div class="lg:col-span-7 space-y-6">
        <BaseCard class="p-0 overflow-hidden">
          <!-- Type Selection Tabs -->
          <div class="flex border-b overflow-x-auto">
            <button
              v-for="tab in tabs"
              :key="tab.value"
              @click="activeTab = tab.value"
              class="flex items-center px-6 py-4 text-sm font-medium border-b-2 transition-colors whitespace-nowrap"
              :class="[
                activeTab === tab.value
                  ? 'border-primary text-primary bg-primary/5'
                  : 'border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/50'
              ]"
            >
              <component :is="tab.icon" class="w-4 h-4 mr-2" />
              {{ tab.label }}
            </button>
          </div>

          <div class="p-6 space-y-6">
            <!-- Dynamic Content Input -->
            <div v-if="activeTab === 'url'" class="space-y-4">
              <div class="space-y-2">
                <BaseLabel>网址 URL</BaseLabel>
                <BaseInput
                  v-model="content.url"
                  placeholder="https://www.example.com"
                  :error="content.url && !isValidUrl"
                />
                <p v-if="content.url && !isValidUrl" class="text-xs text-destructive">
                  请输入有效的网址，需包含 http:// 或 https://
                </p>
              </div>
            </div>

            <div v-if="activeTab === 'text'" class="space-y-4">
              <div class="space-y-2">
                <BaseLabel>文本内容</BaseLabel>
                <BaseTextarea
                  v-model="content.text"
                  placeholder="请输入要生成二维码的文本内容"
                  rows="4"
                  class="resize-none"
                />
              </div>
            </div>

            <div v-if="activeTab === 'wifi'" class="space-y-4">
              <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div class="space-y-2">
                  <BaseLabel>WiFi 名称 (SSID)</BaseLabel>
                  <BaseInput v-model="content.wifi.ssid" placeholder="WiFi 名称" />
                </div>
                <div class="space-y-2">
                  <BaseLabel>加密方式</BaseLabel>
                  <BaseSelect v-model="content.wifi.encryption">
                    <option value="WPA">WPA/WPA2</option>
                    <option value="WEP">WEP</option>
                    <option value="nopass">无密码</option>
                  </BaseSelect>
                </div>
              </div>
              <div class="space-y-2" v-if="content.wifi.encryption !== 'nopass'">
                <BaseLabel>WiFi 密码</BaseLabel>
                <BaseInput
                  v-model="content.wifi.password"
                  type="text"
                  placeholder="WiFi 密码"
                />
              </div>
              <div class="space-y-2">
                 <label class="flex items-center space-x-2 text-sm">
                  <input type="checkbox" v-model="content.wifi.hidden" class="rounded border-gray-300 text-primary focus:ring-primary" />
                  <span>隐藏网络</span>
                 </label>
              </div>
            </div>
          </div>
        </BaseCard>

        <!-- Styling Options -->
        <BaseCard class="p-6">
          <h3 class="text-lg font-medium mb-4 flex items-center">
            <Settings2 class="w-5 h-5 mr-2" />
            样式设置
          </h3>
          
          <div class="space-y-6">
            <!-- Colors -->
            <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div class="space-y-2">
                <BaseLabel>前景色 (码点)</BaseLabel>
                <div class="flex gap-2">
                  <div class="relative w-10 h-10 overflow-hidden rounded-md border shadow-sm">
                    <input
                      v-model="style.dotsColor"
                      type="color"
                      class="absolute -top-2 -left-2 w-16 h-16 cursor-pointer p-0 border-0"
                    />
                  </div>
                  <BaseInput v-model="style.dotsColor" class="flex-1 font-mono" />
                </div>
              </div>

              <div class="space-y-2">
                <BaseLabel>背景色</BaseLabel>
                <div class="flex gap-2">
                  <div class="relative w-10 h-10 overflow-hidden rounded-md border shadow-sm">
                    <input
                      v-model="style.backgroundColor"
                      type="color"
                      class="absolute -top-2 -left-2 w-16 h-16 cursor-pointer p-0 border-0"
                    />
                  </div>
                  <BaseInput v-model="style.backgroundColor" class="flex-1 font-mono" />
                </div>
              </div>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
               <div class="space-y-2">
                <BaseLabel>码眼颜色 (外框)</BaseLabel>
                <div class="flex gap-2">
                   <div class="relative w-10 h-10 overflow-hidden rounded-md border shadow-sm">
                    <input
                      v-model="style.cornerSquareColor"
                      type="color"
                      class="absolute -top-2 -left-2 w-16 h-16 cursor-pointer p-0 border-0"
                    />
                  </div>
                  <BaseInput v-model="style.cornerSquareColor" class="flex-1 font-mono" />
                </div>
               </div>
               <div class="space-y-2">
                 <BaseLabel>码眼颜色 (内点)</BaseLabel>
                 <div class="flex gap-2">
                   <div class="relative w-10 h-10 overflow-hidden rounded-md border shadow-sm">
                    <input
                      v-model="style.cornerDotColor"
                      type="color"
                      class="absolute -top-2 -left-2 w-16 h-16 cursor-pointer p-0 border-0"
                    />
                  </div>
                  <BaseInput v-model="style.cornerDotColor" class="flex-1 font-mono" />
                 </div>
               </div>
            </div>

            <!-- Appearance -->
            <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div class="space-y-2">
                <BaseLabel>码点样式</BaseLabel>
                <BaseSelect v-model="style.dotsType">
                  <option value="square">方块 (Square)</option>
                  <option value="dots">圆点 (Dots)</option>
                  <option value="rounded">圆角 (Rounded)</option>
                  <option value="classy">优雅 (Classy)</option>
                  <option value="classy-rounded">优雅圆角 (Classy Rounded)</option>
                  <option value="extra-rounded">超圆角 (Extra Rounded)</option>
                </BaseSelect>
              </div>
              
              <div class="space-y-2">
                <BaseLabel>容错率</BaseLabel>
                <BaseSelect v-model="style.errorCorrectionLevel">
                  <option value="L">低 (7%)</option>
                  <option value="M">中 (15%)</option>
                  <option value="Q">高 (25%)</option>
                  <option value="H">极高 (30%)</option>
                </BaseSelect>
              </div>
            </div>
            
             <!-- Logo Upload -->
            <div class="space-y-2">
              <BaseLabel>Logo 图片 (可选)</BaseLabel>
              <div class="flex items-center gap-4">
                 <div class="relative flex-1">
                    <input
                        type="file"
                        accept="image/*"
                        @change="handleLogoUpload"
                        class="hidden"
                        id="logo-upload"
                    />
                    <label 
                        for="logo-upload"
                        class="flex items-center justify-center w-full px-4 py-2 border border-dashed rounded-md cursor-pointer hover:bg-muted/50 transition-colors"
                    >
                        <Upload class="w-4 h-4 mr-2 text-muted-foreground" />
                        <span class="text-sm text-muted-foreground">{{ style.image ? '点击更换 Logo' : '点击上传 Logo' }}</span>
                    </label>
                 </div>
                 <BaseButton v-if="style.image" variant="outline" size="icon" @click="clearLogo" title="清除 Logo">
                    <X class="w-4 h-4" />
                 </BaseButton>
              </div>
              <p class="text-xs text-muted-foreground">建议上传背景透明的 PNG 图片，Logo 将显示在二维码中心</p>
            </div>

            <!-- Size and Margin -->
            <div class="space-y-4 pt-4 border-t">
               <div class="grid grid-cols-2 gap-4">
                  <div class="space-y-2">
                    <div class="flex justify-between">
                        <BaseLabel>尺寸: {{ style.width }}px</BaseLabel>
                    </div>
                    <input
                      v-model.number="style.width"
                      type="range"
                      min="100"
                      max="1000"
                      step="10"
                      class="w-full"
                    />
                  </div>
                   <div class="space-y-2">
                    <div class="flex justify-between">
                        <BaseLabel>边距: {{ style.margin }}px</BaseLabel>
                    </div>
                    <input
                      v-model.number="style.margin"
                      type="range"
                      min="0"
                      max="50"
                      step="1"
                      class="w-full"
                    />
                  </div>
               </div>
            </div>
          </div>
        </BaseCard>
      </div>

      <!-- Right Column: Preview -->
      <div class="lg:col-span-5 space-y-6">
        <BaseCard class="p-6 sticky top-6">
          <div class="space-y-6">
            <h3 class="font-medium text-lg text-center">预览 & 下载</h3>

            <div class="flex justify-center p-8 bg-white border rounded-xl min-h-[300px] items-center shadow-sm relative overflow-hidden pattern-bg">
              <div v-if="!qrData" class="text-center text-muted-foreground z-10 absolute inset-0 flex items-center justify-center">
                请输入内容以生成二维码
              </div>
              <div ref="qrRef" class="qr-code-container z-10 bg-white shadow-lg p-2 rounded-lg" :class="{ 'opacity-0': !qrData }"></div>
            </div>

            <div class="grid grid-cols-2 gap-4">
               <div class="space-y-2">
                  <BaseLabel>下载格式</BaseLabel>
                  <BaseSelect v-model="fileExtension">
                    <option value="png">PNG 图片</option>
                    <option value="jpeg">JPEG 图片</option>
                    <option value="webp">WEBP 图片</option>
                    <option value="svg">SVG 矢量图</option>
                  </BaseSelect>
               </div>
               <div class="flex items-end">
                   <BaseButton
                    class="w-full"
                    variant="default"
                    @click="downloadQrCode"
                    :disabled="!qrCode || !qrData"
                  >
                    <Download class="h-4 w-4 mr-2" /> 下载二维码
                  </BaseButton>
               </div>
            </div>

            <div class="text-sm text-muted-foreground bg-muted/50 p-4 rounded-lg">
                <ul class="list-disc list-inside space-y-1">
                    <li>使用微信或手机相机扫码预览</li>
                    <li>Logo 可能会影响识别，请务必在下载前扫码测试</li>
                    <li>SVG 格式适合打印和设计使用</li>
                </ul>
            </div>
          </div>
        </BaseCard>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, nextTick } from 'vue'
import QRCodeStyling from 'qr-code-styling'
import { 
  Download, 
  RotateCcw, 
  Link, 
  Type, 
  Wifi, 
  Settings2, 
  Upload, 
  X, 
  Image as ImageIcon 
} from 'lucide-vue-next'
import BaseCard from '@/components/ui/BaseCard.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseInput from '@/components/ui/BaseInput.vue'
import BaseLabel from '@/components/ui/BaseLabel.vue'
import BaseSelect from '@/components/ui/BaseSelect.vue'
import BaseTextarea from '@/components/ui/BaseTextarea.vue'
import { useToast } from '@/composables/useToast'

const { toast } = useToast()

// Types
type TabType = 'url' | 'text' | 'wifi'
type DotsType = 'square' | 'dots' | 'rounded' | 'classy' | 'classy-rounded' | 'extra-rounded'
type ErrorCorrectionLevel = 'L' | 'M' | 'Q' | 'H'
type FileExtension = 'png' | 'jpeg' | 'webp' | 'svg'

// Tabs Configuration
const tabs = [
  { label: '网址', value: 'url' as TabType, icon: Link },
  { label: '文本', value: 'text' as TabType, icon: Type },
  { label: 'WiFi', value: 'wifi' as TabType, icon: Wifi },
]

// Refs & State
const qrRef = ref<HTMLDivElement | null>(null)
const qrCode = ref<QRCodeStyling | null>(null)
const activeTab = ref<TabType>('url')
const fileExtension = ref<FileExtension>('png')

const content = ref({
  url: 'https://example.com',
  text: '',
  wifi: {
    ssid: '',
    password: '',
    encryption: 'WPA' as 'WPA' | 'WEP' | 'nopass',
    hidden: false
  }
})

const style = ref({
  width: 280,
  height: 280,
  margin: 10,
  dotsType: 'square' as DotsType,
  dotsColor: '#000000',
  backgroundColor: '#ffffff',
  cornerSquareColor: '#000000',
  cornerDotColor: '#000000',
  image: null as string | null,
  errorCorrectionLevel: 'Q' as ErrorCorrectionLevel
})

// Computed
const isValidUrl = computed(() => {
  if (!content.value.url) return false
  try {
    new URL(content.value.url)
    return true
  } catch {
    return false
  }
})

const qrData = computed(() => {
  switch (activeTab.value) {
    case 'url':
      return isValidUrl.value ? content.value.url : ''
    case 'text':
      return content.value.text
    case 'wifi':
      if (!content.value.wifi.ssid) return ''
      const { ssid, password, encryption, hidden } = content.value.wifi
      // Format: WIFI:S:SSID;T:Encryption;P:Password;H:Hidden;;
      let wifiStr = `WIFI:S:${ssid};`
      if (encryption !== 'nopass') {
        wifiStr += `T:${encryption};P:${password};`
      } else {
        wifiStr += `T:nopass;`
      }
      if (hidden) {
        wifiStr += `H:true;`
      }
      wifiStr += ';'
      return wifiStr
    default:
      return ''
  }
})

// Initialization & Updates
let updateTimeout: number | null = null

onMounted(() => {
  initQrCode()
})

function initQrCode() {
  qrCode.value = new QRCodeStyling({
    width: style.value.width,
    height: style.value.width, // Keep square
    margin: style.value.margin,
    data: qrData.value || 'https://example.com',
    image: style.value.image || undefined,
    dotsOptions: {
      color: style.value.dotsColor,
      type: style.value.dotsType,
    },
    backgroundOptions: {
      color: style.value.backgroundColor,
    },
    cornersSquareOptions: {
      color: style.value.cornerSquareColor,
      type: 'square' // Can be customized too if needed
    },
    cornersDotOptions: {
      color: style.value.cornerDotColor,
      type: 'square'
    },
    imageOptions: {
      crossOrigin: 'anonymous',
      margin: 5
    },
    qrOptions: {
        errorCorrectionLevel: style.value.errorCorrectionLevel
    }
  })

  nextTick(() => {
    if (qrCode.value && qrRef.value) {
      qrRef.value.innerHTML = ''
      qrCode.value.append(qrRef.value)
    }
  })
}

// Watchers
watch([activeTab, content, style], () => {
  if (updateTimeout) {
    clearTimeout(updateTimeout)
  }
  updateTimeout = window.setTimeout(() => {
    updateQrCode()
  }, 100)
}, { deep: true })

watch(() => style.value.width, (newWidth) => {
    // Sync height with width to keep it square
    style.value.height = newWidth
})


function updateQrCode() {
  if (!qrCode.value) {
    initQrCode()
    return
  }

  // If data is empty, don't update to invalid state, maybe show placeholder or keep previous
  // But user might want to see empty state.
  // For now, if empty, we just don't update data or set to empty string which might result in empty QR
  
  const currentData = qrData.value
  if (!currentData) return

  qrCode.value.update({
    width: style.value.width,
    height: style.value.width,
    margin: style.value.margin,
    data: currentData,
    image: style.value.image || undefined,
    dotsOptions: {
      color: style.value.dotsColor,
      type: style.value.dotsType,
    },
    backgroundOptions: {
      color: style.value.backgroundColor,
    },
    cornersSquareOptions: {
      color: style.value.cornerSquareColor,
    },
    cornersDotOptions: {
      color: style.value.cornerDotColor,
    },
    qrOptions: {
        errorCorrectionLevel: style.value.errorCorrectionLevel
    }
  })

  // Safety check: ensure canvas is in dom if it was removed
  nextTick(() => {
    if (qrRef.value && qrRef.value.childNodes.length === 0) {
      qrCode.value?.append(qrRef.value)
    }
  })
}

// Actions
function handleLogoUpload(event: Event) {
  const input = event.target as HTMLInputElement
  if (input.files && input.files[0]) {
    const reader = new FileReader()
    reader.onload = (e) => {
      style.value.image = e.target?.result as string
    }
    reader.readAsDataURL(input.files[0])
  }
}

function clearLogo() {
  style.value.image = null
  // Reset file input value
  const input = document.getElementById('logo-upload') as HTMLInputElement
  if(input) input.value = ''
}

function downloadQrCode() {
  if (qrCode.value && qrData.value) {
    qrCode.value.download({
      extension: fileExtension.value,
      name: `qrcode-${Date.now()}`,
    })

    toast({
      title: '二维码已下载',
      description: `格式: ${fileExtension.value.toUpperCase()}`,
      variant: 'success',
      duration: 2000,
    })
  }
}
</script>

<style scoped>
input[type="range"] {
  @apply h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700;
}

input[type="range"]::-webkit-slider-thumb {
  @apply appearance-none w-4 h-4 bg-primary rounded-full cursor-pointer;
}

input[type="range"]::-moz-range-thumb {
  @apply w-4 h-4 bg-primary rounded-full cursor-pointer border-0;
}

.pattern-bg {
  background-image: radial-gradient(#cbd5e1 1px, transparent 1px);
  background-size: 20px 20px;
}

.dark .pattern-bg {
  background-image: radial-gradient(#334155 1px, transparent 1px);
}
</style>
