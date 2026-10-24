# SM2 工具重构技术设计文档

## 一、项目背景

### 当前状态
- **位置**：`src/views/tools/Sm2Tool/`
- **文件**：`index.vue`（单页面）、`useSm2Tool.ts`
- **功能**：加密、解密、签名、验签四合一

### 存在问题
1. 页面结构混乱，四个功能挤在一个页面，用户体验差
2. 加解密和签名结果都是简单的 Hex 字符串，未使用 ASN.1 标准结构
3. 签名功能未实现 P1 和 P7 两种 ASN.1 格式（GMT 0010-2012 规范要求）
4. 缺乏与 gmssl/openssl 国密分支的互操作性

### 重构目标
1. 拆分为两个独立页面，提升用户体验和代码可维护性
2. 实现符合国密标准的 ASN.1 编码输出
3. 支持多种输出格式（Hex、ASN.1 DER）
4. 确保与主流国密工具的互操作性

## 二、实施路线（分阶段）

### 第1阶段：页面拆分 + 基础功能（MVP）✅
**目标**：拆分页面，保持现有功能可用

**任务清单**：
- [ ] 创建 `src/views/tools/Sm2Encrypt/` 目录（加解密页面）
  - [ ] `index.vue`：加解密 UI
  - [ ] `useSm2Encrypt.ts`：加解密逻辑
- [ ] 创建 `src/views/tools/Sm2Sign/` 目录（签名验签页面）
  - [ ] `index.vue`：签名验签 UI
  - [ ] `useSm2Sign.ts`：签名验签逻辑
- [ ] 更新 `src/lib/tools-data.ts`：注册两个新工具
- [ ] 更新路由配置
- [ ] 保留现有 Hex 输出格式（向后兼容）
- [ ] 测试基础功能可用性

**验收标准**：
- 两个页面独立访问，功能正常
- 保持与旧版本相同的加解密、签名验签能力
- UI 清晰，用户体验提升

### 第2阶段：ASN.1 基础编码
**目标**：实现 SM2 算法标准 ASN.1 输出

**任务清单**：
- [ ] 创建 `src/utils/crypto/asn1/sm2.ts`：ASN.1 编解码工具
- [ ] 创建 `src/utils/crypto/asn1/oid.ts`：OID 常量表
- [ ] 实现 `SM2Cipher` ASN.1 编解码
- [ ] 实现 `SM2Signature(r,s)` ASN.1 编解码
- [ ] 在 UI 中添加"Hex/ASN.1"输出格式切换
- [ ] 实现裸格式与 ASN.1 格式的相互转换
- [ ] 编写单元测试和互操作测试

**验收标准**：
- 支持 Hex 和 ASN.1 DER 两种输出格式
- 与 gmssl/openssl 国密分支互操作测试通过
- 代码有完整的单元测试覆盖

### 第3阶段：P7 SignedData（可选，标记为实验功能）
**目标**：支持完整的 CMS SignedData 格式

**任务清单**：
- [ ] 证书导入/导出功能（PEM/DER）
- [ ] SignedData 完整结构实现
- [ ] OID 和 SignedAttributes 支持
- [ ] 证书链嵌入选项
- [ ] 标记为"实验功能"

**说明**：此阶段为可选功能，根据实际需求决定是否实施。

## 三、核心数据结构定义

### 3.1 SM2Cipher ASN.1 结构（加密输出）

```asn1
SM2Cipher ::= SEQUENCE {
  xCoordinate  INTEGER,      -- C1.x (椭圆曲线点 x 坐标)
  yCoordinate  INTEGER,      -- C1.y (椭圆曲线点 y 坐标)
  hash         OCTET STRING, -- C3 (消息摘要，SM3 为 32 字节)
  cipherText   OCTET STRING  -- C2 (密文主体，可变长)
}
```

