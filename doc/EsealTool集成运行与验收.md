# EsealTool 集成运行与验收

更新：2026-10-23。**当前全站保留 36 个工具，零 Java 运行依赖。** 已删除 OFD 签章验签、OFD 签章诊断、电子印章制作三个功能，以及原 Java 服务、API 接入和专用部署配置。本轮只移除，不将这三个功能重写为前端。B. 原生页面 + Java 服务是历史方案，下方原记录完整保留供追溯。

PDF 验签、离线 OCSP/CRL 和 8 个常用 PKI 工具在浏览器 Worker 执行，文件、私钥和口令不上传。TLS/SSL 调试仍不实现。OFD 与电子印章在技术上可纯前端实现，但结构、签名和渲染需要独立开发与互操作验证，见[纯前端可行性](OFD与电子印章纯前端可行性.md)。

## 当前功能入口

| 入口 | 处理位置 | 当前能力 |
| --- | --- | --- |
| `/tools/file-digest` | 浏览器 Worker | MD5、SHA-1、SHA-256、SM3，分块、进度和取消 |
| `/tools/oid-explorer` | 浏览器 | OID 名称/描述搜索、分类和已知上级提示 |
| `/tools/pdf-verify` | 浏览器 Worker | PDF 签名列表、数学验签、摘要与覆盖范围、证书提取及 JSON 报告 |
| `/tools/offline-revocation` | 浏览器 Worker | OCSP 请求生成/解析、离线测试响应签发及校验、完整直接 CRL 解析/验签/序号查询 |
| `/tools/csr-create`、`/tools/csr-parse`、`/tools/pkcs12-create`、`/tools/self-signed-certificate` | 浏览器 Worker | CSR 制作/解析、PFX/PKCS#12、自签证书及配套密钥 |
| `/tools/certificate-chain`、`/tools/certificate-verify`、`/tools/certificate-encrypt`、`/tools/certificate-envelope` | 浏览器 Worker | 离线链验证、证书及数据验签、证书公钥加密、证书数字信封 |
| 原 SM2/SM4/证书/数字信封等工具 | 浏览器 | 保留本地能力及 Hex/Base64、头尾、大小写、换行和文本/二进制导出 |

已删除的三个入口不再显示在首页、侧栏和搜索中。旧 PDF 签章地址转到本地 PDF 验签，旧 PKI 工作台地址转到 CSR 制作；独立 KeyStore/TrustStore 功能保持移除。

三个已删除功能的旧地址重定向到首页；载入收藏时根据现有工具注册过滤失效项目，同时迁移旧 PDF/PKI 收藏。

## 当前开发与部署

使用 Node 22.17+ 和项目锁文件对应的 pnpm：

1. 在仓库根执行 `pnpm install --frozen-lockfile`。
2. 执行 `pnpm dev` 启动开发服务。
3. 执行 `pnpm build` 完成类型检查和生产打包，部署生成的 `dist` 静态文件。

应用运行无需 Java、Maven、Java 能力开关或 API 代理。WebCrypto 需要 HTTPS 或 localhost。可选互操作测试中的 Java/BouncyCastle，以及重新生成 PDF 样本时的 iText，仅属于独立测试工具链；它们不是应用运行依赖。

工作区 `services/esealtool` 下仍有旧 `target`/`.run` 二进制缓存：自动审批拒绝目录和逐文件删除，返回 `blocked by policy`。该目录已在 Git 与 Docker 构建中排除，Java 源码、POM、运行配置及调用入口均已删除。缓存不参与构建或部署。

## 当前边界与验收索引

2026-10-23 移除三项 Java 工具后重新验收：`pnpm build`（含 TypeScript）通过；`test:crypto` 12/12、`test:pdf` 31/31 通过。生产预览下 `test:browser` 验证 36 项注册、旧地址回首页、收藏迁移、摘要/OID、格式复制下载及中英文/移动端；`test:pdf:browser` 验证 PDF 与 OCSP 流程；`test:pki:browser` 验证 8 个 PKI 工具，全部通过，未产生后端 API 请求。PDF/OCSP 和通用本地工具检查还断言外部 HTTP 请求为零。保留现有构建警告，未进行容器启动验证（本机无 Docker）。

