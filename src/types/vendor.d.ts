declare module 'ini' {
  export function parse(text: string): Record<string, unknown>
  export function stringify(value: object, options?: { section?: string; whitespace?: boolean }): string
}
declare module 'jmespath' {
  export function search(data: unknown, expression: string): unknown
}
