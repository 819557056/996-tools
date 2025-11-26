<template>
  <div class="max-w-4xl">
    <BaseCard class="p-6">
      <div class="mb-6">
        <h1 class="text-2xl font-bold mb-2">{{ t('tools.hashTextGenerator.title') }}</h1>
        <p class="text-sm text-muted-foreground">
          {{ t('tools.hashTextGenerator.description') }}
        </p>
      </div>

      <div class="space-y-6">
        <!-- Input -->
        <div class="space-y-2">
          <BaseLabel>{{ t('tools.md5.input', '输入文本') }}</BaseLabel>
          <BaseTextarea
            v-model="input"
            :placeholder="t('tools.md5.input', '输入要生成哈希的文本...')"
            :rows="4"
            autosize
          />
        </div>

        <div class="border-t pt-4">
          <!-- Encoding Select -->
          <div class="mb-6 max-w-xs">
            <BaseLabel class="mb-2 block">{{ t('tools.hashTextGenerator.outputFormat') }}</BaseLabel>
            <BaseSelect
              v-model="encoding"
            >
              <option v-for="opt in encodingOptions" :key="opt.value" :value="opt.value">
                {{ opt.label }}
              </option>
            </BaseSelect>
            <p class="text-xs text-muted-foreground mt-1">
              {{ t('tools.hashTextGenerator.outputFormatDesc') }}
            </p>
          </div>

          <!-- Hashes List -->
          <div class="space-y-3">
            <div v-for="algo in algoNames" :key="algo" class="flex items-center gap-3">
              <BaseLabel class="w-24 flex-shrink-0 text-right">{{ algo }}</BaseLabel>
              <div class="relative flex-1 min-w-0">
                <input
                  :value="getHash(algo)"
                  readonly
                  class="flex h-9 w-full rounded-md border border-input bg-muted/50 px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 font-mono text-ellipsis overflow-hidden whitespace-nowrap"
                  placeholder="等待输入..."
                />
              </div>
              <BaseButton
                variant="outline"
                size="sm"
                class="flex-shrink-0 px-3"
                @click="copyToClipboard(getHash(algo))"
                :disabled="!input"
                title="复制结果"
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
          <strong>{{ t('tools.hashTextGenerator.supportedAlgos') }}</strong> {{ algoNames.join(', ') }}
        </p>
        <p class="text-orange-600 dark:text-orange-400">
          <strong>{{ t('tools.hashTextGenerator.securityNote') }}</strong> {{ t('tools.hashTextGenerator.securityWarning') }}
        </p>
      </div>
    </BaseCard>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { Clipboard } from 'lucide-vue-next'
import BaseCard from '@/components/ui/BaseCard.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseTextarea from '@/components/ui/BaseTextarea.vue'
import BaseLabel from '@/components/ui/BaseLabel.vue'
import BaseSelect from '@/components/ui/BaseSelect.vue'
import { useHashText } from './useHashText'

const { t } = useI18n()
const {
  input,
  encoding,
  algoNames,
  getHash,
  copyToClipboard
} = useHashText()

const encodingOptions = [
  { label: 'Hexadecimal (base 16)', value: 'Hex' },
  { label: 'Binary (base 2)', value: 'Bin' },
  { label: 'Base64 (base 64)', value: 'Base64' },
  { label: 'Base64url (url safe)', value: 'Base64url' },
]
</script>
