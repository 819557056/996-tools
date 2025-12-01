import { ref, computed, watch } from 'vue'
import { useToast } from '@/composables/useToast'
import { convertFormat, formatInput, validateFormat } from './converters'
import type { FormatType, FormatOption, QuickConversion } from './types'

export function useFormatConverter() {
  const { toast } = useToast()

  const sourceFormat = ref<FormatType>('json')
  const targetFormat = ref<FormatType>('yaml')
  const sourceContent = ref('')
  const targetContent = ref('')
  const error = ref('')
  const autoConvertEnabled = ref(false)
  const isConverting = ref(false)

  // 格式选项
  const formatOptions: FormatOption[] = [
    { value: 'json', label: 'JSON', description: 'JavaScript Object Notation' },
    { value: 'yaml', label: 'YAML', description: 'YAML Ain\'t Markup Language' },
    { value: 'toml', label: 'TOML', description: 'Tom\'s Obvious, Minimal Language' },
    { value: 'xml', label: 'XML', description: 'Extensible Markup Language' },
    { value: 'csv', label: 'CSV', description: 'Comma-Separated Values' },
    { value: 'ini', label: 'INI', description: 'Initialization File' },
    { value: 'properties', label: 'Properties', description: 'Java Properties File' }
  ]

  // 快捷转换选项
  const quickConversions: QuickConversion[] = [
    { from: 'json', to: 'yaml', label: 'JSON → YAML' },
    { from: 'json', to: 'toml', label: 'JSON → TOML' },
    { from: 'json', to: 'xml', label: 'JSON → XML' },
    { from: 'yaml', to: 'json', label: 'YAML → JSON' },
    { from: 'yaml', to: 'toml', label: 'YAML → TOML' },
    { from: 'toml', to: 'json', label: 'TOML → JSON' },
    { from: 'toml', to: 'yaml', label: 'TOML → YAML' },
    { from: 'xml', to: 'json', label: 'XML → JSON' },
    { from: 'csv', to: 'json', label: 'CSV → JSON' },
    { from: 'json', to: 'csv', label: 'JSON → CSV' }
  ]

  // 格式说明
  const formatDescription = computed(() => {
    const descriptions: Record<string, string> = {
      json: 'JSON 是最常用的数据交换格式，支持对象、数组、字符串、数字、布尔值和 null',
      yaml: 'YAML 是人类可读的数据序列化格式，常用于配置文件。注意：YAML 对缩进敏感',
      toml: 'TOML 是一种极简的配置文件格式，易于阅读，广泛用于 Rust、Go 等项目',
      xml: 'XML 是一种标记语言，支持复杂的层级结构和属性',
      csv: 'CSV 是表格数据格式，每行代表一条记录，字段用逗号分隔',
      ini: 'INI 是简单的配置文件格式，包含节（section）和键值对',
      properties: 'Properties 是 Java 常用的配置文件格式，每行一个键值对'
    }
    return descriptions[sourceFormat.value] || ''
  })

  // 转换函数
  function convert() {
    error.value = ''
    
    if (!sourceContent.value.trim()) {
      error.value = '请输入源数据'
      return
    }

    isConverting.value = true

    try {
      const result = convertFormat(
        sourceContent.value,
        sourceFormat.value,
        targetFormat.value
      )

      if (result.success) {
        targetContent.value = result.data
        toast({
          title: '转换成功',
          description: `${sourceFormat.value.toUpperCase()} → ${targetFormat.value.toUpperCase()}`,
          variant: 'success',
          duration: 2000
        })
      } else {
        error.value = result.error || '转换失败'
        targetContent.value = ''
      }
    } catch (e) {
      error.value = `转换失败: ${(e as Error).message}`
      targetContent.value = ''
    } finally {
      isConverting.value = false
    }
  }

  // 交换格式
  function swapFormats() {
    const temp = sourceFormat.value
    sourceFormat.value = targetFormat.value
    targetFormat.value = temp

    // 交换内容
    const tempContent = sourceContent.value
    sourceContent.value = targetContent.value
    targetContent.value = tempContent

    toast({
      title: '格式已交换',
      variant: 'success',
      duration: 1500
    })
  }

  // 自动转换
  function toggleAutoConvert() {
    autoConvertEnabled.value = !autoConvertEnabled.value
    
    if (autoConvertEnabled.value && sourceContent.value.trim()) {
      convert()
    }

    toast({
      title: autoConvertEnabled.value ? '已启用自动转换' : '已禁用自动转换',
      variant: autoConvertEnabled.value ? 'success' : 'default',
      duration: 1500
    })
  }

  // 监听源内容变化，自动转换
  let autoConvertTimer: NodeJS.Timeout | null = null
  function onSourceChange() {
    if (!autoConvertEnabled.value) return

    // 防抖
    if (autoConvertTimer) {
      clearTimeout(autoConvertTimer)
    }

    autoConvertTimer = setTimeout(() => {
      if (sourceContent.value.trim()) {
        convert()
      }
    }, 800)
  }

  // 监听格式变化，自动转换
  watch([sourceFormat, targetFormat], () => {
    if (autoConvertEnabled.value && sourceContent.value.trim()) {
      convert()
    }
  })

  // 复制结果
  async function copyResult() {
    if (!targetContent.value) {
      toast({
        title: '没有可复制的内容',
        variant: 'warning',
        duration: 2000
      })
      return
    }

    try {
      await navigator.clipboard.writeText(targetContent.value)
      toast({
        title: '复制成功',
        variant: 'success',
        duration: 2000
      })
    } catch {
      toast({
        title: '复制失败',
        variant: 'destructive',
        duration: 2000
      })
    }
  }

  // 下载结果
  function downloadResult() {
    if (!targetContent.value) {
      toast({
        title: '没有可下载的内容',
        variant: 'warning',
        duration: 2000
      })
      return
    }

    const blob = new Blob([targetContent.value], { type: 'text/plain;charset=utf-8' })
    const link = document.createElement('a')
    const url = URL.createObjectURL(blob)
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5)
    link.href = url
    link.download = `converted_${timestamp}.${targetFormat.value}`
    link.click()
    
    URL.revokeObjectURL(url)

    toast({
      title: '下载成功',
      variant: 'success',
      duration: 2000
    })
  }

  // 格式化源数据
  function formatSource() {
    if (!sourceContent.value.trim()) return

    const result = formatInput(sourceContent.value, sourceFormat.value)
    if (result.success) {
      sourceContent.value = result.data
      toast({
        title: '格式化成功',
        variant: 'success',
        duration: 1500
      })
    } else {
      error.value = result.error || '格式化失败'
    }
  }

  // 格式化目标数据
  function formatTarget() {
    if (!targetContent.value.trim()) return

    const result = formatInput(targetContent.value, targetFormat.value)
    if (result.success) {
      targetContent.value = result.data
      toast({
        title: '格式化成功',
        variant: 'success',
        duration: 1500
      })
    }
  }

  // 加载示例
  function loadExample() {
    const examples: Record<FormatType, string> = {
      json: `{
  "name": "张三",
  "age": 30,
  "email": "zhangsan@example.com",
  "address": {
    "city": "北京",
    "country": "中国"
  },
  "hobbies": ["阅读", "编程", "旅行"],
  "isActive": true
}`,
      yaml: `name: 张三
age: 30
email: zhangsan@example.com
address:
  city: 北京
  country: 中国
hobbies:
  - 阅读
  - 编程
  - 旅行
isActive: true`,
      toml: `name = "张三"
age = 30
email = "zhangsan@example.com"
isActive = true
hobbies = ["阅读", "编程", "旅行"]

[address]
city = "北京"
country = "中国"`,
      xml: `<?xml version="1.0" encoding="UTF-8"?>
<root>
  <name>张三</name>
  <age>30</age>
  <email>zhangsan@example.com</email>
  <address>
    <city>北京</city>
    <country>中国</country>
  </address>
  <hobbies>
    <item>阅读</item>
    <item>编程</item>
    <item>旅行</item>
  </hobbies>
  <isActive>true</isActive>
</root>`,
      csv: `name,age,email,city,country
张三,30,zhangsan@example.com,北京,中国
李四,25,lisi@example.com,上海,中国
王五,35,wangwu@example.com,深圳,中国`,
      ini: `[user]
name = 张三
age = 30
email = zhangsan@example.com

[address]
city = 北京
country = 中国`,
      properties: `user.name=张三
user.age=30
user.email=zhangsan@example.com
address.city=北京
address.country=中国`
    }

    sourceContent.value = examples[sourceFormat.value] || examples.json
    
    if (autoConvertEnabled.value) {
      setTimeout(convert, 100)
    }
  }

  // 清空
  function clear() {
    sourceContent.value = ''
    targetContent.value = ''
    error.value = ''
    
    toast({
      title: '已清空',
      variant: 'default',
      duration: 1500
    })
  }

  // 选择快捷转换
  function selectConversion(from: FormatType, to: FormatType) {
    sourceFormat.value = from
    targetFormat.value = to
    
    if (sourceContent.value.trim() && autoConvertEnabled.value) {
      convert()
    }
  }

  // 判断是否可以格式化
  function canFormat(format: FormatType): boolean {
    return ['json', 'yaml', 'toml', 'xml'].includes(format)
  }

  // 获取编辑器语言
  function getEditorLanguage(format: FormatType): string {
    const languageMap: Record<FormatType, string> = {
      json: 'json',
      yaml: 'yaml',
      toml: 'ini', // Monaco 没有 toml，使用 ini
      xml: 'xml',
      csv: 'plaintext',
      ini: 'ini',
      properties: 'properties'
    }
    return languageMap[format] || 'plaintext'
  }

  return {
    sourceFormat,
    targetFormat,
    sourceContent,
    targetContent,
    error,
    autoConvertEnabled,
    isConverting,
    formatOptions,
    formatDescription,
    quickConversions,
    convert,
    swapFormats,
    toggleAutoConvert,
    copyResult,
    downloadResult,
    formatSource,
    formatTarget,
    loadExample,
    clear,
    selectConversion,
    onSourceChange,
    canFormat,
    getEditorLanguage
  }
}
