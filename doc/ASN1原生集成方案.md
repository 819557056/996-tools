# ASN.1 解析原生集成方案

调研日期：2026-10-29。目标是在 996-tools 中直接使用 asn1js.eu 的解析代码，由 Vue 展示结果，保持全部本地运行。

## 结论

可以直接集成。上游已将解析核心发布为 **`@lapo/asn1js`**，当前 npm 最新版为 **2.1.3**，采用 ES Module，没有生产依赖。无需从单文件 HTML 提取代码，也无需后端。

已增加锁定版本的 `@lapo/asn1js@2.1.3`，通过适配层和 Worker 调用。`/tools/certificate-parser` 已替换为 Vue 原生 ASN.1 工作区，运行时不加载 iframe。

### 当前项目位置

- `src/views/tools/CertificateParser/index.vue`：原生数据输入、结构树、节点详情、十六进制视图。
- `public/asn1-decoder.html`：保留的旧静态资源，新入口不再引用。
- `src/utils/certificateOids.ts`：已有标准、国密及行业 OID 名称，可复用已确认的映射；其中标为示例的行业条目需要核实。
- `src/utils/pki/`、`src/utils/ssl/`：已有证书处理与验证能力。

**名称容易混淆：** 当前依赖 `asn1js@3.x` 来自 PeculiarVentures/asn1.js，配合 PKI.js 使用；`@lapo/asn1js` 来自 lapo-luchini/asn1js，正是 asn1js.eu 的解析器。两个包可并存，应使用明确别名，保留现有 PKI 工具的依赖。

## 上游可复用能力

| 模块 / 接口 | 能力 | 集成方式 |
| --- | --- | --- |
| `ASN1.decode(bytes)` | DER / BER、构造类型、不定长、嵌套内容解析 | Worker 内调用 |
| `node.sub`、`typeName()`、`content()` | 子节点、类型、可读内容 | 转为本项目节点模型 |
| `posStart()`、`posLen()`、`posContent()`、`posEnd()` | Tag / Length / Value 字节区间 | 树和 Hex 视图双向定位 |
| `Base64.unarmor()`、`Hex.decode()` | PEM / Base64、十六进制输入 | 输入规范化 |
| `oids.js` | 通用 OID 名称与说明 | 结合本项目已确认的中文映射 |
| `Defs`、`rfcdef.js` | X.509、CSR、CMS、PKCS#1 / #8 等结构标注 | 按需加载，允许手动选择定义 |
| `toHexString()`、`toB64String('std')` | 节点编码导出 | 用户操作时在 Worker 中生成 |

`content()` 是给人看的预览字符串，OID 内容可能带名称，整数可能附带位数；不要将它当作严格的业务字段 API。需要精确值时使用节点的类型和原始字节，或交给现有 PKI.js 语义解析。

`Defs.match()` 会修改节点上的 `def` 标注。自动匹配多个类型后，应使用最终选中的定义再标注一次。匹配比例不是证书合法性或签名有效性的结论，无法识别的结构继续展示原始 ASN.1。

## 实现结构

```text
文件 / PEM / Base64 / HEX
          ↓
输入规范化 → Uint8Array
          ↓
本地 Web Worker
  @lapo/asn1js 结构解析
  Defs / OID 标注
          ↓
可序列化节点模型
          ↓
Vue：ASN.1 树 + 节点详情 + 十六进制联动
```

### 文件划分

```text
src/utils/asn1/
  decoder.ts            输入规范化、上游接口适配、结构标注
  types.ts              Worker 消息、节点数据类型
src/workers/asn1-decoder.worker.ts
src/composables/useAsn1Decoder.ts
src/views/tools/CertificateParser/
  index.vue             界面、结构树、节点详情、Hex 联动
  style.css             本项目主题、专注模式、窄屏布局
  samples.ts            RSA、SM2 公共证书及通用结构示例
public/licenses/lapo-asn1js.txt
```

节点模型至少包括 `id`、`parentId`、`tagClass`、`tagNumber`、`constructed`、`offset`、`headerLength`、`contentOffset`、`endOffset`、`indefinite`、`typeName`、`preview`、`fieldName` 和子节点 ID。较大的 `tagNumber` 转为字符串，避免 JSON 序列化 BigInt 失败。

原始字节只保留一份，节点通过偏移引用，不给每个节点复制完整 Hex / Base64。Worker 返回普通数据，不直接传递有方法的上游类实例；大树采用扁平索引和按需渲染。

### 最小调用示例

