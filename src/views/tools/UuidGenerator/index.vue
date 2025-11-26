<template>
  <div class="max-w-4xl">
    <BaseCard class="p-6">
      <div class="mb-6">
        <h1 class="text-2xl font-bold mb-2">{{ t('tools.uuid.title') }}</h1>
        <p class="text-sm text-muted-foreground">
          {{ t('tools.uuid.description') }}
        </p>
      </div>

      <div class="space-y-6">
        <!-- UUID Version Selection -->
        <div class="space-y-2">
          <BaseLabel>{{ t('tools.uuid.version') }}</BaseLabel>
          <BaseSelect v-model="version" @update:modelValue="handleVersionChange">
            <option value="v1">v1 {{ locale === 'zh' ? '(基于时间)' : '(Time-based)' }}</option>
            <option value="v4">v4 {{ locale === 'zh' ? '(随机)' : '(Random)' }}</option>
            <option value="v5">v5 {{ locale === 'zh' ? '(基于名称的SHA-1)' : '(Name-based SHA-1)' }}</option>
          </BaseSelect>
          <p class="text-xs text-muted-foreground">
            {{ versionDescription }}
          </p>
        </div>

        <!-- v5 Specific Options -->
        <div v-if="version === 'v5'" class="space-y-4 border-t pt-4">
          <div class="space-y-2">
            <BaseLabel>命名空间 UUID</BaseLabel>
            <div class="flex gap-2">
              <BaseInput
                v-model="namespace"
                placeholder="输入UUID命名空间"
                :error="!!namespaceError"
                class="flex-1"
              />
              <BaseButton
                variant="outline"
                size="icon"
                @click="generateNewNamespace"
                title="生成新的命名空间UUID"
              >
                <RefreshCw class="h-4 w-4" />
              </BaseButton>
            </div>
            <p v-if="namespaceError" class="text-xs text-destructive">
              {{ namespaceError }}
            </p>
            <p class="text-xs text-muted-foreground">
              标准命名空间：URL、DNS、OID 或 X.500
            </p>
          </div>

          <div class="space-y-2">
            <BaseLabel>名称</BaseLabel>
            <BaseInput
              v-model="name"
              placeholder="输入一个名称"
            />
            <p class="text-xs text-muted-foreground">
              用于与命名空间哈希的名称（例如域名）
            </p>
            <p class="text-xs text-muted-foreground">
              <span class="font-semibold">注意：</span>相同的命名空间和名称将始终生成相同的UUID。
            </p>
          </div>
        </div>

        <!-- Quantity Selection -->
        <div class="space-y-2">
          <BaseLabel>{{ t('tools.uuid.quantity') }}: {{ quantity }}</BaseLabel>
          <BaseSelect v-model="quantity">
            <option v-for="num in 20" :key="num" :value="num">{{ num }}</option>
          </BaseSelect>
        </div>

        <!-- Generate Button -->
        <BaseButton @click="generateUUIDs" class="w-full">
          <RefreshCw class="mr-2 h-4 w-4" /> {{ t('tools.uuid.generate') }}
        </BaseButton>

        <!-- Generated UUIDs -->
        <div class="space-y-2">
          <div class="flex justify-between items-center">
            <h3 class="font-medium">{{ locale === 'zh' ? '生成的 UUID：' : 'Generated UUIDs:' }}</h3>
            <BaseButton
              v-if="generatedUUIDs.length > 1"
              variant="outline"
              size="sm"
              @click="copyAllUUIDs"
            >
              <Clipboard class="h-3 w-3 mr-1" /> {{ t('common.copy') }}
            </BaseButton>
          </div>
          <div class="space-y-2">
            <div
              v-for="(uuid, index) in generatedUUIDs"
              :key="index"
              class="flex items-center gap-2"
            >
              <BaseInput :value="uuid" readonly class="font-mono" />
              <BaseButton
                variant="outline"
                size="icon"
                @click="copyToClipboard(uuid)"
                :title="locale === 'zh' ? '复制 (带分隔符)' : 'Copy (with dashes)'"
              >
                <Clipboard class="h-4 w-4" />
              </BaseButton>
              <BaseButton
                variant="outline"
                size="icon"
                @click="copyToClipboard(uuid.replace(/-/g, ''))"
                :title="locale === 'zh' ? '复制 (无分隔符)' : 'Copy (no dashes)'"
              >
                <Copy class="h-4 w-4" />
              </BaseButton>
            </div>
          </div>
        </div>
      </div>

      <!-- Footer Info -->
      <div class="mt-6 pt-6 border-t text-xs text-muted-foreground space-y-2">
        <p>
          UUID（通用唯一识别码）是一个128位的数字，用于在计算机系统中标识信息。
        </p>
        <p>
          格式：{{ formatDescription }}，128位值表示为32个十六进制数字
        </p>
        <p>
          碰撞概率：极低（5.3×10³⁹分之一）
        </p>
      </div>
    </BaseCard>
  </div>
</template>

<script setup lang="ts">
import { RefreshCw, Clipboard, Copy } from 'lucide-vue-next'
import BaseCard from '@/components/ui/BaseCard.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseInput from '@/components/ui/BaseInput.vue'
import BaseLabel from '@/components/ui/BaseLabel.vue'
import BaseSelect from '@/components/ui/BaseSelect.vue'
import { useUuidGenerator } from './useUuidGenerator'

const {
  t,
  locale,
  version,
  quantity,
  generatedUUIDs,
  namespace,
  name,
  namespaceError,
  versionDescription,
  formatDescription,
  generateUUIDs,
  copyToClipboard,
  copyAllUUIDs,
  handleVersionChange,
  generateNewNamespace
} = useUuidGenerator()
</script>

