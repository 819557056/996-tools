import { ref, shallowRef } from 'vue'
import { useToast } from '@/composables/useToast'
import JSON5 from 'json5'

export function useJsonFormatter() {
  const { toast } = useToast()

  const content = ref('')
  const error = ref('')
  const editorRef = shallowRef<any>(null)

  function handleMount(editor: any) {
    editorRef.value = editor
    editor.onDidPaste(() => {
      setTimeout(() => {
          try {
            validateAndParse()
            formatJson()
          } catch (e) {
            // Ignore
          }
      }, 100)
    })
  }

  function validateAndParse() {
    if (!content.value.trim()) {
      throw new Error('请输入JSON数据')
    }
    try {
      return JSON5.parse(content.value)
    } catch (e) {
      const msg = (e as Error).message
      throw new Error(msg)
    }
  }

  function formatJson() {
    error.value = ''
    try {
      const parsed = validateAndParse()
      content.value = JSON.stringify(parsed, null, 2)
    } catch (e) {
      error.value = (e as Error).message
    }
  }

  function removeComments() {
    formatJson()
  }

  function foldAll() {
    editorRef.value?.getAction('editor.foldAll')?.run()
  }

  function unfoldAll() {
    editorRef.value?.getAction('editor.unfoldAll')?.run()
  }

  async function copyText(text: string, successMessage: string) {
    try {
      await navigator.clipboard.writeText(text)
      toast({ title: successMessage, variant: 'success', duration: 2000 })
    } catch (err) {
      toast({ title: '复制失败', variant: 'destructive', duration: 2000 })
    }
  }

  function minifyAndCopy() {
    error.value = ''
    try {
      const parsed = validateAndParse()
      const minified = JSON.stringify(parsed)
      copyText(minified, 'JSON压缩并复制成功')
    } catch (e) {
      error.value = (e as Error).message
    }
  }

  function minifyEscapeAndCopy() {
    error.value = ''
    try {
      const parsed = validateAndParse()
      const minified = JSON.stringify(parsed)
      const escaped = JSON.stringify(minified)
      copyText(escaped, '压缩并转义复制成功')
    } catch (e) {
      error.value = (e as Error).message
    }
  }

  function toXml(obj: any, indent: number = 0): string {
    const spaces = '  '.repeat(indent)
    if (obj === null) return ''
    
    if (typeof obj !== 'object') {
      return `${obj}`
    }
    
    let xml = ''
    
    if (Array.isArray(obj)) {
      // Root array or nested array passed directly
      obj.forEach(item => {
        if (typeof item === 'object') {
           xml += `${spaces}<item>\n${toXml(item, indent + 1)}\n${spaces}</item>\n`
        } else {
           xml += `${spaces}<item>${item}</item>\n`
        }
      })
    } else {
        Object.keys(obj).forEach(key => {
            const value = obj[key]
            // Clean key for XML tag name (basic sanitation)
            const keyTag = key.replace(/[^a-zA-Z0-9_]/g, '_')
            
            if (Array.isArray(value)) {
                value.forEach(item => {
                    if (typeof item === 'object') {
                         xml += `${spaces}<${keyTag}>\n${toXml(item, indent + 1)}\n${spaces}</${keyTag}>\n`
                    } else {
                         xml += `${spaces}<${keyTag}>${item}</${keyTag}>\n`
                    }
                })
            } else if (typeof value === 'object' && value !== null) {
                xml += `${spaces}<${keyTag}>\n${toXml(value, indent + 1)}\n${spaces}</${keyTag}>\n`
            } else {
                xml += `${spaces}<${keyTag}>${value}</${keyTag}>\n`
            }
        })
    }
    
    return xml.trimEnd()
  }

  function jsonToXmlAndCopy() {
    error.value = ''
    try {
      const parsed = validateAndParse()
      let xml = '<?xml version="1.0" encoding="UTF-8"?>\n<root>\n'
      xml += toXml(parsed, 1)
      xml += '\n</root>'
      copyText(xml, '转XML并复制成功')
    } catch (e) {
      error.value = (e as Error).message
    }
  }

  function generateInterfaces(obj: any, rootName: string = 'RootObject'): string {
      const interfaces: Record<string, string> = {}
      
      function traverse(currentObj: any, name: string) {
          if (typeof currentObj !== 'object' || currentObj === null) return

          let interfaceBody = `export interface ${name} {\n`
          
          Object.keys(currentObj).forEach(key => {
              const value = currentObj[key]
              const valueType = typeof value
              let typeStr = 'any'
              
              if (value === null) {
                  typeStr = 'any'
              } else if (Array.isArray(value)) {
                   if (value.length > 0 && typeof value[0] === 'object') {
                       const childName = name + capitalize(key) + 'Item'
                       traverse(value[0], childName)
                       typeStr = `${childName}[]`
                   } else if (value.length > 0) {
                       typeStr = `${typeof value[0]}[]`
                   } else {
                       typeStr = 'any[]'
                   }
              } else if (valueType === 'object') {
                  const childName = name + capitalize(key)
                  traverse(value, childName)
                  typeStr = childName
              } else {
                  typeStr = valueType
              }
              
              interfaceBody += `\n  ${key}: ${typeStr};\n`
          })
          
          interfaceBody += '}\n\n'
          interfaces[name] = interfaceBody
      }
      
      function capitalize(s: string) {
          return s.charAt(0).toUpperCase() + s.slice(1)
      }

      if (Array.isArray(obj)) {
        if (obj.length > 0 && typeof obj[0] === 'object') {
            traverse(obj[0], rootName)
        } else {
            // If array of primitives or empty, we can't generate an interface for the "RootObject" 
            // in the same way, but usually tools expect object input or generate interface for items.
            // Return simple type alias if needed, or just empty if strict.
            // But for user experience, let's try to find first object.
            const firstObj = obj.find(i => typeof i === 'object' && i !== null)
            if (firstObj) {
                traverse(firstObj, rootName)
            }
        }
      } else if (typeof obj === 'object') {
          traverse(obj, rootName)
      }
      
      return Object.values(interfaces).reverse().join('')
  }

  function jsonToTsAndCopy() {
    error.value = ''
    try {
      const parsed = validateAndParse()
      const ts = generateInterfaces(parsed)
      if (!ts) {
         // Fallback or message if no interface generated (e.g. empty array or primitive)
         if (Array.isArray(parsed) && parsed.length === 0) {
             copyText('type RootObject = any[];', '转TypeScript并复制成功')
             return
         }
      }
      copyText(ts, '转TypeScript并复制成功')
    } catch (e) {
      error.value = (e as Error).message
    }
  }

  function loadExample() {
    content.value = `{
  "name": "John Doe",
  "age": 30,
  // This is a comment
  "email": "john@example.com",
  "address": {
    "street": "123 Main St",
    "city": "New York",
    "country": "USA"
  },
  "hobbies": [
    "reading",
    "gaming",
    "coding"
  ],
  "isActive": true
}`
    setTimeout(formatJson, 100)
  }

  function clear() {
    content.value = ''
    error.value = ''
  }

  return {
    content,
    error,
    handleMount,
    formatJson,
    removeComments,
    foldAll,
    unfoldAll,
    minifyAndCopy,
    minifyEscapeAndCopy,
    jsonToXmlAndCopy,
    jsonToTsAndCopy,
    loadExample,
    clear
  }
}
