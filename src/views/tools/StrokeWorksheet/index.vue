<template>
  <div class="stroke-tool">
    <header class="tool-heading">
      <div class="heading-icon" aria-hidden="true"><BookOpen :size="25" :stroke-width="1.7" /></div>
      <div>
        <h1>{{ t('tools.strokeWorksheet.title') }}</h1>
        <p>{{ t('tools.strokeWorksheet.description') }}</p>
      </div>
    </header>

    <div class="tool-layout">
      <section class="settings-panel" :aria-label="t('tools.strokeWorksheet.settings')">
        <div class="setting-group">
          <label class="setting-label" for="worksheet-characters">{{ t('tools.strokeWorksheet.characters') }}</label>
          <textarea
            id="worksheet-characters"
            v-model="input"
            rows="4"
            :placeholder="t('tools.strokeWorksheet.charactersPlaceholder')"
          />
          <p class="field-note">{{ t('tools.strokeWorksheet.charactersHint') }}</p>
        </div>

        <div class="setting-group">
          <div class="setting-label-row">
            <label class="setting-label" for="worksheet-size">{{ t('tools.strokeWorksheet.cellSize') }}</label>
            <span>{{ getColumnCount(cellMm) }} {{ t('tools.strokeWorksheet.columns') }}</span>
          </div>
          <select id="worksheet-size" v-model.number="cellMm">
            <option v-for="size in cellSizes" :key="size" :value="size">{{ size }} mm</option>
          </select>
        </div>

        <fieldset class="setting-group">
          <legend class="setting-label">{{ t('tools.strokeWorksheet.gridStyle') }}</legend>
          <div class="choice-grid">
            <label v-for="style in gridStyles" :key="style.value" class="choice" :class="{ active: gridStyle === style.value }">
              <input v-model="gridStyle" type="radio" name="worksheet-grid" :value="style.value" />
              <span>{{ t(style.label) }}</span>
            </label>
          </div>
        </fieldset>

        <div class="setting-pair">
          <div class="setting-group">
            <label class="setting-label" for="worksheet-trace">{{ t('tools.strokeWorksheet.traceRows') }}</label>
            <select id="worksheet-trace" v-model.number="traceRows">
              <option v-for="count in rowOptions" :key="count" :value="count">{{ count }} {{ t('tools.strokeWorksheet.rows') }}</option>
            </select>
          </div>
          <div class="setting-group">
            <label class="setting-label" for="worksheet-blank">{{ t('tools.strokeWorksheet.blankRows') }}</label>
            <select id="worksheet-blank" v-model.number="blankRows">
              <option v-for="count in rowOptions" :key="count" :value="count">{{ count }} {{ t('tools.strokeWorksheet.rows') }}</option>
            </select>
          </div>
        </div>

        <fieldset class="setting-group">
          <legend class="setting-label">{{ t('tools.strokeWorksheet.gridColor') }}</legend>
          <div class="color-options">
            <button
              v-for="color in gridColors"
              :key="color.value"
              type="button"
              class="color-choice"
              :class="{ selected: gridColor === color.value }"
              :style="{ '--swatch': color.value }"
              :aria-label="t(color.label)"
              :aria-pressed="gridColor === color.value"
              @click="gridColor = color.value"
            ><span /></button>
          </div>
        </fieldset>

        <div class="setting-group header-setting">
          <label class="checkbox-label">
            <input v-model="showHeader" type="checkbox" />
            <span>{{ t('tools.strokeWorksheet.showHeader') }}</span>
          </label>
          <input
            v-if="showHeader"
            v-model="customTitle"
            type="text"
            maxlength="20"
            :aria-label="t('tools.strokeWorksheet.headerTitle')"
            :placeholder="t('tools.strokeWorksheet.defaultHeader')"
          />
        </div>

        <div class="data-note">
          <span>{{ t('tools.strokeWorksheet.dataNote') }}</span>
          <a :href="licenseUrl" target="_blank" rel="noopener noreferrer">{{ t('tools.strokeWorksheet.license') }}</a>
        </div>
      </section>

      <section class="preview-panel" :aria-label="t('tools.strokeWorksheet.preview')">
        <div class="preview-toolbar">
          <div>
            <strong>{{ t('tools.strokeWorksheet.preview') }}</strong>
            <span class="paper-meta">A4 · 210 × 297 mm <span v-if="pages.length">· {{ pages.length }} {{ t('tools.strokeWorksheet.pages') }}</span></span>
          </div>
          <button class="print-button" type="button" :disabled="loading || pages.length === 0" @click="printWorksheet">
            <Printer :size="16" />
            {{ t('tools.strokeWorksheet.print') }}
          </button>
        </div>

        <div v-if="!loading && (skipped.length || inputLimited || failure)" class="preview-warning" role="status">
          <span v-if="inputLimited">{{ t('tools.strokeWorksheet.limitWarning') }}</span>
          <span v-if="skipped.length">{{ t('tools.strokeWorksheet.unsupported') }} {{ skipped.join('、') }}</span>
          <span v-if="failure && pages.length">{{ t('tools.strokeWorksheet.partialFailure') }}</span>
        </div>
        <div v-if="loading" class="preview-state" role="status">{{ t('tools.strokeWorksheet.loading') }}</div>
        <div v-else-if="pages.length === 0" class="preview-state" role="status">{{ failure ? t('tools.strokeWorksheet.loadFailed') : t('tools.strokeWorksheet.empty') }}</div>
        <template v-else>
          <div class="page-stack">
            <div v-for="(page, index) in pages" :key="index" class="page-item">
              <span class="page-caption">{{ t('tools.strokeWorksheet.page') }} {{ index + 1 }} / {{ pages.length }}</span>
              <div class="page-paper">
                <WorksheetPage v-bind="pageProps(page, index)" />
              </div>
            </div>
          </div>
        </template>
      </section>
    </div>

    <Teleport to="body">
      <div id="worksheet-print" aria-hidden="true">
        <div v-for="(page, index) in pages" :key="index" class="print-page">
          <WorksheetPage v-bind="pageProps(page, index)" />
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { BookOpen, Printer } from 'lucide-vue-next'
import WorksheetPage from './WorksheetPage.vue'
import { getColumnCount, layoutWorksheet } from './worksheet'
import type { GridStyle, StrokeGlyph, WorksheetCharacter, WorksheetPage as Page } from './worksheet'

