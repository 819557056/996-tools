// sm-crypto 0.3.13 exports this API; @types/sm-crypto 0.3.4 omits it.
import 'sm-crypto'
declare module 'sm-crypto' {
  namespace sm2 {
    function getPublicKeyFromPrivateKey(privateKey: string): string
  }
}
