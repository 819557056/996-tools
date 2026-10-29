<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { Braces, ChevronRight, ChevronDown, ChevronsDownUp, ChevronsUpDown, Check, CircleHelp,
  Copy, Download, FileCode2, FileText, FolderOpen, Hexagon, Layers3, LoaderCircle, LockKeyhole,
  Maximize2, Minimize2, Play, Search, TextCursorInput, Upload, X, ArrowLeft, ArrowRight, Info } from 'lucide-vue-next'
import { useAsn1Decoder } from '@/composables/useAsn1Decoder'
import { useAsn1Export } from '@/composables/useAsn1Export'
import { downloadBlob } from '@/utils/download'
import { ASN1_MAX_BYTES, definitionOptions, type Asn1Node, type InputFormat, type Asn1Part, type Asn1Encoding } from '@/utils/asn1/types'
import { samples } from './samples'
import NodeContextMenu from './NodeContextMenu.vue'
import NodeTooltip from './NodeTooltip.vue'

const { t } = useI18n()
const decoder = useAsn1Decoder()
const exporter = useAsn1Export()
const { result, loading, error } = decoder
const text = ref(''), mode = ref<'text' | 'file'>('text'), format = ref<InputFormat>('auto'), definition = ref('auto')
const annotations = ref(true), sourceName = ref(''), exampleId = ref(''), dirty = ref(false)
const resultName = ref('')
const fileBytes = ref<Uint8Array>(), fileInput = ref<HTMLInputElement>(), reading = ref(false), dragging = ref(false)
const inputOpen = ref(true), helpOpen = ref(false), focusMode = ref(false)
const detailsOpen = ref(false)
const selectedId = ref(''), hoveredId = ref(''), expanded = ref(new Set<string>()), query = ref('')
const onlySelected = ref(false), hexPage = ref(0), notice = ref(''), copyFeedback = ref('')
const treeEl = ref<HTMLElement>(), mobilePanel = ref<'tree' | 'bytes'>('tree')
const inspectorEl = ref<HTMLElement>(), gridEl = ref<HTMLElement>(), hexEl = ref<HTMLElement>()
const hexColumns = ref(16), split = ref<number>(), gridWidth = ref(1100)
const splitPercent = computed(() => split.value ?? (gridWidth.value - 269) / gridWidth.value * 100)
const HEX_PAGE_SIZE = 4096
const nodeMenu = ref<{ node: Asn1Node; x: number; y: number }>()
const nodeTooltip = ref<{ node: Asn1Node; x: number; y: number }>()
let menuTrigger: HTMLElement | undefined
let resizeObserver: ResizeObserver | undefined
let gridObserver: ResizeObserver | undefined
let dragBounds: DOMRect | undefined
let tooltipTimer: ReturnType<typeof setTimeout> | undefined
let readVersion = 0
let feedbackTimer: ReturnType<typeof setTimeout> | undefined
const nodeMap = computed(() => new Map((result.value?.nodes || []).map(node => [node.id, node])))
const selected = computed(() => nodeMap.value.get(selectedId.value))
const highlighted = computed(() => nodeMap.value.get(hoveredId.value) || selected.value)
const ancestorIds = computed(() => {
  const ids = new Set<string>()
  let parent = highlighted.value?.parent
  while (parent) { ids.add(parent); parent = nodeMap.value.get(parent)?.parent }
  return ids
})
const byteTypes = computed(() => {
  const types = new Uint8Array(result.value?.bytes.length || 0)
  for (const node of result.value?.nodes || []) {
    types.fill(1, node.offset, node.lengthOffset)
    types.fill(2, node.lengthOffset, node.contentOffset)
  }
  return types
})
const fieldLabels: Record<string, string> = {
  tbsCertificate: '证书主体', version: '版本', serialNumber: '序列号', signature: '签名',
  signatureAlgorithm: '签名算法', algorithm: '算法', parameters: '参数', issuer: '签发者',
  subject: '使用者', validity: '有效期', notBefore: '生效时间', notAfter: '到期时间',
  subjectPublicKeyInfo: '公钥信息', subjectPublicKey: '公钥', extensions: '扩展', extnID: '扩展标识',
  extnValue: '扩展值', critical: '关键扩展', privateKey: '私钥', privateKeyAlgorithm: '密钥算法',
}
const typeLabels: Record<string, string> = {
  SEQUENCE: '有序的节点集合', SET: '节点集合', INTEGER: '整数', 'OBJECT IDENTIFIER': '对象标识符',
  'BIT STRING': '比特串', 'OCTET STRING': '字节串', UTF8String: 'UTF-8 文本',
  PrintableString: '可打印文本', IA5String: 'ASCII 文本', UTCTime: 'UTC 时间', GeneralizedTime: '通用时间', BOOLEAN: '布尔值', NULL: '空值',
}
function title(node: Asn1Node) { return annotations.value && node.field ? node.field : node.type }
function shortType(node: Asn1Node) { return node.type === 'OBJECT IDENTIFIER' ? 'OID' : node.type }
function hex(offset: number, width = 4) { return offset.toString(16).toUpperCase().padStart(width, '0') }
function group(node: Asn1Node) { return node.oid ? 'oid' : node.children.length ? 'group' : node.type === 'INTEGER' ? 'number' : 'value' }
function preview(node: Asn1Node) {
  if (node.oid) return node.oid
  const value = node.value.replace(/\n/g, ' ')
  return value.length > 90 ? `${value.slice(0, 90)}…` : value
}
function guides(node: Asn1Node) {
  const path = [node]
  let parent = node.parent
  while (parent) { const item = nodeMap.value.get(parent)!; path.unshift(item); parent = item.parent }
  return path.slice(1).map((item, index) => ({ tail: index === path.length - 2, continues: nodeMap.value.get(item.parent!)?.children.at(-1) !== item.id }))
}
const matches = computed(() => {
  const term = query.value.trim().toLowerCase()
  return term ? (result.value?.nodes || []).filter(node => `${node.type} ${node.field} ${node.schema} ${fieldLabels[node.field.split(' ')[0]] || ''} ${node.value} ${node.oidName}`.toLowerCase().includes(term)) : []
})
const matchingIds = computed(() => new Set(matches.value.map(node => node.id)))
const visibleNodes = computed(() => {
  if (!result.value) return []
  if (query.value.trim()) {
    const show = new Set<string>()
    for (const node of matches.value) {
      let current: Asn1Node | undefined = node
      while (current) { show.add(current.id); current = current.parent ? nodeMap.value.get(current.parent) : undefined }
    }
    return result.value.nodes.filter(node => show.has(node.id)).slice(0, 700)
  }
  const visible = new Set<string>()
  return result.value.nodes.filter(node => {
    const show = !node.parent || visible.has(node.parent) && expanded.value.has(node.parent)
    if (show) visible.add(node.id)
    return show
  }).slice(0, 700)
})
const tabStopId = computed(() => visibleNodes.value.some(node => node.id === selectedId.value) ? selectedId.value : visibleNodes.value[0]?.id)
const breadcrumb = computed(() => {
  const path: Asn1Node[] = []
  let current = selected.value
  while (current) { path.unshift(current); current = current.parent ? nodeMap.value.get(current.parent) : undefined }
  return path
})
const hexRange = computed(() => ({ start: onlySelected.value ? selected.value?.offset || 0 : 0, end: onlySelected.value ? selected.value?.end || 0 : result.value?.bytes.length || 0 }))
const pageCount = computed(() => Math.max(1, Math.ceil((hexRange.value.end - hexRange.value.start) / HEX_PAGE_SIZE)))
const hexRows = computed(() => {
  if (!result.value) return []
  const rows: { offset: number; bytes: { value: number; offset: number }[]; ascii: string }[] = []
  const start = hexRange.value.start + Math.min(hexPage.value, pageCount.value - 1) * HEX_PAGE_SIZE
  const end = Math.min(start + HEX_PAGE_SIZE, hexRange.value.end)
  for (let pos = start; pos < end; pos += hexColumns.value) {
    const values = Array.from(result.value.bytes.slice(pos, Math.min(pos + hexColumns.value, end)))
    rows.push({ offset: pos, bytes: values.map((value, index) => ({ value, offset: pos + index })), ascii: values.map(value => value >= 32 && value <= 126 ? String.fromCharCode(value) : '·').join('') })
  }
  return rows
})
function bytePart(offset: number) {
  const node = highlighted.value
  if (!node || offset < node.offset || offset >= node.end) return byteTypes.value[offset] === 1 ? 'base-tag' : byteTypes.value[offset] === 2 ? 'base-length' : ''
  if (node.indefinite && offset >= node.end - 2) return 'eoc'
  return offset < node.lengthOffset ? 'tag' : offset < node.contentOffset ? 'length' : 'value'
}
function expandParents(node: Asn1Node) {
  let parent = node.parent
  while (parent) { expanded.value.add(parent); parent = nodeMap.value.get(parent)?.parent || null }
}
async function selectNode(node: Asn1Node, reveal = false) {
  hideTooltip()
  selectedId.value = node.id; hexPage.value = onlySelected.value ? 0 : Math.floor(node.offset / HEX_PAGE_SIZE)
  await nextTick()
  const byte = hexEl.value?.querySelector<HTMLElement>(`[data-byte="${node.offset}"]`)
  if (byte && hexEl.value) {
    const container = hexEl.value.getBoundingClientRect(), rect = byte.getBoundingClientRect()
    if (rect.top < container.top || rect.bottom > container.bottom) hexEl.value.scrollTop += rect.top - container.top - 16
  }
  if (reveal) { expandParents(node); await nextTick(); treeEl.value?.querySelector<HTMLElement>(`[data-node="${node.id}"]`)?.scrollIntoView({ block: 'nearest' }) }
}
function hideTooltip() { clearTimeout(tooltipTimer); nodeTooltip.value = undefined; hoveredId.value = '' }
function hoverNode(node: Asn1Node, event: MouseEvent) {
  hideTooltip()
  if (nodeMenu.value) return
  hoveredId.value = node.id
  tooltipTimer = setTimeout(() => { nodeTooltip.value = { node, x: event.clientX, y: event.clientY } }, 200)
}
function selectByte(offset: number) {
  const candidates = result.value?.nodes.filter(node => node.offset <= offset && node.end > offset) || []
  const node = candidates[candidates.length - 1]
  if (node) void selectNode(node, true)
}
function toggleNode(node: Asn1Node) { if (expanded.value.has(node.id)) expanded.value.delete(node.id); else expanded.value.add(node.id) }
async function openNodeMenu(node: Asn1Node, event: MouseEvent | KeyboardEvent) {
  event.preventDefault(); event.stopPropagation()
  menuTrigger = event.currentTarget as HTMLElement
  const rect = menuTrigger.getBoundingClientRect()
  await selectNode(node)
  nodeMenu.value = undefined
  await nextTick()
  const pointer = event instanceof MouseEvent && (event.clientX || event.clientY)
  nodeMenu.value = { node, x: pointer ? event.clientX : rect.left + 24, y: pointer ? event.clientY + 5 : rect.bottom }
}
function closeNodeMenu(restore = false) {
  nodeMenu.value = undefined
  if (restore) menuTrigger?.focus({ preventScroll: true })
}
function startResize(event: PointerEvent) {
  closeNodeMenu(); hideTooltip()
  dragBounds = (event.currentTarget as HTMLElement).parentElement!.getBoundingClientRect()
  ;(event.currentTarget as HTMLElement).setPointerCapture(event.pointerId)
}
function moveResize(event: PointerEvent) {
  if (dragBounds) split.value = Math.max(30, Math.min(85, (event.clientX - dragBounds.left) / dragBounds.width * 100))
}
function endResize() { dragBounds = undefined }
function partHex(part: 'tag' | 'length') {
  if (!selected.value || !result.value) return ''
  const node = selected.value
  return Array.from(result.value.bytes.slice(part === 'tag' ? node.offset : node.lengthOffset, part === 'tag' ? node.lengthOffset : node.contentOffset), byte => hex(byte, 2)).join(' ')
}
async function treeKey(event: KeyboardEvent, node: Asn1Node) {
  if (event.key === 'Enter' || event.key === 'ContextMenu' || event.key === 'F10' && event.shiftKey) { await openNodeMenu(node, event); return }
  const index = visibleNodes.value.findIndex(item => item.id === node.id)
  let next: Asn1Node | undefined
  switch (event.key) {
    case 'ArrowDown': next = visibleNodes.value[index + 1]; break
    case 'ArrowUp': next = visibleNodes.value[index - 1]; break
    case 'Home': next = visibleNodes.value[0]; break
    case 'End': next = visibleNodes.value[visibleNodes.value.length - 1]; break
    case 'ArrowRight': if (!expanded.value.has(node.id)) expanded.value.add(node.id); else next = nodeMap.value.get(node.children[0]); break
    case 'ArrowLeft': if (expanded.value.has(node.id)) expanded.value.delete(node.id); else next = node.parent ? nodeMap.value.get(node.parent) : undefined; break
    case ' ': toggleNode(node); break
    default: return
  }
  event.preventDefault()
  if (next) { await selectNode(next); await nextTick(); treeEl.value?.querySelector<HTMLElement>(`[data-node="${next.id}"]`)?.focus() }
}
async function parse() {
  closeNodeMenu(); hideTooltip()
  const name = sourceName.value
  const input = text.value, bytes = fileBytes.value, inputMode = mode.value, inputFormat = format.value
  const data = await decoder.decode({ text: mode.value === 'text' ? text.value : undefined, bytes: mode.value === 'file' ? fileBytes.value : undefined, format: format.value, definition: definition.value })
  if (!data) return
  resultName.value = name
  dirty.value = text.value !== input || fileBytes.value !== bytes || mode.value !== inputMode || format.value !== inputFormat
  query.value = ''
  inputOpen.value = dirty.value
  expanded.value = new Set(data.nodes.filter(node => data.nodes.length <= 500 || node.depth < 3).map(node => node.id))
  const initial = data.nodes.find(node => node.oid) || data.nodes[0]
  if (initial) { expandParents(initial); void selectNode(initial) }
}
async function loadExample(id: string) {
  const sample = samples.find(item => item.id === id)!
  readVersion++; reading.value = false; mode.value = 'text'; text.value = sample.text; format.value = 'auto'
  sourceName.value = sample.name; fileBytes.value = undefined; exampleId.value = id; inputOpen.value = true
  await parse()
}
async function readFile(file?: File) {
  if (!file) return
  const version = ++readVersion
  reading.value = false
  if (file.size > ASN1_MAX_BYTES) { error.value = '文件超过 2 MB，请选择较小的 ASN.1 文件。'; return }
  reading.value = true
  try {
    const bytes = new Uint8Array(await file.arrayBuffer())
    if (version !== readVersion) return
    mode.value = 'file'; inputOpen.value = true; fileBytes.value = bytes; sourceName.value = file.name; exampleId.value = ''; dirty.value = true; error.value = ''
  } catch { if (version === readVersion) error.value = '无法读取文件，请重新选择。' }
  finally { if (version === readVersion) reading.value = false }
}
function onDrop(event: DragEvent) { dragging.value = false; void readFile(event.dataTransfer?.files[0]) }
function clear() {
  closeNodeMenu(); hideTooltip()
  readVersion++; decoder.clear(); text.value = ''; fileBytes.value = undefined; sourceName.value = ''; exampleId.value = ''
  resultName.value = ''; notice.value = ''
  selectedId.value = ''; query.value = ''; dirty.value = false; reading.value = false; inputOpen.value = true
  if (fileInput.value) fileInput.value.value = ''
}
async function copyPart(part: Asn1Part, encoding: Asn1Encoding) {
  const node = nodeMenu.value?.node || selected.value
  if (!node || !result.value || exporter.busy.value) return
  const bytes = result.value.bytes
  closeNodeMenu(true)
  try {
    const output = await exporter.exportText({ action: 'export', bytes, offset: node.offset, part, encoding })
    await navigator.clipboard.writeText(output)
    const name = { node: '完整节点', tag: 'Tag', length: 'Length', value: 'Value' }[part]
    const label = { hex: 'Hex', 'hex-compact': '连续 Hex', base64: 'Base64', base64url: 'Base64URL', readable: '可读值', tree: '结构树' }[encoding]
    copyFeedback.value = `已复制${name} · ${label}`; notice.value = ''
    clearTimeout(feedbackTimer); feedbackTimer = setTimeout(() => copyFeedback.value = '', 2600)
  } catch (error) { notice.value = error instanceof Error ? `复制失败：${error.message} 可下载节点数据。` : '复制失败，可下载节点数据。' }
}
function downloadNode(all = false) {
  if (!result.value || !selected.value) return
  closeNodeMenu(true)
  const bytes = all ? result.value.bytes : result.value.bytes.slice(selected.value.offset, selected.value.end)
  downloadBlob(new Blob([bytes.slice().buffer as ArrayBuffer], { type: 'application/octet-stream' }), all ? 'decoded-data.asn1' : `node-${hex(selected.value.offset)}.asn1`)
}
function exitFocus(event: KeyboardEvent) { if (event.key === 'Escape') { if (nodeMenu.value) closeNodeMenu(true); else focusMode.value = false } }
watch([text, format, mode], () => { if (result.value) dirty.value = true })
watch([focusMode, query], hideTooltip)
watch(onlySelected, () => { hexPage.value = onlySelected.value ? 0 : Math.floor((selected.value?.offset || 0) / HEX_PAGE_SIZE) })
watch(inspectorEl, element => {
  resizeObserver?.disconnect()
  if (!element) return
  resizeObserver = new ResizeObserver(entries => { const width = entries[0].contentRect.width; if (width > 0) hexColumns.value = width < 244 ? 8 : 16 })
  resizeObserver.observe(element)
})
watch(gridEl, element => {
  gridObserver?.disconnect()
  if (!element) return
  gridObserver = new ResizeObserver(entries => { gridWidth.value = entries[0].contentRect.width })
  gridObserver.observe(element)
})
onMounted(() => { void loadExample('rsa'); document.addEventListener('keydown', exitFocus); window.addEventListener('resize', hideTooltip); window.addEventListener('scroll', hideTooltip, true) })
onBeforeUnmount(() => { readVersion++; clearTimeout(feedbackTimer); hideTooltip(); resizeObserver?.disconnect(); gridObserver?.disconnect(); document.removeEventListener('keydown', exitFocus); window.removeEventListener('resize', hideTooltip); window.removeEventListener('scroll', hideTooltip, true) })
</script>

