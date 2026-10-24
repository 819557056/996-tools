# 本地 PKI 工具使用与验收

更新日期：2026-10-23。常用 PKI 从工作台提取为“公钥基础设施”下的独立入口，在浏览器 Worker 内执行，不上传密钥、证书或原文，不依赖 Java；现新增离线 OCSP/CRL。**本次不实现 TLS / SSL 调试。** PDF 使用纯前端验签；OFD 签章验签、OFD 签章诊断、电子印章制作及 Java 接入已移除，当前全站运行不依赖 Java。

## 功能入口

| 入口 | 功能与范围 |
| --- | --- |
| `/tools/csr-create` | CSR 制作。新建或导入密钥；填写 CN、O、C、SAN、CA 属性；生成带签名的 PKCS#10，并导出密钥 |
| `/tools/csr-parse` | CSR 解析。展示主体、公钥算法、申请扩展、签名算法，验证 CSR 签名 |
| `/tools/pkcs12-create` | 创建 PFX / PKCS#12。检查私钥与证书匹配、排序并验证所附链的连接签名；设置别名和口令，下载同一容器的 `.p12` 或 `.pfx` 文件 |
| `/tools/self-signed-certificate` | 自签证书。使用新密钥或已有密钥生成 X.509；设置有效期、SAN、CA 属性及对应 KeyUsage |
| `/tools/certificate-chain` | 离线证书链验证。输入叶子、中间证书和明确受信任的根；检查逐级签名、有效期、CA、keyCertSign、路径长度及显式信任锚 |
| `/tools/certificate-verify` | 证书验签。验证证书自身签名，或使用证书公钥验证原文/文件的签名 |
| `/tools/certificate-encrypt` | 使用证书公钥加密数据，使用对应私钥解密；RSA-OAEP/SHA-256 和 SM2 ASN.1 DER 密文 |
| `/tools/certificate-envelope` | 单接收者 CMS 数字信封制作和解封；证书 issuer/serial 标识接收者，解封前检查证书与私钥匹配 |
| `/tools/offline-revocation` | OCSP 请求生成/解析、按请求签发离线测试响应、响应签名及绑定校验、CRL 解析/验签/目标序号查询 |

首页、侧栏、搜索和中英文词条均已登记。旧 `/tools/pki-workbench` 地址重定向到 CSR 制作；旧工作台收藏映射到 CSR 制作。原 Java PKI 工作台代码、共享服务接入、Java PDF 和独立 KeyStore API 已删除。

KeyStore / TrustStore 独立入口和公开 API 已移除，PFX/PKCS#12 创建继续提供。PDF 本地验签入口为 `/tools/pdf-verify`，位于“电子签章”分类；当前全站共 36 个工具，零 Java 运行依赖。已移除三个功能的后续技术判断见[OFD 与电子印章纯前端可行性](OFD与电子印章纯前端可行性.md)，本轮不重写。

## 离线 OCSP / CRL

- OCSP 请求：输入目标证书与 CA 证书，验证签发关系后生成 CertID；支持 SHA-256/SHA-1，默认生成随机 32 字节 nonce。解析支持最多 64 个不重复 CertID；带签名请求仅标明存在签名，当前不验证请求签名。
- 测试响应：导入请求、签发者或授权响应者证书及匹配私钥，设置 `good` / `revoked` / `unknown`、thisUpdate、可选 nextUpdate、吊销时间和原因。状态应用于请求全部 CertID，CertID 与 nonce 保留绑定；委托响应者须由该 CA 直接签发并具有 OCSP Signing EKU。
- 离线响应校验：验证签名、响应者授权、CertID/nonce 绑定和时间，可另外核对目标证书。支持 SM2/RSA/ECDSA 和加密 PKCS#8；OCSP/CRL 签名 userId 与证书签名 userId 分开设置。
- CRL：支持完整直接 CRL 的本地解析、签发者/签名/时间校验及目标序号查询；本轮不生成 CRL。增量、间接及限定范围 CRL 明确拒绝。
- 不连接 OCSP、CRL 或 AIA 服务，不读取系统信任库。**生成响应是用户指定状态的离线测试材料，不代表真实在线吊销状态；未列入导入 CRL 也不代表实时未吊销。**
- 请求/响应支持 DER、Hex/Base64、头尾、换行及 LF/CRLF；标准文本头为 `OCSP REQUEST`、`OCSP RESPONSE`，CRL 输入支持 `X509 CRL`。

PDF 只在本地解析和提取证书，不自动判断根信任，不要求或检查吊销证据、TSA 信任锚及长期有效性。完整支持范围见[PDF 本地验签与离线 OCSP/CRL](PDF验签前端迁移评估.md)。

## 算法与格式

