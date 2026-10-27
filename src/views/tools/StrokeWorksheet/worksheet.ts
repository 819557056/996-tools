export const A4_WIDTH_MM = 210
export const A4_HEIGHT_MM = 297
export const PAGE_MARGIN_MM = 14

export type GridStyle = 'tian' | 'mi' | 'square' | 'none'

export type StrokeGlyph = {
  strokes: string[]
}

export type WorksheetCharacter = {
  character: string
  glyph: StrokeGlyph
}

export type WorksheetCell = {
  character: string
  glyph: StrokeGlyph
  kind: 'full' | 'step' | 'trace' | 'blank'
  step?: number
}

export type WorksheetRow = {
  y: number
  cells: WorksheetCell[]
}

export type WorksheetPage = {
  rows: WorksheetRow[]
}

export type WorksheetOptions = {
  cellMm: number
  traceRows: number
  blankRows: number
  showHeader: boolean
}

export function getColumnCount(cellMm: number): number {
  return Math.floor((A4_WIDTH_MM - PAGE_MARGIN_MM * 2) / cellMm)
}

export function getGridStartX(cellMm: number): number {
  return (A4_WIDTH_MM - getColumnCount(cellMm) * cellMm) / 2
}

export function layoutWorksheet(
  characters: WorksheetCharacter[],
  options: WorksheetOptions,
): WorksheetPage[] {
  if (characters.length === 0) return []

  const columns = getColumnCount(options.cellMm)
  const top = options.showHeader ? 36 : 17
  const bottom = A4_HEIGHT_MM - 18
  const gap = Math.min(6, options.cellMm * 0.3)
  const pages: WorksheetPage[] = [{ rows: [] }]
  let y = top

  const startPage = () => {
    pages.push({ rows: [] })
    y = top
  }

  for (const { character, glyph } of characters) {
    const blank: WorksheetCell = { character, glyph, kind: 'blank' }
    const steps: WorksheetCell[] = [
      { character, glyph, kind: 'full' },
      ...glyph.strokes.map((_, index): WorksheetCell => ({
        character,
        glyph,
        kind: 'step',
        step: index + 1,
      })),
      { character, glyph, kind: 'full' },
    ]
    const rows: WorksheetCell[][] = []

    for (let start = 0; start < steps.length; start += columns) {
      rows.push([...steps.slice(start, start + columns), ...Array(columns - Math.min(columns, steps.length - start)).fill(blank)])
    }
    for (let index = 0; index < options.traceRows; index++) {
      rows.push(Array.from({ length: columns }, (): WorksheetCell => ({ character, glyph, kind: 'trace' })))
    }
    for (let index = 0; index < options.blankRows; index++) {
      rows.push(Array.from({ length: columns }, () => blank))
    }

    const blockHeight = rows.length * options.cellMm
    if (pages.at(-1)!.rows.length > 0 && y + blockHeight > bottom) startPage()

    for (const cells of rows) {
      if (y + options.cellMm > bottom) startPage()
      pages.at(-1)!.rows.push({ y, cells })
      y += options.cellMm
    }
    y += gap
  }

  return pages
}
