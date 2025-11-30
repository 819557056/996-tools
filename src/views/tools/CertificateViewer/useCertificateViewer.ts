import { ref, computed, watch } from 'vue'
import { useToast } from '@/composables/useToast'
import { parseCertificate, parseCertificateFromFile, formatDistinguishedName, type CertificateInfo } from '@/utils/certificateViewer'
import { INDUSTRY_OPTIONS, type IndustryType } from '@/utils/certificateOids'

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
  const selectedIndustry = ref<IndustryType>('standard')

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
      certificateInfo.value = parseCertificate(input.value.trim(), selectedIndustry.value)
      showInput.value = false
      toast({ title: '解析成功', variant: 'success' })
    } catch (e: any) {
      errorMessage.value = e.message
      toast({ title: '解析失败', description: e.message, variant: 'error' })
    }
  }



  const handleFileUpload = async (file: File) => {
    if (!file) return
    fileName.value = file.name
    try {
      certificateInfo.value = await parseCertificateFromFile(file, selectedIndustry.value)
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
    handleFileUpload,
    clearAll,
    copyText,
    formatDate,
    selectedIndustry,
    industryOptions: INDUSTRY_OPTIONS
  }
}

