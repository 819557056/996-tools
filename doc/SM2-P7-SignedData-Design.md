# SM2 P7 SignedData 实现设计

## 1. 概述

基于 GMT 0010-2012 第 8 章 SignedData 规范，实现 SM2 签名的 P7 (CMS/PKCS#7) 格式支持。

## 2. 实现级别

**选择 B- 级别**（标准子集，介于最小和完整之间）：

### 包含功能
- SignedData 结构，单个 SignerInfo
- contentType = data (1.2.840.113549.1.7.1)
- digestAlgorithm = SM3 (1.2.156.10197.1.401)
- digestEncryptionAlgorithm = SM2-with-SM3 (1.2.156.10197.1.501)
- signedAttributes（必选）：
  - contentType (1.2.840.113549.1.9.3)
  - messageDigest (1.2.840.113549.1.9.4)
  - signingTime (1.2.840.113549.1.9.5) - 可选
- 可选单个证书嵌入（不含证书链）
- 支持 attached 和 detached 模式

### 不包含（首版）
- CRL
- 多签名者
- 复杂的 unauthenticatedAttributes
- 证书链验证

## 3. 技术栈

- **PKI.js** + **asn1js**：标准 CMS 库，避免手工构造
- **sm-crypto**：SM2/SM3 底层算法
- **x509**：证书解析（如需要）

## 4. 数据结构

### SignedData 结构（GMT 0010-2012）

```asn1
SignedData ::= SEQUENCE {
  version CMSVersion,
  digestAlgorithms DigestAlgorithmIdentifiers,
  encapContentInfo EncapsulatedContentInfo,
  certificates [0] IMPLICIT CertificateSet OPTIONAL,
  crls [1] IMPLICIT RevocationInfoChoices OPTIONAL,
  signerInfos SignerInfos
}

SignerInfo ::= SEQUENCE {
  version CMSVersion,
  sid SignerIdentifier,
  digestAlgorithm DigestAlgorithmIdentifier,
  signedAttrs [0] IMPLICIT SignedAttributes OPTIONAL,
  signatureAlgorithm SignatureAlgorithmIdentifier,
  signature SignatureValue,
  unsignedAttrs [1] IMPLICIT UnsignedAttributes OPTIONAL
}

SignerIdentifier ::= CHOICE {
  issuerAndSerialNumber IssuerAndSerialNumber,
  subjectKeyIdentifier [0] SubjectKeyIdentifier
}
```

## 5. 核心流程

### 5.1 签名生成流程

```
1. 解析输入
   - 原始消息（明文）
   - 私钥（Hex）
   - 证书（可选，PEM 格式）
   - 模式（attached/detached）

2. 构造 signedAttributes
   - contentType = data
   - messageDigest = SM3(原始消息)
   - signingTime = 当前时间（可选）
   - DER 编码并规范化

3. 计算签名
   - 对 signedAttributes 的 DER 编码计算 SM3 摘要
   - 使用 SM2 私钥签名摘要
   - 签名值转换为 ASN.1 格式（P1）

4. 构造 SignedData
   - version = 1
   - digestAlgorithms = [SM3]
   - encapContentInfo:
     - contentType = data
     - content = 原始消息（attached）或 absent（detached）
   - certificates = [证书]（如果提供）
   - signerInfos = [SignerInfo]

5. 输出
   - DER Hex
   - PEM 格式（BEGIN PKCS7）
```

### 5.2 验签流程

```
1. 解析 P7 结构
   - 提取 SignedData
   - 提取 SignerInfo
   - 提取 signedAttributes

2. 验证 signedAttributes
   - 检查必选属性（contentType, messageDigest）
   - 提取 messageDigest 值

3. 获取原始消息
   - attached 模式：从 encapContentInfo.content 提取
   - detached 模式：用户单独提供

4. 验证摘要
   - 计算原始消息的 SM3 摘要
   - 与 signedAttributes 中的 messageDigest 比对

5. 验证签名
   - 对 signedAttributes 的 DER 编码计算 SM3 摘要
   - 使用公钥验证签名
   - 公钥来源：证书（如嵌入）或用户提供

6. 输出验证结果
```

## 6. 模块设计

### 6.1 文件结构

```
src/utils/crypto/asn1/
  ├── oid.ts              # 已存在，补充 CMS OID
  ├── sm2.ts              # 已存在，P1 格式
  └── signed-data.ts      # 新增，P7 SignedData
```

### 6.2 signed-data.ts 接口

```typescript
export interface P7SignOptions {
  message: string;              // 原始消息
  privateKey: string;           // SM2 私钥（Hex）
  certificate?: string;         // 证书（PEM），可选
  mode: 'attached' | 'detached'; // 模式
  includeSigningTime?: boolean; // 是否包含签名时间
}

export interface P7VerifyOptions {
  p7Der: Uint8Array;            // P7 DER 编码
  message?: string;             // detached 模式需要
  publicKey?: string;           // 如果 P7 中无证书，需提供
}

export interface P7VerifyResult {
  valid: boolean;
  signerCert?: Certificate;     // 签名者证书（如有）
  signingTime?: Date;           // 签名时间（如有）
  error?: string;
}

// 主要函数
export function generateP7SignedData(options: P7SignOptions): Uint8Array;
export function verifyP7SignedData(options: P7VerifyOptions): P7VerifyResult;
export function p7DerToPem(der: Uint8Array): string;
export function p7PemToDer(pem: string): Uint8Array;
```

## 7. UI 设计

### 7.1 签名格式选择器扩展

```
当前：[ Hex (原始格式) ] [ ASN.1 DER (P1) ]
扩展：[ Hex (原始格式) ] [ ASN.1 DER (P1) ] [ P7 SignedData ]
```

### 7.2 P7 高级配置（展开式）

当选择 P7 格式时，显示额外配置：

```
┌─ P7 高级配置 ────────────────────────┐
│ 模式：                                │
│   ○ Attached（消息嵌入）              │
│   ○ Detached（消息分离）              │
│                                       │
│ 证书（可选）：                        │
│   [上传 PEM 文件] 或 [粘贴 PEM 文本]  │
│   ┌─────────────────────────────┐    │
│   │ -----BEGIN CERTIFICATE----- │    │
│   │ ...                         │    │
│   └─────────────────────────────┘    │
│                                       │
│ ☑ 包含签名时间                        │
│                                       │
│ 输出格式：                            │
│   ○ DER Hex                           │
│   ○ PEM (PKCS#7)                      │
└───────────────────────────────────────┘
```

### 7.3 验签区扩展

```
┌─ 验签输入 ────────────────────────────┐
│ 签名格式：自动检测                    │
│   检测结果：P7 SignedData (Attached)  │
│                                       │
│ 如果是 Detached 模式：                │
│   原始消息：[输入框]                  │
│                                       │
│ 公钥/证书：                           │
│   ○ 从 P7 中提取（如有嵌入证书）      │
│   ○ 手动提供公钥（Hex）               │
└───────────────────────────────────────┘

┌─ 验签结果 ────────────────────────────┐
│ ✓ 验证通过                            │
│                                       │
│ 签名者信息：                          │
│   CN: Test User                       │
│   Issuer: Test CA                     │
│   Serial: 1234567890                  │
│                                       │
│ 签名时间：2024-01-15 10:30:45         │
└───────────────────────────────────────┘
```

## 8. 关键技术点

### 8.1 signedAttributes DER 规范化

```typescript
// signedAttributes 必须使用 SET OF 的 DER 编码规则
// 1. 每个 Attribute 按 DER 编码
// 2. SET OF 中的元素按字典序排序
// 3. 签名时使用 0xA0 标签（[0] IMPLICIT）
```

### 8.2 SM2 签名值格式转换

```typescript
// sm-crypto 返回：r||s (128 hex chars)
// P7 需要：SEQUENCE { r INTEGER, s INTEGER } (P1 格式)
// 使用已有的 encodeSm2SignatureDer 函数
```

### 8.3 证书解析

```typescript
// 使用 PKI.js 的 Certificate 类
import { Certificate } from 'pkijs';

function parseCertificate(pem: string): Certificate {
  const der = pemToDer(pem);
  return Certificate.fromBER(der);
}

// 提取 issuerAndSerialNumber
function getIssuerAndSerialNumber(cert: Certificate) {
  return {
    issuer: cert.issuer,
    serialNumber: cert.serialNumber
  };
}
```

## 9. 测试用例

### 9.1 签名测试

```typescript
// Test 1: Attached 模式，无证书
const p7 = generateP7SignedData({
  message: "Hello SM2",
  privateKey: "...",
  mode: 'attached'
});

// Test 2: Detached 模式，含证书
const p7 = generateP7SignedData({
  message: "Hello SM2",
  privateKey: "...",
  certificate: "-----BEGIN CERTIFICATE-----...",
  mode: 'detached',
  includeSigningTime: true
});
```

### 9.2 验签测试

```typescript
// Test 1: Attached 模式，从 P7 提取消息和证书
const result = verifyP7SignedData({
  p7Der: p7Bytes
});

// Test 2: Detached 模式，手动提供消息和公钥
const result = verifyP7SignedData({
  p7Der: p7Bytes,
  message: "Hello SM2",
  publicKey: "04..."
});
```

## 10. 互操作性

### 10.1 与 gmssl 互操作

```bash
# 使用 gmssl 验证生成的 P7
echo "Hello SM2" | gmssl cms -verify -in signed.p7 -inform DER -CAfile ca.pem

# 使用工具验证 gmssl 生成的 P7
gmssl cms -sign -in message.txt -signer cert.pem -inkey key.pem -out signed.p7 -outform DER
```

### 10.2 OID 兼容性

确保使用正确的国密 OID：
- SM2: 1.2.156.10197.1.301
- SM3: 1.2.156.10197.1.401
- SM2-with-SM3: 1.2.156.10197.1.501

## 11. 实施步骤

1. **补充 OID 定义**（oid.ts）
2. **实现 signed-data.ts 核心模块**
3. **扩展 useSm2Sign.ts 逻辑**
4. **使用 Gemini 实现 UI 扩展**
5. **测试与调试**
6. **Codex Review**

## 12. 注意事项

- P7 结构复杂，首版聚焦核心功能
- 证书验证（链、有效期）暂不实现
- 错误处理要详细（解析失败、签名无效等）
- 性能考虑：大文件签名可能较慢
- 浏览器兼容性：确保 PKI.js 在目标浏览器正常工作
