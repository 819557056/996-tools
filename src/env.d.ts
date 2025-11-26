/// <reference types="vite/client" />

declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<{}, {}, any>
  export default component
}

declare module 'fast-gbk' {
  const GBK: {
    encode(str: string): number[];
    decode(bytes: Uint8Array | number[]): string;
  }
  export default GBK;
}

