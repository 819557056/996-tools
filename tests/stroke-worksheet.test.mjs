import assert from 'node:assert/strict'
import { test } from 'node:test'
import { getColumnCount, getGridStartX, layoutWorksheet } from '../src/views/tools/StrokeWorksheet/worksheet.ts'

test('A4 grid is centered and stays within the printable area', () => {
  for (const size of [12, 14, 16, 18, 20, 24]) {
    const columns = getColumnCount(size)
    const left = getGridStartX(size)
    assert.ok(left >= 14)
    assert.ok(left + columns * size <= 196)
  }
})

test('long stroke sequences wrap without losing steps and paginate on A4', () => {
  const glyph = { strokes: Array.from({ length: 30 }, (_, index) => `M ${index} 0`) }
  const characters = ['甲', '乙'].map(character => ({ character, glyph }))
  const pages = layoutWorksheet(characters, { cellMm: 24, traceRows: 1, blankRows: 1, showHeader: true })

  assert.equal(pages.length, 2)
  for (const page of pages) {
    assert.equal(page.rows.length, 7)
    assert.ok(page.rows.every(row => row.y >= 36 && row.y + 24 <= 279))
    const steps = page.rows.flatMap(row => row.cells).filter(cell => cell.kind === 'step').map(cell => cell.step)
    assert.deepEqual(steps, Array.from({ length: 30 }, (_, index) => index + 1))
  }
})
