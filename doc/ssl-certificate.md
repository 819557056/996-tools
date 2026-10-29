# SSL 证书生成

本功能属于 **996-tools**，入口为「公钥基础设施 → SSL 证书生成」，路由为 `/tools/ssl-certificate`。首页、侧栏和搜索使用同一工具目录。

## 纯前端架构

静态页面即可运行。浏览器使用 Web Crypto、PKI.js / ASN1.js 和 sm-crypto 生成密钥及 X.509 证书，Web Worker 执行签发与验证，JSZip 在本地打包下载。没有业务后端、签发 API 或远程密钥服务。

- 页面：`src/views/tools/SslCertificate/`
- 配置与校验：`src/utils/ssl/config.ts`
- 密钥和证书实现：`src/utils/ssl/generator.ts`
- 线程：`src/workers/ssl-certificate.worker.ts`
- 线程生命周期：`src/composables/useCertificateGenerator.ts`
- 下载：`src/utils/ssl/download.ts`

密钥与结果只保存在当前页面内存中；不写入 localStorage、IndexedDB 或日志，不发送到服务器。取消生成会终止 Worker；刷新、离开页面或返回调整会清除结果。浏览器必须支持 Web Crypto 和 Web Worker，并通过 HTTPS 或 localhost 访问。

## 使用流程

1. 选择本地开发、内网服务或自定义地址，选择根 CA 算法。
2. 填写域名 / IP、其他访问地址（SAN）和有效期；选择自动生成或导入已有密钥对。
3. 按需展开高级选项，设置 DN、站点算法、根 CA 有效期、生效日期及客户端认证用途。
4. 确认配置，生成后下载站点部署包及单独的根 CA 文件。

页面提供实时预览、字段提示、签发进度、取消与重试，以及部署说明。

## 根 CA 预设

| 算法 | 根证书 DN | 签名算法 |
| --- | --- | --- |
| RSA 2048 | `CN=RSA2048-Test-CA,ou=test,ou=xcf,c=cn` | SHA256withRSA |
| RSA 4096 | `CN=RSA4096-Test-CA,ou=test,ou=xcf,c=cn` | SHA256withRSA |
| SM2 | `CN=SM2-Test-CA,ou=test,ou=xcf,c=cn` | SM3withSM2 |

两个 OU 编码为独立、有序的 RDN，不会合并或覆盖。根证书默认有效 3650 天，可调整至 1–10950 天，必须覆盖站点有效期。每次生成创建新的根 CA。

RSA 根预设支持 RSA 2048 / 3072 / 4096、ECDSA P-256 / P-384 站点密钥；SM2 预设使用 SM2 站点密钥。站点证书默认有效 365 天，可设置 1–3650 天。SAN 支持 DNS、通配符、IPv4 和 IPv6。

## 导入与验证

使用已有密钥时，必须同时选择或粘贴私钥和公钥：

- 私钥：未加密 PEM，PKCS#8、RSA PKCS#1 或 EC SEC1。
- 公钥：PEM，SPKI 或 RSA PKCS#1。
- 每份文件最大 256 KB；加密私钥、非配套密钥、不支持的曲线或 RSA 参数会显示明确错误。
- 签发前检查算法、参数及公钥，并通过随机挑战签名验签确认配对。

证书包含 BasicConstraints、KeyUsage、SKI / AKI，以及站点 SAN、serverAuth（可选 clientAuth）。生成后重新解析并验证根自签名、站点签名、公私钥、身份与扩展。SM2 的私钥和签名随机数使用 `crypto.getRandomValues`，不依赖库中的旧随机数生成器。

## 下载

站点 ZIP 含 `server.crt`、`server.der`、`server.pub`、自动生成时的 `server.key` 和 `README.txt`。导入密钥时继续使用原私钥。根证书和根私钥单独下载，避免将根私钥一起部署到站点。

私钥导出为未加密 PKCS#8 PEM。根 CA 需由用户在测试设备上手动信任；页面不会修改设备的信任库。SM2 面向支持国密的客户端，输出单张签名证书，不包含 TLCP 双证书配置。

## 验证

```sh
pnpm exec vue-tsc --noEmit
pnpm test:ssl
pnpm build
pnpm test:ssl:bundle
```

`test:ssl` 覆盖三种根 CA、RSA / ECDSA / SM2 密钥、导入格式与错误配对、精确 DN / SAN / 扩展、有效期及 2050 年后的日期编码。RSA / ECDSA 证书通过 Node TLS 客户端验证握手；测试中临时启动的本机 HTTPS 服务仅用于检查证书互通性，不属于应用或构建产物。

`test:ssl:bundle` 检查实际生产 Worker 能在没有 `window`、Node `require` / `module` 的环境中启动。浏览器验收已覆盖生产构建的 SM2、RSA4096 签发与密钥导入，以及 RSA 下载包中的证书、密钥和 DER 内容匹配。
