import { ref, watch, computed } from 'vue'
import yaml from 'js-yaml'
import TOML from '@iarna/toml'
import { useToast } from '@/composables/useToast'
import { convertFormat } from '../FormatConverter/converters'
import { propertiesConverter } from '../FormatConverter/converters/propertiesConverter'
import type { EditorType, ValidationError, IndentationIssue } from './types'

export function useYamlTomlEditor() {
  const { toast } = useToast()
  
  const editorType = ref<EditorType>('yaml')
  const content = ref('')
  const errors = ref<ValidationError[]>([])
  const indentationIssues = ref<IndentationIssue[]>([])
  const isValid = ref(true)
  const editorRef = ref<any>(null)
  
  // 实时语法校验（防抖）
  let validateTimer: NodeJS.Timeout | null = null
  watch(content, (newContent) => {
    if (validateTimer) {
      clearTimeout(validateTimer)
    }
    
    validateTimer = setTimeout(() => {
      validateSyntax(newContent)
      if (editorType.value === 'yaml') {
        checkIndentation(newContent)
      }
    }, 500)
  })
  
  // 语法校验
  function validateSyntax(text: string): boolean {
    errors.value = []
    isValid.value = true
    
    if (!text.trim()) {
      return true
    }
    
    try {
      if (editorType.value === 'yaml') {
        yaml.load(text)
      } else if (editorType.value === 'toml') {
        TOML.parse(text)
      } else if (editorType.value === 'properties') {
        propertiesConverter.parse(text)
      }
      return true
    } catch (e: any) {
      isValid.value = false
      
      // 解析错误信息
      const errorMessage = e.message
      let line = 0
      let column = 0
      
      // 尝试提取行号和列号
      const lineMatch = errorMessage.match(/line (\d+)/i)
      const columnMatch = errorMessage.match(/column (\d+)/i)
      
      if (lineMatch) {
        line = parseInt(lineMatch[1])
      }
      if (columnMatch) {
        column = parseInt(columnMatch[1])
      }
      
      errors.value.push({
        line,
        column,
        message: errorMessage,
        severity: 'error'
      })
      
      return false
    }
  }
  
  // 缩进检测（YAML 特有）
  function checkIndentation(text: string) {
    if (editorType.value !== 'yaml') return
    
    indentationIssues.value = []
    const lines = text.split('\n')
    
    lines.forEach((line, index) => {
      const trimmed = line.trim()
      
      // 跳过空行和注释
      if (!trimmed || trimmed.startsWith('#')) {
        return
      }
      
      // 检查行首空格
      const leadingSpaces = line.match(/^(\s*)/)?.[1].length || 0
      
      // 检查是否使用了 tab
      if (line.startsWith('\t')) {
        indentationIssues.value.push({
          line: index + 1,
          expected: 0,
          actual: leadingSpaces,
          message: '不应使用 Tab 缩进，请使用空格'
        })
        return
      }
      
      // 检查缩进是否为 2 的倍数
      if (leadingSpaces > 0 && leadingSpaces % 2 !== 0) {
        const expected = Math.round(leadingSpaces / 2) * 2
        indentationIssues.value.push({
          line: index + 1,
          expected,
          actual: leadingSpaces,
          message: `缩进应为 2 的倍数，当前为 ${leadingSpaces} 个空格，建议调整为 ${expected} 个`
        })
      }
    })
  }
  
  // 将扁平化的对象转换为嵌套结构
  function unflattenObject(obj: any): any {
    if (typeof obj !== 'object' || obj === null || Array.isArray(obj)) {
      return obj
    }
    
    const result: any = {}
    
    for (const [key, value] of Object.entries(obj)) {
      // 检查 key 是否包含点号
      if (key.includes('.')) {
        const parts = key.split('.')
        let current = result
        
        // 遍历路径，创建嵌套对象
        for (let i = 0; i < parts.length - 1; i++) {
          const part = parts[i]
          if (!(part in current)) {
            current[part] = {}
          }
          // 如果当前值不是对象，需要转换为对象
          if (typeof current[part] !== 'object' || current[part] === null) {
            current[part] = {}
          }
          current = current[part]
        }
        
        // 设置最终值
        const lastPart = parts[parts.length - 1]
        current[lastPart] = typeof value === 'object' ? unflattenObject(value) : value
      } else {
        // 递归处理嵌套对象
        result[key] = typeof value === 'object' && value !== null && !Array.isArray(value)
          ? unflattenObject(value)
          : value
      }
    }
    
    return result
  }
  
  // 格式化
  function format() {
    if (!content.value.trim()) {
      toast({ title: '内容为空', variant: 'warning', duration: 2000 })
      return
    }

    try {
      if (editorType.value === 'yaml') {
        let parsed = yaml.load(content.value)
        // 将扁平化的属性转换为嵌套结构
        parsed = unflattenObject(parsed)
        content.value = yaml.dump(parsed, {
          indent: 2,
          lineWidth: 120,
          noRefs: true,
          sortKeys: false
        })
      } else if (editorType.value === 'toml') {
        const parsed = TOML.parse(content.value)
        content.value = TOML.stringify(parsed)
      } else if (editorType.value === 'properties') {
        // Properties 格式化：解析后重新生成
        const parsed = propertiesConverter.parse(content.value)
        content.value = propertiesConverter.stringify(parsed)
      }
      
      toast({ title: '格式化成功', variant: 'success', duration: 2000 })
      errors.value = []
      indentationIssues.value = []
    } catch (e: any) {
      toast({ 
        title: '格式化失败', 
        description: e.message,
        variant: 'destructive',
        duration: 3000 
      })
    }
  }
  
  // 验证并显示结果
  function validate() {
    const isValidSyntax = validateSyntax(content.value)
    
    if (editorType.value === 'yaml') {
      checkIndentation(content.value)
    }
    
    if (isValidSyntax && indentationIssues.value.length === 0) {
      toast({
        title: '验证通过 ✓',
        description: `${editorType.value.toUpperCase()} 格式正确`,
        variant: 'success',
        duration: 2000
      })
    } else if (isValidSyntax && indentationIssues.value.length > 0) {
      toast({
        title: '语法正确，但有缩进警告',
        description: `发现 ${indentationIssues.value.length} 处缩进问题`,
        variant: 'warning',
        duration: 3000
      })
    } else {
      toast({
        title: '验证失败',
        description: errors.value[0]?.message || '格式错误',
        variant: 'destructive',
        duration: 3000
      })
    }
  }
  
  // 转换为 JSON
  function convertToJson() {
    if (!content.value.trim()) {
      toast({ title: '内容为空', variant: 'warning', duration: 2000 })
      return ''
    }

    try {
      const result = convertFormat(content.value, editorType.value, 'json')
      if (result.success) {
        toast({
          title: '转换成功',
          description: `${editorType.value.toUpperCase()} → JSON`,
          variant: 'success',
          duration: 2000
        })
        return result.data
      } else {
        toast({
          title: '转换失败',
          description: result.error,
          variant: 'destructive',
          duration: 3000
        })
        return ''
      }
    } catch (e: any) {
      toast({
        title: '转换失败',
        description: e.message,
        variant: 'destructive',
        duration: 3000
      })
      return ''
    }
  }
  
  // 从 JSON 导入
  function importFromJson(jsonText: string) {
    if (!jsonText.trim()) {
      toast({ title: 'JSON 内容为空', variant: 'warning', duration: 2000 })
      return
    }

    try {
      const result = convertFormat(jsonText, 'json', editorType.value)
      if (result.success) {
        content.value = result.data
        toast({
          title: '导入成功',
          description: `JSON → ${editorType.value.toUpperCase()}`,
          variant: 'success',
          duration: 2000
        })
      } else {
        toast({
          title: '导入失败',
          description: result.error,
          variant: 'destructive',
          duration: 3000
        })
      }
    } catch (e: any) {
      toast({
        title: '导入失败',
        description: e.message,
        variant: 'destructive',
        duration: 3000
      })
    }
  }
  
  // 切换编辑器类型
  function switchEditorType(type: EditorType) {
    if (type === editorType.value) return
    
    // 如果有内容，尝试转换
    if (content.value.trim()) {
      try {
        const result = convertFormat(content.value, editorType.value, type)
        if (result.success) {
          content.value = result.data
          editorType.value = type
          toast({
            title: '格式切换成功',
            variant: 'success',
            duration: 1500
          })
        } else {
          toast({
            title: '格式切换失败',
            description: '请先修复当前格式的错误',
            variant: 'destructive',
            duration: 3000
          })
        }
      } catch (e: any) {
        toast({
          title: '格式切换失败',
          description: e.message,
          variant: 'destructive',
          duration: 3000
        })
      }
    } else {
      editorType.value = type
    }
  }
  
  // 修复缩进
  function fixIndentation() {
    if (editorType.value !== 'yaml' || !content.value.trim()) {
      return
    }

    try {
      // 通过重新格式化来修复缩进，同时转换扁平化属性
      let parsed = yaml.load(content.value)
      parsed = unflattenObject(parsed)
      content.value = yaml.dump(parsed, {
        indent: 2,
        lineWidth: 120,
        noRefs: true
      })
      
      indentationIssues.value = []
      toast({
        title: '缩进已修复',
        variant: 'success',
        duration: 2000
      })
    } catch (e: any) {
      toast({
        title: '修复失败',
        description: '请先修复语法错误',
        variant: 'destructive',
        duration: 3000
      })
    }
  }
  
  // 加载示例
  function loadExample() {
    const examples = {
      yaml: `# Kubernetes Pod 配置示例
apiVersion: v1
kind: Pod
metadata:
  name: nginx-pod
  labels:
    app: nginx
    environment: production
spec:
  containers:
    - name: nginx
      image: nginx:1.21
      ports:
        - containerPort: 80
          protocol: TCP
      resources:
        requests:
          memory: "64Mi"
          cpu: "250m"
        limits:
          memory: "128Mi"
          cpu: "500m"
      env:
        - name: NGINX_HOST
          value: example.com
        - name: NGINX_PORT
          value: "80"`,
      toml: `# Rust Cargo.toml 配置示例
[package]
name = "my-project"
version = "0.1.0"
edition = "2021"
authors = ["Your Name <you@example.com>"]
description = "A demo project"

[dependencies]
serde = { version = "1.0", features = ["derive"] }
tokio = { version = "1.0", features = ["full"] }
axum = "0.6"

[dev-dependencies]
criterion = "0.5"

[[bin]]
name = "server"
path = "src/main.rs"

[profile.release]
opt-level = 3
lto = true`,
      properties: `# Spring Boot 配置示例
# 服务器配置
server.port=8080
server.address=0.0.0.0
server.servlet.context-path=/api

# 数据库配置
spring.datasource.url=jdbc:mysql://localhost:3306/mydb
spring.datasource.username=root
spring.datasource.password=password123
spring.datasource.driver-class-name=com.mysql.cj.jdbc.Driver

# JPA 配置
spring.jpa.hibernate.ddl-auto=update
spring.jpa.show-sql=true
spring.jpa.properties.hibernate.dialect=org.hibernate.dialect.MySQL8Dialect

# 日志配置
logging.level.root=INFO
logging.level.com.example=DEBUG
logging.file.name=logs/application.log

# 应用配置
app.name=My Application
app.version=1.0.0
app.description=A Spring Boot application example`
    }
    
    content.value = examples[editorType.value]
  }
  
  // 复制内容
  async function copy() {
    if (!content.value.trim()) {
      toast({ title: '内容为空', variant: 'warning', duration: 2000 })
      return
    }

    try {
      await navigator.clipboard.writeText(content.value)
      toast({ title: '复制成功', variant: 'success', duration: 2000 })
    } catch {
      toast({ title: '复制失败', variant: 'destructive', duration: 2000 })
    }
  }
  
  // 清空
  function clear() {
    content.value = ''
    errors.value = []
    indentationIssues.value = []
    toast({ title: '已清空', variant: 'default', duration: 1500 })
  }
  
  // 下载
  function download() {
    if (!content.value.trim()) {
      toast({ title: '内容为空', variant: 'warning', duration: 2000 })
      return
    }

    const blob = new Blob([content.value], { type: 'text/plain;charset=utf-8' })
    const link = document.createElement('a')
    const url = URL.createObjectURL(blob)
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5)
    const extensionMap = {
      yaml: 'yaml',
      toml: 'toml',
      properties: 'properties'
    }
    const extension = extensionMap[editorType.value]
    link.href = url
    link.download = `config_${timestamp}.${extension}`
    link.click()
    
    URL.revokeObjectURL(url)
    toast({ title: '下载成功', variant: 'success', duration: 2000 })
  }
  
  // 编辑器挂载
  function handleMount(editor: any) {
    editorRef.value = editor
  }
  
  // 计算统计信息
  const stats = computed(() => {
    const lines = content.value.split('\n').length
    const chars = content.value.length
    const words = content.value.trim() ? content.value.trim().split(/\s+/).length : 0
    
    return { lines, chars, words }
  })
  
  return {
    editorType,
    content,
    errors,
    indentationIssues,
    isValid,
    stats,
    editorRef,
    validateSyntax,
    checkIndentation,
    format,
    validate,
    convertToJson,
    importFromJson,
    switchEditorType,
    fixIndentation,
    loadExample,
    copy,
    clear,
    download,
    handleMount
  }
}
