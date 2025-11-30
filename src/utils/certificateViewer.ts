import * as forge from 'node-forge';
import { STANDARD_OID_NAMES, INDUSTRY_OID_MAPS, type IndustryType } from './certificateOids';

export interface CertificateInfo {
  version: string;
  serialNumber: string;
  signatureAlgorithm: string;
  issuer: Record<string, string>;
  subject: Record<string, string>;
  validFrom: string;
  validTo: string;
  publicKey: {
    algorithm: string;
    size: string;
    exponent?: string;
    modulus?: string;
    curve?: string;
    publicKey?: string;  // 用于 SM2 等椭圆曲线公钥
    [key: string]: any;  // 允许其他字段
  };
  extensions: Array<{
    name: string;
    critical: boolean;
    value: string;
  }>;
  fingerprints: {
    sha1: string;
    sha256: string;
    md5: string;
  };
  raw: {
    pem: string;
    der: string;
  };
}

// OID 映射逻辑：优先使用行业映射，如果未找到则使用标准映射
function getOidName(oid: string, industry: IndustryType = 'standard'): string {
  const industryMap = INDUSTRY_OID_MAPS[industry];
  if (industryMap && industryMap[oid]) {
    return industryMap[oid];
  }
  return STANDARD_OID_NAMES[oid] || oid;
}

// 解析输入的证书（支持多种格式）
export function parseCertificate(input: string, industry: IndustryType = 'standard'): CertificateInfo {
  let der: string;
  let asn1: forge.asn1.Asn1;

  try {
    // 尝试 PEM 格式
    if (input.includes('-----BEGIN CERTIFICATE-----')) {
      const base64 = input
        .replace(/-----BEGIN CERTIFICATE-----/g, '')
        .replace(/-----END CERTIFICATE-----/g, '')
        .replace(/\s/g, '');
      der = forge.util.decode64(base64);
    }
    // 尝试 Base64 格式（无 PEM 头尾）
    else if (/^[A-Za-z0-9+/=\s]+$/.test(input.trim())) {
      const base64 = input.replace(/\s/g, '');
      der = forge.util.decode64(base64);
    }
    // 尝试 HEX 格式
    else if (/^[0-9A-Fa-f\s]+$/.test(input.trim())) {
      const hex = input.replace(/\s/g, '');
      der = forge.util.hexToBytes(hex);
    } else {
      throw new Error('无法识别的证书格式。请输入 PEM、Base64 或 HEX 格式的证书');
    }

    asn1 = forge.asn1.fromDer(der);

    // 尝试使用 forge 解析
    let cert: forge.pki.Certificate | null = null;
    try {
      cert = forge.pki.certificateFromAsn1(asn1);
      return extractCertificateInfo(cert, asn1, industry);
    } catch (forgeError: any) {
      // 如果 forge 解析失败（例如国密证书），使用自定义解析
      if (forgeError.message?.includes('Cannot read public key') ||
        forgeError.message?.includes('OID is not RSA')) {
        return extractCertificateInfoFromAsn1(asn1, der, industry);
      }
      throw forgeError;
    }
  } catch (error: any) {
    throw new Error(`证书解析失败: ${error.message}`);
  }
}

// 从文件解析证书
// 兼容：PEM / Base64 / HEX 文本证书，以及二进制 DER 证书（无论后缀是 .der 还是 .cer/.crt 等）
export async function parseCertificateFromFile(file: File, industry: IndustryType = 'standard'): Promise<CertificateInfo> {
  try {
    // 优先按文本读取，便于处理 PEM / Base64 / HEX / 文本 DER（极少见）
    const text = await file.text();

    // 如果内容看起来像二进制（包含较多不可打印字符），则按二进制 DER 处理
    if (isBinaryContent(text)) {
      const arrayBuffer = await file.arrayBuffer();
      const base64 = arrayBufferToBase64(arrayBuffer);
      return parseCertificate(base64, industry);
    }

    // 否则当作普通文本输入，交给 parseCertificate 识别 PEM / Base64 / HEX
    return parseCertificate(text, industry);
  } catch (error: any) {
    // 如果按文本读取或解析失败，再尝试纯二进制方式，作为兜底
    try {
      const arrayBuffer = await file.arrayBuffer();
      const base64 = arrayBufferToBase64(arrayBuffer);
      return parseCertificate(base64, industry);
    } catch (binaryError: any) {
      throw new Error(`证书文件解析失败: ${binaryError.message}`);
    }
  }
}

