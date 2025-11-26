import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useToast } from '@/composables/useToast'

export function use{{toolPascalName}}() {
  const { t } = useI18n()
  const { toast } = useToast()

  // ========== 状态定义 ==========
  const input = ref('')
  const output = ref('')

  // ========== 核心功能 ==========
  function handleAction() {
    if (!input.value.trim()) {
      toast({
        title: '请输入内容',
        variant: 'error',
        duration: 2000,
      })
      return
    }

    try {
      // TODO: 在此实现具体的处理逻辑
      output.value = input.value
      
      toast({
        title: '处理成功',
        variant: 'success',
        duration: 2000,
      })
    } catch (error) {
      toast({
        title: '处理失败',
        description: (error as Error).message,
        variant: 'error',
      })
    }
  }

  // ========== 工具函数 ==========
  function copyToClipboard() {
    if (output.value) {
      navigator.clipboard.writeText(output.value)
      toast({
        title: t('common.copied'),
        variant: 'success',
        duration: 2000,
      })
    }
  }

  return {
    t,
    input,
    output,
    handleAction,
    copyToClipboard
  }
}

