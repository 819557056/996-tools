export const localPkiTools = [
  { key: 'csrCreate', mode: 'csr-create', title: 'CSR 制作', en: 'Create CSR', description: '本地生成密钥和 PKCS#10 证书申请', enDescription: 'Generate keys and PKCS#10 certificate requests locally', icon: 'FileSignature' },
  { key: 'csrParse', mode: 'csr-parse', title: 'CSR 解析', en: 'Inspect CSR', description: '解析申请主体、公钥、扩展并验证申请签名', enDescription: 'Inspect subjects, keys, extensions and CSR signatures', icon: 'Search' },
  { key: 'pkcs12Create', mode: 'pkcs12-create', title: 'PFX / PKCS#12', en: 'PFX / PKCS#12', description: '将私钥和证书链封装为带口令的 PFX / P12 文件', enDescription: 'Package a key and certificate chain in a password-protected PFX / P12', icon: 'Lock' },
  { key: 'selfSignedCertificate', mode: 'self-signed-certificate', title: '自签证书', en: 'Self-signed certificate', description: '在浏览器生成 RSA、ECDSA 或 SM2 自签证书', enDescription: 'Create RSA, ECDSA or SM2 self-signed certificates in the browser', icon: 'Shield' },
  { key: 'certificateChain', mode: 'certificate-chain', title: '证书链验证', en: 'Certificate chain validation', description: '离线检查签名、有效期、CA 约束及指定信任根', enDescription: 'Check signatures, validity, CA constraints and explicit trust anchors offline', icon: 'Network' },
  { key: 'certificateVerify', mode: 'certificate-verify', title: '证书验签', en: 'Certificate signature verification', description: '验证证书签名，或使用证书公钥验证数据签名', enDescription: 'Verify certificate signatures or data signatures using certificate keys', icon: 'FileSignature' },
  { key: 'certificateEncrypt', mode: 'certificate-encrypt', title: '证书加密', en: 'Certificate encryption', description: '使用 RSA / SM2 证书公钥加密，使用对应私钥解密', enDescription: 'Encrypt using RSA / SM2 certificate keys and decrypt using private keys', icon: 'Lock' },
  { key: 'certificateEnvelope', mode: 'certificate-envelope', title: '证书数字信封', en: 'Certificate digital envelope', description: '使用接收者证书制作和解开 CMS 数字信封', enDescription: 'Create and open CMS digital envelopes with recipient certificates', icon: 'Shield' },
] as const
export type PkiMode = typeof localPkiTools[number]['mode']
