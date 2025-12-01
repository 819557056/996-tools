export type FormatType = 'json' | 'yaml' | 'toml' | 'xml' | 'csv' | 'ini' | 'properties'

export interface ConversionResult {
  success: boolean
  data: string
  error?: string
}

export interface Converter {
  // 从当前格式解析为通用对象
  parse: (input: string) => any
  // 从通用对象生成当前格式
  stringify: (data: any, options?: any) => string
  // 验证格式
  validate: (input: string) => boolean
  // 获取格式化选项
  getOptions?: () => any
}

export interface FormatOption {
  value: FormatType
  label: string
  description: string
}

export interface QuickConversion {
  from: FormatType
  to: FormatType
  label: string
}
