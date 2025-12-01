import yaml from 'js-yaml'
import type { Converter } from '../types'

export const yamlConverter: Converter = {
  parse(input: string) {
    return yaml.load(input)
  },
  
  stringify(data: any, options = { indent: 2, lineWidth: 120 }) {
    return yaml.dump(data, {
      indent: options.indent,
      lineWidth: options.lineWidth,
      noRefs: true,
      sortKeys: false
    })
  },
  
  validate(input: string): boolean {
    try {
      yaml.load(input)
      return true
    } catch {
      return false
    }
  },
  
  getOptions() {
    return {
      indent: 2,
      lineWidth: 120
    }
  }
}
