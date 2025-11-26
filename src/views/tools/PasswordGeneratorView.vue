<template>
  <div class="max-w-4xl">
    <BaseCard class="p-6">
      <div class="mb-6">
        <h1 class="text-2xl font-bold mb-2">密码生成器</h1>
        <p class="text-sm text-muted-foreground">
          生成强度高且安全的密码，支持自定义选项
        </p>
      </div>

      <div class="space-y-6">
        <!-- Password Length -->
        <div class="space-y-2">
          <BaseLabel>密码长度: {{ length }}</BaseLabel>
          <input
            v-model.number="length"
            type="range"
            min="8"
            max="64"
            step="1"
            class="w-full"
          />
        </div>

        <!-- Options -->
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <label class="flex items-center gap-2 cursor-pointer">
            <input
              v-model="includeUppercase"
              type="checkbox"
              class="w-4 h-4 rounded border-input"
            />
            <span class="text-sm">包含大写字母 (A-Z)</span>
          </label>

          <label class="flex items-center gap-2 cursor-pointer">
            <input
              v-model="includeLowercase"
              type="checkbox"
              class="w-4 h-4 rounded border-input"
            />
            <span class="text-sm">包含小写字母 (a-z)</span>
          </label>

          <label class="flex items-center gap-2 cursor-pointer">
            <input
              v-model="includeNumbers"
              type="checkbox"
              class="w-4 h-4 rounded border-input"
            />
            <span class="text-sm">包含数字 (0-9)</span>
          </label>

          <label class="flex items-center gap-2 cursor-pointer">
            <input
              v-model="includeSymbols"
              type="checkbox"
              class="w-4 h-4 rounded border-input"
            />
            <span class="text-sm">包含符号 (!@#$%^&*)</span>
          </label>
        </div>

        <!-- Generate Button -->
        <BaseButton @click="generatePassword" class="w-full">
          <RefreshCw class="mr-2 h-4 w-4" /> 生成密码
        </BaseButton>

        <!-- Generated Password -->
        <div class="space-y-2">
          <div class="flex justify-between items-center">
            <h3 class="font-medium">生成的密码：</h3>
            <div class="flex gap-2">
              <BaseButton
                variant="outline"
                size="sm"
                @click="copyToClipboard"
                :disabled="!password"
              >
                <Clipboard class="h-3 w-3 mr-1" /> 复制
              </BaseButton>
            </div>
          </div>
          <div class="flex items-center gap-2">
            <BaseInput
              :value="password"
              readonly
              class="font-mono text-lg"
              placeholder="点击生成密码按钮"
            />
          </div>
        </div>

        <!-- Password Strength -->
        <div v-if="password" class="space-y-2">
          <div class="flex justify-between items-center">
            <BaseLabel>密码强度：</BaseLabel>
            <span
              :class="[
                'text-sm font-medium',
                strengthColor
              ]"
            >
              {{ strengthText }}
            </span>
          </div>
          <div class="w-full bg-gray-200 rounded-full h-2 dark:bg-gray-700">
            <div
              :class="[
                'h-2 rounded-full transition-all',
                strengthColor
              ]"
              :style="{ width: strengthPercentage + '%' }"
            ></div>
          </div>
        </div>
      </div>

      <!-- Footer Info -->
      <div class="mt-6 pt-6 border-t text-xs text-muted-foreground space-y-2">
        <p>
          <strong>密码安全提示：</strong>
        </p>
        <ul class="list-disc list-inside space-y-1">
          <li>使用至少12个字符的密码</li>
          <li>包含大小写字母、数字和符号</li>
          <li>不要使用个人信息</li>
          <li>为每个账户使用不同的密码</li>
          <li>定期更换密码</li>
        </ul>
      </div>
    </BaseCard>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { RefreshCw, Clipboard } from 'lucide-vue-next'
import BaseCard from '@/components/ui/BaseCard.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseInput from '@/components/ui/BaseInput.vue'
import BaseLabel from '@/components/ui/BaseLabel.vue'
import { useToast } from '@/composables/useToast'

const { toast } = useToast()

const length = ref(16)
const includeUppercase = ref(true)
const includeLowercase = ref(true)
const includeNumbers = ref(true)
const includeSymbols = ref(true)
const password = ref('')

const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
const lowercase = 'abcdefghijklmnopqrstuvwxyz'
const numbers = '0123456789'
const symbols = '!@#$%^&*()_+-=[]{}|;:,.<>?'

const passwordStrength = computed(() => {
  if (!password.value) return 0

  let strength = 0
  const len = password.value.length

  // Length score
  if (len >= 8) strength += 20
  if (len >= 12) strength += 20
  if (len >= 16) strength += 20

  // Character variety score
  if (/[a-z]/.test(password.value)) strength += 10
  if (/[A-Z]/.test(password.value)) strength += 10
  if (/[0-9]/.test(password.value)) strength += 10
  if (/[^a-zA-Z0-9]/.test(password.value)) strength += 10

  return Math.min(strength, 100)
})

const strengthText = computed(() => {
  const strength = passwordStrength.value
  if (strength >= 80) return '非常强'
  if (strength >= 60) return '强'
  if (strength >= 40) return '中等'
  if (strength >= 20) return '弱'
  return '非常弱'
})

const strengthColor = computed(() => {
  const strength = passwordStrength.value
  if (strength >= 80) return 'text-green-600 bg-green-600'
  if (strength >= 60) return 'text-blue-600 bg-blue-600'
  if (strength >= 40) return 'text-yellow-600 bg-yellow-600'
  if (strength >= 20) return 'text-orange-600 bg-orange-600'
  return 'text-red-600 bg-red-600'
})

const strengthPercentage = computed(() => passwordStrength.value)

onMounted(() => {
  generatePassword()
})

function generatePassword() {
  let charset = ''
  
  if (includeUppercase.value) charset += uppercase
  if (includeLowercase.value) charset += lowercase
  if (includeNumbers.value) charset += numbers
  if (includeSymbols.value) charset += symbols

  if (charset === '') {
    toast({
      title: '请至少选择一个字符类型',
      variant: 'warning',
    })
    return
  }

  let result = ''
  const charsetLength = charset.length

  for (let i = 0; i < length.value; i++) {
    const randomIndex = Math.floor(Math.random() * charsetLength)
    result += charset[randomIndex]
  }

  password.value = result
}

function copyToClipboard() {
  if (password.value) {
    navigator.clipboard.writeText(password.value)
    toast({
      title: '已复制到剪贴板',
      description: '密码已复制到剪贴板',
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

input[type="checkbox"] {
  @apply cursor-pointer accent-primary;
}
</style>

