<template>
  <div class="max-w-4xl">
    <BaseCard class="p-6">
      <!-- 标题区域 -->
      <div class="mb-6">
        <h1 class="text-2xl font-bold mb-2">{{ t('tools.{{toolKey}}.title') }}</h1>
        <p class="text-sm text-muted-foreground">
          {{ t('tools.{{toolKey}}.description') }}
        </p>
      </div>

      <!-- 主要内容区域 -->
      <div class="space-y-6">
        <!-- 输入区域 -->
        <div class="space-y-2">
          <BaseLabel>{{ t('tools.{{toolKey}}.input') }}</BaseLabel>
          <BaseTextarea
            v-model="input"
            :placeholder="t('common.placeholder')"
            :rows="6"
          />
        </div>

        <!-- 操作按钮 -->
        <BaseButton @click="handleAction" class="w-full">
          <RefreshCw class="mr-2 h-4 w-4" />
          {{ t('tools.{{toolKey}}.action') }}
        </BaseButton>

        <!-- 输出区域 -->
        <div v-if="output" class="space-y-2">
          <div class="flex justify-between items-center">
            <BaseLabel>{{ t('tools.{{toolKey}}.output') }}</BaseLabel>
            <BaseButton
              variant="outline"
              size="sm"
              @click="copyToClipboard"
            >
              <Clipboard class="h-3 w-3 mr-1" />
              {{ t('common.copy') }}
            </BaseButton>
          </div>
          <BaseInput
            :value="output"
            readonly
            class="font-mono"
          />
        </div>
      </div>

      <!-- 底部说明 -->
      <div class="mt-6 pt-6 border-t text-xs text-muted-foreground space-y-2">
        <p>
          <strong>关于该工具：</strong>
        </p>
        <p>
          在此添加工具的使用说明和注意事项...
        </p>
      </div>
    </BaseCard>
  </div>
</template>

<script setup lang="ts">
import { Clipboard, RefreshCw } from 'lucide-vue-next'
import BaseCard from '@/components/ui/BaseCard.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseInput from '@/components/ui/BaseInput.vue'
import BaseTextarea from '@/components/ui/BaseTextarea.vue'
import BaseLabel from '@/components/ui/BaseLabel.vue'
import { use{{toolPascalName}} } from './use{{toolPascalName}}'

const {
  t,
  input,
  output,
  handleAction,
  copyToClipboard
} = use{{toolPascalName}}()
</script>