<template>
  <div class="asn-workbench" :class="{ 'asn-focus': focusMode }" :style="{ '--asn-tree-size': split ? `${split}%` : '1fr', '--asn-hex-size': split ? '1fr' : '264px' }">
    <header class="asn-heading">
      <div class="asn-heading-copy"><div class="asn-title-line"><span class="asn-app-icon"><Braces /></span><h1>{{ t('tools.certificate-parser.title') }}</h1></div><p>查看证书、密钥与消息的层级结构，定位每一个原始字节。</p></div>
      <div class="asn-header-actions"><span class="asn-local"><LockKeyhole /> 本地解析</span><button type="button" class="asn-icon-button" aria-label="使用说明" :aria-expanded="helpOpen" @click="helpOpen = !helpOpen"><CircleHelp /></button><button v-if="focusMode" type="button" class="asn-button" @click="focusMode = false"><Minimize2 /> 退出专注</button></div>
    </header>
    <div v-if="helpOpen" class="asn-help"><Info /><div><strong>从结构到字节</strong><p>粘贴 PEM、Base64 或 HEX，也可以选择 DER / BER 文件。单击或右键点击节点可复制、导出，点击箭头展开子节点；点击字节反向定位。Tag 表示类型，Length 表示长度，Value 是实际内容。</p><small>结构定义用于辅助阅读；解析结果不代表证书已通过签名或信任验证。</small></div><button class="asn-icon-button" aria-label="关闭使用说明" @click="helpOpen = false"><X /></button></div>

    <section class="asn-input-panel" aria-label="ASN.1 数据输入" :class="{ dragging, 'input-collapsed': !inputOpen }" @dragover.prevent="dragging = true" @dragleave.prevent="dragging = false" @drop.prevent="onDrop">
      <div class="asn-input-toolbar"><div class="asn-tabs" role="tablist" aria-label="输入方式"><button role="tab" :aria-selected="mode === 'text'" :class="{ active: mode === 'text' }" @click="mode = 'text'; inputOpen = true"><TextCursorInput /> 文本输入</button><button role="tab" :aria-selected="mode === 'file'" :class="{ active: mode === 'file' }" @click="mode = 'file'; inputOpen = true"><FolderOpen /> 本地文件</button></div><div class="asn-input-options"><span v-if="!inputOpen" class="asn-input-summary">展开以粘贴数据或更换文件</span><label for="asn-input-format">输入格式</label><select id="asn-input-format" v-model="format"><option value="auto">自动识别</option><option value="pem">PEM</option><option value="base64">Base64</option><option value="hex">HEX</option></select><button type="button" class="asn-icon-button" :aria-label="inputOpen ? '收起输入区' : '展开输入区'" :aria-expanded="inputOpen" @click="inputOpen = !inputOpen"><ChevronDown :class="{ rotated: inputOpen }" /></button></div></div>
      <div v-show="inputOpen" class="asn-input-body">
        <div v-if="mode === 'text'" class="asn-editor"><span class="asn-editor-gutter" aria-hidden="true">1<br />2<br />3</span><textarea v-model="text" aria-label="ASN.1 数据" spellcheck="false" rows="3" placeholder="在这里粘贴 PEM、Base64 或十六进制数据…" @input="exampleId = ''; sourceName = '文本输入'" @keydown.ctrl.enter.prevent="parse" @keydown.meta.enter.prevent="parse" /><span v-if="exampleId" class="asn-example-mark">示例数据</span></div>
        <button v-else type="button" class="asn-dropzone" @click="fileInput?.click()"><Upload /><span><strong>{{ reading ? '正在读取…' : fileBytes ? sourceName : '选择文件，或拖放到这里' }}</strong><small>{{ fileBytes ? `${fileBytes.length.toLocaleString()} 字节 · 点击更换文件` : '证书、密钥、CSR、CMS 或任意 ASN.1 数据 · 最大 2 MB' }}</small></span><span class="asn-file-browse">浏览文件</span></button>
        <input ref="fileInput" type="file" class="asn-hidden-input" aria-label="选择 ASN.1 文件" @change="readFile(($event.target as HTMLInputElement).files?.[0])" />
      </div>
      <footer v-show="inputOpen" class="asn-input-footer"><div class="asn-examples"><span>试试示例</span><button v-for="sample in samples" :key="sample.id" type="button" :class="{ chosen: exampleId === sample.id }" :disabled="loading" @click="loadExample(sample.id)">{{ sample.label }}</button></div><div class="asn-parse-actions"><button type="button" class="asn-text-button" :disabled="loading" @click="clear">清空</button><button v-if="loading" type="button" class="asn-button" @click="decoder.stop"><X /> 停止</button><button type="button" class="asn-button asn-primary" :disabled="loading || reading || (mode === 'text' ? !text.trim() : !fileBytes)" @click="parse"><LoaderCircle v-if="loading" class="asn-spin" /><Play v-else />{{ loading ? '正在解析' : '解析数据' }}<kbd v-if="!loading">Ctrl ↵</kbd></button></div></footer>
    </section>
    <div v-if="error" class="asn-error" role="alert"><Info /><div><strong>数据暂时无法解析</strong><p>{{ error }}</p><small>可检查数据是否完整，或手动选择输入格式。{{ result ? '下方仍显示上一次成功解析的结果。' : '' }}</small></div></div>
    <div v-if="notice" class="asn-error" role="status">{{ notice }}<button class="asn-icon-button" aria-label="关闭提示" @click="notice = ''"><X /></button></div>

    <section v-if="result" class="asn-result" aria-label="ASN.1 解析结果">
      <div class="asn-document-bar"><div class="asn-document-name"><FileCode2 /><strong>{{ resultName || 'ASN.1 数据' }}</strong><span class="asn-format-badge">{{ result.format }}</span></div><div class="asn-document-meta"><span v-if="dirty" class="asn-dirty">输入已修改，解析后更新</span><template v-else><span class="asn-decoded"><Check /> 结构已解码</span><span>{{ result.bytes.length.toLocaleString() }} 字节</span><span>{{ result.nodes.length }} 节点</span></template><button class="asn-icon-button" aria-label="下载原始数据" title="下载原始数据" @click="downloadNode(true)"><Download /></button><button class="asn-icon-button" :aria-label="focusMode ? '退出专注模式' : '进入专注模式'" :title="focusMode ? '退出专注模式' : '进入专注模式'" @click="focusMode = !focusMode"><Minimize2 v-if="focusMode" /><Maximize2 v-else /></button></div></div>
      <div class="asn-result-controls"><label class="asn-search"><Search /><input v-model="query" aria-label="搜索节点" placeholder="搜索类型、字段、OID 或值…" /><span v-if="query">{{ matches.length }} 项</span><button v-if="query" class="asn-icon-button" aria-label="清除搜索" @click="query = ''"><X /></button></label><div class="asn-definition"><label for="asn-definition">结构定义</label><select id="asn-definition" v-model="definition" :disabled="loading" @change="parse"><option v-for="option in definitionOptions" :key="option.value" :value="option.value">{{ option.label }}</option></select></div></div>
      <div class="asn-mobile-tabs" role="tablist" aria-label="结果面板"><button role="tab" :aria-selected="mobilePanel === 'tree'" @click="mobilePanel = 'tree'"><Layers3 /> 结构树</button><button role="tab" :aria-selected="mobilePanel === 'bytes'" @click="mobilePanel = 'bytes'"><Hexagon /> 节点与字节</button></div>
      <div ref="gridEl" class="asn-analysis-grid">
        <section class="asn-tree-pane" :class="{ 'mobile-hidden': mobilePanel !== 'tree' }" aria-label="结构树面板">
          <header class="asn-pane-heading"><h2><Layers3 /> ASN.1 结构</h2><div><label class="asn-check"><input v-model="annotations" type="checkbox" /> 字段定义</label><button class="asn-icon-button" aria-label="展开全部节点" title="展开全部" @click="expanded = new Set(result.nodes.map(node => node.id))"><ChevronsUpDown /></button><button class="asn-icon-button" aria-label="收起全部节点" title="收起全部" @click="query = ''; expanded = new Set()"><ChevronsDownUp /></button></div></header>
          <div ref="treeEl" class="asn-tree-scroll" role="tree" aria-label="ASN.1 结构树" @scroll="hideTooltip">
            <div v-for="node in visibleNodes" :key="node.id" :data-node="node.id" role="treeitem" :aria-level="node.depth + 1" :aria-selected="selectedId === node.id" :aria-expanded="node.children.length ? expanded.has(node.id) || !!query : undefined" :tabindex="tabStopId === node.id ? 0 : -1" :aria-label="`${title(node)}，${shortType(node)}，偏移 ${node.offset}`" class="asn-tree-row" :class="{ selected: selectedId === node.id, 'search-match': matchingIds.has(node.id), ancestor: ancestorIds.has(node.id) }" @click="openNodeMenu(node, $event)" @contextmenu.prevent="openNodeMenu(node, $event)" aria-haspopup="menu" :aria-describedby="nodeTooltip?.node.id === node.id ? 'asn-node-tooltip' : undefined" @mouseenter="hoverNode(node, $event)" @mouseleave="hideTooltip" @keydown="treeKey($event, node)">
              <div class="asn-node-main">
                <span class="asn-tree-guides" aria-hidden="true"><i v-for="(guide, index) in guides(node)" :key="index" :class="guide" /></span>
                <button v-if="node.children.length" type="button" class="asn-node-toggle" tabindex="-1" :aria-label="`${expanded.has(node.id) ? '收起' : '展开'} ${title(node)}`" @click.stop="hideTooltip(); toggleNode(node)"><span class="asn-expand-marker" :class="{ open: expanded.has(node.id) || !!query }" /></button>
                <span v-else class="asn-node-toggle" />
                <div class="asn-node-copy">
                  <strong v-if="annotations && node.field">{{ node.field }}</strong>
                  <span v-if="annotations && node.schema && node.schema !== node.type" class="asn-node-schema">{{ node.schema }}</span>
                  <span v-if="annotations && node.definitionMismatch" class="asn-node-schema" title="此处未匹配到具体结构定义">[?]</span>
                  <span class="asn-type">{{ node.type }}</span>
                  <span class="asn-node-preview">{{ preview(node) }}</span>
                  <span v-if="node.oidName" class="asn-oid-name">{{ node.oidName }}</span>
                </div>
              </div>
            </div>
            <div v-if="!visibleNodes.length" class="asn-no-match"><Search /><strong>没有匹配的节点</strong><p>试试类型、字段名，或 OID 的一部分。</p><button class="asn-text-button" @click="query = ''">清除搜索</button></div>
            <p v-if="visibleNodes.length === 700" class="asn-tree-limit">已显示前 700 个节点，请搜索或收起分支来缩小范围。</p>
          </div>
          <footer class="asn-tree-footer"><span><span class="asn-node-dot" /> {{ result.definition }}</span><span>悬浮查看详情 · 单击 / 右键复制</span></footer>
        </section>
        <div class="asn-divider" role="separator" aria-label="调整结构树宽度" aria-orientation="vertical" :aria-valuenow="Math.round(splitPercent)" :aria-valuemin="30" :aria-valuemax="85" tabindex="0" @pointerdown.prevent="startResize" @pointermove="moveResize" @pointerup="endResize" @pointercancel="endResize" @lostpointercapture="endResize" @dblclick="split = undefined" @keydown.left.prevent="split = Math.max(30, splitPercent - 2)" @keydown.right.prevent="split = Math.min(85, splitPercent + 2)"><span /></div>
        <section v-if="selected" ref="inspectorEl" class="asn-inspector" :class="{ 'mobile-hidden': mobilePanel !== 'bytes' }" aria-label="节点详情与十六进制">
          <header class="asn-pane-heading"><h2><Hexagon /> Hex</h2><div><button class="asn-icon-button" :aria-expanded="detailsOpen" :aria-label="detailsOpen ? '收起节点元信息' : '展开节点元信息'" title="选中节点的详细信息" @click="detailsOpen = !detailsOpen"><Info /></button><button class="asn-icon-button" aria-label="复制或导出节点" title="复制或导出选中节点" aria-haspopup="menu" :disabled="exporter.busy.value" @click="openNodeMenu(selected, $event)"><Copy /></button></div></header>
          <div v-if="detailsOpen" class="asn-node-detail"><nav class="asn-node-path" aria-label="节点路径"><template v-for="(node, index) in breadcrumb" :key="node.id"><ChevronRight v-if="index" /><button :title="title(node)" @click="selectNode(node, true)">{{ index === 0 ? '根节点' : title(node) }}</button></template></nav><div class="asn-selected-title"><span class="asn-type" :class="group(selected)">{{ selected.type }}</span><span>{{ fieldLabels[selected.field.split(' ')[0]] || typeLabels[selected.type] || '上下文标签' }}</span></div><div class="asn-selected-value"><code>{{ selected.oid || selected.value || (selected.type === 'NULL' ? 'NULL' : '—') }}</code><span v-if="selected.oidName">{{ selected.oidName }}</span></div><dl class="asn-node-metrics"><div><dt>Offset</dt><dd>{{ selected.offset }} <small>0x{{ hex(selected.offset) }}</small></dd></div><div><dt>Header</dt><dd>{{ selected.header }}</dd></div><div><dt>Length</dt><dd>{{ selected.indefinite ? '不定长' : selected.contentLength }}</dd></div></dl>
            <div class="asn-tlv-strip"><button title="复制 Tag 的 Hex" @click="copyPart('tag', 'hex')"><span class="tag">Tag</span><code>{{ partHex('tag') }}</code></button><button title="复制 Length 的 Hex" @click="copyPart('length', 'hex')"><span class="length">Length</span><code>{{ partHex('length') }}</code></button><button title="复制 Value 的 Hex" @click="copyPart('value', 'hex')"><span class="value">Value</span><code>{{ selected.indefinite ? selected.contentLength - 2 : selected.contentLength }} B</code><Copy /></button></div>
          </div>
          <div class="asn-hex-options"><label class="asn-check"><input v-model="onlySelected" type="checkbox" /> 仅选中节点</label><div class="asn-hex-legend"><span class="tag">T</span><span class="length">L</span><span class="value">V</span></div></div>
          <div ref="hexEl" class="asn-hex-scroll" aria-label="十六进制数据"><div class="asn-hex-table" :style="{ '--hex-columns': hexColumns }"><div v-for="row in hexRows" :key="row.offset" class="asn-hex-row"><span class="asn-hex-offset">{{ hex(row.offset, 6) }}</span><div class="asn-hex-bytes"><button v-for="byte in row.bytes" :key="byte.offset" :data-byte="byte.offset" class="asn-byte" :class="bytePart(byte.offset)" :aria-label="`偏移 0x${hex(byte.offset)}，字节 ${hex(byte.value, 2)}`" :title="`偏移 ${byte.offset} · 0x${hex(byte.offset)}`" @click="selectByte(byte.offset)" @contextmenu.prevent="selectByte(byte.offset); selected && openNodeMenu(selected, $event)">{{ hex(byte.value, 2) }}</button></div><span class="asn-hex-ascii">{{ row.ascii }}</span></div></div></div>
          <footer class="asn-hex-footer"><span>{{ hexRows[0] ? `0x${hex(hexRows[0].offset)} — 0x${hex(hexRows[hexRows.length - 1].bytes.slice(-1)[0].offset)}` : '无数据' }}</span><div v-if="pageCount > 1"><button class="asn-icon-button" aria-label="上一页字节" :disabled="hexPage <= 0" @click="hexPage--"><ArrowLeft /></button><span>{{ hexPage + 1 }} / {{ pageCount }}</span><button class="asn-icon-button" aria-label="下一页字节" :disabled="hexPage >= pageCount - 1" @click="hexPage++"><ArrowRight /></button></div></footer>
        </section>
      </div>
      <footer class="asn-status-bar"><span><LockKeyhole /> 数据只在当前浏览器中处理</span><span>结构解析 · 未执行签名验证 <span class="asn-status-time">{{ result.elapsed }} ms</span></span></footer>
    </section>
    <section v-else-if="!loading" class="asn-empty"><span><FileText /></span><h2>从一段数据，展开完整结构</h2><p>粘贴 ASN.1 编码或选择文件，也可以先打开示例。<br />支持证书、密钥、签名消息，以及通用 DER / BER 数据。</p><button class="asn-button" @click="loadExample('rsa')"><Play /> 查看证书示例</button></section>
    <NodeContextMenu v-if="nodeMenu" :key="nodeMenu.node.id + ':' + nodeMenu.x + ':' + nodeMenu.y" :node="nodeMenu.node" :x="nodeMenu.x" :y="nodeMenu.y" @close="closeNodeMenu" @copy="copyPart" @download="downloadNode()" />
    <NodeTooltip v-if="nodeTooltip && !nodeMenu" id="asn-node-tooltip" :node="nodeTooltip.node" :x="nodeTooltip.x" :y="nodeTooltip.y" />
    <div v-if="copyFeedback || exporter.busy.value" class="asn-copy-feedback" role="status"><LoaderCircle v-if="exporter.busy.value" class="asn-spin" /><Check v-else />{{ exporter.busy.value ? '正在准备完整节点内容…' : copyFeedback }}</div>
    <footer class="asn-credit">解析引擎 <a href="https://github.com/lapo-luchini/asn1js" target="_blank" rel="noopener noreferrer">ASN.1 JavaScript decoder</a><span>by Lapo Luchini · <a href="/licenses/lapo-asn1js.txt" target="_blank" rel="noopener noreferrer">ISC License</a></span></footer>
  </div>
</template>

<style scoped src="./style.css"></style>
