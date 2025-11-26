import { ref, computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { v1 as uuidv1, v4 as uuidv4, v5 as uuidv5, validate } from 'uuid'
import { useToast } from '@/composables/useToast'

export function useUuidGenerator() {
  const { t, locale } = useI18n()
  const { toast } = useToast()

  // Default namespace for UUID v5
  const NAMESPACE_URL = '6ba7b811-9dad-11d1-80b4-00c04fd430c8'

  const version = ref<'v1' | 'v4' | 'v5'>('v4')
  const quantity = ref<number>(5)
  const generatedUUIDs = ref<string[]>([])
  const namespace = ref<string>(NAMESPACE_URL)
  const name = ref<string>('example.com')
  const namespaceError = ref<string>('')

  const versionDescription = computed(() => {
    const descriptions = {
      v1: '基于时间戳和MAC地址生成',
      v4: '使用随机数或伪随机数生成',
      v5: '通过哈希命名空间和名称生成',
    }
    return descriptions[version.value]
  })

  const formatDescription = computed(() => {
    const formats = {
      v1: '基于时间-MAC',
      v4: '随机',
      v5: '基于名称的SHA-1',
    }
    return formats[version.value]
  })

  function generateUUIDs() {
    let newUUIDs: string[] = []

    try {
      if (version.value === 'v5') {
        // Validate namespace for v5
        if (!validate(namespace.value)) {
          namespaceError.value = '无效的UUID命名空间'
          return
        }
        namespaceError.value = ''

        newUUIDs = Array(Number(quantity.value))
          .fill(0)
          .map(() => uuidv5(name.value, namespace.value))
      } else if (version.value === 'v1') {
        newUUIDs = Array(Number(quantity.value))
          .fill(0)
          .map(() => uuidv1())
      } else {
        // Default to v4
        newUUIDs = Array(Number(quantity.value))
          .fill(0)
          .map(() => uuidv4())
      }

      generatedUUIDs.value = newUUIDs
    } catch (error) {
      toast({
        title: '生成UUID时出错',
        description: (error as Error).message,
        variant: 'error',
      })
    }
  }

  function copyToClipboard(text: string) {
    navigator.clipboard.writeText(text)
    toast({
      title: t('common.copied'),
      variant: 'success',
      duration: 2000,
    })
  }

  function copyAllUUIDs() {
    navigator.clipboard.writeText(generatedUUIDs.value.join('\n'))
    toast({
      title: t('common.copied'),
      variant: 'success',
      duration: 2000,
    })
  }

  function handleVersionChange() {
    namespaceError.value = ''
    setTimeout(generateUUIDs, 0)
  }

  function generateNewNamespace() {
    const newNamespace = uuidv4()
    namespace.value = newNamespace
    namespaceError.value = ''

    if (version.value === 'v5') {
      setTimeout(() => {
        generateUUIDs()
      }, 0)
    }

    toast({
      title: '已生成新命名空间',
      description: '生成了一个随机的UUID v4作为命名空间',
      variant: 'success',
      duration: 2000,
    })
  }

  onMounted(() => {
    generateUUIDs()
  })

  return {
    t,
    locale,
    version,
    quantity,
    generatedUUIDs,
    namespace,
    name,
    namespaceError,
    versionDescription,
    formatDescription,
    generateUUIDs,
    copyToClipboard,
    copyAllUUIDs,
    handleVersionChange,
    generateNewNamespace
  }
}

