export type EditorType = 'yaml' | 'toml' | 'properties'

export interface ValidationError {
  line: number
  column?: number
  message: string
  severity: 'error' | 'warning'
}

export interface IndentationIssue {
  line: number
  expected: number
  actual: number
  message: string
}

