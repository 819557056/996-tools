import TOML from '@iarna/toml'
import type { Converter } from '../types'

export const tomlConverter: Converter = {
  parse(input: string) {
    return TOML.parse(input)
  },
  
  stringify(data: any) {
    return TOML.stringify(data)
  },
  
  validate(input: string): boolean {
    try {
      TOML.parse(input)
      return true
    } catch {
      return false
    }
  }
}