// 简单判断内容是否为“二进制”为主（参考 certificate-encoding-converter 的实现）
function isBinaryContent(text: string): boolean {
  if (!text) return false;
  let nonPrintableCount = 0;

  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    // 排除常见的控制字符：\t \n \r
    if (code < 32 && code !== 9 && code !== 10 && code !== 13) {
      nonPrintableCount++;
    }
  }

  return nonPrintableCount > text.length * 0.1;
}

// ArrayBuffer 转 Base64（与 certificate-encoding-converter 中逻辑一致）
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

// 从 ASN.1 直接提取证书信息（用于国密等不被 forge 完全支持的证书）
function extractCertificateInfoFromAsn1(asn1: forge.asn1.Asn1, der: string, industry: IndustryType): CertificateInfo {
  try {
    // TBSCertificate 在第一个 SEQUENCE 中
    const tbsCertificate = (asn1 as any).value[0];
    const extensions: CertificateInfo['extensions'] = [];

    // 版本（可选，默认为 v1）
    let version = 0;
    let currentIndex = 0;
    if (tbsCertificate.value[0].tagClass === forge.asn1.Class.CONTEXT_SPECIFIC) {
      version = tbsCertificate.value[0].value[0].value.charCodeAt(0);
      currentIndex = 1;
    }

    // 序列号
    const serialNumber = forge.util.bytesToHex(tbsCertificate.value[currentIndex].value).toUpperCase();
    currentIndex++;

    // 签名算法
    const signatureAlg = tbsCertificate.value[currentIndex];
    const signatureOid = forge.asn1.derToOid(signatureAlg.value[0].value);
    const signatureAlgorithm = getOidName(signatureOid, industry);
    currentIndex++;

    // 颁发者
    const issuerAsn1 = tbsCertificate.value[currentIndex];
    const issuer = parseDistinguishedNameFromAsn1(issuerAsn1, industry, (name, value) => {
      extensions.push({ name, critical: false, value });
    });
    currentIndex++;

    // 有效期
    const validity = tbsCertificate.value[currentIndex];
    const validFrom = parseAsn1Time(validity.value[0]).toISOString();
    const validTo = parseAsn1Time(validity.value[1]).toISOString();
    currentIndex++;

    // 使用者
    const subjectAsn1 = tbsCertificate.value[currentIndex];
    const subject = parseDistinguishedNameFromAsn1(subjectAsn1, industry, (name, value) => {
      extensions.push({ name, critical: false, value });
    });
    currentIndex++;

    // 公钥信息
    const publicKeyInfo = tbsCertificate.value[currentIndex];
    const publicKey = parsePublicKeyFromAsn1(publicKeyInfo, industry);
    currentIndex++;

    // 扩展（可选）
    // extensions 已在函数开头初始化
    if (currentIndex < tbsCertificate.value.length) {
      const extField = tbsCertificate.value[currentIndex];
      if (extField.tagClass === forge.asn1.Class.CONTEXT_SPECIFIC && extField.type === 3) {
        const extsSeq = extField.value[0];
        if (extsSeq.value) {
          for (const ext of extsSeq.value) {
            try {
              const extOid = forge.asn1.derToOid(ext.value[0].value);
              const extName = getExtensionName(extOid, industry);
              const critical = ext.value.length > 2 && ext.value[1].value[0] === 0xff;
              const valueIndex = critical ? 2 : 1;

              // 解析扩展值
              const extValueOctetString = ext.value[valueIndex];
              const extValue = parseExtensionValue(extOid, extName, extValueOctetString, industry);

              extensions.push({
                name: extName,
                critical,
                value: extValue,
              });
            } catch (e) {
              // 忽略无法解析的扩展
            }
          }
        }
      }
    }

    // 计算指纹
    const fingerprints = calculateFingerprintsFromDer(der);

    // 生成 PEM
    const pem = `-----BEGIN CERTIFICATE-----\n${forge.util.encode64(der).match(/.{1,64}/g)?.join('\n')}\n-----END CERTIFICATE-----`;
    const derHex = forge.util.bytesToHex(der).toUpperCase();

    return {
      version: `V${version + 1}`,
      serialNumber,
      signatureAlgorithm,
      issuer,
      subject,
      validFrom,
      validTo,
      publicKey,
      extensions,
      fingerprints,
      raw: {
        pem,
        der: derHex,
      },
    };
  } catch (error: any) {
    throw new Error(`ASN.1 解析失败: ${error.message}`);
  }
}