**字段说明**：
| 字段 | 类型 | 长度 | 说明 | 校验规则 |
|------|------|------|------|----------|
| xCoordinate | INTEGER | 32 bytes (推荐) | 椭圆曲线点 x 坐标 | 正整数，DER 编码需处理高位 0x80 前导 0x00 |
| yCoordinate | INTEGER | 32 bytes (推荐) | 椭圆曲线点 y 坐标 | 正整数，DER 编码需处理高位 0x80 前导 0x00 |
| hash | OCTET STRING | 32 bytes | SM3 消息摘要 | 固定 32 字节 |
| cipherText | OCTET STRING | 可变 | 加密后的密文 | 长度 > 0 |

**语义对应**：
- 这是 `C1 || C3 || C2` 的结构化表达（常见国密实现约定）
- 与裸字节串拼接相比，ASN.1 结构提供了明确的字段边界和类型信息

**关于 C1C3C2 和 C1C2C3**：
- ASN.1 结构本身无区别（字段语义固定：`x, y, hash, cipherText`）
- 区别在"裸字节串拼接顺序"与"与 sm-crypto 的输入输出转换逻辑"
- 裸格式：区分 C1C3C2 / C1C2C3
- ASN.1：统一结构，不应再依赖拼接顺序

### 3.2 SM2Signature ASN.1 结构（签名输出）

```asn1
SM2Signature ::= SEQUENCE {
  r INTEGER,  -- 签名值 r
  s INTEGER   -- 签名值 s
}
```

**字段说明**：
| 字段 | 类型 | 长度 | 说明 | 校验规则 |
|------|------|------|------|----------|
| r | INTEGER | 32 bytes (典型) | 签名值 r | 正整数，处理边界值（31/32/33 字节） |
| s | INTEGER | 32 bytes (典型) | 签名值 s | 正整数，处理边界值（31/32/33 字节） |

**语义对应**：
- SM2 签名算法输出 `(r, s)` 的 DER 封装
- 与 ECDSA 的签名值封装形式类似
- **本项目 P1 定义**：DER 编码的 SM2Signature（SEQUENCE{r,s}）

**与 GMT 0010-2012 的对应关系**：
- 这是 SM2 签名算法的基础输出格式
- P7 SignedData 是在此基础上增加签名者信息、证书链等扩展字段

### 3.3 OID 常量表

| 名称 | OID | 说明 |
|------|-----|------|
| id-sm2 | 1.2.156.10197.1.301 | SM2 椭圆曲线公钥密码算法 |
| sm3 | 1.2.156.10197.1.401 | SM3 密码杂凑算法 |
| sm4 | 1.2.156.10197.1.104 | SM4 分组密码算法 |
| sm2sign-with-sm3 | (以联调结果锁定) | SM2 签名算法标识（不同实现可能有差异） |

**说明**：
- 创建 `src/utils/crypto/asn1/oid.ts` 统一管理 OID 常量
- 禁止在代码中散落 OID 字符串
- OID、SignedAttributes、证书链处理以互操作测试结果为验收标准

## 四、前端模块接口设计

### 4.1 文件结构

```
src/
├── views/tools/
│   ├── Sm2Encrypt/           # 加解密页面
│   │   ├── index.vue
│   │   └── useSm2Encrypt.ts
│   ├── Sm2Sign/              # 签名验签页面
│   │   ├── index.vue
│   │   └── useSm2Sign.ts
│   └── Sm2Tool/              # 旧实现（可选保留或删除）
│       ├── index.vue
│       └── useSm2Tool.ts
└── utils/crypto/asn1/
    ├── sm2.ts                # SM2 ASN.1 编解码
    ├── oid.ts                # OID 常量表
    └── cms.ts                # CMS/P7 结构（第3阶段）
```

### 4.2 `src/utils/crypto/asn1/sm2.ts` 接口