const { t } = useI18n()
const cellSizes = [12, 14, 16, 18, 20, 24]
const rowOptions = [0, 1, 2]
const gridStyles: { value: GridStyle; label: string }[] = [
  { value: 'tian', label: 'tools.strokeWorksheet.tian' },
  { value: 'mi', label: 'tools.strokeWorksheet.mi' },
  { value: 'square', label: 'tools.strokeWorksheet.square' },
  { value: 'none', label: 'tools.strokeWorksheet.noGrid' },
]
const gridColors = [
  { value: '#c6d3e3', label: 'tools.strokeWorksheet.blue' },
  { value: '#e7c4c4', label: 'tools.strokeWorksheet.red' },
  { value: '#cfd4db', label: 'tools.strokeWorksheet.gray' },
]

const input = ref('实践是检验真理的唯一标准')
const cellMm = ref(16)
const gridStyle = ref<GridStyle>('tian')
const gridColor = ref(gridColors[0].value)
const traceRows = ref(1)
const blankRows = ref(1)
const showHeader = ref(true)
const customTitle = ref('')
const renderedCharacters = ref<WorksheetCharacter[]>([])
const skipped = ref<string[]>([])
const loading = ref(false)
const failure = ref(false)
const inputLimited = ref(false)
const glyphCache = new Map<string, StrokeGlyph | null>()
const maxCharacters = 80
const licenseUrl = `${import.meta.env.BASE_URL}hanzi-strokes/ARPHICPL.TXT`
const headerTitle = computed(() => customTitle.value.trim() || t('tools.strokeWorksheet.defaultHeader'))
const pages = computed(() => layoutWorksheet(renderedCharacters.value, {
  cellMm: cellMm.value,
  traceRows: traceRows.value,
  blankRows: blankRows.value,
  showHeader: showHeader.value,
}))

