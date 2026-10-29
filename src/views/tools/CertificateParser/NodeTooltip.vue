<script setup lang="ts">
import { nextTick, onMounted, ref, watch } from 'vue'
import type { Asn1Node } from '@/utils/asn1/types'
const props = defineProps<{ node: Asn1Node; x: number; y: number }>()
const tooltip = ref<HTMLElement>(), position = ref({ x: props.x + 16, y: props.y + 14 })
async function place() {
  await nextTick()
  const rect = tooltip.value?.getBoundingClientRect()
  if (!rect) return
  position.value = {
    x: Math.max(8, Math.min(props.x + 16, window.innerWidth - rect.width - 8)),
    y: props.y + 14 + rect.height > window.innerHeight - 8 ? Math.max(8, props.y - rect.height - 10) : props.y + 14,
  }
}
onMounted(place)
watch(() => [props.x, props.y, props.node.id], place)
</script>
<template>
  <div ref="tooltip" role="tooltip" class="asn-tooltip" :style="{ left: `${position.x}px`, top: `${position.y}px` }">
    <div><span>Offset</span><b>{{ node.offset }}</b></div>
    <div><span>Length</span><b>{{ node.header }} + {{ node.indefinite ? `${node.contentLength}（不定长）` : node.contentLength }}</b></div>
    <p v-if="node.constructed">constructed · 构造类型</p>
    <p v-else-if="node.encapsulated">encapsulates · 内嵌 ASN.1</p>
    <div class="tooltip-value"><span>Value</span><pre>{{ node.value || (node.type === 'NULL' ? 'NULL' : '—') }}</pre><small v-if="node.oidName">{{ node.oidName }}</small></div>
  </div>
</template>
<style scoped>
.asn-tooltip { position: fixed; z-index: 90; width: max-content; max-width: min(360px, calc(100vw - 16px)); padding: 8px 10px; background: var(--asn-surface); color: var(--asn-ink); border: 1px solid var(--asn-muted); box-shadow: 0 3px 12px #0002; pointer-events: none; font: 12px/1.5 var(--asn-code); }
.asn-tooltip > div:not(.tooltip-value) { display: flex; gap: 12px; }.asn-tooltip span { color: var(--asn-muted); }.asn-tooltip b { font-weight: 500; }.asn-tooltip p { margin: 2px 0; color: var(--asn-muted); }.tooltip-value { margin-top: 3px; }.tooltip-value pre { margin: 1px 0 0; white-space: pre-wrap; overflow-wrap: anywhere; max-height: 180px; overflow: hidden; font: inherit; font-weight: 600; }.tooltip-value small { display: block; margin-top: 3px; color: var(--asn-muted); font-size: 11px; }
</style>
