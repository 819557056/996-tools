declare module '@lapo/asn1js' {
  export class ASN1 {
    static decode(data: Uint8Array | number[], offset?: number): ASN1
    header: number
    length: number
    tag: { tagClass: number; tagNumber: number | bigint; tagConstructed: boolean }
    sub: ASN1[] | null
    def?: { id?: string; name?: string; mismatch?: number }
    typeName(): string
    content(maxLength?: number): string | null
    toPrettyString(indent?: string): string
    posStart(): number
    posLen(): number
    posContent(): number
    posEnd(): number
  }
}
declare module '@lapo/asn1js/base64.js' {
  export class Base64 { static decode(text: string): number[]; static unarmor(text: string): number[] }
}
declare module '@lapo/asn1js/hex.js' {
  export class Hex { static decode(text: string): number[] }
}
declare module '@lapo/asn1js/defs.js' {
  import type { ASN1 } from '@lapo/asn1js'
  export interface Definition { description: string; name: string }
  export class Defs {
    static commonTypes: Definition[]
    static match(node: ASN1, definition: Definition | null): { recognized: number; total: number }
  }
}
