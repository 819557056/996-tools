import { ref } from 'vue'
import { useToast } from '@/composables/useToast'
import JSON5 from 'json5'

export interface DiffStats {
  added: number
  removed: number
  modified: number
}

export function useJsonDiff() {
  const { toast } = useToast()

  const leftJson = ref('')
  const rightJson = ref('')
  const leftError = ref('')
  const rightError = ref('')
  const diffStats = ref<DiffStats>({ added: 0, removed: 0, modified: 0 })
  const showDiffView = ref(false)

  function validateAndParse(jsonString: string): any {
    if (!jsonString.trim()) {
      throw new Error('JSON 数据为空')
    }
    try {
      return JSON5.parse(jsonString)
    } catch (e) {
      const msg = (e as Error).message
      throw new Error(`JSON 解析错误: ${msg}`)
    }
  }

  function formatJson(side: 'left' | 'right') {
    const jsonRef = side === 'left' ? leftJson : rightJson
    const errorRef = side === 'left' ? leftError : rightError
    
    errorRef.value = ''
    try {
      const parsed = validateAndParse(jsonRef.value)
      jsonRef.value = JSON.stringify(parsed, null, 2)
      toast({ title: '格式化成功', variant: 'success', duration: 2000 })
    } catch (e) {
      errorRef.value = (e as Error).message
    }
  }

  function validateBoth() {
    leftError.value = ''
    rightError.value = ''
    
    try {
      validateAndParse(leftJson.value)
    } catch (e) {
      leftError.value = (e as Error).message
    }
    
    try {
      validateAndParse(rightJson.value)
    } catch (e) {
      rightError.value = (e as Error).message
    }
    
    return !leftError.value && !rightError.value
  }

  function calculateDiff() {
    if (!validateBoth()) {
      toast({ title: '请确保两边的 JSON 都有效', variant: 'destructive', duration: 2000 })
      return
    }

    try {
      const leftObj = validateAndParse(leftJson.value)
      const rightObj = validateAndParse(rightJson.value)

      const stats = computeDiffStats(leftObj, rightObj)
      diffStats.value = stats

      showDiffView.value = true

      toast({ 
        title: `对比完成: ${stats.added} 新增, ${stats.modified} 修改, ${stats.removed} 删除`, 
        variant: 'success', 
        duration: 3000 
      })
    } catch (e) {
      toast({ title: (e as Error).message, variant: 'destructive', duration: 2000 })
    }
  }

  function computeDiffStats(left: any, right: any, path: string = ''): DiffStats {
    const stats: DiffStats = { added: 0, removed: 0, modified: 0 }

    if (typeof left !== 'object' || typeof right !== 'object') {
      if (left !== right) {
        stats.modified++
      }
      return stats
    }

    if (left === null || right === null) {
      if (left !== right) {
        stats.modified++
      }
      return stats
    }

    // Handle arrays
    if (Array.isArray(left) && Array.isArray(right)) {
      const maxLen = Math.max(left.length, right.length)
      for (let i = 0; i < maxLen; i++) {
        if (i >= left.length) {
          stats.added++
        } else if (i >= right.length) {
          stats.removed++
        } else {
          const childStats = computeDiffStats(left[i], right[i], `${path}[${i}]`)
          stats.added += childStats.added
          stats.removed += childStats.removed
          stats.modified += childStats.modified
        }
      }
      return stats
    }

    // Handle objects
    const leftKeys = new Set(Object.keys(left))
    const rightKeys = new Set(Object.keys(right))
    const allKeys = new Set([...leftKeys, ...rightKeys])

    for (const key of allKeys) {
      const newPath = path ? `${path}.${key}` : key

      if (!leftKeys.has(key)) {
        // Key only in right (added)
        stats.added++
      } else if (!rightKeys.has(key)) {
        // Key only in left (removed)
        stats.removed++
      } else {
        // Key in both
        const leftVal = left[key]
        const rightVal = right[key]

        if (typeof leftVal === 'object' && typeof rightVal === 'object') {
          const childStats = computeDiffStats(leftVal, rightVal, newPath)
          stats.added += childStats.added
          stats.removed += childStats.removed
          stats.modified += childStats.modified
        } else if (leftVal !== rightVal) {
          stats.modified++
        }
      }
    }

    return stats
  }

  function swapSides() {
    const temp = leftJson.value
    leftJson.value = rightJson.value
    rightJson.value = temp

    const tempErr = leftError.value
    leftError.value = rightError.value
    rightError.value = tempErr

    toast({ title: '已交换两侧内容', variant: 'success', duration: 2000 })
  }

  function copyToRight() {
    rightJson.value = leftJson.value
    rightError.value = ''
    toast({ title: '已复制到右侧', variant: 'success', duration: 2000 })
  }

  function copyToLeft() {
    leftJson.value = rightJson.value
    leftError.value = ''
    toast({ title: '已复制到左侧', variant: 'success', duration: 2000 })
  }

  function loadExample() {
    leftJson.value = `{
  "name": "John Doe",
  "age": 30,
  "email": "john@example.com",
  "address": {
    "city": "New York",
    "country": "USA"
  },
  "hobbies": ["reading", "coding"],
  "isActive": true
}`

    rightJson.value = `{
  "name": "John Doe",
  "age": 31,
  "email": "john.doe@example.com",
  "address": {
    "city": "Los Angeles",
    "country": "USA",
    "zipCode": "90001"
  },
  "hobbies": ["reading", "gaming", "coding"],
  "isActive": true,
  "lastLogin": "2024-01-15"
}`

    leftError.value = ''
    rightError.value = ''
    
    setTimeout(calculateDiff, 100)
  }

  function clear() {
    leftJson.value = ''
    rightJson.value = ''
    leftError.value = ''
    rightError.value = ''
    diffStats.value = { added: 0, removed: 0, modified: 0 }
    showDiffView.value = false
  }

  return {
    leftJson,
    rightJson,
    leftError,
    rightError,
    diffStats,
    showDiffView,
    formatJson,
    calculateDiff,
    swapSides,
    copyToRight,
    copyToLeft,
    loadExample,
    clear
  }
}