- 格式显示保持原始字节不变，Base64 编码二进制字节；复制与文本下载使用同一格式化结果。见[密码材料格式转换](密码材料格式转换-进度与待办.md)。
- 证书链只验证用户指定信任锚，不读取系统信任库或自动获取中间证书；数学验签不自动代表信任。见[本地 PKI 使用与验收](本地PKI工具使用与验收.md)。
- PDF 仅验证受支持签名、摘要及覆盖范围，不检查吊销证据、TSA 信任锚或长期有效性。离线 OCSP 响应状态由用户指定，不代表在线状态；CRL 未列入某序号不等于实时未吊销。见[PDF 与离线 OCSP/CRL 实施记录](PDF验签前端迁移评估.md)。
- 以下 Java 204/229/231 项、HTTP 和 OFD/印章浏览器结果均为删除前的历史验收，不构成当前 Java 运行要求，也不代表本轮删除后的重新测试。

## 历史存档：B 方案集成运行与验收

**本节为 Java 接入移除前的原记录。以下“当前”“最终”“保留”均指当时状态，原路径、命令与接口仅供追溯，不能作为当前项目的启动步骤或功能清单。** 原服务及相关脚本现已删除；原参考目录 `tmp/esealTool` 不作为运行依赖。

更新：2026-10-23。实现采用 **B. 原生页面 + Java 服务**，前端继续使用本项目 Vue / Tailwind。**PDF 验签、离线 OCSP/CRL 和常用 PKI 均在浏览器 Worker 执行；OFD 与电子印章保留 Java 实现。**

**最新调整：常用 PKI 能力已拆为 8 个纯前端独立工具，位于“公钥基础设施”分类；本次不实现 TLS/SSL 调试。** 使用方法、算法边界及新增验收见[本地 PKI 工具使用与验收](本地PKI工具使用与验收.md)。以下历史 Java 集成验证记录仍保留。

**2026-10-23 最终范围：** KeyStore / TrustStore 独立模块及公开 API 已删除，PFX/PKCS#12 和共享底层能力保留。原 PDF 签章、预览、批量及 Java PDF 模块已删除，iText/PDFBox 不再是运行依赖；PDF 仅提供本地验签。新增离线 OCSP 请求、测试响应及 CRL 校验，均不请求任何外部状态服务。详细边界和最新验收见[PDF 本地验签与离线 OCSP/CRL](PDF验签前端迁移评估.md)。

### 功能入口

| 入口 | 处理位置 | 本次实现 |
| --- | --- | --- |
| `/tools/file-digest` | 浏览器 Worker | MD5、SHA-1、SHA-256、SM3；1 MiB 分块、进度、取消，支持空文件 |
| `/tools/oid-explorer` | 浏览器 | 124 条 OID，名称/描述搜索、分类和已知上级提示 |
| `/tools/pdf-verify` | 浏览器 Worker | PDF 签名列表、数学验签、摘要与覆盖范围、证书提取及 JSON 报告；旧 `/tools/pdf-seal` 重定向到此处 |
| `/tools/offline-revocation` | 浏览器 Worker | OCSP 请求生成/解析、按请求签发用户指定状态的离线测试响应、响应绑定及签名校验、CRL 解析/验签/序号查询 |
| `/tools/ofd-seal` | Java | OFD 签章、验签、签名列表、诊断、单页预览选点，单点/多位置/关键词/连续骑缝/重叠骑缝，批量及成功文件 ZIP |
| `/tools/signature-debugger` | Java | OFD 结构、摘要、证书和电子印章诊断，材料及 JSON 报告下载 |
| `/tools/csr-create`、`/tools/csr-parse`、`/tools/pkcs12-create`、`/tools/self-signed-certificate` | 浏览器 Worker | CSR 制作/解析、PFX/PKCS#12、自签证书及配套密钥生成 |
| `/tools/certificate-chain`、`/tools/certificate-verify`、`/tools/certificate-encrypt`、`/tools/certificate-envelope` | 浏览器 Worker | 离线证书链验证、证书及数据验签、证书公钥加密、证书数字信封；旧工作台地址跳转到 CSR 制作 |
| `/tools/seal-generator` | Java | 七种印章图片形状、电子印章制作/解析/验证、独立测试身份材料 |
| 原 SM2/SM4/证书/数字信封页面 | 浏览器 | Hex/Base64、头尾、大小写、换行和精确文本导出；SM2 C1 适配及 P7 修复 |

