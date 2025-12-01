import { ref, computed } from 'vue'
import Papa from 'papaparse'
import JSZip from 'jszip'
import { useToast } from '@/composables/useToast'
import type { CsvData, SplitOptions, ColumnSelection, SqlOptions } from './types'

export function useCsvAdvanced() {
  const { toast } = useToast()
  
  const csvContent = ref('')
  const csvData = ref<CsvData>({ headers: [], rows: [] })
  const isParsed = ref(false)
  const parseError = ref('')
  
  // 计算统计信息
  const stats = computed(() => ({
    rows: csvData.value.rows.length,
    columns: csvData.value.headers.length,
    size: new TextEncoder().encode(csvContent.value).length
  }))
  
  // 解析 CSV
  function parseCsv() {
    parseError.value = ''
    
    if (!csvContent.value.trim()) {
      parseError.value = '请输入 CSV 数据'
      return false
    }

    try {
      const result = Papa.parse(csvContent.value, {
        header: true,
        skipEmptyLines: true,
        dynamicTyping: false,
        transformHeader: (header) => header.trim()
      })
      
      if (result.errors.length > 0) {
        parseError.value = `解析错误: ${result.errors[0].message}`
        return false
      }
      
      csvData.value = {
        headers: result.meta.fields || [],
        rows: result.data as Record<string, any>[]
      }
      
      isParsed.value = true
      toast({
        title: '解析成功',
        description: `${csvData.value.rows.length} 行 × ${csvData.value.headers.length} 列`,
        variant: 'success',
        duration: 2000
      })
      
      return true
    } catch (e: any) {
      parseError.value = `解析失败: ${e.message}`
      return false
    }
  }
  
  // CSV 分割
  function splitCsv(options: SplitOptions): string[] {
    if (!parseCsv()) {
      return []
    }
    
    const files: string[] = []
    const { rows, headers } = csvData.value
    
    if (options.type === 'lines') {
      // 按行数分割
      const chunkSize = options.value
      for (let i = 0; i < rows.length; i += chunkSize) {
        const chunk = rows.slice(i, i + chunkSize)
        const csv = Papa.unparse(chunk, { 
          header: true,
          columns: headers 
        })
        files.push(csv)
      }
    } else {
      // 按文件大小分割（KB）
      const maxSize = options.value * 1024
      let currentChunk: any[] = []
      let currentSize = 0
      const headerSize = Papa.unparse([rows[0]], { 
        header: true,
        columns: headers 
      }).length
      
      rows.forEach((row, index) => {
        const rowCsv = Papa.unparse([row], { header: false })
        const rowSize = rowCsv.length
        
        if (currentSize + rowSize > maxSize && currentChunk.length > 0) {
          const csv = Papa.unparse(currentChunk, { 
            header: true,
            columns: headers 
          })
          files.push(csv)
          currentChunk = []
          currentSize = headerSize
        }
        
        currentChunk.push(row)
        currentSize += rowSize
      })
      
      if (currentChunk.length > 0) {
        const csv = Papa.unparse(currentChunk, { 
          header: true,
          columns: headers 
        })
        files.push(csv)
      }
    }
    
    toast({
      title: '分割完成',
      description: `生成了 ${files.length} 个文件`,
      variant: 'success',
      duration: 2000
    })
    
    return files
  }
  
  // 列提取与重排
  function extractColumns(selections: ColumnSelection[]): string {
    if (!parseCsv()) {
      return ''
    }
    
    // 按 order 排序
    const sorted = [...selections].sort((a, b) => a.order - b.order)
    
    // 创建新的列映射
    const newHeaders = sorted.map(s => s.newName || s.column)
    const columnMap = sorted.map(s => s.column)
    
    // 提取数据
    const extracted = csvData.value.rows.map(row => {
      const newRow: any = {}
      sorted.forEach((sel, idx) => {
        newRow[newHeaders[idx]] = row[sel.column] || ''
      })
      return newRow
    })
    
    const result = Papa.unparse(extracted, {
      header: true,
      columns: newHeaders
    })
    
    toast({
      title: '列提取成功',
      description: `提取了 ${newHeaders.length} 列`,
      variant: 'success',
      duration: 2000
    })
    
    return result
  }
  
  // CSV 转 SQL Insert
  function csvToSqlInsert(options: SqlOptions): string {
    if (!parseCsv()) {
      return ''
    }
    
    const { tableName, includeColumns, batchSize } = options
    const columns = includeColumns.length > 0 
      ? includeColumns 
      : csvData.value.headers
    
    const sqlStatements: string[] = []
    
    // 按批次生成 SQL
    for (let i = 0; i < csvData.value.rows.length; i += batchSize) {
      const batch = csvData.value.rows.slice(i, i + batchSize)
      
      if (batchSize === 1) {
        // 单条插入
        batch.forEach(row => {
          const values = columns.map(col => {
            const value = row[col]
            if (value === null || value === undefined || value === '') {
              return 'NULL'
            }
            if (typeof value === 'number') {
              return value
            }
            // 转义单引号
            return `'${String(value).replace(/'/g, "''")}'`
          }).join(', ')
          
          sqlStatements.push(
            `INSERT INTO ${tableName} (${columns.join(', ')}) VALUES (${values});`
          )
        })
      } else {
        // 批量插入
        const valuesList = batch.map(row => {
          const values = columns.map(col => {
            const value = row[col]
            if (value === null || value === undefined || value === '') {
              return 'NULL'
            }
            if (typeof value === 'number') {
              return value
            }
            return `'${String(value).replace(/'/g, "''")}'`
          }).join(', ')
          return `(${values})`
        }).join(',\n  ')
        
        sqlStatements.push(
          `INSERT INTO ${tableName} (${columns.join(', ')})\nVALUES\n  ${valuesList};`
        )
      }
    }
    
    const result = sqlStatements.join('\n\n')
    
    toast({
      title: 'SQL 生成成功',
      description: `生成了 ${sqlStatements.length} 条 SQL 语句`,
      variant: 'success',
      duration: 2000
    })
    
    return result
  }
  
  // 下载分割后的文件（打包为 ZIP）
  async function downloadSplitFiles(files: string[]) {
    try {
      // 创建 ZIP 文件
      const zip = new JSZip()
      
      // 添加所有文件到 ZIP
      files.forEach((content, index) => {
        zip.file(`part_${index + 1}.csv`, content)
      })
      
      // 生成 ZIP 文件
      const blob = await zip.generateAsync({ 
        type: 'blob',
        compression: 'DEFLATE',
        compressionOptions: { level: 6 }
      })
      
      // 下载 ZIP 文件
      const link = document.createElement('a')
      link.href = URL.createObjectURL(blob)
      
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5)
      link.download = `csv_split_${timestamp}.zip`
      link.click()
      URL.revokeObjectURL(link.href)
      
      toast({
        title: '下载成功',
        description: `已将 ${files.length} 个文件打包为 ZIP`,
        variant: 'success',
        duration: 2000
      })
    } catch (error) {
      toast({
        title: '下载失败',
        description: (error as Error).message,
        variant: 'destructive',
        duration: 3000
      })
    }
  }
  
  // 下载单个文件
  function downloadFile(content: string, filename: string) {
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = filename
    link.click()
    URL.revokeObjectURL(link.href)
    
    toast({
      title: '下载成功',
      variant: 'success',
      duration: 2000
    })
  }
  
  // 复制到剪贴板
  async function copyToClipboard(text: string) {
    try {
      await navigator.clipboard.writeText(text)
      toast({
        title: '复制成功',
        variant: 'success',
        duration: 2000
      })
    } catch {
      toast({
        title: '复制失败',
        variant: 'destructive',
        duration: 2000
      })
    }
  }
  
  // 加载示例
  function loadExample() {
    csvContent.value = `id,name,age,email,city,salary
1,张三,30,zhangsan@example.com,北京,8000
2,李四,25,lisi@example.com,上海,7500
3,王五,35,wangwu@example.com,深圳,9000
4,赵六,28,zhaoliu@example.com,广州,7800
5,钱七,32,qianqi@example.com,杭州,8500
6,孙八,29,sunba@example.com,成都,7200
7,周九,31,zhoujiu@example.com,武汉,7600
8,吴十,27,wushi@example.com,西安,7300
9,郑一,33,zhengyi@example.com,南京,8200
10,冯二,26,fenger@example.com,重庆,7400`
    
    parseCsv()
  }
  
  // 读取文件内容
  async function readFile(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = (e) => {
        const result = e.target?.result
        if (typeof result === 'string') {
          resolve(result)
        } else {
          reject(new Error('无法读取文件'))
        }
      }
      reader.onerror = () => reject(new Error('文件读取失败'))
      reader.readAsText(file, 'utf-8')
    })
  }
  
  // 处理文件上传
  async function handleFileUpload(file: File) {
    // 检查文件类型
    const validTypes = ['.csv', 'text/csv', 'application/vnd.ms-excel', 'text/plain']
    const fileName = file.name.toLowerCase()
    const fileType = file.type
    
    if (!fileName.endsWith('.csv') && !validTypes.includes(fileType)) {
      toast({
        title: '文件类型错误',
        description: '请上传 CSV 文件',
        variant: 'destructive',
        duration: 3000
      })
      return
    }
    
    // 检查文件大小（限制 10MB）
    const maxSize = 10 * 1024 * 1024
    if (file.size > maxSize) {
      toast({
        title: '文件过大',
        description: '文件大小不能超过 10MB',
        variant: 'destructive',
        duration: 3000
      })
      return
    }
    
    try {
      const content = await readFile(file)
      csvContent.value = content
      
      toast({
        title: '文件加载成功',
        description: `已加载：${file.name}`,
        variant: 'success',
        duration: 2000
      })
      
      // 自动解析
      setTimeout(() => {
        parseCsv()
      }, 100)
    } catch (error) {
      toast({
        title: '文件读取失败',
        description: (error as Error).message,
        variant: 'destructive',
        duration: 3000
      })
    }
  }
  
  // 处理拖拽上传
  function handleDrop(event: DragEvent) {
    event.preventDefault()
    event.stopPropagation()
    
    const files = event.dataTransfer?.files
    if (files && files.length > 0) {
      handleFileUpload(files[0])
    }
    
    return false
  }
  
  // 处理文件选择
  function handleFileSelect(event: Event) {
    const input = event.target as HTMLInputElement
    const files = input.files
    if (files && files.length > 0) {
      handleFileUpload(files[0])
    }
    // 清空 input，允许重复选择同一文件
    input.value = ''
  }
  
  // 清空
  function clear() {
    csvContent.value = ''
    csvData.value = { headers: [], rows: [] }
    isParsed.value = false
    parseError.value = ''
    
    toast({
      title: '已清空',
      variant: 'default',
      duration: 1500
    })
  }
  
  return {
    csvContent,
    csvData,
    isParsed,
    parseError,
    stats,
    parseCsv,
    splitCsv,
    extractColumns,
    csvToSqlInsert,
    downloadSplitFiles,
    downloadFile,
    copyToClipboard,
    loadExample,
    clear,
    handleDrop,
    handleFileSelect
  }
}