```ts
import { ASN1 as LapoASN1 } from '@lapo/asn1js'
import { Base64 } from '@lapo/asn1js/base64.js'

const bytes = Uint8Array.from(Base64.unarmor(pem))
const root = LapoASN1.decode(bytes)

const summary = {
  type: root.typeName(),
  offset: root.posStart(),
  contentOffset: root.posContent(),
  endOffset: root.posEnd(),
  preview: root.content(160),
  children: root.sub ?? [],
}
```

这是核心接口示例；正式适配层要遍历节点并转换为普通数据。包内没有自带 TypeScript 声明，补充仅覆盖所用 API 的类型声明。

### 已实现的页面交互

1. 保留 `/tools/certificate-parser` 入口，名称改为「ASN.1 解析」。
2. 上方输入：文本 / 本地文件、格式选择、RSA / SM2 / 基础结构示例、展开收起。
3. 左侧结构树：完整字段名、定义类型、原始 ASN.1 类型、值与 OID 名称，紧凑单行排列；搜索、展开收起、方向键导航。
4. 悬浮详情：Offset、Header + Length、constructed / encapsulates、值。右侧信息按钮可展开节点路径及详细参数。
5. Hex 视图：Tag 青绿、Length 琥珀、Value 蓝色；点击字节反向定位节点，复制节点 Hex、下载原始字节、按 4096 字节分页、仅看选中节点。常规证书一页显示全部字节。
6. 专注模式隐藏输入区，树与 Hex 分别滚动；窄屏改为「结构树 / 节点与字节」标签切换。
7. 结构定义支持自动匹配、手动选择和原始 ASN.1。自动匹配要求较高匹配比例且根与第一层子节点无类型冲突，仍仅作为阅读参考。
8. 支持多个 PEM 块、连续 ASN.1 对象与 BER 不定长。解析仅使用内存，不写入 URL、持久存储或日志。
9. 错误显示具体原因，并保留上一次成功结果及其来源名称；编辑输入后显示待重新解析状态。

## 接入边界

- **不用 `index.js` / `dom.js` 做展示。** `index.js` 绑定固定 DOM、拖放、localStorage 和 URL hash；`dom.js` 操作原生节点并引入 `context.js`。实际 npm 2.1.3 包还缺少这个 `context.js` 文件。核心解析接口不依赖这些页面模块。
- **纯前端部署。** npm 包在开发时安装，生产构建打包为本地静态资源。运行时不用 CDN 或远程解析 API。
- **格式歧义。** HEX 字符串也可能符合 Base64 字符集；提供自动识别及手动格式选择，避免只按正则首次匹配判断。
- **资源限制。** 文件大小限制、Worker 超时终止、结果节点数量限制及分段展示。已发布 2.1.3 的 `decode` 没有 `maxDepth` 参数；当前 trunk 已加入该参数，不能直接将 trunk 接口当作 npm 2.1.3 的接口使用。如需在解码期间限制深度，应单独引入审阅过的补丁或跟进正式发布。
- **语义与验签。** ASN.1 解析可读出 SM2 的 OID、参数和签名结构；签名验证、证书链信任、加密私钥解密需要另接现有密码学工具。
- **许可。** 上游为 ISC，允许集成及修改，分发时保留版权和许可声明。

## 实测结果

调研时先在独立临时目录验证 npm 发布包 `@lapo/asn1js@2.1.3`；本次界面实现已将其加入项目依赖。

- RSA2048、RSA4096 / ECDSA P-384、SM2：站点证书、根证书、SPKI 公钥和 PKCS#8 私钥，共 12 份测试材料解析成功。
- PEM、Base64、HEX 输入与 DER 字节相同；根证书两个独立 OU 顺序保留。
- 节点边界覆盖完整输入，语义标注可读出 issuer、subject 等字段。
- BER 不定长可解析，截断 DER 被拒绝。
- 将核心与 `Defs` 打包为浏览器脚本后，在没有 `window`、`document`、Node API 或网络接口的沙箱中运行成功。
- 该验证构建约 334.5 KB，gzip 约 52.1 KB（包含 OID 与 RFC 定义；实际 Vite 产物会有差异）。建议通过路由及 Worker 按需加载。

验证脚本位于本机临时目录 `tmp/asn1-integration-research/verify.mjs`，结果为同目录 `verification.json`。这些测试证明模块可脱离 HTML 运行。

本次界面验收：

