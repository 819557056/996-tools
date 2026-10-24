<script setup lang="ts">
import { ref, onBeforeUnmount } from 'vue'
import { useI18n } from 'vue-i18n'
import BaseCard from '@/components/ui/BaseCard.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import EncodedOutput from '@/components/crypto/EncodedOutput.vue'
const { t } = useI18n()
const file = ref<File | null>(null), busy = ref(false), progress = ref(0), error = ref('')
const result = ref<Record<string, string> | null>(null)
let worker: Worker | undefined
function cancel() { worker?.terminate(); worker = undefined; busy.value = false }
function select(event: Event) { cancel(); file.value = (event.target as HTMLInputElement).files?.[0] ?? null; result.value = null; progress.value = 0; error.value = '' }
function calculate() {
  if (!file.value) return
  cancel(); result.value = null; error.value = ''; progress.value = 0; busy.value = true
  worker = new Worker(new URL('../../../workers/file-digest.worker.ts', import.meta.url), { type: 'module' })
  worker.onmessage = ({ data }) => { progress.value = data.progress ?? progress.value; if (data.result) { result.value = data.result; cancel() } if (data.error) { error.value = data.error; cancel() } }
  worker.onerror = () => { error.value = t('localTools.failed'); cancel() }
  worker.postMessage(file.value)
}
onBeforeUnmount(cancel)
</script>
<template>
  <BaseCard class="p-4 md:p-6 space-y-5 min-w-0">
    <h1 class="text-2xl font-bold">{{ t('tools.fileDigest.title') }}</h1>
    <p class="text-sm text-muted-foreground">{{ t('localTools.localDigest') }}</p>
    <input type="file" :aria-label="t('localTools.document')" class="block max-w-full" @change="select" />
    <p v-if="file" class="text-sm break-all">{{ file.name }} · {{ file.size.toLocaleString() }} bytes</p>
    <div class="flex gap-2"><BaseButton :disabled="!file || busy" @click="calculate">{{ t('localTools.startDigest') }}</BaseButton><BaseButton v-if="busy" variant="outline" @click="cancel">{{ t('localTools.cancel') }}</BaseButton></div>
    <div v-if="busy" role="status" class="space-y-1"><progress :value="progress" max="100" class="w-full" />{{ progress }}%</div>
    <p v-if="error" role="alert" class="text-destructive">{{ error }}</p>
    <EncodedOutput v-for="(value,algorithm) in result" :key="algorithm" :label="algorithm" :value="value" source-encoding="hex" kind="binary" />
  </BaseCard>
</template>
