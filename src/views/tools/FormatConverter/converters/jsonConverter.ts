import JSON5 from 'json5'
import type { Converter } from '../types'

export const jsonConverter: Converter = {
  parse(input: string) {
    return JSON5.parse(input)
  },
  
  stringify(data: any, options = { indent: 2 }) {
    return JSON.stringify(data, null, options.indent)
  },
  
  validate(input: string): boolean {
    try {
      JSON5.parse(input)
      return true
    } catch {
      return false
    }
  },
  
  getOptions() {
    return {
      indent: 2
    }
  }
}