watch(input, (value, _oldValue, onCleanup) => {
  const controller = new AbortController()
  const characters = Array.from(value).filter(character => /\p{Script=Han}/u.test(character))
  inputLimited.value = characters.length > maxCharacters
  const limited = characters.slice(0, maxCharacters)
  loading.value = limited.length > 0
  failure.value = false
  skipped.value = []

  if (!limited.length) {
    renderedCharacters.value = []
    return
  }

  const timer = window.setTimeout(async () => {
    let loadFailed = false
    await Promise.all([...new Set(limited)].map(async character => {
      if (glyphCache.has(character)) return
      try {
        const url = `${import.meta.env.BASE_URL}hanzi-strokes/${encodeURIComponent(character)}.json`
        const response = await fetch(url, { signal: controller.signal })
        if (response.status === 404) {
          glyphCache.set(character, null)
          return
        }
        if (!response.ok) throw new Error(`Stroke data HTTP ${response.status}`)
        if (!response.headers.get('content-type')?.includes('application/json')) {
          glyphCache.set(character, null)
          return
        }
        const data: unknown = await response.json()
        if (!isStrokeGlyph(data)) {
          glyphCache.set(character, null)
          return
        }
        glyphCache.set(character, data)
      } catch (error) {
        if (!controller.signal.aborted) loadFailed = true
      }
    }))

    if (controller.signal.aborted) return
    renderedCharacters.value = limited.flatMap(character => {
      const glyph = glyphCache.get(character)
      return glyph ? [{ character, glyph }] : []
    })
    skipped.value = [...new Set(limited.filter(character => glyphCache.get(character) === null))]
    failure.value = loadFailed
    loading.value = false
  }, 180)

  onCleanup(() => {
    window.clearTimeout(timer)
    controller.abort()
  })
}, { immediate: true })

function isStrokeGlyph(data: unknown): data is StrokeGlyph {
  if (typeof data !== 'object' || data === null || !('strokes' in data)) return false
  const strokes = (data as { strokes: unknown }).strokes
  return Array.isArray(strokes) && strokes.length > 0 && strokes.length <= 64 && strokes.every(stroke => typeof stroke === 'string' && stroke.length < 20000)
}

function pageProps(page: Page, index: number) {
  return {
    page,
    pageIndex: index,
    pageCount: pages.value.length,
    cellMm: cellMm.value,
    gridStyle: gridStyle.value,
    gridColor: gridColor.value,
    inkColor: '#213149',
    traceColor: '#c5cbd3',
    showHeader: showHeader.value,
    headerTitle: headerTitle.value,
    nameLabel: t('tools.strokeWorksheet.name'),
    dateLabel: t('tools.strokeWorksheet.date'),
    pageLabel: t('tools.strokeWorksheet.page'),
  }
}

function printWorksheet() {
  if (!loading.value && pages.value.length) window.print()
}
</script>