- 密钥/CSR/自签证书：SM2/SM3、RSA/SHA-256、ECDSA/SHA-256。RSA 新建支持 2048/3072/4096 位；ECDSA 新建使用 P-256，导入支持 P-256/P-384/P-521。
- 私钥输入：PKCS#8、RSA PKCS#1、带命名曲线的 EC SEC1，SM2 还支持 32 字节裸私钥。接受 PEM、Hex、Base64 及二进制 DER 文件；SEC1 转为 PEM 使用 `EC PRIVATE KEY`，裸 SM2 私钥先转换成真实 PKCS#8。
- 加密 PKCS#8 支持 PBES2 + PBKDF2 + AES-CBC（128/192/256 位），PBKDF2 摘要支持 SHA-1/256/384/512，迭代次数最多 1000 万。不支持旧式带 `Proc-Type` / `DEK-Info` 的加密 PEM、其他 PBE 算法或显式 EC 曲线参数；口令错误、损坏材料及不支持的参数均返回错误。
- SM2 签名默认 userId 为 `1234567812345678`；CSR、证书生成、验证及 PFX 创建页提供修改入口，验证所附链时需与签发端一致。
- 原文签名验证：SM2/SM3（DER 或 64 字节 r||s）、RSA PKCS#1 v1.5/SHA-256、RSA-PSS/SHA-256（salt=32）、ECDSA/SHA-256（DER）。CMS/P7 签名继续使用已有签名工具。
- PFX 私钥保护：PBES2、PBKDF2/HMAC-SHA-256（100000 次）、AES-256-CBC；容器完整性使用 PKCS#12 KDF、SHA-256 MAC（10000 次），支持中文口令及 BMP 字符别名。
- RSA 信封：CMS EnvelopedData，RSA-OAEP/SHA-256 + AES-256-CBC。SM2 信封：CMS EnvelopedData，SM2 加密 OID `1.2.156.10197.1.301.3`、ASN.1 DER 加密密钥、SM4-CBC OID `1.2.156.10197.1.104.2`。
- 信封不是发送者签名。CBC 信封本身不提供认证完整性，解密成功不能作为签名或防篡改验证成功。SM2 信封与特定国密产品的封装兼容性需使用该产品样本另验，不宣称覆盖所有 GM/T 信封变体。
- 输出复用 Hex/Base64、有头/无头、32/64/76 字符换行、LF/CRLF；独立提供原始 DER/P12/PFX/密文二进制下载。`.pfx` 与 `.p12` 为同一容器格式的两个扩展名。
- 输入支持粘贴及文件导入。每份 Base64、Hex 或 DER 证书文件先单独转为 PEM，再组成证书包，支持混合格式多选。文本自动识别时纯十六进制字符优先视为 Hex；有歧义时选择格式并点击“按所选格式转为 PEM”。签名/密文二进制导入不按文本猜测，文本编码请使用输入框。

## 页面操作

- 导入加密私钥时填写“私钥口令（加密 PKCS#8）”。创建 PFX 时另填“保护口令”，用于保护新生成的容器，二者可以不同。导入私钥后，CSR/自签证书页按实际密钥识别算法。
- CSR 解析展示申请主体、签名算法、基本约束、密钥用途及可读 DNS/IP SAN；证书验签展示有效期与检查范围，证书链页面展示验证路径或失败原因。原始 JSON 保留在折叠面板中。
- 编辑输入会清除旧结果。清空、切换操作或离开页面时，尚未完成的文件读取不能回写旧材料；取消/清空会终止正在执行的 Worker。

## 本轮兼容性修复

- CSR 和 X.509 多字段主体改为每项单独的 RDN，并保留编码后的 ASN.1 字节。此前 PKI.js 将多个属性放入一个未排序 SET，本地自验能通过，但 BouncyCastle 按 DER 重编码后验签失败；现在规范 DER、第三方验签及 PFX 内证书字节一致性检查均通过。此前由旧实现生成且包含多个主体字段的 CSR/证书应重新生成；修改已签名材料的编码不能替代重新签名。
- 补齐加密 PKCS#8 和 SEC1 导入，检查曲线、公私钥匹配及容器结构；修复多份 Base64/Hex 证书直接拼接造成的解析错误。
- 原文与封装材料使用独立大小上限，避免 20 MiB 原文加上信封头、填充后无法解封；PFX 附带链验证使用页面指定的 SM2 userId。

## 使用边界