当前工具数为 **39**，按 `toolsData` 实际注册核对：以本地 PDF 验签替换原 PDF 签章入口不改变数量，新增离线 OCSP/CRL 使 KeyStore 移除后的 38 项增至 39 项。仅 OFD 签章、OFD 诊断、电子印章制作三个入口要求 Java；首页、侧栏和搜索统一登记运行位置。

### 开发运行

本地工具要求 Node 22.17+ 和项目锁文件对应的 pnpm。使用 OFD/电子印章等服务端功能时另需 Java 17、Maven 3.9；PDF 验签与离线 OCSP/CRL 无需启动 Java。

1. 在仓库根执行 `pnpm install --frozen-lockfile`。
2. 在 `services/esealtool` 执行 `mvn -B -pl esealtool-server -am package`，随后运行：

   ```sh
   java -jar esealtool-server/target/esealtool-server-0.1.0.jar --esealtool.integration.writes-enabled=true
   ```

3. 将根目录 `.env.eseal.example` 复制为 `.env.local`，保持 `VITE_ESEAL_ENABLED=true`、`ESEAL_PROXY_TARGET=http://127.0.0.1:18080`，执行 `pnpm dev`。
4. 前端请求 `/api/eseal/v1/*`，Vite 转发到 Java `/api/v1/*`。不要在页面中直接填写或调用其他服务主机。

静态版不配置 `.env.local`，或将 `VITE_ESEAL_ENABLED=false`；执行 `pnpm build` 后部署 `dist`。Java 工具会解释当前不可用原因，本地工具仍可用。开关是构建时设置，修改后需重启开发服务或重新打包。

### 私有 Compose 部署

```sh
docker compose -f docker-compose.eseal.yml up --build -d
```

入口为 `http://127.0.0.1:8081`。Java 只在容器网络暴露 18080；容器以非 root 用户运行，文件系统只读，临时目录使用 tmpfs。Compose 开启签名和材料生成，关闭持久化测试根及 TLS。服务具备健康检查，前端经同源 Nginx 转发。

单文件 20 MiB、multipart 总请求 32 MiB；批量最多 20 个文件、合计 100 MiB；最多同时处理 4 个 POST，请求繁忙返回 429。前端取消会终止等待及后续批量项，已进入 Java 的计算可能继续。业务响应兼容原服务 `code=0`，客户端同时检查 HTTP 状态、JSON 类型及业务码；静态 Nginx 的 `/api/` 返回 JSON 错误，避免误回退成首页。

这套配置面向本机/私有部署，未增加公网账户鉴权平台；如改为公开监听，需由部署方提供访问控制和 HTTPS。

### 签章材料与格式约定

- 本地格式转换以原始字节为准。Base64 编码二进制字节；切换显示不重新生成签名、密钥或密文。
- SM2 裸公钥为 `04|X|Y`，裸私钥为 32 字节。SPKI/PKCS#8 选项先生成真实 DER；标准 PEM 头与裸材料自定义头分开。
- 文本可选择 0/32/64/76 列、LF/CRLF；复制和文本下载读取格式化结果，二进制下载另提供按钮。切换显示不会改写 API 算法参数。
- OFD 签章使用电子印章 DER，服务验证印章签名/当前有效期、授权签章者证书、图片一致性及私钥证书配对。默认禁止隐式生成持久化测试根印章。
- OFD 原生位置输入为 mm、左下角原点、印章中心，内部转换为页面标注坐标；OFD 是简化预览。当前不提供 PDF 位置输入或签章。
- 浏览器 P7 使用 SM3 原文字节、SM2 ZA 和 DER 排序属性；可从匹配签名者的内嵌证书提取公钥。只支持单签名者 SM2/SM3，其他算法/多签名者交给 Java CMS。旧错误摘要语义不做静默兼容。
- 数学签名和文档完整性分别展示通过/失败/未确定/暂不支持。证书链信任、吊销和可信时间不由文档验签页认定。本地证书链页验证用户指定信任锚，不检查吊销或主机名。
- PDF 页面仅在本地解析、提取证书并检查受支持签名、摘要及修订覆盖范围，不要求或检查吊销证据、TSA 信任锚。离线 OCSP/CRL 是独立工具：测试响应状态由用户指定，不代表在线状态；导入 CRL 未列入某个序号不代表实时未吊销。