- `pnpm build`：类型检查及生产构建通过。
- `node --test tests/asn1-worker-bundle.test.mjs`：4 项通过。验证实际生产 Worker 在无 DOM、Node 运行时与网络接口的环境下解析；覆盖通用结构防误标、TLV 偏移、DER / Base64 / 多 PEM、BER 不定长、非法与超限输入。
- 浏览器：RSA 与 SM2 示例、通用结构、搜索、树收起后的键盘导航、点击字节反向定位、TLV 高亮、选中节点范围、DER 文件读取、错误保留旧结果、专注模式及 390px 窄屏切换。
- 截图：`doc/verification/asn1/workspace.png`（专注模式）与 `input.png`（普通模式）。

界面定位为通用 ASN.1 检查工具。当前值预览有长度限制，下载保留准确原始字节。文件上限 2 MB、Worker 超时 6 秒、返回节点最多 12000 个 / 80 层、树单次最多显示 700 行。尚未提供证书信任链验证、加密内容解密或完整的 X.509 业务摘要。

## 上游来源

- 项目及官方调用示例：https://github.com/lapo-luchini/asn1js
- npm：https://www.npmjs.com/package/@lapo/asn1js
- npm 发布元数据：https://registry.npmjs.org/@lapo%2fasn1js/latest
- 解析器源码：https://github.com/lapo-luchini/asn1js/blob/e936e81c8d022fe4161eaabd9d01cd9c37910c1a/asn1.js
- 结构定义匹配：https://github.com/lapo-luchini/asn1js/blob/e936e81c8d022fe4161eaabd9d01cd9c37910c1a/defs.js
- 许可证：https://github.com/lapo-luchini/asn1js/blob/e936e81c8d022fe4161eaabd9d01cd9c37910c1a/LICENSE

源码调研固定为 trunk 提交 `e936e81c8d022fe4161eaabd9d01cd9c37910c1a`；运行验证使用 npm 发布包 2.1.3。两者接口的差异已在上面单独说明。


## 展示与复制菜单优化（2026-10-29）

- 参照原站的紧凑单行树和层级连接线，普通文件默认展开；选中节点的祖先路径同步突出显示。解析成功后收起输入区。
- 默认 Hex 面板宽 264px，结构树占剩余空间；分隔线可拖动或用左右方向键调整，双击恢复。节点详情默认折叠，信息按钮可展开。
- 按用户提供的原站截图补全 `issuer rdnSequence` 等完整字段名、`CertificateSerialNumber` 等定义名称及 `[?]` 标记；展示完整 `OBJECT IDENTIFIER` 类型。字段不截断，长行可横向滚动，大值保留简短预览。
- 桌面树行高 18px，显示细连接线与独立的加减展开按钮；悬浮显示偏移、头部与内容长度、构造 / 内嵌标记和值预览。
- 节点文字左键、节点右键、Enter / Shift+F10 均打开同一菜单；箭头独立展开 / 收起。菜单支持方向键、Escape、外部点击关闭，并限制在视口内。
- 常用菜单提供 Hex、Base64、子树、可读值；“更多格式”中可分别复制完整节点、Tag、Length、Value 的 Hex、Base64、Base64URL，另有连续 Hex 和原始节点下载。Tag / Length 的复制保留编码字节；Value 不包含 BER 的结束标记，BIT STRING 保留未使用位计数字节。
- 所有复制都从原始字节在本地 Worker 中生成，避免把缩短后的 UI 预览当作完整值。菜单带复制成功反馈。
- Hex 对全部节点的 Tag / Length 着色，选中节点的 TLV 区间加背景；默认 16 列，面板小于 244px 时显示 8 列；加宽后自动显示偏移和 ASCII。选择树节点时自动滚动到对应字节。
- `pnpm build` 通过；`node --test tests/asn1-worker-bundle.test.mjs` 7 项通过，新增全格式 / 全范围、BER 结束标记、多字节 Tag、长 Length、空 Value、Base64URL 和 2000 字符长值复制测试。
- 浏览器实测左键、右键、键盘菜单；完整节点 Hex、Tag Hex、Value Base64、完整可读值的剪贴板内容；展开按钮独立操作、拖动 / 键盘调宽和双击复位；390px 菜单边界与 8 列 Hex 无横向溢出。
- 最新浏览器复核：本地 SM2 根证书（78 节点、492 字节）完整字段定义；简洁菜单与高级格式切换；Offset / Length 悬浮提示；分隔线复位；390px 高级菜单无溢出、16 列 Hex 无横向溢出。
- 当前效果图：`doc/verification/asn1/classic-workspace.png`、`classic-context-menu.png`、`classic-mobile.png`。
