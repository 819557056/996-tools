<template>
  <div class="max-w-4xl">
    <BaseCard class="p-6">
      <div class="mb-6">
        <h1 class="text-2xl font-bold mb-2">Nano ID 生成器</h1>
        <p class="text-sm text-muted-foreground">
          生成随机ID，支持自定义长度和字符集
        </p>
      </div>

      <div class="space-y-6">
        <!-- Length Selection -->
        <div class="space-y-2">
          <BaseLabel>ID 长度: {{ length }}</BaseLabel>
          <input
            v-model.number="length"
            type="range"
            min="8"
            max="64"
            step="1"
            class="w-full"
          />
        </div>

        <!-- Alphabet Selection -->
        <div class="space-y-2">
          <BaseLabel>字符集</BaseLabel>
          <BaseSelect v-model="alphabetType">
            <option value="default">默认 (A-Za-z0-9_-)</option>
            <option value="numbers">仅数字 (0-9)</option>
            <option value="lowercase">小写字母 (a-z)</option>
            <option value="uppercase">大写字母 (A-Z)</option>
            <option value="alphanumeric">字母数字 (A-Za-z0-9)</option>
            <option value="hex">十六进制 (0-9a-f)</option>
            <option value="custom">自定义</option>
          </BaseSelect>
        </div>

        <!-- Custom Alphabet -->
        <div v-if="alphabetType === 'custom'" class="space-y-2">
          <BaseLabel>自定义字符集</BaseLabel>
          <BaseInput
            v-model="customAlphabet"
            placeholder="输入自定义字符集"
          />
          <p class="text-xs text-muted-foreground">
            例如: 0123456789ABCDEF
          </p>
        </div>

        <!-- Quantity Selection -->
        <div class="space-y-2">
          <BaseLabel>数量: {{ quantity }}</BaseLabel>
          <BaseSelect v-model.number="quantity">
            <option v-for="num in 20" :key="num" :value="num">{{ num }}</option>
          </BaseSelect>
        </div>

        <!-- Generate Button -->
        <BaseButton @click="generateIds" class="w-full">
          <RefreshCw class="mr-2 h-4 w-4" /> 生成 Nano ID
        </BaseButton>

        <!-- Generated IDs -->
        <div class="space-y-2">
          <div class="flex justify-between items-center">
            <h3 class="font-medium">生成的 ID：</h3>
            <BaseButton
              v-if="generatedIds.length > 1"
              variant="outline"
              size="sm"
              @click="copyAllIds"
            >
              <Clipboard class="h-3 w-3 mr-1" /> 复制全部
            </BaseButton>
          </div>
          <div class="space-y-2">
            <div
              v-for="(id, index) in generatedIds"
              :key="index"
              class="flex items-center gap-2"
            >
              <BaseInput :value="id" readonly class="font-mono" />
              <BaseButton
                variant="outline"
                size="icon"
                @click="copyToClipboard(id)"
                title="复制到剪贴板"
              >
                <Clipboard class="h-4 w-4" />
              </BaseButton>
            </div>
          </div>
        </div>
      </div>

      <!-- Footer Info -->
      <div class="mt-6 pt-6 border-t text-xs text-muted-foreground space-y-2">
        <p>
          Nano ID 是一个小巧、安全、URL友好的唯一字符串ID生成器，适用于JavaScript。
        </p>
        <p>
          相比UUID，Nano ID更短、更快，并且使用更大的字母表，生成的ID更紧凑。
        </p>
        <p>
          默认字符集使用64个字符（A-Za-z0-9_-），21个字符的ID可以提供与UUID v4相似的碰撞概率。
        </p>
      </div>
    </BaseCard>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { nanoid, customAlphabet } from 'nanoid'
import { numbers, lowercase, uppercase } from 'nanoid-dictionary'
import { RefreshCw, Clipboard } from 'lucide-vue-next'
import BaseCard from '@/components/ui/BaseCard.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseInput from '@/components/ui/BaseInput.vue'
import BaseLabel from '@/components/ui/BaseLabel.vue'
import BaseSelect from '@/components/ui/BaseSelect.vue'
import { useToast } from '@/composables/useToast'

const { toast } = useToast()

const length = ref(21)
const quantity = ref(5)
const alphabetType = ref('default')
const customAlphabet_input = ref('')
const generatedIds = ref<string[]>([])

const customAlphabet = computed({
  get: () => customAlphabet_input.value,
  set: (val) => customAlphabet_input.value = val
})

const currentAlphabet = computed(() => {
  const alphabets: Record<string, string> = {
    default: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_-',
    numbers: numbers,
    lowercase: lowercase,
    uppercase: uppercase,
    alphanumeric: uppercase + lowercase + numbers,
    hex: '0123456789abcdef',
    custom: customAlphabet.value || 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_-',
  }
  return alphabets[alphabetType.value] || alphabets.default
})

onMounted(() => {
  generateIds()
})

function generateIds() {
  try {
    const alphabet = currentAlphabet.value
    if (!alphabet) {
      toast({
        title: '请提供有效的字符集',
        variant: 'warning',
      })
      return
    }

    const generate = customAlphabet(alphabet, length.value)
    generatedIds.value = Array(quantity.value)
      .fill(0)
      .map(() => generate())
  } catch (error) {
    toast({
      title: '生成ID时出错',
      description: (error as Error).message,
      variant: 'error',
    })
  }
}

function copyToClipboard(text: string) {
  navigator.clipboard.writeText(text)
  toast({
    title: '已复制到剪贴板',
    variant: 'success',
    duration: 2000,
  })
}

function copyAllIds() {
  navigator.clipboard.writeText(generatedIds.value.join('\n'))
  toast({
    title: '所有ID已复制',
    description: `${generatedIds.value.length}个ID已复制到剪贴板`,
    variant: 'success',
    duration: 2000,
  })
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
</style>