```typescript
// SM2Cipher 结构
export interface Sm2CipherStruct {
  x: Uint8Array;   // 32 bytes (推荐)
  y: Uint8Array;   // 32 bytes (推荐)
  c3: Uint8Array;  // 32 bytes (SM3)
  c2: Uint8Array;  // 可变长度
}

// SM2Signature 结构
export interface Sm2SignatureStruct {
  r: Uint8Array;   // 32 bytes (典型)
  s: Uint8Array;   // 32 bytes (典型)
}

// 编码函数
export function encodeSm2CipherDer(input: Sm2CipherStruct): Uint8Array;
export function decodeSm2CipherDer(der: Uint8Array): Sm2CipherStruct;
export function encodeSm2SignatureDer(input: Sm2SignatureStruct): Uint8Array;
export function decodeSm2SignatureDer(der: Uint8Array): Sm2SignatureStruct;

// 格式转换函数
export function convertRawCipherToAsn1(
  raw: Uint8Array,
  mode: "C1C3C2" | "C1C2C3"
): Uint8Array;

export function convertAsn1ToRawCipher(
  der: Uint8Array,
  mode: "C1C3C2" | "C1C2C3"
): Uint8Array;
```

### 4.3 错误处理策略

**错误码定义**：
| 错误码 | 说明 | 触发场景 |
|--------|------|----------|
| ERR_ASN1_PARSE | ASN.1 解析失败 | DER 数据格式错误 |
| ERR_ASN1_SCHEMA | ASN.1 结构不匹配 | 字段类型或数量错误 |
| ERR_SM2_FIELD_LENGTH | SM2 字段长度错误 | x/y/c3 长度不符合预期 |
| ERR_SM2_VALUE_RANGE | SM2 值范围错误 | r/s 为负数或超出范围 |

**错误处理原则**：
- 底层抛结构化错误：`{ code: string, message: string, detail?: any }`
- UI 层做文案映射，提供用户友好的错误提示
- 所有 decode 函数严格校验 SEQUENCE 长度与字段类型
- 拒绝"宽松解析"，确保数据安全性

### 4.4 `asn1js` 实现示例

```typescript
import * as asn1js from "asn1js";

// Uint8Array 转 ASN.1 INTEGER（处理 DER 正整数编码）
function uint8ToInteger(bytes: Uint8Array): asn1js.Integer {
  // 确保 DER 编码为正整数（高位为 1 时需前导 0x00）
  const needsPad = bytes.length > 0 && (bytes[0] & 0x80) !== 0;
  const v = needsPad ? Uint8Array.from([0x00, ...bytes]) : bytes;
  return new asn1js.Integer({
    valueHex: v.buffer.slice(v.byteOffset, v.byteOffset + v.byteLength)
  });
}

// 编码 SM2Cipher 为 DER
export function encodeSm2CipherDer(v: Sm2CipherStruct): Uint8Array {
  const seq = new asn1js.Sequence({
    value: [
      uint8ToInteger(v.x),
      uint8ToInteger(v.y),
      new asn1js.OctetString({
        valueHex: v.c3.buffer.slice(v.c3.byteOffset, v.c3.byteOffset + v.c3.byteLength)
      }),
      new asn1js.OctetString({
        valueHex: v.c2.buffer.slice(v.c2.byteOffset, v.c2.byteOffset + v.c2.byteLength)
      }),
    ],
  });
  return new Uint8Array(seq.toBER(false));
}
```

## 五、互操作性测试

### 5.1 测试向量类型

| 测试类型 | 说明 | 验证点 |
|----------|------|--------|
| 固定密钥加解密往返 | 固定私钥/公钥 + 固定明文 | 加密解密结果一致 |
| 固定密钥签名验签 | 固定私钥 + 固定消息 + 固定 ZA/ID | 签名验签通过 |
| r/s 边界值测试 | 高位为 1（触发 DER 前导 0x00） | DER 编码正确 |
| 长度边界测试 | r/s 长度为 31/32/33 字节 | 解析正确 |
| C1C3C2/C1C2C3 互转 | 两种模式相互转换 | 转换正确 |
| DER 非法输入 | 截断、tag 错误、负整数 | 异常处理正确 |

### 5.2 联调方式

**双向验证**：
1. 前端产物 → gmssl/openssl 验签/解密
2. gmssl/openssl 产物 → 前端验签/解密

