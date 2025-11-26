import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useToast } from '@/composables/useToast'

export function useBinaryViewer() {
  const { t } = useI18n()
  const { toast } = useToast()

  // State
  const fileInput = ref<File>()
  const hexOutput = ref('')
  const bytesPerLine = ref(16)
  const startOffset = ref(0)
  
  // Helpers
  function toHex(num: number, padding: number = 2): string {
    return num.toString(16).toUpperCase().padStart(padding, '0')
  }

  function isPrintableAscii(byte: number): boolean {
    return byte >= 0x20 && byte <= 0x7E
  }

  function formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i]
  }

  // Core Logic
  async function processFile(file: File) {
    if (!file) {
      return
    }

    try {
      const arrayBuffer = await file.arrayBuffer()
      const bytes = new Uint8Array(arrayBuffer)
      
      let output = ''
      // Ensure values are valid
      const perLine = Number(bytesPerLine.value) || 16
      const offset = Number(startOffset.value) || 0
      
      // Verify boundaries
      const validPerLine = Math.max(8, Math.min(32, perLine))
      
      for (let i = 0; i < bytes.length; i += validPerLine) {
        // Address part (8 digits hex)
        const address = offset + i
        output += toHex(address, 8) + '  '
        
        // Hex bytes part
        const lineBytes = bytes.slice(i, i + validPerLine)
        for (let j = 0; j < validPerLine; j++) {
          if (j < lineBytes.length) {
            output += toHex(lineBytes[j]) + ' '
          } else {
            output += '   ' // Padding
          }
        }
        
        output += ' '
        
        // ASCII chars part
        for (let j = 0; j < lineBytes.length; j++) {
          const byte = lineBytes[j]
          if (isPrintableAscii(byte)) {
            output += String.fromCharCode(byte)
          } else {
            output += '.'
          }
        }
        
        output += '\n'
      }
      
      hexOutput.value = output
      
      toast({
        title: t('common.success'),
        description: t('tools.binary-viewer.output'),
        variant: 'success',
        duration: 2000,
      })
    } catch (error) {
      console.error('Error processing file:', error)
      toast({
        title: t('common.error'),
        description: (error as Error).message || 'Error processing file',
        variant: 'error',
      })
    }
  }

  function copyToClipboard() {
    if (hexOutput.value) {
      navigator.clipboard.writeText(hexOutput.value)
      toast({
        title: t('common.copied'),
        variant: 'success',
        duration: 2000,
      })
    }
  }

  function clearAll() {
    hexOutput.value = ''
    fileInput.value = undefined
    startOffset.value = 0
    
    toast({
      title: t('common.success'),
      description: t('tools.certificate-encoding-converter.cleared'),
      variant: 'success',
      duration: 2000,
    })
  }

  // Watchers
  watch([bytesPerLine, startOffset], async () => {
    if (fileInput.value) {
      await processFile(fileInput.value)
    }
  })

  return {
    t,
    fileInput,
    hexOutput,
    bytesPerLine,
    startOffset,
    processFile,
    copyToClipboard,
    clearAll,
    formatFileSize
  }
}

