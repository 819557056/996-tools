import { ref, watch, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useToast } from '@/composables/useToast'

export type FormatType = 'PEM' | 'BASE64' | 'HEX' | 'DER' | null

export function useCertificateEncodingConverter() {
  const { t } = useI18n()
  const { toast } = useToast()

  const input = ref('')
  const output = ref('')
  const targetFormat = ref<FormatType>('BASE64')
  const errorMessage = ref('')
  const inputFileName = ref('')
  const fileExtension = ref<'cer' | 'crt' | 'der'>('crt')
  const isFromBinaryFile = ref(false)

  const targetFormats: FormatType[] = ['PEM', 'BASE64', 'HEX', 'DER']

  // Detect input format
  const detectedInputFormat = computed((): FormatType => {
    if (!input.value.trim()) {
      return null
    }
    
    if (isFromBinaryFile.value) {
      return 'DER'
    }
    
    return detectFormat(input.value)
  })

  // Detect output format
  const outputFormat = computed((): FormatType => {
    if (!output.value.trim()) {
      return null
    }
    return detectFormat(output.value)
  })

  // Check if conversion is possible
  const canConvert = computed(() => {
    if (!input.value.trim() || !targetFormat.value) {
      return false
    }
    
    // If input format not detected, cannot convert
    if (!detectedInputFormat.value) {
      return false
    }
    
    // If input and target format are same, no need to convert
    if (detectedInputFormat.value === targetFormat.value) {
      return false
    }
    
    return true
  })

  // Conversion info message
  const conversionInfo = computed(() => {
    if (!input.value.trim()) {
      return ''
    }
    
    if (!detectedInputFormat.value) {
      return t('tools.certificate-encoding-converter.formatNotDetected')
    }
    
    if (!targetFormat.value) {
      return ''
    }
    
    if (detectedInputFormat.value === targetFormat.value) {
      return t('tools.certificate-encoding-converter.sameFormat')
    }
    
    return `${detectedInputFormat.value} → ${targetFormat.value}`
  })

  // Watch input to clear output
  watch(input, (newValue, oldValue) => {
    if (!newValue.trim()) {
      output.value = ''
      errorMessage.value = ''
      isFromBinaryFile.value = false
    } else if (oldValue !== undefined) {
      isFromBinaryFile.value = false
    }
  })

  // Helper functions
  function getFormatBadgeClass(format: FormatType): string {
    const classes: Record<string, string> = {
      'PEM': 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-200',
      'BASE64': 'bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-200',
      'HEX': 'bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-200',
      'DER': 'bg-orange-100 dark:bg-orange-900 text-orange-700 dark:text-orange-200',
    }
    return format ? classes[format] || 'bg-gray-100 dark:bg-gray-900 text-gray-700 dark:text-gray-200' : ''
  }

  function detectFormat(content: string): FormatType {
    if (!content.trim()) {
      return null
    }
    
    // PEM
    if (content.includes('-----BEGIN') && content.includes('-----END')) {
      return 'PEM'
    }
    
    const trimmed = content.trim()
    
    // HEX
    const hexRegex = /^[0-9A-Fa-f\s]+$/
    if (hexRegex.test(trimmed)) {
      const cleaned = trimmed.replace(/\s/g, '')
      if (cleaned.length >= 20 && cleaned.length % 2 === 0) {
        return 'HEX'
      }
    }
    
    // Base64
    const base64Regex = /^[A-Za-z0-9+/=\s]+$/
    
    if (base64Regex.test(trimmed)) {
      try {
        const cleaned = trimmed.replace(/\s/g, '')
        if (cleaned.length % 4 === 0) {
          atob(cleaned.substring(0, Math.min(100, cleaned.length)))
          return 'BASE64'
        }
      } catch (e) {
        // Decode failed
      }
    }
    
    return null
  }

  function isValidBase64Text(text: string): boolean {
    const trimmed = text.trim()
    
    if (!/^[A-Za-z0-9+/\s]+={0,2}$/.test(trimmed)) {
      return false
    }
    
    const cleaned = trimmed.replace(/\s/g, '')
    
    if (cleaned.length < 20) {
      return false
    }
    
    if (cleaned.length % 4 !== 0) {
      return false
    }
    
    try {
      atob(cleaned.substring(0, Math.min(100, cleaned.length)))
      return true
    } catch (e) {
      return false
    }
  }

  function isBinaryContent(text: string): boolean {
    const nonPrintableCount = Array.from(text).filter(char => {
      const code = char.charCodeAt(0)
      return code < 32 && code !== 9 && code !== 10 && code !== 13
    }).length
    
    return nonPrintableCount > text.length * 0.1
  }

  async function handleFileLoad(file: File) {
    inputFileName.value = file.name
    
    try {
      const text = await file.text()
      
      if (isBinaryContent(text)) {
        const arrayBuffer = await file.arrayBuffer()
        const base64 = arrayBufferToBase64(arrayBuffer)
        input.value = base64
        isFromBinaryFile.value = true
        toast({
          title: t('tools.certificate-encoding-converter.fileLoadedAsBinary', { name: file.name }),
          variant: 'success',
          duration: 2000,
        })
        return
      }
      
      if (text.includes('-----BEGIN') && text.includes('-----END')) {
        input.value = text
        isFromBinaryFile.value = false
        toast({
          title: t('tools.certificate-encoding-converter.fileLoaded', { name: file.name }),
          variant: 'success',
          duration: 2000,
        })
        return
      }
      
      if (isValidBase64Text(text)) {
        input.value = text
        isFromBinaryFile.value = false
        toast({
          title: t('tools.certificate-encoding-converter.fileLoaded', { name: file.name }),
          variant: 'success',
          duration: 2000,
        })
        return
      }
      
      if (text.trim().length > 0) {
        input.value = text
        isFromBinaryFile.value = false
        toast({
          title: t('tools.certificate-encoding-converter.fileLoadedAsText', { name: file.name }),
          variant: 'warning',
          duration: 2000,
        })
        return
      }
      
      toast({
        title: t('tools.certificate-encoding-converter.errors.emptyFile'),
        variant: 'error',
        duration: 2000,
      })
    } catch (error: any) {
      try {
        const arrayBuffer = await file.arrayBuffer()
        const base64 = arrayBufferToBase64(arrayBuffer)
        input.value = base64
        isFromBinaryFile.value = true
        toast({
          title: t('tools.certificate-encoding-converter.fileLoadedAsBinary', { name: file.name }),
          variant: 'success',
          duration: 2000,
        })
      } catch (binaryError: any) {
        toast({
          title: t('tools.certificate-encoding-converter.errors.fileReadError'),
          variant: 'error',
          duration: 2000,
        })
      }
    }
  }

  function arrayBufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer)
    let binary = ''
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i])
    }
    return btoa(binary)
  }

  function base64ToArrayBuffer(base64: string): ArrayBuffer {
    const binaryString = atob(base64)
    const bytes = new Uint8Array(binaryString.length)
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i)
    }
    return bytes.buffer
  }

  function detectCertificateType(base64: string): string {
    try {
      const decoded = atob(base64.substring(0, 100))
      if (decoded.includes('RSA')) {
        return 'RSA PRIVATE KEY'
      } else if (decoded.includes('EC')) {
        return 'EC PRIVATE KEY'
      } else if (decoded.includes('PRIVATE')) {
        return 'PRIVATE KEY'
      } else if (decoded.includes('PUBLIC')) {
        return 'PUBLIC KEY'
      }
    } catch (e) {
      // Decode failed
    }
    return 'CERTIFICATE'
  }

  function convert() {
    errorMessage.value = ''
    output.value = ''
    
    try {
      const inputValue = input.value.trim()
      if (!inputValue) {
        errorMessage.value = t('tools.certificate-encoding-converter.errors.emptyInput')
        return
      }

      if (!detectedInputFormat.value) {
        errorMessage.value = t('tools.certificate-encoding-converter.errors.formatNotDetected')
        return
      }

      if (!targetFormat.value) {
        errorMessage.value = t('tools.certificate-encoding-converter.errors.noTargetFormat')
        return
      }

      if (detectedInputFormat.value === targetFormat.value) {
        errorMessage.value = t('tools.certificate-encoding-converter.errors.sameFormat')
        return
      }

      // If target is DER, download file
      if (targetFormat.value === 'DER') {
        downloadDerFile(inputValue)
        return
      }

      // Execute conversion
      const sourceFormat = detectedInputFormat.value
      const result = performConversion(inputValue, sourceFormat, targetFormat.value)
      output.value = result
      
      toast({
        title: t('tools.certificate-encoding-converter.convertSuccess'),
        variant: 'success',
        duration: 2000,
      })
    } catch (error: any) {
      errorMessage.value = error.message || t('tools.certificate-encoding-converter.errors.conversionFailed')
    }
  }

  function performConversion(inputValue: string, sourceFormat: FormatType, targetFormat: FormatType): string {
    const conversionMap: Record<string, () => string> = {
      'PEM-BASE64': () => pemToBase64(inputValue),
      'PEM-HEX': () => pemToHex(inputValue),
      'BASE64-PEM': () => base64ToPem(inputValue),
      'BASE64-HEX': () => base64ToHex(inputValue),
      'HEX-PEM': () => hexToPem(inputValue),
      'HEX-BASE64': () => hexToBase64(inputValue),
      'DER-PEM': () => base64ToPem(inputValue),
      'DER-BASE64': () => inputValue.replace(/\s/g, ''),
      'DER-HEX': () => base64ToHex(inputValue),
    }
    
    const key = `${sourceFormat}-${targetFormat}`
    const converter = conversionMap[key]
    
    if (!converter) {
      throw new Error(t('tools.certificate-encoding-converter.errors.invalidConversion'))
    }
    
    return converter()
  }

  function clearAll() {
    input.value = ''
    output.value = ''
    errorMessage.value = ''
    inputFileName.value = ''
    isFromBinaryFile.value = false
    toast({
      title: t('tools.certificate-encoding-converter.cleared'),
      variant: 'success',
      duration: 2000,
    })
  }

  // Conversion utilities
  function pemToBase64(pemText: string): string {
    const base64 = pemText
      .replace(/-----BEGIN [^-]+-----/g, '')
      .replace(/-----END [^-]+-----/g, '')
      .replace(/\s/g, '')
    
    if (!base64) {
      throw new Error(t('tools.certificate-encoding-converter.errors.invalidPem'))
    }
    
    return base64
  }

  function base64ToPem(base64Text: string): string {
    const base64 = base64Text.replace(/\s/g, '')
    
    if (!base64) {
      throw new Error(t('tools.certificate-encoding-converter.errors.invalidBase64'))
    }
    
    const type = detectCertificateType(base64)
    const formattedBase64 = base64.match(/.{1,64}/g)?.join('\n') || base64
    
    return `-----BEGIN ${type}-----\n${formattedBase64}\n-----END ${type}-----`
  }

  function base64ToHex(base64Text: string): string {
    const base64 = base64Text.replace(/\s/g, '')
    
    if (!base64) {
      throw new Error(t('tools.certificate-encoding-converter.errors.invalidBase64'))
    }
    
    try {
      const binaryString = atob(base64)
      let hex = ''
      for (let i = 0; i < binaryString.length; i++) {
        const byte = binaryString.charCodeAt(i)
        hex += byte.toString(16).padStart(2, '0').toUpperCase()
      }
      
      return formatHex(hex)
    } catch (e) {
      throw new Error(t('tools.certificate-encoding-converter.errors.invalidBase64'))
    }
  }

  function hexToBase64(hexText: string): string {
    const hex = hexText.replace(/\s/g, '')
    
    if (!hex || hex.length % 2 !== 0) {
      throw new Error(t('tools.certificate-encoding-converter.errors.invalidHex'))
    }
    
    if (!/^[0-9A-Fa-f]+$/.test(hex)) {
      throw new Error(t('tools.certificate-encoding-converter.errors.invalidHex'))
    }
    
    try {
      let binaryString = ''
      for (let i = 0; i < hex.length; i += 2) {
        const byte = parseInt(hex.substr(i, 2), 16)
        binaryString += String.fromCharCode(byte)
      }
      
      return btoa(binaryString)
    } catch (e) {
      throw new Error(t('tools.certificate-encoding-converter.errors.invalidHex'))
    }
  }

  function pemToHex(pemText: string): string {
    const base64 = pemToBase64(pemText)
    return base64ToHex(base64)
  }

  function hexToPem(hexText: string): string {
    const base64 = hexToBase64(hexText)
    return base64ToPem(base64)
  }

  function formatHex(hex: string): string {
    const lines = []
    for (let i = 0; i < hex.length; i += 64) {
      lines.push(hex.substr(i, 64))
    }
    return lines.join('\n')
  }

  function downloadDerFile(inputValue: string) {
    try {
      let base64: string
      
      const sourceFormat = detectedInputFormat.value
      
      if (sourceFormat === 'PEM') {
        base64 = pemToBase64(inputValue)
      } else if (sourceFormat === 'BASE64' || sourceFormat === 'DER') {
        base64 = inputValue.replace(/\s/g, '')
      } else if (sourceFormat === 'HEX') {
        base64 = hexToBase64(inputValue)
      } else {
        throw new Error(t('tools.certificate-encoding-converter.errors.invalidConversion'))
      }
      
      const arrayBuffer = base64ToArrayBuffer(base64)
      const blob = new Blob([arrayBuffer], { type: 'application/x-x509-ca-cert' })
      
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = inputFileName.value ? 
        inputFileName.value.replace(/\.(pem|crt|cer|txt)$/i, '.der') : 
        'certificate.der'
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      
      toast({
        title: t('tools.certificate-encoding-converter.downloadSuccess'),
        variant: 'success',
        duration: 2000,
      })
    } catch (error: any) {
      errorMessage.value = error.message || t('tools.certificate-encoding-converter.errors.conversionFailed')
    }
  }

  function downloadOutput() {
    if (!output.value.trim()) {
      toast({
        title: t('tools.certificate-encoding-converter.errors.emptyOutput'),
        variant: 'error',
        duration: 2000,
      })
      return
    }
    
    try {
      const format = outputFormat.value
      let blob: Blob
      let fileName: string
      let extension: string
      
      if (format === 'HEX') {
        extension = 'txt'
        blob = new Blob([output.value], { type: 'text/plain' })
      } else if (format === 'PEM') {
        extension = fileExtension.value
        blob = new Blob([output.value], { type: 'application/x-pem-file' })
      } else if (format === 'BASE64') {
        extension = fileExtension.value
        blob = new Blob([output.value], { type: 'text/plain' })
      } else {
        extension = fileExtension.value
        blob = new Blob([output.value], { type: 'text/plain' })
      }
      
      if (inputFileName.value) {
        fileName = inputFileName.value.replace(/\.(pem|crt|cer|der|txt|hex)$/i, `.${extension}`)
      } else {
        fileName = format === 'HEX' ? `certificate.txt` : `certificate.${extension}`
      }
      
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = fileName
      
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      
      toast({
        title: t('tools.certificate-encoding-converter.downloadSuccess'),
        variant: 'success',
        duration: 2000,
      })
    } catch (error: any) {
      toast({
        title: t('tools.certificate-encoding-converter.errors.downloadFailed'),
        variant: 'error',
        duration: 2000,
      })
    }
  }

  return {
    t,
    input,
    output,
    targetFormat,
    errorMessage,
    inputFileName,
    fileExtension,
    isFromBinaryFile,
    targetFormats,
    detectedInputFormat,
    outputFormat,
    canConvert,
    conversionInfo,
    convert,
    clearAll,
    downloadOutput,
    handleFileLoad,
    getFormatBadgeClass
  }
}

