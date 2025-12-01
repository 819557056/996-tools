import ini from 'ini'
import type { Converter } from '../types'

// 将嵌套对象扁平化为 key.subkey.subsubkey 格式
function flattenObject(obj: any, prefix: string = ''): Record<string, string> {
  const result: Record<string, string> = {}
  
  for (const [key, value] of Object.entries(obj)) {
    const newKey = prefix ? `${prefix}.${key}` : key
    
    if (value === null || value === undefined) {
      result[newKey] = ''
    } else if (Array.isArray(value)) {
      // 处理数组：使用索引作为键
      value.forEach((item, index) => {
        if (typeof item === 'object' && item !== null) {
          const flattenedItem = flattenObject(item, `${newKey}[${index}]`)
          Object.assign(result, flattenedItem)
        } else {
          result[`${newKey}[${index}]`] = String(item)
        }
      })
    } else if (typeof value === 'object') {
      // 递归处理嵌套对象
      const flattenedValue = flattenObject(value, newKey)
      Object.assign(result, flattenedValue)
    } else {
      // 基本类型直接赋值
      result[newKey] = String(value)
    }
  }
  
  return result
}

// Properties 格式与 INI 类似，但更简单（没有 section）
export const propertiesConverter: Converter = {
  parse(input: string) {
    // Properties 文件格式：key=value
    const result: Record<string, string> = {}
    const lines = input.split('\n')
    
    for (const line of lines) {
      const trimmed = line.trim()
      // 跳过空行和注释
      if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith('!')) {
        continue
      }
      
      // 查找第一个等号或冒号
      const separatorIndex = Math.min(
        trimmed.indexOf('=') !== -1 ? trimmed.indexOf('=') : Infinity,
        trimmed.indexOf(':') !== -1 ? trimmed.indexOf(':') : Infinity
      )
      
      if (separatorIndex !== Infinity) {
        const key = trimmed.substring(0, separatorIndex).trim()
        const value = trimmed.substring(separatorIndex + 1).trim()
        result[key] = value
      }
    }
    
    return result
  },
  
  stringify(data: any) {
    // 先扁平化对象
    const flattened = flattenObject(data)
    
    // 转换为 key=value 格式
    const lines: string[] = []
    for (const [key, value] of Object.entries(flattened)) {
      lines.push(`${key}=${value}`)
    }
    
    // 按键名排序，使输出更有序
    lines.sort()
    
    return lines.join('\n')
  },
  
  validate(input: string): boolean {
    try {
      this.parse(input)
      return true
    } catch {
      return false
    }
  }
}

