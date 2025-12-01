import { ref, shallowRef } from 'vue'
import { useToast } from '@/composables/useToast'
import JSON5 from 'json5'

export type TargetLanguage = 'typescript' | 'go' | 'java' | 'protobuf' | 'rust' | 'python'

export function useCodeGenerator() {
  const { toast } = useToast()

  const inputJson = ref('')
  const outputCode = ref('')
  const error = ref('')
  const selectedLanguage = ref<TargetLanguage>('typescript')
  const rootTypeName = ref('RootObject')
  const editorRef = shallowRef<any>(null)

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
      throw new Error(msg)
    }
  }

  function capitalize(s: string): string {
    return s.charAt(0).toUpperCase() + s.slice(1)
  }

  function toPascalCase(s: string): string {
    return s
      .replace(/[-_\s]+(.)?/g, (_, c) => (c ? c.toUpperCase() : ''))
      .replace(/^(.)/, (c) => c.toUpperCase())
  }

  function toCamelCase(s: string): string {
    const pascal = toPascalCase(s)
    return pascal.charAt(0).toLowerCase() + pascal.slice(1)
  }

  function toSnakeCase(s: string): string {
    return s
      .replace(/([A-Z])/g, '_$1')
      .toLowerCase()
      .replace(/^_/, '')
  }

  // TypeScript Interface 生成
  function generateTypeScript(obj: any, rootName: string = 'RootObject'): string {
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

        interfaceBody += `  ${key}: ${typeStr};\n`
      })

      interfaceBody += '}\n\n'
      interfaces[name] = interfaceBody
    }

    if (Array.isArray(obj)) {
      if (obj.length > 0 && typeof obj[0] === 'object') {
        traverse(obj[0], rootName)
        return Object.values(interfaces).reverse().join('') + `export type ${rootName}Array = ${rootName}[];\n`
      }
    } else if (typeof obj === 'object') {
      traverse(obj, rootName)
    }

    return Object.values(interfaces).reverse().join('')
  }

  // Go Struct 生成
  function generateGo(obj: any, rootName: string = 'RootObject'): string {
    const structs: Record<string, string> = {}

    function getGoType(value: any, key: string, parentName: string): string {
      if (value === null) return 'interface{}'
      
      if (Array.isArray(value)) {
        if (value.length > 0 && typeof value[0] === 'object') {
          const childName = parentName + capitalize(key) + 'Item'
          traverse(value[0], childName)
          return `[]${childName}`
        } else if (value.length > 0) {
          const goType = typeof value[0] === 'string' ? 'string' : 
                        typeof value[0] === 'number' ? 'float64' :
                        typeof value[0] === 'boolean' ? 'bool' : 'interface{}'
          return `[]${goType}`
        }
        return '[]interface{}'
      }
      
      if (typeof value === 'object') {
        const childName = parentName + capitalize(key)
        traverse(value, childName)
        return childName
      }
      
      switch (typeof value) {
        case 'string': return 'string'
        case 'number': return Number.isInteger(value) ? 'int' : 'float64'
        case 'boolean': return 'bool'
        default: return 'interface{}'
      }
    }

    function traverse(currentObj: any, name: string) {
      if (typeof currentObj !== 'object' || currentObj === null) return

      let structBody = `type ${name} struct {\n`

      Object.keys(currentObj).forEach(key => {
        const value = currentObj[key]
        const goType = getGoType(value, key, name)
        const fieldName = capitalize(key)
        structBody += `\t${fieldName} ${goType} \`json:"${key}"\`\n`
      })

      structBody += '}\n\n'
      structs[name] = structBody
    }

    if (Array.isArray(obj)) {
      if (obj.length > 0 && typeof obj[0] === 'object') {
        traverse(obj[0], rootName)
        return Object.values(structs).reverse().join('')
      }
    } else if (typeof obj === 'object') {
      traverse(obj, rootName)
    }

    return Object.values(structs).reverse().join('')
  }

  // Java Class 生成
  function generateJava(obj: any, rootName: string = 'RootObject'): string {
    const classes: Record<string, string> = {}

    function getJavaType(value: any, key: string, parentName: string): string {
      if (value === null) return 'Object'
      
      if (Array.isArray(value)) {
        if (value.length > 0 && typeof value[0] === 'object') {
          const childName = parentName + capitalize(key) + 'Item'
          traverse(value[0], childName)
          return `List<${childName}>`
        } else if (value.length > 0) {
          const javaType = typeof value[0] === 'string' ? 'String' : 
                          typeof value[0] === 'number' ? 'Double' :
                          typeof value[0] === 'boolean' ? 'Boolean' : 'Object'
          return `List<${javaType}>`
        }
        return 'List<Object>'
      }
      
      if (typeof value === 'object') {
        const childName = parentName + capitalize(key)
        traverse(value, childName)
        return childName
      }
      
      switch (typeof value) {
        case 'string': return 'String'
        case 'number': return Number.isInteger(value) ? 'Integer' : 'Double'
        case 'boolean': return 'Boolean'
        default: return 'Object'
      }
    }

    function traverse(currentObj: any, name: string) {
      if (typeof currentObj !== 'object' || currentObj === null) return

      let classBody = `public class ${name} {\n`

      Object.keys(currentObj).forEach(key => {
        const value = currentObj[key]
        const javaType = getJavaType(value, key, name)
        const fieldName = toCamelCase(key)
        classBody += `    private ${javaType} ${fieldName};\n`
      })

      classBody += '\n'

      // Getters and Setters
      Object.keys(currentObj).forEach(key => {
        const value = currentObj[key]
        const javaType = getJavaType(value, key, name)
        const fieldName = toCamelCase(key)
        const methodName = capitalize(fieldName)
        
        classBody += `    public ${javaType} get${methodName}() {\n`
        classBody += `        return ${fieldName};\n`
        classBody += `    }\n\n`
        
        classBody += `    public void set${methodName}(${javaType} ${fieldName}) {\n`
        classBody += `        this.${fieldName} = ${fieldName};\n`
        classBody += `    }\n\n`
      })

      classBody += '}\n\n'
      classes[name] = classBody
    }

    if (Array.isArray(obj)) {
      if (obj.length > 0 && typeof obj[0] === 'object') {
        traverse(obj[0], rootName)
      }
    } else if (typeof obj === 'object') {
      traverse(obj, rootName)
    }

    return Object.values(classes).reverse().join('')
  }

  // Protobuf 生成
  function generateProtobuf(obj: any, rootName: string = 'RootObject'): string {
    const messages: Record<string, string> = {}
    let messageCounter = 0

    function getProtoType(value: any, key: string, parentName: string): string {
      if (value === null) return 'string'
      
      if (Array.isArray(value)) {
        if (value.length > 0 && typeof value[0] === 'object') {
          const childName = parentName + capitalize(key) + 'Item'
          traverse(value[0], childName)
          return `repeated ${childName}`
        } else if (value.length > 0) {
          const protoType = typeof value[0] === 'string' ? 'string' : 
                           typeof value[0] === 'number' ? 'double' :
                           typeof value[0] === 'boolean' ? 'bool' : 'string'
          return `repeated ${protoType}`
        }
        return 'repeated string'
      }
      
      if (typeof value === 'object') {
        const childName = parentName + capitalize(key)
        traverse(value, childName)
        return childName
      }
      
      switch (typeof value) {
        case 'string': return 'string'
        case 'number': return Number.isInteger(value) ? 'int32' : 'double'
        case 'boolean': return 'bool'
        default: return 'string'
      }
    }

    function traverse(currentObj: any, name: string) {
      if (typeof currentObj !== 'object' || currentObj === null) return

      let messageBody = `message ${name} {\n`
      let fieldNumber = 1

      Object.keys(currentObj).forEach(key => {
        const value = currentObj[key]
        const protoType = getProtoType(value, key, name)
        const fieldName = toSnakeCase(key)
        
        if (protoType.startsWith('repeated')) {
          messageBody += `    ${protoType} ${fieldName} = ${fieldNumber};\n`
        } else {
          messageBody += `    ${protoType} ${fieldName} = ${fieldNumber};\n`
        }
        fieldNumber++
      })

      messageBody += '}\n\n'
      messages[name] = messageBody
    }

    let result = 'syntax = "proto3";\n\n'
    
    if (Array.isArray(obj)) {
      if (obj.length > 0 && typeof obj[0] === 'object') {
        traverse(obj[0], rootName)
      }
    } else if (typeof obj === 'object') {
      traverse(obj, rootName)
    }

    result += Object.values(messages).reverse().join('')
    return result
  }

  // Rust Struct 生成
  function generateRust(obj: any, rootName: string = 'RootObject'): string {
    const structs: Record<string, string> = {}

    function getRustType(value: any, key: string, parentName: string): string {
      if (value === null) return 'Option<String>'
      
      if (Array.isArray(value)) {
        if (value.length > 0 && typeof value[0] === 'object') {
          const childName = parentName + capitalize(key) + 'Item'
          traverse(value[0], childName)
          return `Vec<${childName}>`
        } else if (value.length > 0) {
          const rustType = typeof value[0] === 'string' ? 'String' : 
                          typeof value[0] === 'number' ? 'f64' :
                          typeof value[0] === 'boolean' ? 'bool' : 'String'
          return `Vec<${rustType}>`
        }
        return 'Vec<String>'
      }
      
      if (typeof value === 'object') {
        const childName = parentName + capitalize(key)
        traverse(value, childName)
        return childName
      }
      
      switch (typeof value) {
        case 'string': return 'String'
        case 'number': return Number.isInteger(value) ? 'i64' : 'f64'
        case 'boolean': return 'bool'
        default: return 'String'
      }
    }

    function traverse(currentObj: any, name: string) {
      if (typeof currentObj !== 'object' || currentObj === null) return

      let structBody = `#[derive(Debug, Clone, Serialize, Deserialize)]\n`
      structBody += `pub struct ${name} {\n`

      Object.keys(currentObj).forEach(key => {
        const value = currentObj[key]
        const rustType = getRustType(value, key, name)
        const fieldName = toSnakeCase(key)
        structBody += `    pub ${fieldName}: ${rustType},\n`
      })

      structBody += '}\n\n'
      structs[name] = structBody
    }

    if (Array.isArray(obj)) {
      if (obj.length > 0 && typeof obj[0] === 'object') {
        traverse(obj[0], rootName)
      }
    } else if (typeof obj === 'object') {
      traverse(obj, rootName)
    }

    return Object.values(structs).reverse().join('')
  }

  // Python Dataclass 生成
  function generatePython(obj: any, rootName: string = 'RootObject'): string {
    const classes: Record<string, string> = {}

    function getPythonType(value: any, key: string, parentName: string): string {
      if (value === null) return 'Any'
      
      if (Array.isArray(value)) {
        if (value.length > 0 && typeof value[0] === 'object') {
          const childName = parentName + capitalize(key) + 'Item'
          traverse(value[0], childName)
          return `List[${childName}]`
        } else if (value.length > 0) {
          const pyType = typeof value[0] === 'string' ? 'str' : 
                        typeof value[0] === 'number' ? 'float' :
                        typeof value[0] === 'boolean' ? 'bool' : 'Any'
          return `List[${pyType}]`
        }
        return 'List[Any]'
      }
      
      if (typeof value === 'object') {
        const childName = parentName + capitalize(key)
        traverse(value, childName)
        return childName
      }
      
      switch (typeof value) {
        case 'string': return 'str'
        case 'number': return Number.isInteger(value) ? 'int' : 'float'
        case 'boolean': return 'bool'
        default: return 'Any'
      }
    }

    function traverse(currentObj: any, name: string) {
      if (typeof currentObj !== 'object' || currentObj === null) return

      let classBody = `@dataclass\n`
      classBody += `class ${name}:\n`

      Object.keys(currentObj).forEach(key => {
        const value = currentObj[key]
        const pyType = getPythonType(value, key, name)
        const fieldName = toSnakeCase(key)
        classBody += `    ${fieldName}: ${pyType}\n`
      })

      classBody += '\n'
      classes[name] = classBody
    }

    let result = 'from dataclasses import dataclass\nfrom typing import List, Any\n\n'
    
    if (Array.isArray(obj)) {
      if (obj.length > 0 && typeof obj[0] === 'object') {
        traverse(obj[0], rootName)
      }
    } else if (typeof obj === 'object') {
      traverse(obj, rootName)
    }

    result += Object.values(classes).reverse().join('')
    return result
  }

  function generate() {
    error.value = ''
    try {
      const parsed = validateAndParse()
      const typeName = rootTypeName.value || 'RootObject'

      switch (selectedLanguage.value) {
        case 'typescript':
          outputCode.value = generateTypeScript(parsed, typeName)
          break
        case 'go':
          outputCode.value = generateGo(parsed, typeName)
          break
        case 'java':
          outputCode.value = generateJava(parsed, typeName)
          break
        case 'protobuf':
          outputCode.value = generateProtobuf(parsed, typeName)
          break
        case 'rust':
          outputCode.value = generateRust(parsed, typeName)
          break
        case 'python':
          outputCode.value = generatePython(parsed, typeName)
          break
      }
    } catch (e) {
      error.value = (e as Error).message
    }
  }

  async function copyOutput() {
    if (!outputCode.value) {
      toast({ title: '没有可复制的内容', variant: 'destructive', duration: 2000 })
      return
    }
    try {
      await navigator.clipboard.writeText(outputCode.value)
      toast({ title: '复制成功', variant: 'success', duration: 2000 })
    } catch (err) {
      toast({ title: '复制失败', variant: 'destructive', duration: 2000 })
    }
  }

  function loadExample() {
    inputJson.value = `{
  "id": 1,
  "name": "John Doe",
  "email": "john@example.com",
  "age": 30,
  "isActive": true,
  "roles": ["admin", "user"],
  "profile": {
    "avatar": "https://example.com/avatar.jpg",
    "bio": "Software Engineer"
  },
  "posts": [
    {
      "id": 1,
      "title": "Hello World",
      "views": 100
    }
  ]
}`
    setTimeout(generate, 100)
  }

  function clear() {
    inputJson.value = ''
    outputCode.value = ''
    error.value = ''
  }

  return {
    inputJson,
    outputCode,
    error,
    selectedLanguage,
    rootTypeName,
    handleMount,
    generate,
    copyOutput,
    loadExample,
    clear
  }
}

