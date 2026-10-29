<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { Copy, Download, ListTree, TextCursorInput, X, ArrowLeft, ChevronRight } from 'lucide-vue-next'
import type { Asn1Node, Asn1Part, Asn1Encoding } from '@/utils/asn1/types'

const props = defineProps<{ node: Asn1Node; x: number; y: number }>()
const emit = defineEmits<{ close: [restoreFocus: boolean]; copy: [part: Asn1Part, encoding: Asn1Encoding]; download: [] }>()
const menu = ref<HTMLElement>(), position = ref({ left: props.x, top: props.y })
const advanced = ref(false)
const parts: { key: Asn1Part; label: string; hint: string }[] = [
  { key: 'node', label: '完整节点', hint: 'Tag + Length + Value' },
  { key: 'tag', label: 'Tag', hint: '类型的原始编码' },
  { key: 'length', label: 'Length', hint: '长度的原始编码' },
  { key: 'value', label: 'Value', hint: '内容的原始字节' },
]
const formats: { key: Asn1Encoding; label: string }[] = [
  { key: 'hex', label: 'Hex' }, { key: 'base64', label: 'Base64' }, { key: 'base64url', label: 'Base64URL' },
]
function outside(event: Event) { if (!menu.value?.contains(event.target as Node)) emit('close', false) }
function resize() { emit('close', false) }
function keyboard(event: KeyboardEvent) {
  if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); if (advanced.value) advanced.value = false; else emit('close', true); return }
  if (event.key === 'Tab') { emit('close', false); return }
  const items = Array.from(menu.value?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]') || [])
  const current = items.indexOf(document.activeElement as HTMLButtonElement)
  let index: number
  if (['ArrowDown', 'ArrowRight'].includes(event.key)) index = (current + 1) % items.length
  else if (['ArrowUp', 'ArrowLeft'].includes(event.key)) index = (current - 1 + items.length) % items.length
  else if (event.key === 'Home') index = 0
  else if (event.key === 'End') index = items.length - 1
  else return
  event.preventDefault(); items[index]?.focus()
}
async function place() {
  await nextTick()
  const rect = menu.value!.getBoundingClientRect()
  position.value = { left: Math.max(8, Math.min(props.x, window.innerWidth - rect.width - 8)), top: Math.max(8, Math.min(props.y, window.innerHeight - rect.height - 8)) }
  await nextTick()
  menu.value?.querySelector<HTMLButtonElement>('[role="menuitem"]')?.focus({ preventScroll: true })
}
watch(advanced, place)
onMounted(async () => {
  await place()
  document.addEventListener('pointerdown', outside, true)
  document.addEventListener('scroll', outside, true)
  window.addEventListener('resize', resize)
})
onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', outside, true)
  document.removeEventListener('scroll', outside, true)
  window.removeEventListener('resize', resize)
})
</script>

<template>
  <div ref="menu" class="asn-node-menu" :class="{ advanced }" role="menu" aria-label="节点操作" :style="{ left: `${position.left}px`, top: `${position.top}px` }" @keydown="keyboard" @contextmenu.prevent>
    <template v-if="!advanced">
      <div class="menu-caption"><span>{{ node.field || node.type }}</span><small>@{{ node.offset }}</small></div>
      <div class="copy-primary">
        <button role="menuitem" aria-label="复制完整节点 Hex" @click="emit('copy', 'node', 'hex')">复制 Hex</button>
        <button role="menuitem" aria-label="复制完整节点 Base64" @click="emit('copy', 'node', 'base64')">复制 Base64</button>
        <button role="menuitem" @click="emit('copy', 'node', 'tree')">复制子树</button>
        <button v-if="!['SEQUENCE', 'SET'].includes(node.type)" role="menuitem" @click="emit('copy', 'value', 'readable')">复制可读值</button>
        <button class="menu-more" role="menuitem" @click="advanced = true">更多格式<ChevronRight /></button>
      </div>
    </template>
    <template v-else>
    <header><button aria-label="返回常用复制" @click="advanced = false"><ArrowLeft /></button><div><strong>更多复制格式</strong><span>{{ node.type }} · 偏移 {{ node.offset }}</span></div><button aria-label="关闭节点菜单" @click="emit('close', true)"><X /></button></header>
    <div class="copy-caption">选择要复制的内容和格式</div>
    <div v-for="part in parts" :key="part.key" class="copy-row" role="group" :aria-label="part.label">
      <span :title="part.hint"><i :class="part.key" />{{ part.label }}</span>
      <button v-for="format in formats" :key="format.key" role="menuitem" :aria-label="`复制${part.label} ${format.label}`" @click="emit('copy', part.key, format.key)">{{ format.label }}</button>
    </div>
    <div class="copy-other">
      <button role="menuitem" @click="emit('copy', 'node', 'hex-compact')"><Copy />复制连续 Hex<span>不含空格</span></button>
      <button role="menuitem" @click="emit('copy', 'value', 'readable')"><TextCursorInput />复制可读值<span>完整内容</span></button>
      <button role="menuitem" @click="emit('copy', 'node', 'tree')"><ListTree />复制结构树<span>含子节点</span></button>
      <button role="menuitem" @click="emit('download')"><Download />下载节点数据<span>原始编码</span></button>
    </div>
    </template>
  </div>
