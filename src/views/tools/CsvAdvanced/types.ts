export interface CsvData {
  headers: string[]
  rows: Record<string, any>[]
}

export interface SplitOptions {
  type: 'lines' | 'size'
  value: number
}

export interface ColumnSelection {
  column: string
  newName?: string
  order: number
}

export interface SqlOptions {
  tableName: string
  includeColumns: string[]
  batchSize: number
}

