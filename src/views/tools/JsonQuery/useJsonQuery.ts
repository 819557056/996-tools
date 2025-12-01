import { ref, shallowRef } from 'vue'
import { useToast } from '@/composables/useToast'
import JSON5 from 'json5'
import jmespath from 'jmespath'
import { JSONPath } from 'jsonpath-plus'

export type QueryEngine = 'jmespath' | 'jsonpath'

export function useJsonQuery() {
  const { toast } = useToast()

  const inputJson = ref('')
  const queryExpression = ref('')
  const resultJson = ref('')
  const error = ref('')
  const queryEngine = ref<QueryEngine>('jsonpath')
  const editorRef = shallowRef<any>(null)

  // Query history
  const queryHistory = ref<Array<{ expression: string, engine: QueryEngine }>>([])
  const maxHistorySize = 20

  function handleMount(editor: any) {
    editorRef.value = editor
  }

  function validateAndParse() {
    if (!inputJson.value.trim()) {
      throw new Error('请输入JSON数据')
    }
    try {
      return JSON5.parse(inputJson.value)
    } catch (e) {
      const msg = (e as Error).message
      throw new Error(`JSON解析错误: ${msg}`)
    }
  }

  function executeQuery() {
    error.value = ''
    
    if (!queryExpression.value.trim()) {
      error.value = '请输入查询表达式'
      return
    }

    try {
      const parsed = validateAndParse()
      let result: any

      if (queryEngine.value === 'jmespath') {
        result = jmespath.search(parsed, queryExpression.value)
      } else {
        // JSONPath
        result = JSONPath({ path: queryExpression.value, json: parsed })
      }

      resultJson.value = JSON.stringify(result, null, 2)

      // Add to history
      addToHistory(queryExpression.value, queryEngine.value)

      toast({ 
        title: '查询成功', 
        variant: 'success', 
        duration: 2000 
      })
    } catch (e) {
      error.value = (e as Error).message
      resultJson.value = ''
    }
  }

  function addToHistory(expression: string, engine: QueryEngine) {
    // Remove duplicate if exists
    queryHistory.value = queryHistory.value.filter(
      h => !(h.expression === expression && h.engine === engine)
    )
    
    // Add to beginning
    queryHistory.value.unshift({ expression, engine })
    
    // Limit size
    if (queryHistory.value.length > maxHistorySize) {
      queryHistory.value = queryHistory.value.slice(0, maxHistorySize)
    }
  }

  function loadFromHistory(item: { expression: string, engine: QueryEngine }) {
    queryExpression.value = item.expression
    queryEngine.value = item.engine
    executeQuery()
  }

  function clearHistory() {
    queryHistory.value = []
    toast({ title: '历史记录已清空', variant: 'success', duration: 2000 })
  }

  async function copyResult() {
    if (!resultJson.value) {
      toast({ title: '没有可复制的内容', variant: 'destructive', duration: 2000 })
      return
    }
    try {
      await navigator.clipboard.writeText(resultJson.value)
      toast({ title: '复制成功', variant: 'success', duration: 2000 })
    } catch (err) {
      toast({ title: '复制失败', variant: 'destructive', duration: 2000 })
    }
  }

  function loadExample() {
    inputJson.value = `{
  "store": {
    "book": [
      {
        "category": "reference",
        "author": "Nigel Rees",
        "title": "Sayings of the Century",
        "price": 8.95
      },
      {
        "category": "fiction",
        "author": "Evelyn Waugh",
        "title": "Sword of Honour",
        "price": 12.99
      },
      {
        "category": "fiction",
        "author": "Herman Melville",
        "title": "Moby Dick",
        "isbn": "0-553-21311-3",
        "price": 8.99
      }
    ],
    "bicycle": {
      "color": "red",
      "price": 19.95
    }
  },
  "expensive": 10
}`

    // Set example query based on engine
    if (queryEngine.value === 'jsonpath') {
      queryExpression.value = '$.store.book[?(@.price < 10)].title'
    } else {
      queryExpression.value = 'store.book[?price < `10`].title'
    }

    setTimeout(executeQuery, 100)
  }

  function clear() {
    inputJson.value = ''
    queryExpression.value = ''
    resultJson.value = ''
    error.value = ''
  }

  // Example queries for each engine
  const examples = {
    jsonpath: [
      { label: '获取所有书籍标题', query: '$.store.book[*].title' },
      { label: '价格小于10的书', query: '$.store.book[?(@.price < 10)]' },
      { label: '第一本书的作者', query: '$.store.book[0].author' },
      { label: '所有价格', query: '$..price' },
      { label: '最后一本书', query: '$.store.book[-1:]' },
    ],
    jmespath: [
      { label: '获取所有书籍标题', query: 'store.book[*].title' },
      { label: '价格小于10的书', query: 'store.book[?price < `10`]' },
      { label: '第一本书的作者', query: 'store.book[0].author' },
      { label: '书籍数量', query: 'length(store.book)' },
      { label: '按价格排序', query: 'sort_by(store.book, &price)' },
    ]
  }

  function getExamples() {
    return examples[queryEngine.value] || []
  }

  function loadExampleQuery(query: string) {
    queryExpression.value = query
    if (inputJson.value) {
      executeQuery()
    }
  }

  return {
    inputJson,
    queryExpression,
    resultJson,
    error,
    queryEngine,
    queryHistory,
    handleMount,
    executeQuery,
    loadFromHistory,
    clearHistory,
    copyResult,
    loadExample,
    clear,
    getExamples,
    loadExampleQuery
  }
}

