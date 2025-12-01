import type { FormatType, ConversionResult, Converter } from '../types'
import { jsonConverter } from './jsonConverter'
import { yamlConverter } from './yamlConverter'
import { tomlConverter } from './tomlConverter'
import { xmlConverter } from './xmlConverter'
import { csvConverter } from './csvConverter'
import { iniConverter } from './iniConverter'
import { propertiesConverter } from './propertiesConverter'

export const converters: Record<FormatType, Converter> = {
  json: jsonConverter,
  yaml: yamlConverter,
  toml: tomlConverter,
  xml: xmlConverter,
  csv: csvConverter,
  ini: iniConverter,
  properties: propertiesConverter
}

/**
 * 在两种格式之间转换数据
 * @param input 输入字符串
 * @param fromFormat 源格式
 * @param toFormat 目标格式
 * @param options 转换选项
 * @returns 转换结果
 */
export function convertFormat(
  input: string,
  fromFormat: FormatType,
  toFormat: FormatType,
  options?: any
): ConversionResult {
  try {
    // 如果源格式和目标格式相同，直接返回
    if (fromFormat === toFormat) {
      return {
        success: true,
        data: input
      }
    }

    // 1. 验证源格式
    const fromConverter = converters[fromFormat]
    if (!fromConverter) {
      return {
        success: false,
        data: '',
        error: `不支持的源格式: ${fromFormat.toUpperCase()}`
      }
    }

    // 2. 解析源格式为中间数据结构
    let intermediateData: any
    try {
      intermediateData = fromConverter.parse(input.trim())
    } catch (error) {
      return {
        success: false,
        data: '',
        error: `源格式解析失败: ${(error as Error).message}`
      }
    }

    // 3. 验证目标格式转换器
    const toConverter = converters[toFormat]
    if (!toConverter) {
      return {
        success: false,
        data: '',
        error: `不支持的目标格式: ${toFormat.toUpperCase()}`
      }
    }

    // 4. 将中间数据转换为目标格式
    let output: string
    try {
      // 合并默认选项和用户选项
      const converterOptions = {
        ...(toConverter.getOptions?.() || {}),
        ...(options || {})
      }
      output = toConverter.stringify(intermediateData, converterOptions)
    } catch (error) {
      return {
        success: false,
        data: '',
        error: `目标格式生成失败: ${(error as Error).message}`
      }
    }

    return {
      success: true,
      data: output
    }
  } catch (error) {
    return {
      success: false,
      data: '',
      error: `转换失败: ${(error as Error).message}`
    }
  }
}

/**
 * 验证输入格式
 * @param input 输入字符串
 * @param format 格式类型
 * @returns 是否有效
 */
export function validateFormat(input: string, format: FormatType): boolean {
  const converter = converters[format]
  if (!converter) {
    return false
  }
  return converter.validate(input.trim())
}

/**
 * 格式化输入（美化）
 * @param input 输入字符串
 * @param format 格式类型
 * @param options 格式化选项
 * @returns 格式化结果
 */
export function formatInput(
  input: string,
  format: FormatType,
  options?: any
): ConversionResult {
  return convertFormat(input, format, format, options)
}

