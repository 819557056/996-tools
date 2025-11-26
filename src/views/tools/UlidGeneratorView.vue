<template>
  <div class="max-w-4xl">
    <BaseCard class="p-6">
      <div class="mb-6">
        <h1 class="text-2xl font-bold mb-2">ULID 生成器</h1>
        <p class="text-sm text-muted-foreground">
          生成ULID（通用唯一按字典序排序的标识符）
        </p>
      </div>

      <div class="space-y-6">
        <!-- Quantity Selection -->
        <div class="space-y-2">
          <BaseLabel>数量: {{ quantity }}</BaseLabel>
          <BaseSelect v-model.number="quantity">
            <option v-for="num in 20" :key="num" :value="num">{{ num }}</option>
          </BaseSelect>
        </div>

        <!-- Generate Button -->
        <BaseButton @click="generateUlids" class="w-full">
          <RefreshCw class="mr-2 h-4 w-4" /> 生成 ULID
        </BaseButton>

        <!-- Generated ULIDs -->
        <div class="space-y-2">
          <div class="flex justify-between items-center">
            <h3 class="font-medium">生成的 ULID：</h3>
            <BaseButton
              v-if="generatedUlids.length > 1"
              variant="outline"
              size="sm"
              @click="copyAllUlids"
            >
              <Clipboard class="h-3 w-3 mr-1" /> 复制全部
            </BaseButton>
          </div>
          <div class="space-y-2">
            <div
              v-for="(ulid, index) in generatedUlids"
              :key="index"
              class="flex items-center gap-2"
            >
              <BaseInput :value="ulid" readonly class="font-mono" />
              <BaseButton
                variant="outline"
                size="icon"
                @click="copyToClipboard(ulid)"
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
          <strong>关于 ULID：</strong>
        </p>
        <p>
          ULID (Universally Unique Lexicographically Sortable Identifier) 是一种按字典序排序的唯一标识符。
        </p>
        <p>
          <strong>特点：</strong>
        </p>
        <ul class="list-disc list-inside space-y-1 ml-2">
          <li>128位兼容UUID</li>
          <li>按字典序排序（基于时间戳）</li>
          <li>每毫秒1.21e+24个唯一ULID</li>
          <li>使用Crockford's base32编码，更易读</li>
          <li>区分大小写</li>
          <li>没有特殊字符（URL安全）</li>
          <li>单调排序（在同一毫秒内）</li>
        </ul>
      </div>
    </BaseCard>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { ulid } from 'ulid'
import { RefreshCw, Clipboard } from 'lucide-vue-next'
import BaseCard from '@/components/ui/BaseCard.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseInput from '@/components/ui/BaseInput.vue'
import BaseLabel from '@/components/ui/BaseLabel.vue'
import BaseSelect from '@/components/ui/BaseSelect.vue'
import { useToast } from '@/composables/useToast'

const { toast } = useToast()

const quantity = ref(5)
const generatedUlids = ref<string[]>([])

onMounted(() => {
  generateUlids()
})

function generateUlids() {
  try {
    generatedUlids.value = Array(quantity.value)
      .fill(0)
      .map(() => ulid())
  } catch (error) {
    toast({
      title: '生成ULID时出错',
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

function copyAllUlids() {
  navigator.clipboard.writeText(generatedUlids.value.join('\n'))
  toast({
    title: '所有ULID已复制',
    description: `${generatedUlids.value.length}个ULID已复制到剪贴板`,
    variant: 'success',
    duration: 2000,
  })
}
</script>

