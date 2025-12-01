import ini from 'ini'
import type { Converter } from '../types'

export const iniConverter: Converter = {
  parse(input: string) {
    return ini.parse(input)
  },
  
  stringify(data: any, options = { whitespace: false }) {
    return ini.stringify(data, {
      whitespace: options.whitespace
    })
  },
  
  validate(input: string): boolean {
    try {
      ini.parse(input)
      return true
    } catch {
      return false
    }
  },
  
  getOptions() {
    return {
      whitespace: false
    }
  }
}
