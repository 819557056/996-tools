import Papa from 'papaparse'
import type { Converter } from '../types'

export const csvConverter: Converter = {
  parse(input: string) {
    const result = Papa.parse(input, {
      header: true,
      skipEmptyLines: true,
      dynamicTyping: true,
      transformHeader: (header) => header.trim()
    })
    
    if (result.errors.length > 0) {
      throw new Error(`CSV 解析错误: ${result.errors[0].message}`)
    }
    
    return result.data
  },
  
  stringify(data: any, options = { header: true, delimiter: ',' }) {
    // 如果不是数组，转换为数组
    if (!Array.isArray(data)) {
      data = [data]
    }
    
    // 如果是空数组，返回空字符串
    if (data.length === 0) {
      return ''
    }
    
    return Papa.unparse(data, {
      header: options.header,
      delimiter: options.delimiter,
      newline: '\n',
      quotes: true
    })
  },
  
  validate(input: string): boolean {
    try {
      const result = Papa.parse(input, { preview: 1 })
      return result.errors.length === 0
    } catch {
      return false
    }
  },
  
  getOptions() {
    return {
      header: true,
      delimiter: ','
    }
  }
}