<style scoped>
.stroke-tool { max-width: 1450px; margin: 0 auto; color: hsl(var(--foreground)); }
.tool-heading { display: flex; align-items: center; gap: 14px; margin: 0 0 24px; }
.heading-icon { display: grid; place-items: center; width: 48px; height: 48px; border: 1px solid #bbd0e5; border-radius: 12px; background: #eaf2fa; color: #21517e; flex: none; }
.tool-heading h1 { font-size: 25px; line-height: 1.2; font-weight: 700; letter-spacing: -0.02em; }
.tool-heading p { margin: 5px 0 0; color: hsl(var(--muted-foreground)); font-size: 14px; }
.tool-layout { display: grid; grid-template-columns: minmax(280px, 330px) minmax(0, 1fr); gap: 22px; align-items: start; }
.settings-panel { background: hsl(var(--card)); border: 1px solid hsl(var(--border)); border-radius: 12px; padding: 21px; display: flex; flex-direction: column; gap: 21px; }
.setting-group { min-width: 0; margin: 0; padding: 0; border: 0; }
.setting-label { display: block; color: hsl(var(--foreground)); font-size: 13px; font-weight: 650; margin: 0 0 8px; }
.setting-label-row { display: flex; justify-content: space-between; align-items: baseline; gap: 8px; }
.setting-label-row span, .field-note { color: hsl(var(--muted-foreground)); font-size: 12px; }
.field-note { margin: 6px 0 0; line-height: 1.45; }
.settings-panel textarea, .settings-panel select, .header-setting > input { width: 100%; border: 1px solid hsl(var(--input)); background: hsl(var(--background)); color: hsl(var(--foreground)); border-radius: 7px; padding: 9px 11px; font-size: 14px; outline: none; }
.settings-panel textarea { min-height: 92px; resize: vertical; line-height: 1.55; }
.settings-panel select { height: 39px; }
.settings-panel textarea:focus-visible, .settings-panel select:focus-visible, .header-setting > input:focus-visible { border-color: #3978b4; box-shadow: 0 0 0 2px #3978b42c; }
.choice-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 7px; }
.choice { position: relative; display: grid; place-items: center; min-height: 36px; border: 1px solid hsl(var(--input)); border-radius: 7px; font-size: 13px; cursor: pointer; user-select: none; }
.choice input { position: absolute; opacity: 0; inset: 0; cursor: pointer; }
.choice.active { color: #174d80; border-color: #6e9ecb; background: #eaf3fc; font-weight: 650; }
.choice:focus-within { outline: 2px solid #3978b4; outline-offset: 2px; }
.setting-pair { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
.color-options { display: flex; align-items: center; gap: 10px; padding: 2px 0; }
.color-choice { width: 34px; height: 34px; display: grid; place-items: center; background: transparent; border: 2px solid transparent; border-radius: 8px; cursor: pointer; }
.color-choice span { display: block; width: 24px; height: 24px; border: 1px solid #aab3bd; border-radius: 5px; background: var(--swatch); }
.color-choice.selected { border-color: #2c659d; }
.color-choice:focus-visible { outline: 2px solid #3978b4; outline-offset: 2px; }
.header-setting { display: flex; flex-direction: column; gap: 10px; padding-top: 17px; border-top: 1px solid hsl(var(--border)); }
.checkbox-label { display: flex; align-items: center; gap: 9px; font-size: 13px; cursor: pointer; }
.checkbox-label input { width: 15px; height: 15px; accent-color: #28649c; }
.data-note { display: flex; flex-wrap: wrap; gap: 4px; border-top: 1px solid hsl(var(--border)); padding-top: 16px; color: hsl(var(--muted-foreground)); font-size: 11px; line-height: 1.5; }
.data-note a { color: #246293; text-decoration: underline; text-underline-offset: 2px; }
.preview-panel { min-width: 0; border: 1px solid hsl(var(--border)); border-radius: 12px; background: hsl(var(--card)); overflow: hidden; }
.preview-toolbar { display: flex; justify-content: space-between; align-items: center; gap: 16px; padding: 16px 20px; border-bottom: 1px solid hsl(var(--border)); }
.preview-toolbar > div { display: flex; flex-direction: column; gap: 3px; min-width: 0; }
.preview-toolbar strong { font-size: 15px; font-weight: 650; }
.paper-meta { color: hsl(var(--muted-foreground)); font-size: 12px; }
.print-button { flex: none; display: inline-flex; align-items: center; justify-content: center; gap: 7px; min-height: 38px; padding: 0 14px; background: #245884; color: #fff; border: 0; border-radius: 7px; font-size: 13px; font-weight: 650; cursor: pointer; }
.print-button:hover:not(:disabled) { background: #19466d; }
.print-button:disabled { opacity: 0.45; cursor: not-allowed; }
.print-button:focus-visible { outline: 2px solid #3978b4; outline-offset: 3px; }
.preview-state { min-height: 330px; display: grid; place-items: center; padding: 32px; color: hsl(var(--muted-foreground)); font-size: 14px; text-align: center; }
.preview-warning { display: flex; flex-wrap: wrap; gap: 8px 16px; padding: 10px 20px; border-bottom: 1px solid #e8d9bb; background: #fff8e9; color: #78531d; font-size: 12px; }
.page-stack { display: flex; flex-direction: column; align-items: center; gap: 24px; padding: 24px; background: #e8edf3; }
.page-item { width: min(100%, 620px); }
.page-caption { display: block; margin-bottom: 9px; text-align: center; color: #667789; font-size: 12px; }
.page-paper { overflow: hidden; background: #fff; box-shadow: 0 3px 12px #25384b1c, 0 0 0 1px #dbe2e9; }
@media (max-width: 920px) { .tool-layout { grid-template-columns: 1fr; } .settings-panel { display: grid; grid-template-columns: 1fr 1fr; align-items: start; } .settings-panel > .setting-group:first-child, .settings-panel > .setting-pair, .settings-panel > .header-setting, .settings-panel > .data-note { grid-column: 1 / -1; } }
@media (max-width: 600px) { .tool-heading { align-items: flex-start; } .tool-heading h1 { font-size: 22px; } .settings-panel { display: flex; padding: 17px; } .preview-toolbar { padding: 14px; } .page-stack { padding: 13px; } }
</style>

<style>
@media screen { #worksheet-print { display: none; } }
@media print {
  @page { size: A4 portrait; margin: 0; }
  html, body { width: 210mm !important; margin: 0 !important; padding: 0 !important; }
  body > :not(#worksheet-print) { display: none !important; }
  #worksheet-print { display: block !important; width: 210mm; margin: 0; padding: 0; }
  #worksheet-print .print-page { width: 210mm; height: 297mm; overflow: hidden; break-after: page; page-break-after: always; }
  #worksheet-print .print-page:last-child { break-after: auto; page-break-after: auto; }
  #worksheet-print .worksheet-svg { width: 210mm !important; height: 297mm !important; }
}
</style>
