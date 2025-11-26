import { ref, computed, watch } from 'vue'
import { useToast } from '@/composables/useToast'
import { parseCertificate, parseCertificateFromFile, formatDistinguishedName, type CertificateInfo } from '@/utils/certificateViewer'

export interface DetailItem {
  label: string
  previewValue: string
  fullValue: string
  critical?: boolean
}

export function useCertificateViewer() {
  const { toast } = useToast()

  // State
  const input = ref('')
  const inputMode = ref<'text' | 'file'>('text')
  const showInput = ref(false)
  const certificateInfo = ref<CertificateInfo | null>(null)
  const errorMessage = ref('')
  const activeTab = ref('general')
  const fileName = ref('')
  const selectedDetail = ref<DetailItem | null>(null)

  const tabs = [
    { label: '常规', value: 'general' },
    { label: '详细信息', value: 'details' },
    { label: '原始数据', value: 'raw' },
  ]

  // Computed properties
  const isValidCert = computed(() => {
    if (!certificateInfo.value) return null
    const now = new Date()
    return now >= new Date(certificateInfo.value.validFrom) && now <= new Date(certificateInfo.value.validTo)
  })

  const isSM2 = computed(() => {
    return certificateInfo.value?.publicKey.algorithm.includes('SM2') || 
           certificateInfo.value?.signatureAlgorithm.includes('SM')
  })

  const detailItems = computed<DetailItem[]>(() => {
    if (!certificateInfo.value) return []
    const info = certificateInfo.value
    const items: DetailItem[] = []

    // Basic Info
    items.push({ label: '版本', previewValue: info.version, fullValue: info.version })
    items.push({ label: '序列号', previewValue: info.serialNumber, fullValue: info.serialNumber })
    items.push({ label: '签名算法', previewValue: info.signatureAlgorithm, fullValue: info.signatureAlgorithm })
    
    // Issuer
    items.push({ 
      label: '颁发者', 
      previewValue: formatDistinguishedName(info.issuer), 
      fullValue: JSON.stringify(info.issuer, null, 2)
    })
    
    // Validity
    items.push({ label: '有效期开始', previewValue: formatDate(info.validFrom), fullValue: info.validFrom })
    items.push({ label: '有效期结束', previewValue: formatDate(info.validTo), fullValue: info.validTo })
    
    // Subject
    items.push({ 
      label: '使用者', 
      previewValue: formatDistinguishedName(info.subject), 
      fullValue: JSON.stringify(info.subject, null, 2)
    })

    // Public Key
    items.push({ 
      label: '公钥', 
      previewValue: `${info.publicKey.algorithm} (${info.publicKey.size})`, 
      fullValue: JSON.stringify(info.publicKey, null, 2)
    })

    // Extensions
    if (info.extensions) {
      info.extensions.forEach(ext => {
        items.push({
          label: ext.name,
          previewValue: ext.value.replace(/\n/g, ' ').substring(0, 50) + (ext.value.length > 50 ? '...' : ''),
          fullValue: ext.value,
          critical: ext.critical
        })
      })
    }

    // Fingerprints
    items.push({ label: '指纹 (SHA1)', previewValue: info.fingerprints.sha1, fullValue: info.fingerprints.sha1 })
    items.push({ label: '指纹 (SHA256)', previewValue: info.fingerprints.sha256, fullValue: info.fingerprints.sha256 })

    return items
  })

  // Watchers
  watch(activeTab, (newVal) => {
    if (newVal === 'details' && detailItems.value.length > 0 && !selectedDetail.value) {
      selectedDetail.value = detailItems.value[0]
    }
  })

  // Functions
  const parseCert = () => {
    errorMessage.value = ''
    certificateInfo.value = null
    try {
      if (!input.value.trim()) throw new Error('请输入内容')
      certificateInfo.value = parseCertificate(input.value.trim())
      showInput.value = false
      toast({ title: '解析成功', variant: 'success' })
    } catch (e: any) {
      errorMessage.value = e.message
      toast({ title: '解析失败', description: e.message, variant: 'error' })
    }
  }

  const loadExample = () => {
    const certLines = [
      '-----BEGIN CERTIFICATE-----',
      'MIIEvjCCA6agAwIBAgIQdZgZR7xJ+wLLH5/RkzOOOzANBgkqhkiG9w0BAQsFADBG',
      'MQswCQYDVQQGEwJVUzEiMCAGA1UEChMZR29vZ2xlIFRydXN0IFNlcnZpY2VzIExM',
      'QzETMBEGA1UEAxMKR1RTIENBIDFDMzAeFw0yMzA4MDcwODE4MDRaFw0yMzEwMzAw',
      'ODE4MDNaMBkxFzAVBgNVBAMTDnd3dy5nb29nbGUuY29tMFkwEwYHKoZIzj0CAQYI',
      'KoZIzj0DAQcDQgAEjEUuKqIvLhKJeFMBkVt/cBF/QkQo8fTH2FYR3PG6ZujYJZKW',
      'mYFAB0KRzKPM7jWJJqiQeVhXI9fIqcq/UwdHCKOCAmMwggJfMA4GA1UdDwEB/wQE',
      'AwIHgDATBgNVHSUEDDAKBggrBgEFBQcDATAMBgNVHRMBAf8EAjAAMB0GA1UdDgQW',
      'BBQb3K3v7I7+GEKTpGbXq0bQhtADrTAfBgNVHSMEGDAWgBSKdH+vhc3ulc09nNDi',
      'RhTzcTUdJzBqBggrBgEFBQcBAQReMFwwJwYIKwYBBQUHMAGGG2h0dHA6Ly9vY3Nw',
      'LnBraS5nb29nL2d0czFjMzAxBggrBgEFBQcwAoYlaHR0cDovL3BraS5nb29nL3Jl',
      'cG8vY2VydHMvZ3RzMWMzLmRlcjAZBgNVHREEEjAQgg53d3cuZ29vZ2xlLmNvbTAh',
      'BgNVHSAEGjAYMAgGBmeBDAECATAMBgorBgEEAdZ5AgUDMDwGA1UdHwQ1MDMwMaAv',
      'oC2GK2h0dHA6Ly9jcmxzLnBraS5nb29nL2d0czFjMy9tb1ZEZklTdGVrMC5jcmww',
      'ggEFBgorBgEEAdZ5AgQCBIH2BIHzAPEAdgDoPtDaPvUGNTLnVyi8iWvJA9PL0RFr',
      '7Otp4Xd9bQa9bgAAAYl3FhfqAAAEAwBHMEUCIQCXyqZc8zJWJh8Y9J7UpnkJPQPh',
      'vqJQxKJCNWUNlqIFAQIgbAW3PJKr2qM1nCu5lH3n9LLg1w/NDRHL7pR/8gT8z6AA',
      'dwCzc3cH4YRQ+GOG1gWp3BEJSnktsWcMC4fc8AMOeTalmgAAAYl3FhfVAAAEAwBI',
      'MEYCIQDfPxPGJgJzMqYq9K0wU7YDQT5YnXm3YkUfhDJQGZGS3QIhANc9h4c2qH6N',
      'gU4q3gQBXx/wFhJwqZOQYkE1JYxIjJ3aMA0GCSqGSIb3DQEBCwUAA4IBAQBZFN8J',
      'HV0nOp5D8BhQ6ErgKvC0z5oAGMRYcE9f1lq7PqQKCZTkQKLNYvLiLQPqKUGdWO5Q',
      '9EKN4cEYVpE5a1Oq0PqExRZ4p3q3M2Qr/uGLAqLH9cOZZOzxrjLMSsLVWH0jHlUI',
      'Gf0yG9LJxnUIVshfDGj1OXLL+WFqBMhFG0qfZxGPVKxNLOVQIvZXI7wLTvQKLNw2',
      '3p5fRqCJbC0pFXQYj3K2z3YhC/sX8WXjBqFqOpQ9lVtfLXqKVQtpGMEaBZUZmyZh',
      'HdIpHbRKDnlJvZU9gNFKQ8W8LI3qXJUWLPZLm6hOJKHnPfGHBR7WdPyC9cTLQxJR',
      'p3wFYXL8pLgq8nW4',
      '-----END CERTIFICATE-----'
    ]
    input.value = certLines.join('\n')
    showInput.value = false
    parseCert()
  }

  const handleFileUpload = async (file: File) => {
    if (!file) return
    fileName.value = file.name
    try {
      certificateInfo.value = await parseCertificateFromFile(file)
      showInput.value = false
      toast({ title: '文件解析成功', variant: 'success' })
    } catch (e: any) {
      errorMessage.value = e.message
    }
  }

  const clearAll = () => {
    input.value = ''
    certificateInfo.value = null
    fileName.value = ''
    errorMessage.value = ''
    showInput.value = true
  }

  const copyText = (text: string, label: string) => {
    navigator.clipboard.writeText(text)
    toast({ title: '已复制', description: label })
  }

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString('zh-CN', {
      year: 'numeric', month: '2-digit', day: '2-digit', 
      hour: '2-digit', minute: '2-digit', second: '2-digit'
    })
  }

  return {
    input,
    inputMode,
    showInput,
    certificateInfo,
    errorMessage,
    activeTab,
    fileName,
    selectedDetail,
    tabs,
    isValidCert,
    isSM2,
    detailItems,
    parseCert,
    loadExample,
    handleFileUpload,
    clearAll,
    copyText,
    formatDate
  }
}