// DN OID 到短名称的映射（用于 UI 绑定）
const DN_OID_SHORT_NAMES: Record<string, string> = {
  '2.5.4.3': 'CN',
  '2.5.4.6': 'C',
  '2.5.4.7': 'L',
  '2.5.4.8': 'ST',
  '2.5.4.10': 'O',
  '2.5.4.11': 'OU',
  '2.5.4.9': 'STREET',
  '2.5.4.5': 'SERIALNUMBER',
  '1.2.840.113549.1.9.1': 'E',
};

// 从 ASN.1 解析 Distinguished Name
function parseDistinguishedNameFromAsn1(
  dnAsn1: forge.asn1.Asn1,
  industry: IndustryType,
  onIndustryOid?: (name: string, value: string) => void
): Record<string, string> {
  const result: Record<string, string> = {};
  try {
    for (const rdn of (dnAsn1 as any).value) {
      for (const atv of rdn.value) {
        const oid = forge.asn1.derToOid(atv.value[0].value);
        let value = atv.value[1].value;

        // 尝试将字节字符串解码为 UTF-8
        try {
          // 检测是否包含 UTF-8 多字节字符（首字节 >= 0xC0）
          let hasMultibyte = false;
          for (let i = 0; i < value.length; i++) {
            if (value.charCodeAt(i) >= 192) {
              hasMultibyte = true;
              break;
            }
          }

          if (hasMultibyte) {
            // 将字符串转换为 UTF-8 字节数组
            const bytes = new Uint8Array(value.length);
            for (let i = 0; i < value.length; i++) {
              bytes[i] = value.charCodeAt(i);
            }
            // 使用 TextDecoder 解码 UTF-8
            const decoder = new TextDecoder('utf-8');
            value = decoder.decode(bytes);
          }
        } catch (decodeError) {
          // 如果解码失败，保持原值
        }

        let name = DN_OID_SHORT_NAMES[oid];
        if (!name) {
          name = getOidName(oid, industry);
        }
        result[name] = value;

        // 如果是行业特定的 OID，触发回调
        if (onIndustryOid && INDUSTRY_OID_MAPS[industry]?.[oid]) {
          onIndustryOid(name, value);
        }
      }
    }
  } catch (e) {
    // 忽略错误
  }

  return result;
}

// 解析 ASN.1 时间
function parseAsn1Time(timeAsn1: forge.asn1.Asn1): Date {
  const timeStr = (timeAsn1 as any).value;

  // UTCTime (YYMMDDHHMMSSZ) or GeneralizedTime (YYYYMMDDHHMMSSZ)
  if (timeStr.length === 13) {
    // UTCTime
    const year = parseInt(timeStr.substring(0, 2), 10);
    const fullYear = year >= 50 ? 1900 + year : 2000 + year;
    const month = parseInt(timeStr.substring(2, 4), 10) - 1;
    const day = parseInt(timeStr.substring(4, 6), 10);
    const hour = parseInt(timeStr.substring(6, 8), 10);
    const minute = parseInt(timeStr.substring(8, 10), 10);
    const second = parseInt(timeStr.substring(10, 12), 10);
    return new Date(Date.UTC(fullYear, month, day, hour, minute, second));
  } else if (timeStr.length === 15) {
    // GeneralizedTime
    const year = parseInt(timeStr.substring(0, 4), 10);
    const month = parseInt(timeStr.substring(4, 6), 10) - 1;
    const day = parseInt(timeStr.substring(6, 8), 10);
    const hour = parseInt(timeStr.substring(8, 10), 10);
    const minute = parseInt(timeStr.substring(10, 12), 10);
    const second = parseInt(timeStr.substring(12, 14), 10);
    return new Date(Date.UTC(year, month, day, hour, minute, second));
  }

  return new Date();
}

