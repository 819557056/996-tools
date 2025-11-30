import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useToast } from '@/composables/useToast'

export function useBinaryViewer() {
  const { t } = useI18n()
  const { toast } = useToast()

  // State
  const inputMode = ref<'file' | 'text'>('file')
  const fileInput = ref<File>()
  const textInput = ref('')
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

  function stringToBytes(str: string): Uint8Array {
    // 1. Try PEM
    if (str.includes('-----BEGIN')) {
      try {
        const lines = str.split('\n')
        let base64 = ''
        let inBlock = false
        for (const line of lines) {
          if (line.includes('-----BEGIN')) { inBlock = true; continue; }
          if (line.includes('-----END')) { inBlock = false; continue; }
          if (inBlock) base64 += line.trim()
        }
        if (base64) {
          const binary = atob(base64)
          const bytes = new Uint8Array(binary.length)
          for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
          return bytes
        }
      } catch (e) {
        console.debug('PEM decode failed, trying other formats')
      }
    }

    const cleanStr = str.replace(/[\s\n\r]/g, '')

    // 2. Try Hex
    // Hex string must be even length and contain only 0-9A-F
    if (cleanStr.length > 0 && cleanStr.length % 2 === 0 && /^[0-9A-Fa-f]+$/.test(cleanStr)) {
      try {
        const bytes = new Uint8Array(cleanStr.length / 2)
        for (let i = 0; i < cleanStr.length; i += 2) {
          bytes[i / 2] = parseInt(cleanStr.substring(i, i + 2), 16)
        }
        return bytes
      } catch (e) {
        console.debug('Hex decode failed')
      }
    }

    // 3. Try Base64
    // Base64 length must be multiple of 4 (with padding)
    if (cleanStr.length > 0 && cleanStr.length % 4 === 0 && /^[A-Za-z0-9+/]*={0,2}$/.test(cleanStr)) {
      try {
        const binary = atob(cleanStr)
        const bytes = new Uint8Array(binary.length)
        for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
        return bytes
      } catch (e) {
        console.debug('Base64 decode failed')
      }
    }

    // 4. Fallback to raw text (UTF-8)
    return new TextEncoder().encode(str)
  }

  function generateHexView(bytes: Uint8Array): string {
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
    return output
  }

  // Core Logic
  async function processInput() {
    try {
      let bytes: Uint8Array | null = null

      if (inputMode.value === 'file' && fileInput.value) {
        const arrayBuffer = await fileInput.value.arrayBuffer()
        bytes = new Uint8Array(arrayBuffer)
      } else if (inputMode.value === 'text' && textInput.value) {
        bytes = stringToBytes(textInput.value)
      }

      if (bytes) {
        hexOutput.value = generateHexView(bytes)

        toast({
          title: t('common.success'),
          description: t('tools.binary-viewer.output'),
          variant: 'success',
          duration: 2000,
        })
      }
    } catch (error) {
      console.error('Error processing input:', error)
      toast({
        title: t('common.error'),
        description: (error as Error).message || 'Error processing input',
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
    textInput.value = ''
    startOffset.value = 0

    toast({
      title: t('common.success'),
      description: t('tools.binary-viewer.cleared'),
      variant: 'success',
      duration: 2000,
    })
  }

  // Watchers
  watch([bytesPerLine, startOffset], async () => {
    if (hexOutput.value) { // Only re-process if we already have output
      await processInput()
    }
  })

  return {
    t,
    inputMode,
    fileInput,
    textInput,
    hexOutput,
    bytesPerLine,
    startOffset,
    processInput,
    copyToClipboard,
    clearAll,
    formatFileSize
  }
}

