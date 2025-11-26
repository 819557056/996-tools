import { ref, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useToast } from '@/composables/useToast'
import GBK from 'fast-gbk'

// Types
export type Format = 'text' | 'base64' | 'hex'
export type OutputFormat = Format | 'der'
export type Encoding = 'utf-8' | 'gbk'

export function useTranscoding() {
  const { t } = useI18n()
  const { toast } = useToast()

  // Constants
  const formats: { label: string; value: Format }[] = [
    { label: '原文', value: 'text' },
    { label: 'Base64', value: 'base64' },
    { label: 'Hex', value: 'hex' },
  ]

  const outputFormats: { label: string; value: OutputFormat }[] = [
    { label: '原文', value: 'text' },
    { label: 'Base64', value: 'base64' },
    { label: 'Hex', value: 'hex' },
    { label: 'DER', value: 'der' },
  ]

  // State
  const inputContent = ref('')
  const inputFormat = ref<Format>('text')
  const inputEncoding = ref<Encoding>('utf-8')

  const outputFormat = ref<OutputFormat>('text')
  const outputEncoding = ref<Encoding>('utf-8')

  const error = ref('')

  // Computed
  const inputLengthInfo = computed(() => {
    return `长度: ${inputContent.value.length}`
  })

  const outputLengthInfo = computed(() => {
    if (outputFormat.value === 'der') return ''
    return `长度: ${outputContent.value.length}`
  })

  // Conversion Logic
  const sourceBytes = computed<Uint8Array | null>(() => {
    error.value = ''
    if (!inputContent.value) return null

    try {
      if (inputFormat.value === 'text') {
        if (inputEncoding.value === 'gbk') {
          return new Uint8Array(GBK.encode(inputContent.value))
        } else {
          return new TextEncoder().encode(inputContent.value)
        }
      } else if (inputFormat.value === 'base64') {
        const binaryString = atob(inputContent.value.replace(/\s/g, ''))
        const bytes = new Uint8Array(binaryString.length)
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i)
        }
        return bytes
      } else if (inputFormat.value === 'hex') {
        const hex = inputContent.value.replace(/[\s\n]/g, '')
        if (hex.length % 2 !== 0) throw new Error('Hex 长度必须为偶数')
        const bytes = new Uint8Array(hex.length / 2)
        for (let i = 0; i < hex.length; i += 2) {
          bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16)
        }
        return bytes
      }
    } catch (e) {
      error.value = '输入格式错误: ' + (e as Error).message
      return null
    }
    return null
  })

  const outputContent = computed(() => {
    if (!sourceBytes.value) return ''
    
    try {
      const bytes = sourceBytes.value
      
      if (outputFormat.value === 'text') {
        if (outputEncoding.value === 'gbk') {
          return GBK.decode(bytes)
        } else {
          return new TextDecoder('utf-8').decode(bytes)
        }
      } else if (outputFormat.value === 'base64') {
        let binaryString = ''
        // 使用分片处理避免栈溢出
        const chunkSize = 8192
        for (let i = 0; i < bytes.length; i += chunkSize) {
          binaryString += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + chunkSize)))
        }
        return btoa(binaryString)
      } else if (outputFormat.value === 'hex') {
        const hex = Array.from(bytes)
          .map(b => b.toString(16).padStart(2, '0'))
          .map(h => h.toUpperCase())
        
        // 每16个字节换行，字节之间加空格
        let result = ''
        for (let i = 0; i < hex.length; i++) {
          result += hex[i]
          if ((i + 1) % 16 === 0) {
            result += '\n'
          } else if (i < hex.length - 1) {
            result += ' '
          }
        }
        return result.trim()
      } else if (outputFormat.value === 'der') {
        return `[二进制文件 ${bytes.length} 字节] 点击上方下载按钮保存`
      }
    } catch (e) {
      return '转换错误: ' + (e as Error).message
    }
    return ''
  })

  // Handlers
  function handleDownload() {
    if (!sourceBytes.value) return
    
    const blob = new Blob([sourceBytes.value as any], { type: 'application/octet-stream' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'output.bin' // 或者 output.der
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  function copyOutput(minify: boolean = false) {
    if (outputContent.value) {
      let textToCopy = outputContent.value
      
      // 如果是 hex 格式且需要压缩复制
      if (outputFormat.value === 'hex' && minify) {
        textToCopy = textToCopy.replace(/[\s\n]/g, '')
      }

      navigator.clipboard.writeText(textToCopy)
      toast({
        title: t('common.copied'),
        description: outputFormat.value === 'hex' ? (minify ? '已压缩复制' : '已格式化复制') : undefined,
        variant: 'success',
        duration: 2000,
      })
    }
  }

  function handleFileLoad(file: File, result: ArrayBuffer) {
      // 转为 Base64 字符串并显示
      const bytes = new Uint8Array(result)
      let binaryString = ''
      const chunkSize = 8192
      for (let i = 0; i < bytes.length; i += chunkSize) {
        binaryString += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + chunkSize)))
      }
      inputContent.value = btoa(binaryString)
      inputFormat.value = 'base64'
      
      toast({
        title: '文件已加载',
        description: `已加载 ${file.name} (${bytes.length} 字节)，自动切换为 Base64 模式`,
        variant: 'success',
        duration: 3000
      })
  }

  return {
    formats,
    outputFormats,
    inputContent,
    inputFormat,
    inputEncoding,
    outputFormat,
    outputEncoding,
    error,
    inputLengthInfo,
    outputLengthInfo,
    outputContent,
    sourceBytes,
    handleDownload,
    copyOutput,
    handleFileLoad,
    t
  }
}