// 从 ASN.1 解析公钥信息
function parsePublicKeyFromAsn1(publicKeyInfoAsn1: forge.asn1.Asn1, industry: IndustryType): CertificateInfo['publicKey'] {
  try {
    const algorithm = (publicKeyInfoAsn1 as any).value[0];
    const oid = forge.asn1.derToOid(algorithm.value[0].value);
    const algorithmName = getOidName(oid, industry);

    const publicKeyBits = (publicKeyInfoAsn1 as any).value[1];
    const publicKeyBytes = publicKeyBits.value;

    let size = 'Unknown';
    let keyDetails: any = {};

    // 尝试解析公钥详情
    try {
      if (oid === '1.2.156.10197.1.301') {
        // SM2 公钥
        size = '256 位';
        keyDetails.curve = 'SM2';
        // SM2 公钥是 64 字节的未压缩点（04 + X + Y）
        if (publicKeyBytes.length >= 65) {
          keyDetails.publicKey = formatHex(publicKeyBytes);
        }
      } else if (oid === '1.2.840.10045.2.1') {
        // EC 公钥
        const curveOid = algorithm.value.length > 1 ? forge.asn1.derToOid(algorithm.value[1].value) : '';
        keyDetails.curve = getCurveName(curveOid);
        size = getCurveSize(curveOid);
        // 解析公钥数据
        if (publicKeyBytes.length > 0) {
          keyDetails.publicKey = formatHex(publicKeyBytes);
        }
      }
    } catch (e) {
      // 忽略解析错误
    }

    return {
      algorithm: algorithmName,
      size,
      ...keyDetails,
    };
  } catch (error) {
    return {
      algorithm: '未知',
      size: '未知',
    };
  }
}

// 格式化十六进制（使用空格分隔，每两个字符一组）
function formatHex(bytes: string): string {
  const hex = forge.util.bytesToHex(bytes).toUpperCase();
  return hex.match(/.{2}/g)?.join(' ') || '';
}

// 格式化已有的十六进制字符串（添加空格分隔）
function formatHexString(hexStr: string): string {
  // 移除所有空格、冒号等分隔符
  const cleanHex = hexStr.replace(/[\s:]/g, '').toUpperCase();
  return cleanHex.match(/.{2}/g)?.join(' ') || '';
}

// 获取扩展名称
function getExtensionName(oid: string, industry: IndustryType): string {
  return getOidName(oid, industry);
}

// 解析扩展值
function parseExtensionValue(oid: string, _name: string, extValueAsn1: forge.asn1.Asn1, industry: IndustryType): string {
  try {
    // OCTET STRING 包含实际的扩展值
    const octets = (extValueAsn1 as any).value;

    // 尝试将 OCTET STRING 解析为 ASN.1
    let valueAsn1: forge.asn1.Asn1;
    try {
      valueAsn1 = forge.asn1.fromDer(octets);
    } catch (e) {
      // 如果无法解析为 ASN.1，返回十六进制
      return `OID: ${oid}\n十六进制: ${formatHex(octets)}`;
    }

    // 根据扩展类型解析
    switch (oid) {
      case '2.5.29.15': // keyUsage
        return parseKeyUsage(valueAsn1);

      case '2.5.29.19': // basicConstraints
        return parseBasicConstraints(valueAsn1);

      case '2.5.29.14': // subjectKeyIdentifier
        return parseKeyIdentifier(valueAsn1);

      case '2.5.29.35': // authorityKeyIdentifier
        return parseAuthorityKeyIdentifier(valueAsn1);

      case '2.5.29.17': // subjectAltName
        return parseSubjectAltName(valueAsn1);

      case '2.5.29.37': // extKeyUsage
        return parseExtKeyUsage(valueAsn1, industry);

      default:
        // 对于未知的扩展，尝试显示为字符串或十六进制
        const valueStr = formatAsn1Value(valueAsn1);
        return `OID: ${oid}\n${valueStr}`;
    }
  } catch (error) {
    return `OID: ${oid}\n解析错误: ${(error as Error).message}`;
  }
}

// 解析 keyUsage
function parseKeyUsage(asn1: forge.asn1.Asn1): string {
  try {
    const bitString = (asn1 as any).value;
    const usages = [];

    // KeyUsage BIT STRING 的每一位代表一个用途
    if (bitString.length > 0) {
      const byte1 = bitString.charCodeAt(0);
      if (byte1 & 0x80) usages.push('数字签名 (Digital Signature)');
      if (byte1 & 0x40) usages.push('不可否认性 (Non Repudiation)');
      if (byte1 & 0x20) usages.push('密钥加密 (Key Encipherment)');
      if (byte1 & 0x10) usages.push('数据加密 (Data Encipherment)');
      if (byte1 & 0x08) usages.push('密钥协商 (Key Agreement)');
      if (byte1 & 0x04) usages.push('证书签名 (Key Cert Sign)');
      if (byte1 & 0x02) usages.push('CRL 签名 (CRL Sign)');
      if (byte1 & 0x01) usages.push('仅加密 (Encipher Only)');
    }

    if (bitString.length > 1) {
      const byte2 = bitString.charCodeAt(1);
      if (byte2 & 0x80) usages.push('仅解密 (Decipher Only)');
    }

    return usages.length > 0 ? usages.join('\n') : '未指定';
  } catch (e) {
    return '解析失败';
  }
}

