# PDF 本地验签与离线 OCSP / CRL

更新日期：2026-10-23。本文件记录最终实施范围，替代此前 PDF 迁移建议。

## 最终范围

- PDF 验签在浏览器 Worker 完成，文件、证书、公钥不上传，不请求 OCSP、CRL、AIA 或其他服务。
- 证书只在本地解析并展示主体、签发者、序号、算法、当前有效期和 SHA-256 指纹。签名数学结果与证书有效期分开，不自动判断根信任，不检查 TSA 信任锚、吊销证据或长期有效性。
- 新增离线 OCSP/CRL 工具：生成请求，根据请求及用户提供的响应者证书、私钥签发响应，校验已提供的响应和 CRL；全程不连接其他服务。
- 原 PDF 签章、预览、批量、Java 验签及诊断已删除；随后 OFD 签章验签、OFD 签章诊断、电子印章制作及剩余 Java 接入也已移除。当前保留 36 个工具，零 Java 运行依赖；本轮不重写这三个功能，不实现 TLS/SSL 调试。

## 入口

| 入口 | 功能 | 执行位置 |
| --- | --- | --- |
| `/tools/pdf-verify` | 签名列表、数学验签、摘要和覆盖范围、证书提取、JSON 报告 | 浏览器 Worker |
| `/tools/offline-revocation` | OCSP 请求生成/解析、响应签发/校验、CRL 解析/校验/查询 | 浏览器 Worker |
| `/tools/certificate-chain` | 用户提供根、中间及叶子证书的独立离线链验证 | 浏览器 Worker |

旧 `/tools/pdf-seal` 重定向到本地验签，旧收藏迁移到 `pdfVerify`。原 `/tools/ofd-seal`、`/tools/signature-debugger`、`/tools/seal-generator` 已删除；全站无需 Java 服务状态检测。被移除功能的后续技术判断见[OFD 与电子印章纯前端可行性](OFD与电子印章纯前端可行性.md)。

## PDF 支持范围

| 封装 | 范围 |
| --- | --- |
| Detached CMS / PKCS#7 | SM2/SM3、RSA PKCS#1 v1.5 和 ECDSA 的 SHA-256/384/512；含 signedAttrs 或直接签名，逐 signer 匹配证书 |
| RSA-PSS CMS | 限明确且一致的摘要/MGF 参数、有效 saltLength/trailerField；已通过 BC 独立 SHA-256 / MGF1 SHA-256 / 32 字节 salt 样本，RSA-PSS 专用 SPKI 暂不支持 |
| SES v4 | 外层 SM2 签章签名及 SM3(ByteRange)，覆盖原 Java 服务完整 SES 文件 |
| 历史裸 SM2 | DER `(r,s)`，将 `SM3(ByteRange)` 作为 SM2 消息验证；公钥来自 `/Cert` 或外部材料 |

SES 仅检查外层签名及文档摘要，制章签名、印章授权和印章有效期未检查；页面明确显示该范围。

实现有界 PDF token、xref 和对象解析，支持普通 xref、Flate xref stream、普通对象流。沿 AcroForm/引用读取签名，保留原始偏移，不正则扫描正文找签名、不重写 PDF 后验签。ByteRange 必须是四个非负安全整数，无越界、重叠，排除区间精确对应当前 Contents，末端覆盖完整修订。按 ASN.1 长度提取签名，剩余空间仅允许零填充。

每个签名分别展示所签修订、覆盖末端及后续内容。历史签名有效不等于签署了最终文件；最终未签追加内容会使总体检查不通过。后续签名覆盖新增内容不等于改动获得前一签名者许可，DocMDP/FieldMDP 修改许可未评估。证书当前过期不改变历史签名的数学结果。

限制：20 MiB 文件、64 个修订、64 个 PDF 签名、每 CMS 16 个 signer、每签名容器 4 MiB。取消、清空或离开页面会终止 Worker，异步文件读取不回写已清空材料。

加密 PDF、XFA、hybrid xref、未知过滤器/预测器、索引或对象流的间接长度、压缩签名字典、间接 Contents、attached CMS、非 issuer/serial 的 CMS SID、未知 SubFilter/算法、SES 扩展结构明确返回失败或不支持。越界、重复键和循环引用不显示成功。

## OCSP 请求与响应

1. 输入目标证书和 CA 证书，本地验证签发关系后生成 CertID，选择 SHA-256 或 SHA-1，默认附随机 32 字节 nonce。
2. 可解析上传请求，最多 64 个 CertID。带签名请求仅标明存在签名，当前不验证请求签名，不将它作为响应签发的身份认证依据。
3. 按请求构造 BasicOCSPResponse，设置 `good`、`revoked`、`unknown`、thisUpdate、可选 nextUpdate、吊销时间与原因。页面所选状态应用于请求中全部 CertID。
4. 提供匹配的签发者或授权响应者证书与私钥，支持 SM2/RSA/ECDSA、加密 PKCS#8。委托响应者必须由该 CA 直接签发且具有 OCSP Signing EKU，检查 KeyUsage、有效期及密钥匹配。
5. 响应保留请求 CertID/nonce。离线校验检查签名、授权、绑定、nonce、时间及可选目标证书。

**响应是离线测试材料，状态由用户指定，不代表真实在线吊销状态。** 数学验证成功也不等于操作系统或外部 CA 信任。GeneralizedTime 按规范 UTC 秒编码；SM2 签名结构严格检查。