</template>

<style scoped>
.asn-node-menu { position: fixed; z-index: 100; width: 190px; max-width: calc(100vw - 16px); max-height: calc(100dvh - 16px); overflow: auto; padding: 4px; border: 1px solid var(--asn-line); border-radius: 4px; background: var(--asn-surface); color: var(--asn-ink); box-shadow: 0 5px 18px #0003; font: 13px/1.5 system-ui, sans-serif; }
.asn-node-menu.advanced { width: 360px; padding: 8px; }
.menu-caption { display: flex; align-items: center; gap: 8px; padding: 4px 8px 6px; border-bottom: 1px solid var(--asn-line); color: var(--asn-muted); font: 11px/1.5 var(--asn-code); }.menu-caption span { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }.menu-caption small { font: inherit; }
.copy-primary button { display: flex; align-items: center; justify-content: space-between; width: 100%; padding: 5px 8px; text-align: left; border-radius: 2px; }.copy-primary .menu-more { border-top: 1px solid var(--asn-line); margin-top: 3px; padding-top: 6px; }
header { display: flex; align-items: center; gap: 10px; padding: 7px 6px 12px; border-bottom: 1px solid var(--asn-line); }
header > svg { color: var(--asn-blue); }
header div { min-width: 0; flex: 1; }
header strong, header span { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
header span { font-size: 11px; color: var(--asn-muted); }
button { cursor: pointer; color: inherit; font: inherit; border: 0; background: transparent; border-radius: 4px; }
button:hover, button:focus-visible { background: var(--asn-blue-bg); color: var(--asn-blue); outline: 2px solid transparent; }
button:focus-visible { box-shadow: inset 0 0 0 1px var(--asn-blue); }
header button { display: grid; place-items: center; padding: 5px; }
svg { width: 16px; height: 16px; flex: none; }
.copy-caption { padding: 10px 6px 6px; color: var(--asn-muted); font-size: 12px; }
.copy-row { display: grid; grid-template-columns: 98px 50px 67px 1fr; align-items: center; min-height: 35px; gap: 2px; padding: 0 4px; }
.copy-row > span { display: flex; align-items: center; gap: 7px; font-weight: 550; }
.copy-row i { width: 6px; height: 6px; border-radius: 2px; background: var(--asn-muted); }
.copy-row .tag { background: var(--asn-teal); }.copy-row .length { background: var(--asn-amber); }.copy-row .value { background: var(--asn-blue); }
.copy-row button { padding: 6px 3px; font: 12px/1.5 var(--asn-code); border: 1px solid var(--asn-line); }
.copy-other { margin-top: 8px; padding-top: 7px; border-top: 1px solid var(--asn-line); }
.copy-other button { display: flex; align-items: center; width: 100%; gap: 9px; padding: 7px; text-align: left; }
.copy-other button span { margin-left: auto; font-size: 11px; color: var(--asn-muted); }
@media (max-width: 380px) { .copy-row { grid-template-columns: 88px 44px 58px 1fr; gap: 1px; }.copy-row button { font-size: 11px; } }
</style>