// 解析 basicConstraints
function parseBasicConstraints(asn1: forge.asn1.Asn1): string {
  try {
    const seq = (asn1 as any).value;
    let isCA = false;
    let pathLen: number | undefined;

    if (seq && seq.length > 0) {
      // 第一个元素可能是 cA BOOLEAN
      if (seq[0].type === forge.asn1.Type.BOOLEAN) {
        isCA = seq[0].value.charCodeAt(0) !== 0;
      }
      // 第二个元素可能是 pathLenConstraint INTEGER
      if (seq.length > 1 && seq[1].type === forge.asn1.Type.INTEGER) {
        pathLen = parseInt(forge.util.bytesToHex(seq[1].value), 16);
      }
    }

    let result = `CA: ${isCA ? '是' : '否'}`;
    if (pathLen !== undefined) {
      result += `\n路径长度限制: ${pathLen}`;
    }
    return result;
  } catch (e) {
    return '解析失败';
  }
}

// 解析 subjectKeyIdentifier
function parseKeyIdentifier(asn1: forge.asn1.Asn1): string {
  try {
    const value = (asn1 as any).value;

    if (typeof value === 'string') {
      return formatHex(value);
    }

    if (Array.isArray(value) && value.length > 0) {
      return formatHex(value[0].value || value[0]);
    }

    return '无法解析该格式';
  } catch (e) {
    return `解析错误: ${(e as Error).message}`;
  }
}

// 解析 authorityKeyIdentifier
function parseAuthorityKeyIdentifier(asn1: forge.asn1.Asn1): string {
  try {
    const value = (asn1 as any).value;

    if (Array.isArray(value)) {
      const parts: string[] = [];

      for (const item of value) {
        const itemType = item.type;
        const itemValue = item.value;

        // keyIdentifier [0]
        if (itemType === 0x80 || itemType === 0) {
          parts.push(`Key ID: ${formatHex(itemValue)}`);
        }
        // authorityCertIssuer [1]
        else if (itemType === 0x81 || itemType === 1) {
          parts.push(`Issuer: [复杂结构]`);
        }
        // authorityCertSerialNumber [2]
        else if (itemType === 0x82 || itemType === 2) {
          parts.push(`Serial: ${formatHex(itemValue)}`);
        }
      }

      return parts.length > 0 ? parts.join('\n') : formatHex(value[0]?.value || '');
    }

    if (typeof value === 'string') {
      return formatHex(value);
    }

    return '无法解析该格式';
  } catch (e) {
    return `解析错误: ${(e as Error).message}`;
  }
}

// 解析 subjectAltName
function parseSubjectAltName(asn1: forge.asn1.Asn1): string {
  try {
    const altNames: string[] = [];
    const seq = (asn1 as any).value;

    if (seq) {
      for (const item of seq) {
        const type = item.type;
        const value = item.value;

        switch (type) {
          case 0x82: // dNSName [2]
            altNames.push(`DNS: ${value}`);
            break;
          case 0x87: // iPAddress [7]
            if (value.length === 4) {
              const ip = Array.from(value).map((b: any) => b.charCodeAt(0)).join('.');
              altNames.push(`IP: ${ip}`);
            } else if (value.length === 16) {
              // IPv6
              altNames.push(`IP: [IPv6]`);
            }
            break;
          case 0x86: // uniformResourceIdentifier [6]
            altNames.push(`URI: ${value}`);
            break;
          default:
            altNames.push(`Type ${type}: ${value}`);
        }
      }
    }

    return altNames.length > 0 ? altNames.join('\n') : '无';
  } catch (e) {
    return '解析失败';
  }
}

// 解析 extKeyUsage
function parseExtKeyUsage(asn1: forge.asn1.Asn1, industry: IndustryType): string {
  try {
    const usages: string[] = [];
    const seq = (asn1 as any).value;

    if (seq) {
      for (const item of seq) {
        const oid = forge.asn1.derToOid(item.value);
        usages.push(getOidName(oid, industry));
      }
    }

    return usages.length > 0 ? usages.join('\n') : '未指定';
  } catch (e) {
    return '解析失败';
  }
}