请求/响应支持 DER 下载、Hex/Base64、有头/无头、换行及 LF/CRLF，头分别是 `OCSP REQUEST`、`OCSP RESPONSE`。SM2 响应签名 userId 与证书签名 userId 可分别设置。私钥、口令只在当前页面内存。

## CRL 离线校验

导入完整直接 CRL、CA 证书与可选目标证书，检查签名、签发者、时间及目标序号是否列入，展示吊销时间和原因。未列入某份 CRL 不等于实时未吊销。

本轮不生成 CRL，不获取网络列表。增量、间接及限定范围 CRL 明确拒绝，不把不完整列表作为完整状态。支持 PEM（`X509 CRL`）、DER、Hex、Base64 输入。

## Java 接入移除与历史范围

第一阶段删除 `esealtool-pdf` 源码模块、POM 依赖、PdfController/PdfApplicationService/PdfSignResponse，以及 PDF 预览、诊断、capability 和 API 白名单，移除 iText/PDFBox 运行依赖；当时原文档工作台、坐标处理和诊断收敛为 OFD。此为历史迁移步骤。

当前进一步移除 OFD 签章验签、OFD 签章诊断、电子印章制作三个功能及 Java 服务目录、前端接入、API 代理和专用部署配置。应用运行完全在浏览器中；测试生成器中的 Java/iText/BC 仅用于独立测试和样本生成。`tmp/esealTool` 保留为原始参考资料，不参与产品运行。

## 实现与验证

实现：[PDF 解析](../src/utils/pdf/parser.ts)、[签名校验](../src/utils/pdf/payload.ts)、[结果编排](../src/utils/pdf/verify.ts)、[PDF 页面](../src/views/tools/PdfVerify/index.vue)、[离线吊销核心](../src/utils/pki/revocation.ts)、[离线吊销页面](../src/views/tools/OfflineRevocation/index.vue)。

```sh
pnpm test:pdf
pnpm test:revocation
pnpm test:crypto
pnpm build
```

OCSP 独立互通配置 `PKI_OPENSSL`、`PKI_JAVA`、`PKI_BC_CLASSPATH`，缺失工具时明确跳过外部互通组。PDF 测试使用 `tests/fixtures/pdf` 的合成公开 PDF，日常运行无需 Java。可用 `tests/helpers/PdfFixtureGenerator.java` 与 iText 9.6/BC 1.84 classpath 重新生成样本；只保存合成 PDF 和公开证书，不保存私钥。

样本来源、完整 SES 与占位 SES 区别及重新生成说明见 [PDF 测试样本说明](../tests/fixtures/pdf/README.md)。

浏览器设置 `PKI_UI_URL`、`PLAYWRIGHT_MODULE` 后执行 `pnpm test:pdf:browser`，覆盖原服务 CMS/SES、SM2/RSA/ECDSA、对象流、多签名、追加数据、无签名、报告导出、OCSP 请求→响应→校验、中英文/移动端，并断言 API/外部请求为零。

### 2026-10-23 PDF 迁移阶段验收（删除剩余 Java 接入前）

下表保留当时的验证证据。Java 204 项、HTTP 5 组和 OFD/印章浏览器 7 组均为已删除功能的历史结果，不构成当前运行依赖或删除后的重新验收。

| 检查 | 结果 |
| --- | --- |
| PDF 核心 `test:pdf` | 31/31；包括原 Java CMS/完整 SES、RSA-PSS、增量多签名、内容篡改、范围错误、未知格式、CMS 参数与内层 DER 异常、多 signer 失败优先级 |
| 离线吊销 `test:revocation` | 9/9，零跳过；包含 OpenSSL RSA/ECDSA OCSP 验证、BC SM2/RSA/ECDSA OCSP/CRL 双向互通 |
| 共用密码/材料 `test:crypto` | 12/12 |
| 本地 PKI `test:pki` | 配置 OpenSSL 后 38/38，零跳过 |
| PKI 浏览器 `test:pki:browser` | 8 个独立工具、密钥/格式导入、完整流程、中英文/移动端；零后端请求 |
| 历史 Java `clean package` | 当时保留 8 模块共 204 项测试通过，零失败/错误/跳过；当时 jar 不含 PDF 模块、iText 或 PDFBox；现 Java 服务已删除 |
| 历史 Java HTTP `test:eseal` | 当时 5/5；capabilities 无 PDF，5 个已删除 PDF 入口均返回 403；现不再提供 Java 接口 |
| 历史 OFD/印章浏览器 `test:browser` | 当时 7 组通过：路由、摘要、材料显示、PNG、OFD 签章/预览/验签、批量及移动端/离线等；现三个功能已删除 |
| `pnpm build` | TypeScript 和生产 Vite 构建成功；保留现有大包体积提示 |
| 生产预览 `test:pdf:browser` | 8 份签名 PDF 通过，未签名/未签追加被识别，报告导出及 OCSP 请求→响应→校验通过；中英文/移动端通过，API/外部 HTTP 请求均为零 |

浏览器测试使用 Edge 的实际 Worker 与 WebCrypto。样本为合成文件及原服务输出，不代表所有第三方 PDF 的兼容性；未支持的结构按上述边界明确返回不支持。临时测试服务在验收后关闭，未执行部署。
