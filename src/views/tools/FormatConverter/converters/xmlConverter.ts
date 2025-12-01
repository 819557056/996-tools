import { XMLParser, XMLBuilder } from 'fast-xml-parser'
import type { Converter } from '../types'

export const xmlConverter: Converter = {
  parse(input: string) {
    const parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: '@_',
      textNodeName: '#text',
      parseAttributeValue: true,
      parseTagValue: true,
      trimValues: true
    })
    return parser.parse(input)
  },
  
  stringify(data: any, options = { format: true, indentBy: '  ' }) {
    const builder = new XMLBuilder({
      ignoreAttributes: false,
      attributeNamePrefix: '@_',
      textNodeName: '#text',
      format: options.format,
      indentBy: options.indentBy,
      suppressEmptyNode: true
    })
    
    // 添加 XML 声明
    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n'
    xml += builder.build(data)
    return xml
  },
  
  validate(input: string): boolean {
    try {
      const parser = new XMLParser()
      parser.parse(input)
      return true
    } catch {
      return false
    }
  },
  
  getOptions() {
    return {
      format: true,
      indentBy: '  '
    }
  }
}