### 已执行验证

当前 Java 八模块回归 **204 项通过**。PDF 和离线 OCSP/CRL 的最终前端、互操作及浏览器验证统一记录在[PDF 本地验签与离线 OCSP/CRL](PDF验签前端迁移评估.md)，不沿用旧 Java PDF 数量作为当前通过数量。

**历史记录——2026-10-23 KeyStore 移除阶段（早于 PDF 移除）：** TypeScript/Vite 构建通过；当时 Maven 全量 231 项通过并完成干净打包；最终 JAR 启动后 5 组 HTTP 集成通过，13 个已删除 KeyStore API 在写入开关开启时仍按现有过滤器策略返回 403。当时浏览器工具数为 38、无 KeyStore 路由及入口、旧收藏已清理，8 个本地 PKI 流程通过；当时的 PFX 与 Java PDF/OFD 签章验签均通过。Java PDF 路径现已删除，此记录仅供追溯。

下表为 2026-10-22 集成验收历史，其中 KeyStore/JKS/TrustStore 的独立入口和 API 已于 2026-10-23 移除，当前 HTTP/浏览器测试脚本已同步调整。

| 检查 | 实际结果 |
| --- | --- |
| 全项目 `vue-tsc --noEmit` | 通过；修复阻断构建的原有类型错误，未关闭严格选项 |
| Vite 生产打包 | 通过；测试产物输出到系统临时目录 |
| `pnpm test:crypto` | 12 项通过，覆盖显示字节、换行、Node/OpenSSL 密钥导入、业务往返、SM3 标准向量和分块边界 |
| Maven 全模块测试 | 229 项通过；含迁入测试及新增能力开关、TLS 白名单、电子印章授权/图片/篡改、CBC 缺 IV 校验 |
| 真实 HTTP 集成 | 5 组通过；SM2 双顺序密文、默认/自定义 userId 双向签验；JS/Java CMS 内嵌/分离及空消息互通、签名/内容篡改；CSR、PFX/JKS、TrustStore；PDF/OFD 五种位置签章、预览、验签、列表、诊断及错误材料 |
| Edge 无头浏览器 | 八个页面；真实 Worker 摘要、原生表单、Base64 头尾复制、CRLF 下载、PDF 签章后下载回验、批量部分失败 ZIP、移动端/暗色/英文、服务失败时本地页可用；无页面运行异常 |
| 静态版 | Java 关闭提示正确，不请求 Java API，原有本地页可打开 |
| Docker / Nginx 实际启动 | 本机未安装 Docker，配置已提供，未实际构建或启动容器 |
| 第三方 PDF/OFD 阅读器、正式 CA/HSM、时间戳/吊销 | 未验收，不据此宣称生产可信签章或全部厂商兼容 |

HTTP 测试需要启动 **writes=true、testAuthority=false、tls=false** 的本地 Java 服务。例如 PowerShell：

```powershell
$env:ESEAL_TEST_URL='http://127.0.0.1:18080/api/v1'
pnpm test:eseal
```

浏览器测试需要已安装的 Playwright 和浏览器，`ESEAL_UI_URL` 指向已启用 Java 的前端；可用 `PLAYWRIGHT_MODULE` 指向现有 Playwright 模块、`PLAYWRIGHT_CHANNEL=msedge` 使用本机 Edge。测试材料即时生成，不向仓库写入私钥。

历史构建存在大包、浏览器数据过期、TOML stream 外置和 vue-i18n 的 Rollup 提示；最新构建结果见 PDF 实施记录。发布前仍需核实保留参考源码的授权、跑容器验证，并按部署进行资源压力及第三方样本验收。iText/PDFBox 已从产品运行依赖移除；可选 PDF 测试样本生成器使用的 iText 属于独立测试工具链。