// 格式化 ASN.1 值（通用）
function formatAsn1Value(asn1: forge.asn1.Asn1): string {
  try {
    const type = (asn1 as any).type;
    const value = (asn1 as any).value;

    if (type === forge.asn1.Type.SEQUENCE && Array.isArray(value)) {
      const items: string[] = [];
      for (let i = 0; i < Math.min(value.length, 10); i++) {
        const item = value[i];
        const itemType = item.type;
        const itemValue = item.value;

        if (itemType === forge.asn1.Type.PRINTABLESTRING ||
          itemType === forge.asn1.Type.UTF8 ||
          itemType === forge.asn1.Type.IA5STRING) {
          items.push(`[${i}] 字符串: ${itemValue}`);
        } else if (itemType === forge.asn1.Type.INTEGER) {
          items.push(`[${i}] 整数: ${formatHex(itemValue)}`);
        } else if (itemType === forge.asn1.Type.OCTETSTRING) {
          items.push(`[${i}] 八位组: ${formatHex(itemValue)}`);
        } else if (itemType === forge.asn1.Type.OID) {
          try {
            const oid = forge.asn1.derToOid(itemValue);
            items.push(`[${i}] OID: ${oid}`);
          } catch (e) {
            items.push(`[${i}] OID: 无法解析`);
          }
        } else {
          items.push(`[${i}] 类型 ${itemType}`);
        }
      }

      if (value.length > 10) {
        items.push('...(更多项目)');
      }

      return items.length > 0 ? items.join('\n') : `SEQUENCE (${value.length} 项)`;
    } else if (type === forge.asn1.Type.OCTETSTRING) {
      return `十六进制: ${formatHex(value)}`;
    } else if (type === forge.asn1.Type.PRINTABLESTRING ||
      type === forge.asn1.Type.UTF8 ||
      type === forge.asn1.Type.IA5STRING) {
      return `字符串: ${value}`;
    } else if (type === forge.asn1.Type.INTEGER) {
      return `整数: ${formatHex(value)}`;
    } else if (type === forge.asn1.Type.BOOLEAN) {
      return `布尔: ${value.charCodeAt(0) !== 0}`;
    } else if (type === forge.asn1.Type.OID) {
      try {
        const oid = forge.asn1.derToOid(value);
        return `OID: ${oid}`;
      } catch (e) {
        return `OID: 无法解析`;
      }
    } else {
      return `类型 ${type}: ${formatHex(value)}`;
    }
  } catch (e) {
    return '无法格式化';
  }
}

// 获取曲线名称
function getCurveName(oid: string): string {
  const curves: Record<string, string> = {
    '1.2.840.10045.3.1.7': 'P-256 (secp256r1)',
    '1.3.132.0.34': 'P-384 (secp384r1)',
    '1.3.132.0.35': 'P-521 (secp521r1)',
    '1.2.156.10197.1.301': 'SM2',
  };
  return curves[oid] || oid;
}

// 获取曲线大小
function getCurveSize(oid: string): string {
  const sizes: Record<string, string> = {
    '1.2.840.10045.3.1.7': '256 位',
    '1.3.132.0.34': '384 位',
    '1.3.132.0.35': '521 位',
    '1.2.156.10197.1.301': '256 位',
  };
  return sizes[oid] || '未知';
}

// 从 DER 计算指纹
function calculateFingerprintsFromDer(der: string) {
  const md5 = forge.md.md5.create();
  md5.update(der);

  const sha1 = forge.md.sha1.create();
  sha1.update(der);

  const sha256 = forge.md.sha256.create();
  sha256.update(der);

  return {
    md5: formatHex(md5.digest().getBytes()),
    sha1: formatHex(sha1.digest().getBytes()),
    sha256: formatHex(sha256.digest().getBytes()),
  };
}

