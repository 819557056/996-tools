<template>
  <svg
    class="worksheet-svg"
    xmlns="http://www.w3.org/2000/svg"
    :viewBox="`0 0 ${A4_WIDTH_MM} ${A4_HEIGHT_MM}`"
    :aria-label="`${headerTitle} ${pageIndex + 1} / ${pageCount}`"
    role="img"
  >
    <rect width="210" height="297" fill="#ffffff" />

    <g v-if="showHeader" class="sheet-heading">
      <text x="14" y="22" fill="#1f2937" font-size="5.2" font-weight="600">{{ headerTitle }}</text>
      <text x="196" y="21.5" fill="#475569" font-size="3.1" text-anchor="end">{{ nameLabel }} __________　{{ dateLabel }} __________</text>
      <line x1="14" x2="196" y1="29" y2="29" stroke="#d8e0e8" stroke-width="0.25" />
    </g>

    <g v-for="(row, rowIndex) in page.rows" :key="rowIndex" :data-row-index="rowIndex">
      <g v-for="(cell, columnIndex) in row.cells" :key="columnIndex" :data-cell-index="columnIndex" :data-cell-kind="cell.kind" :data-step="cell.step">
        <g v-if="gridStyle !== 'none'" :stroke="gridColor" fill="none" stroke-width="0.2">
          <rect :x="getCellX(columnIndex)" :y="row.y" :width="cellMm" :height="cellMm" />
          <g v-if="gridStyle === 'tian' || gridStyle === 'mi'" stroke-width="0.14" stroke-dasharray="1.1 0.95">
            <line :x1="getCellX(columnIndex) + cellMm / 2" :x2="getCellX(columnIndex) + cellMm / 2" :y1="row.y" :y2="row.y + cellMm" />
            <line :x1="getCellX(columnIndex)" :x2="getCellX(columnIndex) + cellMm" :y1="row.y + cellMm / 2" :y2="row.y + cellMm / 2" />
            <g v-if="gridStyle === 'mi'">
              <line :x1="getCellX(columnIndex)" :x2="getCellX(columnIndex) + cellMm" :y1="row.y" :y2="row.y + cellMm" />
              <line :x1="getCellX(columnIndex) + cellMm" :x2="getCellX(columnIndex)" :y1="row.y" :y2="row.y + cellMm" />
            </g>
          </g>
        </g>

        <g v-if="cell.kind !== 'blank'" :transform="getGlyphTransform(columnIndex, row.y)">
          <path
            v-for="(stroke, strokeIndex) in visibleStrokes(cell)"
            :key="strokeIndex"
            :d="stroke"
            :fill="getStrokeColor(cell, strokeIndex)"
          />
        </g>
      </g>
    </g>

    <text x="196" y="288" fill="#8a98a8" font-size="3" text-anchor="end">{{ pageLabel }} {{ pageIndex + 1 }} / {{ pageCount }}</text>
  </svg>
</template>

<script setup lang="ts">
import { A4_HEIGHT_MM, A4_WIDTH_MM, getGridStartX } from './worksheet'
import type { GridStyle, WorksheetCell, WorksheetPage } from './worksheet'

const props = defineProps<{
  page: WorksheetPage
  pageIndex: number
  pageCount: number
  cellMm: number
  gridStyle: GridStyle
  gridColor: string
  inkColor: string
  traceColor: string
  showHeader: boolean
  headerTitle: string
  nameLabel: string
  dateLabel: string
  pageLabel: string
}>()

function getCellX(columnIndex: number): number {
  return getGridStartX(props.cellMm) + columnIndex * props.cellMm
}

function getGlyphTransform(columnIndex: number, y: number): string {
  const inset = props.cellMm * 0.02
  const scale = props.cellMm / 1024
  return `translate(${getCellX(columnIndex) + inset} ${y + inset}) scale(${scale}) translate(0 900) scale(1 -1)`
}

function visibleStrokes(cell: WorksheetCell): string[] {
  return cell.kind === 'step' ? cell.glyph.strokes.slice(0, cell.step) : cell.glyph.strokes
}

function getStrokeColor(cell: WorksheetCell, strokeIndex: number): string {
  if (cell.kind === 'trace') return props.traceColor
  if (cell.kind === 'step' && strokeIndex < (cell.step || 0) - 1) return '#aab7c6'
  return props.inkColor
}
</script>

<style scoped>
.worksheet-svg {
  display: block;
  width: 100%;
  height: auto;
  aspect-ratio: 210 / 297;
  background: #fff;
}

.sheet-heading {
  font-family: "Microsoft YaHei", "Noto Sans CJK SC", sans-serif;
}
</style>