- Web Crypto 需要 HTTPS 或 localhost；私钥与结果仅保存在页面内存，不写 localStorage。离开页面、取消或清空会终止当前 Worker。
- 原文最多 20 MiB（20 × 1024² 字节），密文、信封及签名的二进制材料最多 21 MiB；页面 MB 提示按此二进制计量。证书导入每次最多 16 个，单个最多 20 MiB。大文件使用信封；2048 位 RSA-OAEP/SHA-256 单次只能加密 190 字节。
- ECDSA 证书不能直接用于本工具的加密或密钥传输信封。加密时检查证书有效期和 keyEncipherment 用途。
- 证书链验证只针对用户明确选择的信任根，不读取系统信任库，不自动获取 AIA 中间证书，不做 OCSP/CRL 或主机名验证。证书策略、名称约束等当前未实现的约束会明确失败，不忽略后显示成功。
- 自签证书不会自动获得系统信任。单证书验签只证明相应签名是否正确，结果中的有效期、信任、吊销信息分开显示。
- SAN 支持 ASCII DNS（国际域名使用 Punycode）、IPv4 和电子邮件；IPv6 SAN 暂未提供。

## 验证

```sh
pnpm test:pki
pnpm test:pki:interop
pnpm test:revocation
pnpm test:crypto
pnpm build
```

`test:pki` 包含 38 项本地算法、错误材料、篡改、错根、非 CA 签发者、有效期、PFX 完整性、加密私钥、SEC1、20 MiB 信封往返及越界拒绝测试。设置 `PKI_OPENSSL` 为 OpenSSL 可执行文件可启用其中 5 项外部互操作测试；未设置时明确跳过。

`test:pki:interop` 包含 5 组独立 SM2 互通测试。设置 `PKI_JAVA` 为 Java 17+ 可执行文件、`PKI_BC_CLASSPATH` 为 bcprov/bcpkix/bcutil 三个 JAR 的路径列表（Windows 使用分号，其他平台按系统 classpath 分隔符）。本次使用 BouncyCastle 1.84；配置缺失时明确跳过，配置无效则失败。Java 仅作为测试基准，应用运行仍然只使用浏览器。

浏览器验证使用现有 Playwright 和浏览器：启动 `pnpm dev`，设置 `PKI_UI_URL` 为前端 URL，然后执行 `pnpm test:pki:browser`。可通过 `PLAYWRIGHT_MODULE` 指定已安装的 Playwright 模块，通过 `PLAYWRIGHT_CHANNEL` 选择浏览器（默认 msedge）。无需启动 Java。

以下是既有 8 个本地 PKI 工具的验收记录；新增离线 OCSP/CRL 的 9 组测试已通过，含 OpenSSL RSA/ECDSA 响应校验及 BC 三算法响应/CRL 双向验证。最新整合构建和浏览器结果以[PDF 本地验签与离线 OCSP/CRL](PDF验签前端迁移评估.md)的最终验收为准。

| 检查 | 结果与范围 |
| --- | --- |
| PKI 算法与导入 | 38 项通过，0 跳过；包括真实 20 MiB 原文信封加解密并对比摘要 |
| OpenSSL 1.1.1u | 三种算法 PFX 的 MAC、私钥解密导出；RSA CMS 解封；PBES2 多种 AES 位长及摘要组合导入 |
| Node 原生密码实现 | RSA/ECDSA CSR 和证书签名独立验证；RSA、EC、SM2 私钥独立生成后导入 |
| BouncyCastle 1.84 | 5 组通过，0 跳过；SM2 CSR/证书双向验签、默认/中文 userId、DER 密文双向加解密、当前单接收者 SM2/SM4-CBC CMS 双向互通、PFX 读取与 MAC 校验，并覆盖错误材料/篡改拒绝 |
| 既有密码工具 | 12 项回归通过 |
| 浏览器 | 开发与生产预览覆盖 8 个入口及核心流程、加密私钥和 SEC1 导入、多文件混合编码、延迟读取后清空/切换、CSR/SAN 可读结果、中英文及移动端布局；后端 API 请求为零 |
| 构建 | TypeScript 检查及 Vite 生产构建通过 |

CMS 互通验证针对本工具使用的单接收者结构和密码运算，不代表全部国密厂商格式或 GM/T 变体。独立测试文件为 `tests/pki-key-import.test.mjs`、`tests/pki-sm2-interop.test.mjs` 与 `tests/helpers/PkiSm2Interop.java`；测试生成的合成密钥在结束时清理。

实现文件：`src/utils/pki/`（算法与操作）、`src/workers/pki.worker.ts`（隔离计算）、`src/views/tools/PkiTools/index.vue`（独立路由共用页面）、`src/lib/local-pki-tools.ts`（工具定义）。离线吊销使用 `src/utils/pki/revocation.ts`、`src/workers/revocation.worker.ts`、`src/views/tools/OfflineRevocation/index.vue` 和 `tests/offline-revocation.test.mjs`。没有新增运行依赖。