// 提取证书详细信息（标准 RSA 证书）
function extractCertificateInfo(cert: forge.pki.Certificate, _asn1?: forge.asn1.Asn1, industry: IndustryType = 'standard'): CertificateInfo {
  // 解析 Distinguished Name
  const parseDistinguishedName = (name: forge.pki.CertificateField[]): Record<string, string> => {
    const result: Record<string, string> = {};
    name.forEach((attr) => {
      const shortName = attr.shortName || attr.name;
      let value = attr.value;

      // 尝试将字节字符串解码为 UTF-8（如果需要）
      try {
        if (typeof value === 'string') {
          let hasMultibyte = false;
          for (let i = 0; i < value.length; i++) {
            if (value.charCodeAt(i) >= 192) {
              hasMultibyte = true;
              break;
            }
          }

          if (hasMultibyte) {
            const bytes = new Uint8Array(value.length);
            for (let i = 0; i < value.length; i++) {
              bytes[i] = value.charCodeAt(i);
            }
            const decoder = new TextDecoder('utf-8');
            value = decoder.decode(bytes);
          }
        }
      } catch (decodeError) {
        // 如果解码失败，保持原值
      }

      result[shortName] = value;
    });
    return result;
  };

  // 解析公钥
  const parsePublicKey = (publicKey: forge.pki.PublicKey, cert: forge.pki.Certificate) => {
    const keyInfo: CertificateInfo['publicKey'] = {
      algorithm: '',
      size: '',
    };

    try {
      if ('n' in publicKey && 'e' in publicKey) {
        // RSA 密钥
        keyInfo.algorithm = 'RSA';
        keyInfo.size = `${(publicKey as forge.pki.rsa.PublicKey).n.bitLength()} 位`;
        keyInfo.exponent = (publicKey as forge.pki.rsa.PublicKey).e.toString(10);
        const modulusHex = (publicKey as forge.pki.rsa.PublicKey).n.toString(16).toUpperCase();
        keyInfo.modulus = formatHexString(modulusHex);
      } else {
        // 其他类型（EC、SM2 等）
        // 尝试从证书 ASN.1 中提取
        const oid = (cert as any).publicKey?.oid || (publicKey as any).oid;
        if (oid) {
          keyInfo.algorithm = getOidName(oid, industry);
        } else {
          keyInfo.algorithm = '未知';
        }
        keyInfo.size = '未知';
      }
    } catch (error) {
      keyInfo.algorithm = '未知';
      keyInfo.size = '未知';
    }

    return keyInfo;
  };

  // 解析扩展
  const parseExtensions = (extensions: any[]): CertificateInfo['extensions'] => {
    return extensions.map((ext) => {
      let value = '';

      try {
        if (ext.name === 'subjectAltName') {
          const altNames = (ext as any).altNames || [];
          value = altNames.map((altName: any) => {
            if (altName.type === 2) return `DNS: ${altName.value}`;
            if (altName.type === 7) return `IP: ${altName.ip}`;
            if (altName.type === 6) return `URI: ${altName.value}`;
            return `${altName.type}: ${altName.value}`;
          }).join('\n');
        } else if (ext.name === 'keyUsage') {
          const keyUsage = ext as any;
          const usages = [];
          if (keyUsage.digitalSignature) usages.push('数字签名');
          if (keyUsage.nonRepudiation) usages.push('不可否认性');
          if (keyUsage.keyEncipherment) usages.push('密钥加密');
          if (keyUsage.dataEncipherment) usages.push('数据加密');
          if (keyUsage.keyAgreement) usages.push('密钥协商');
          if (keyUsage.keyCertSign) usages.push('证书签名');
          if (keyUsage.cRLSign) usages.push('CRL 签名');
          if (keyUsage.encipherOnly) usages.push('仅加密');
          if (keyUsage.decipherOnly) usages.push('仅解密');
          value = usages.join(', ');
        } else if (ext.name === 'extKeyUsage') {
          const extKeyUsage = (ext as any);
          const usages = [];
          if (extKeyUsage.serverAuth) usages.push('服务器身份验证');
          if (extKeyUsage.clientAuth) usages.push('客户端身份验证');
          if (extKeyUsage.codeSigning) usages.push('代码签名');
          if (extKeyUsage.emailProtection) usages.push('电子邮件保护');
          if (extKeyUsage.timeStamping) usages.push('时间戳');
          value = usages.join(', ');
        } else if (ext.name === 'basicConstraints') {
          const bc = ext as any;
          value = `CA: ${bc.cA ? '是' : '否'}`;
          if (bc.pathLenConstraint !== undefined) {
            value += `, 路径长度: ${bc.pathLenConstraint}`;
          }
        } else if (ext.name === 'subjectKeyIdentifier') {
          value = (ext as any).subjectKeyIdentifier || '';
        } else if (ext.name === 'authorityKeyIdentifier') {
          value = (ext as any).keyIdentifier || '';
        } else {
          value = JSON.stringify(ext, null, 2);
        }
      } catch (e) {
        value = ext.value || JSON.stringify(ext);
      }

      const oid = ext.id;
      let name = ext.name;

      // 优先使用行业映射的名称
      if (oid && INDUSTRY_OID_MAPS[industry]?.[oid]) {
        name = INDUSTRY_OID_MAPS[industry][oid];
      } else if (!name && oid) {
        name = getOidName(oid, industry);
      } else if (!name) {
        name = 'Unknown';
      }

      return {
        name,
        critical: ext.critical || false,
        value,
      };
    });
  };

  // 计算指纹
  const calculateFingerprints = (cert: forge.pki.Certificate) => {
    const der = forge.asn1.toDer(forge.pki.certificateToAsn1(cert)).getBytes();

    const md5 = forge.md.md5.create();
    md5.update(der);

    const sha1 = forge.md.sha1.create();
    sha1.update(der);

    const sha256 = forge.md.sha256.create();
    sha256.update(der);

    return {
      md5: formatHex(md5.digest().getBytes()),
      sha1: formatHex(sha1.digest().getBytes()),
      sha256: formatHex(sha256.digest().getBytes()),
    };
  };

  // 获取原始格式
  const getRawFormats = (cert: forge.pki.Certificate) => {
    const pem = forge.pki.certificateToPem(cert);
    const asn1 = forge.pki.certificateToAsn1(cert);
    const der = forge.asn1.toDer(asn1).getBytes();
    const derHex = forge.util.bytesToHex(der).toUpperCase();

    return {
      pem,
      der: derHex,
    };
  };

  const issuer = parseDistinguishedName(cert.issuer.attributes);
  const subject = parseDistinguishedName(cert.subject.attributes);
  const publicKey = parsePublicKey(cert.publicKey, cert);
  const extensions = parseExtensions(cert.extensions || []);

  // 扫描 Subject 和 Issuer 中的行业特定 OID，并添加到扩展列表中
  const industryMap = INDUSTRY_OID_MAPS[industry];
  if (industry && industry !== 'standard' && industryMap) {
    const addIndustryOids = (attrs: forge.pki.CertificateField[]) => {
      if (!attrs) return;
      attrs.forEach((attr) => {
        const oid = attr.type;
        if (oid && industryMap[oid]) {
          let value = attr.value;
          // 尝试解码值（与 parseDistinguishedName 逻辑一致）
          try {
            if (typeof value === 'string') {
              let hasMultibyte = false;
              for (let i = 0; i < value.length; i++) {
                if (value.charCodeAt(i) >= 192) {
                  hasMultibyte = true;
                  break;
                }
              }
              if (hasMultibyte) {
                const bytes = new Uint8Array(value.length);
                for (let i = 0; i < value.length; i++) {
                  bytes[i] = value.charCodeAt(i);
                }
                const decoder = new TextDecoder('utf-8');
                value = decoder.decode(bytes);
              }
            }
          } catch (e) {
            // 忽略解码错误
          }

          extensions.push({
            name: industryMap[oid],
            critical: false,
            value: value as string,
          });
        }
      });
    };

    addIndustryOids(cert.subject.attributes);
    addIndustryOids(cert.issuer.attributes);
  }
  const fingerprints = calculateFingerprints(cert);
  const raw = getRawFormats(cert);

  // 获取签名算法名称
  const sigAlgOid = (cert as any).signatureOid || cert.siginfo?.algorithmOid || '未知';
  const signatureAlgorithm = getOidName(sigAlgOid, industry);

  return {
    version: `V${cert.version + 1}`,
    serialNumber: cert.serialNumber.toUpperCase(),
    signatureAlgorithm,
    issuer,
    subject,
    validFrom: cert.validity.notBefore.toISOString(),
    validTo: cert.validity.notAfter.toISOString(),
    publicKey,
    extensions,
    fingerprints,
    raw,
  };
}

// 格式化 Distinguished Name
export function formatDistinguishedName(dn: Record<string, string>): string {
  const order = ['CN', 'OU', 'O', 'L', 'ST', 'C'];
  const parts = [];

  for (const key of order) {
    if (dn[key]) {
      parts.push(`${key}=${dn[key]}`);
    }
  }

  // 添加其他字段
  for (const [key, value] of Object.entries(dn)) {
    if (!order.includes(key)) {
      parts.push(`${key}=${value}`);
    }
  }

  return parts.join(', ');
}