**工具推荐**：
- gmssl 命令行工具
- openssl 国密分支
- 在线国密工具（用于快速验证）

### 5.3 验收标准

- 所有测试向量通过
- 与主流国密工具互操作性 100%
- 边界情况和异常处理完善
- 代码有完整的单元测试覆盖

## 六、UI/UX 设计要点

### 6.1 加解密页面（Sm2Encrypt）

**布局**：
- 左侧：密钥管理区（公钥、私钥、生成按钮）
- 中间：加密区（输入、模式选择、执行按钮）
- 右侧：解密区（输入、模式选择、执行按钮）
- 底部：输出格式切换（Hex/ASN.1）

**交互**：
- 加密结果可一键复制到解密输入
- 支持拖拽文件上传（大文件加密）
- 实时显示输出格式和长度

### 6.2 签名验签页面（Sm2Sign）

**布局**：
- 左侧：密钥管理区（公钥、私钥、生成按钮）
- 中间：签名区（输入、格式选择、执行按钮）
- 右侧：验签区（消息、签名、验证按钮、结果显示）
- 底部：输出格式切换（Hex/P1/P7）

**交互**：
- 签名结果可一键复制到验签输入
- 支持导入证书（P7 模式）
- 验签结果清晰显示（通过/失败）

## 七、工具注册和路由配置

### 7.1 更新 `src/lib/tools-data.ts`

```typescript
sm2Encrypt: {
  key: "sm2Encrypt",
  label: "SM2 加解密",
  i18nKey: "tools.sm2Encrypt",
  description: "SM2 国密算法加密解密工具，支持 ASN.1 标准输出",
  badges: ["SM2", "加密", "ASN.1"],
  category: "Encryption_Tools",
  path: "/tools/sm2-encrypt",
  icon: "Lock",
  isNew: true,
},
sm2Sign: {
  key: "sm2Sign",
  label: "SM2 签名验签",
  i18nKey: "tools.sm2Sign",
  description: "SM2 国密算法签名验签工具，支持 P1/P7 格式",
  badges: ["SM2", "签名", "P1", "P7"],
  category: "Encryption_Tools",
  path: "/tools/sm2-sign",
  icon: "FileSignature",
  isNew: true,
},
```

### 7.2 路由配置

- `/tools/sm2-encrypt` → `Sm2Encrypt/index.vue`
- `/tools/sm2-sign` → `Sm2Sign/index.vue`
- `/tools/sm2-tool` → 保留或重定向到新页面

## 八、开发注意事项

### 8.1 代码规范
- 使用 TypeScript 严格模式
- 所有函数添加 JSDoc 注释
- 遵循项目现有的代码风格

### 8.2 性能优化
- 大文件加密使用 Web Worker
- ASN.1 编解码结果缓存
- 避免不必要的重复计算

### 8.3 安全性
- 私钥不存储到 localStorage
- 敏感数据及时清理
- 输入验证和错误处理完善

### 8.4 可维护性
- 模块化设计，职责清晰
- 共享代码抽取到 utils
- 完善的单元测试和文档

## 九、时间规划

| 阶段 | 预计时间 | 交付物 |
|------|----------|--------|
| 第1阶段 | 2-3 天 | 两个独立页面，基础功能可用 |
| 第2阶段 | 3-5 天 | ASN.1 编解码，互操作测试通过 |
| 第3阶段 | 5-7 天 | P7 完整支持（可选） |

## 十、参考资料

- GMT 0010-2012 SM2 密码算法加密签名消息语法规范
- [asn1js 文档](https://github.com/PeculiarVentures/ASN1.js)
- [PKI.js 文档](https://github.com/PeculiarVentures/PKI.js)
- [sm-crypto 库](https://github.com/JuneAndGreen/sm-crypto)
- gmssl 命令行工具文档

---

**文档版本**：v1.0
**创建日期**：2024-12-01
**最后更新**：2024-12-01
**审核状态**：Codex 已审核通过 ✅
