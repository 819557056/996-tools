// Static OID snapshot from the original EsealTool DefaultOidRegistry; no runtime service or network lookup.
export const oidEntries = [
  {
    "oid": "1.2.156.10197.1.104",
    "name": "SM4",
    "description": "SM4 分组密码算法",
    "category": "国密算法 OID"
  },
  {
    "oid": "1.2.156.10197.1.301",
    "name": "SM2",
    "description": "SM2 椭圆曲线 / 加密算法 (sm2p256v1)",
    "category": "国密算法 OID"
  },
  {
    "oid": "1.2.156.10197.1.302",
    "name": "SM2-Signature",
    "description": "SM2 签名算法 (sm2sign)",
    "category": "国密算法 OID"
  },
  {
    "oid": "1.2.156.10197.1.401",
    "name": "SM3",
    "description": "SM3 密码杂凑算法",
    "category": "国密算法 OID"
  },
  {
    "oid": "1.2.156.10197.1.501",
    "name": "SM3withSM2",
    "description": "SM3 与 SM2 数字签名算法（证书签名算法）",
    "category": "国密算法 OID"
  },
  {
    "oid": "1.2.156.10197.1.504",
    "name": "SM9",
    "description": "SM9 标识密码算法",
    "category": "国密算法 OID"
  },
  {
    "oid": "1.2.840.113549.1.1.1",
    "name": "rsaEncryption",
    "description": "RSA 公钥加密",
    "category": "RSA"
  },
  {
    "oid": "1.2.840.113549.1.1.4",
    "name": "md5WithRSAEncryption",
    "description": "MD5 与 RSA 签名",
    "category": "RSA"
  },
  {
    "oid": "1.2.840.113549.1.1.5",
    "name": "sha1WithRSAEncryption",
    "description": "SHA-1 与 RSA 签名",
    "category": "RSA"
  },
  {
    "oid": "1.2.840.113549.1.1.7",
    "name": "id-RSAES-OAEP",
    "description": "RSAES-OAEP 公钥加密方案",
    "category": "RSA"
  },
  {
    "oid": "1.2.840.113549.1.1.8",
    "name": "id-mgf1",
    "description": "RSA OAEP / PSS 使用的 MGF1 掩码生成函数",
    "category": "RSA"
  },
  {
    "oid": "1.2.840.113549.1.1.9",
    "name": "id-pSpecified",
    "description": "RSAES-OAEP 的指定标签参数",
    "category": "RSA"
  },
  {
    "oid": "1.2.840.113549.1.1.10",
    "name": "id-RSASSA-PSS",
    "description": "RSA-PSS 签名方案；摘要和盐长度由参数指定",
    "category": "RSA"
  },
  {
    "oid": "1.2.840.113549.1.1.11",
    "name": "sha256WithRSAEncryption",
    "description": "SHA-256 与 RSA 签名",
    "category": "RSA"
  },
  {
    "oid": "1.2.840.113549.1.1.12",
    "name": "sha384WithRSAEncryption",
    "description": "SHA-384 与 RSA 签名",
    "category": "RSA"
  },
  {
    "oid": "1.2.840.113549.1.1.13",
    "name": "sha512WithRSAEncryption",
    "description": "SHA-512 与 RSA 签名",
    "category": "RSA"
  },
  {
    "oid": "1.2.840.113549.1.1.14",
    "name": "sha224WithRSAEncryption",
    "description": "SHA-224 与 RSA 签名",
    "category": "RSA"
  },
  {
    "oid": "1.2.840.113549.1.9.1",
    "name": "emailAddress",
    "description": "电子邮件地址",
    "category": "RSA"
  },
  {
    "oid": "1.2.840.113549.1.5.12",
    "name": "PBKDF2",
    "description": "基于口令的密钥派生函数 PBKDF2",
    "category": "PKCS #5 / 对称加密（RFC 8018、NIST AES OID）"
  },
  {
    "oid": "1.2.840.113549.1.5.13",
    "name": "PBES2",
    "description": "基于口令的加密方案 PBES2",
    "category": "PKCS #5 / 对称加密（RFC 8018、NIST AES OID）"
  },
  {
    "oid": "2.16.840.1.101.3.4.1.2",
    "name": "aes128-CBC",
    "description": "AES-128 CBC 模式加密",
    "category": "PKCS #5 / 对称加密（RFC 8018、NIST AES OID）"
  },
  {
    "oid": "2.16.840.1.101.3.4.1.6",
    "name": "aes128-GCM",
    "description": "AES-128 GCM 模式认证加密",
    "category": "PKCS #5 / 对称加密（RFC 8018、NIST AES OID）"
  },
  {
    "oid": "2.16.840.1.101.3.4.1.22",
    "name": "aes192-CBC",
    "description": "AES-192 CBC 模式加密",
    "category": "PKCS #5 / 对称加密（RFC 8018、NIST AES OID）"
  },
  {
    "oid": "2.16.840.1.101.3.4.1.26",
    "name": "aes192-GCM",
    "description": "AES-192 GCM 模式认证加密",
    "category": "PKCS #5 / 对称加密（RFC 8018、NIST AES OID）"
  },
  {
    "oid": "2.16.840.1.101.3.4.1.42",
    "name": "aes256-CBC",
    "description": "AES-256 CBC 模式加密",
    "category": "PKCS #5 / 对称加密（RFC 8018、NIST AES OID）"
  },
  {
    "oid": "2.16.840.1.101.3.4.1.46",
    "name": "aes256-GCM",
    "description": "AES-256 GCM 模式认证加密",
    "category": "PKCS #5 / 对称加密（RFC 8018、NIST AES OID）"
  },
  {
    "oid": "1.3.14.3.2.26",
    "name": "sha1",
    "description": "SHA-1 哈希算法",
    "category": "哈希算法"
  },
  {
    "oid": "2.16.840.1.101.3.4.2.4",
    "name": "sha224",
    "description": "SHA-224 哈希算法",
    "category": "哈希算法"
  },
  {
    "oid": "2.16.840.1.101.3.4.2.1",
    "name": "sha256",
    "description": "SHA-256 哈希算法",
    "category": "哈希算法"
  },
  {
    "oid": "2.16.840.1.101.3.4.2.2",
    "name": "sha384",
    "description": "SHA-384 哈希算法",
    "category": "哈希算法"
  },
  {
    "oid": "2.16.840.1.101.3.4.2.3",
    "name": "sha512",
    "description": "SHA-512 哈希算法",
    "category": "哈希算法"
  },
  {
    "oid": "2.16.840.1.101.3.4.2.7",
    "name": "sha3-224",
    "description": "SHA3-224 哈希算法",
    "category": "哈希算法"
  },
  {
    "oid": "2.16.840.1.101.3.4.2.8",
    "name": "sha3-256",
    "description": "SHA3-256 哈希算法",
    "category": "哈希算法"
  },
  {
    "oid": "2.16.840.1.101.3.4.2.9",
    "name": "sha3-384",
    "description": "SHA3-384 哈希算法",
    "category": "哈希算法"
  },
  {
    "oid": "2.16.840.1.101.3.4.2.10",
    "name": "sha3-512",
    "description": "SHA3-512 哈希算法",
    "category": "哈希算法"
  },
  {
    "oid": "1.2.840.10045.2.1",
    "name": "ecPublicKey",
    "description": "椭圆曲线公钥 (EC)",
    "category": "椭圆曲线公钥"
  },
  {
    "oid": "1.2.840.10045.4.1",
    "name": "ecdsa-with-SHA1",
    "description": "ECDSA 与 SHA-1 数字签名算法",
    "category": "椭圆曲线公钥"
  },
  {
    "oid": "1.2.840.10045.4.3.2",
    "name": "ecdsa-with-SHA256",
    "description": "ECDSA 与 SHA-256 数字签名算法",
    "category": "椭圆曲线公钥"
  },
  {
    "oid": "1.2.840.10045.4.3.3",
    "name": "ecdsa-with-SHA384",
    "description": "ECDSA 与 SHA-384 数字签名算法",
    "category": "椭圆曲线公钥"
  },
  {
    "oid": "1.2.840.10045.4.3.4",
    "name": "ecdsa-with-SHA512",
    "description": "ECDSA 与 SHA-512 数字签名算法",
    "category": "椭圆曲线公钥"
  },
  {
    "oid": "1.2.840.10045.3.1.7",
    "name": "prime256v1",
    "description": "NIST P-256 / secp256r1 椭圆曲线",
    "category": "椭圆曲线公钥"
  },
  {
    "oid": "1.3.132.0.10",
    "name": "secp256k1",
    "description": "secp256k1 椭圆曲线",
    "category": "椭圆曲线公钥"
  },
  {
    "oid": "1.3.132.0.34",
    "name": "secp384r1",
    "description": "NIST P-384 椭圆曲线",
    "category": "椭圆曲线公钥"
  },
  {
    "oid": "1.3.132.0.35",
    "name": "secp521r1",
    "description": "NIST P-521 椭圆曲线",
    "category": "椭圆曲线公钥"
  },
  {
    "oid": "1.3.101.110",
    "name": "X25519",
    "description": "X25519 密钥协商算法",
    "category": "椭圆曲线公钥"
  },
  {
    "oid": "1.3.101.111",
    "name": "X448",
    "description": "X448 密钥协商算法",
    "category": "椭圆曲线公钥"
  },
  {
    "oid": "1.3.101.112",
    "name": "Ed25519",
    "description": "Ed25519 签名算法与公钥类型",
    "category": "椭圆曲线公钥"
  },
  {
    "oid": "1.3.101.113",
    "name": "Ed448",
    "description": "Ed448 签名算法与公钥类型",
    "category": "椭圆曲线公钥"
  },
  {
    "oid": "2.5.4.3",
    "name": "commonName",
    "description": "通用名称 (CN)",
    "category": "名称（Subject / Issuer）"
  },
  {
    "oid": "2.5.4.4",
    "name": "surname",
    "description": "姓氏",
    "category": "名称（Subject / Issuer）"
  },
  {
    "oid": "2.5.4.5",
    "name": "serialNumber",
    "description": "序列号",
    "category": "名称（Subject / Issuer）"
  },
  {
    "oid": "2.5.4.6",
    "name": "countryName",
    "description": "国家/地区 (C)",
    "category": "名称（Subject / Issuer）"
  },
  {
    "oid": "2.5.4.7",
    "name": "localityName",
    "description": "地区 (L)",
    "category": "名称（Subject / Issuer）"
  },
  {
    "oid": "2.5.4.8",
    "name": "stateOrProvinceName",
    "description": "省份/州 (ST)",
    "category": "名称（Subject / Issuer）"
  },
  {
    "oid": "2.5.4.9",
    "name": "streetAddress",
    "description": "街道地址",
    "category": "名称（Subject / Issuer）"
  },
  {
    "oid": "2.5.4.10",
    "name": "organizationName",
    "description": "组织 (O)",
    "category": "名称（Subject / Issuer）"
  },
  {
    "oid": "2.5.4.11",
    "name": "organizationalUnitName",
    "description": "组织单位 (OU)",
    "category": "名称（Subject / Issuer）"
  },
  {
    "oid": "2.5.4.12",
    "name": "title",
    "description": "头衔",
    "category": "名称（Subject / Issuer）"
  },
  {
    "oid": "2.5.4.17",
    "name": "postalCode",
    "description": "邮政编码",
    "category": "名称（Subject / Issuer）"
  },
  {
    "oid": "2.5.4.42",
    "name": "givenName",
    "description": "名字",
    "category": "名称（Subject / Issuer）"
  },
  {
    "oid": "2.5.4.46",
    "name": "dnQualifier",
    "description": "DN 限定符",
    "category": "名称（Subject / Issuer）"
  },
  {
    "oid": "2.5.4.65",
    "name": "pseudonym",
    "description": "化名",
    "category": "名称（Subject / Issuer）"
  },
  {
    "oid": "2.5.4.97",
    "name": "organizationIdentifier",
    "description": "组织标识符",
    "category": "名称（Subject / Issuer）"
  },
  {
    "oid": "0.9.2342.19200300.100.1.25",
    "name": "domainComponent",
    "description": "域名组成部分 (DC)",
    "category": "名称（Subject / Issuer）"
  },
  {
    "oid": "0.9.2342.19200300.100.1.1",
    "name": "userId",
    "description": "用户标识符 (UID)",
    "category": "名称（Subject / Issuer）"
  },
  {
    "oid": "2.5.29.14",
    "name": "subjectKeyIdentifier",
    "description": "主体密钥标识",
    "category": "X.509 扩展"
  },
  {
    "oid": "2.5.29.9",
    "name": "subjectDirectoryAttributes",
    "description": "主体目录属性",
    "category": "X.509 扩展"
  },
  {
    "oid": "2.5.29.15",
    "name": "keyUsage",
    "description": "密钥用途",
    "category": "X.509 扩展"
  },
  {
    "oid": "2.5.29.16",
    "name": "privateKeyUsagePeriod",
    "description": "私钥使用期限",
    "category": "X.509 扩展"
  },
  {
    "oid": "2.5.29.17",
    "name": "subjectAltName",
    "description": "主题备用名称",
    "category": "X.509 扩展"
  },
  {
    "oid": "2.5.29.18",
    "name": "issuerAltName",
    "description": "颁发者备用名称",
    "category": "X.509 扩展"
  },
  {
    "oid": "2.5.29.19",
    "name": "basicConstraints",
    "description": "基本约束",
    "category": "X.509 扩展"
  },
  {
    "oid": "2.5.29.20",
    "name": "cRLNumber",
    "description": "证书吊销列表编号",
    "category": "X.509 扩展"
  },
  {
    "oid": "2.5.29.21",
    "name": "reasonCode",
    "description": "证书吊销原因代码",
    "category": "X.509 扩展"
  },
  {
    "oid": "2.5.29.24",
    "name": "invalidityDate",
    "description": "证书失效日期",
    "category": "X.509 扩展"
  },
  {
    "oid": "2.5.29.27",
    "name": "deltaCRLIndicator",
    "description": "增量 CRL 标识",
    "category": "X.509 扩展"
  },
  {
    "oid": "2.5.29.28",
    "name": "issuingDistributionPoint",
    "description": "CRL 签发分发点",
    "category": "X.509 扩展"
  },
  {
    "oid": "2.5.29.30",
    "name": "nameConstraints",
    "description": "名称约束",
    "category": "X.509 扩展"
  },
  {
    "oid": "2.5.29.31",
    "name": "cRLDistributionPoints",
    "description": "CRL 分发点",
    "category": "X.509 扩展"
  },
  {
    "oid": "2.5.29.32",
    "name": "certificatePolicies",
    "description": "证书策略",
    "category": "X.509 扩展"
  },
  {
    "oid": "2.5.29.32.0",
    "name": "anyPolicy",
    "description": "任意证书策略",
    "category": "X.509 扩展"
  },
  {
    "oid": "2.5.29.33",
    "name": "policyMappings",
    "description": "证书策略映射",
    "category": "X.509 扩展"
  },
  {
    "oid": "2.5.29.35",
    "name": "authorityKeyIdentifier",
    "description": "权威密钥标识",
    "category": "X.509 扩展"
  },
  {
    "oid": "2.5.29.36",
    "name": "policyConstraints",
    "description": "证书策略约束",
    "category": "X.509 扩展"
  },
  {
    "oid": "2.5.29.37",
    "name": "extendedKeyUsage",
    "description": "扩展密钥用途",
    "category": "X.509 扩展"
  },
  {
    "oid": "2.5.29.37.0",
    "name": "anyExtendedKeyUsage",
    "description": "任意扩展密钥用途",
    "category": "X.509 扩展"
  },
  {
    "oid": "2.5.29.46",
    "name": "freshestCRL",
    "description": "最新增量 CRL 分发点",
    "category": "X.509 扩展"
  },
  {
    "oid": "2.5.29.54",
    "name": "inhibitAnyPolicy",
    "description": "禁止使用 anyPolicy 的约束",
    "category": "X.509 扩展"
  },
  {
    "oid": "1.3.6.1.5.5.7.1.1",
    "name": "authorityInfoAccess",
    "description": "颁发机构信息访问；常包含 OCSP 和 CA 证书地址",
    "category": "PKIX 用途和访问方法（RFC 5280）"
  },
  {
    "oid": "1.3.6.1.5.5.7.1.11",
    "name": "subjectInfoAccess",
    "description": "主体信息访问",
    "category": "PKIX 用途和访问方法（RFC 5280）"
  },
  {
    "oid": "1.3.6.1.5.5.7.48.1",
    "name": "id-ad-ocsp",
    "description": "在线证书状态协议 OCSP 响应地址",
    "category": "PKIX 用途和访问方法（RFC 5280）"
  },
  {
    "oid": "1.3.6.1.5.5.7.48.2",
    "name": "id-ad-caIssuers",
    "description": "CA 签发者证书获取地址",
    "category": "PKIX 用途和访问方法（RFC 5280）"
  },
  {
    "oid": "1.3.6.1.5.5.7.3.1",
    "name": "serverAuth",
    "description": "TLS 服务器身份验证",
    "category": "PKIX 用途和访问方法（RFC 5280）"
  },
  {
    "oid": "1.3.6.1.5.5.7.3.2",
    "name": "clientAuth",
    "description": "TLS 客户端身份验证",
    "category": "PKIX 用途和访问方法（RFC 5280）"
  },
  {
    "oid": "1.3.6.1.5.5.7.3.3",
    "name": "codeSigning",
    "description": "代码签名",
    "category": "PKIX 用途和访问方法（RFC 5280）"
  },
  {
    "oid": "1.3.6.1.5.5.7.3.4",
    "name": "emailProtection",
    "description": "电子邮件保护",
    "category": "PKIX 用途和访问方法（RFC 5280）"
  },
  {
    "oid": "1.3.6.1.5.5.7.3.8",
    "name": "timeStamping",
    "description": "可信时间戳签发",
    "category": "PKIX 用途和访问方法（RFC 5280）"
  },
  {
    "oid": "1.3.6.1.5.5.7.3.9",
    "name": "OCSPSigning",
    "description": "OCSP 响应签名",
    "category": "PKIX 用途和访问方法（RFC 5280）"
  },
  {
    "oid": "1.2.840.113549.1.7.1",
    "name": "data",
    "description": "CMS 原始数据内容类型",
    "category": "CMS / PKCS #7、PKCS #9、PKCS #12（RFC 5652、2985、7292）"
  },
  {
    "oid": "1.2.840.113549.1.7.2",
    "name": "signedData",
    "description": "CMS 数字签名数据内容类型",
    "category": "CMS / PKCS #7、PKCS #9、PKCS #12（RFC 5652、2985、7292）"
  },
  {
    "oid": "1.2.840.113549.1.7.3",
    "name": "envelopedData",
    "description": "CMS 数字信封内容类型",
    "category": "CMS / PKCS #7、PKCS #9、PKCS #12（RFC 5652、2985、7292）"
  },
  {
    "oid": "1.2.840.113549.1.7.4",
    "name": "signedAndEnvelopedData",
    "description": "旧版 PKCS #7 签名并加密内容类型",
    "category": "CMS / PKCS #7、PKCS #9、PKCS #12（RFC 5652、2985、7292）"
  },
  {
    "oid": "1.2.840.113549.1.7.5",
    "name": "digestedData",
    "description": "CMS 摘要数据内容类型",
    "category": "CMS / PKCS #7、PKCS #9、PKCS #12（RFC 5652、2985、7292）"
  },
  {
    "oid": "1.2.840.113549.1.7.6",
    "name": "encryptedData",
    "description": "CMS 加密数据内容类型",
    "category": "CMS / PKCS #7、PKCS #9、PKCS #12（RFC 5652、2985、7292）"
  },
  {
    "oid": "1.2.840.113549.1.9.3",
    "name": "contentType",
    "description": "CMS 签名属性：被签名内容类型",
    "category": "CMS / PKCS #7、PKCS #9、PKCS #12（RFC 5652、2985、7292）"
  },
  {
    "oid": "1.2.840.113549.1.9.4",
    "name": "messageDigest",
    "description": "CMS 签名属性：内容摘要",
    "category": "CMS / PKCS #7、PKCS #9、PKCS #12（RFC 5652、2985、7292）"
  },
  {
    "oid": "1.2.840.113549.1.9.5",
    "name": "signingTime",
    "description": "CMS 签名属性：声明的签名时间",
    "category": "CMS / PKCS #7、PKCS #9、PKCS #12（RFC 5652、2985、7292）"
  },
  {
    "oid": "1.2.840.113549.1.9.6",
    "name": "counterSignature",
    "description": "CMS 计数签名属性",
    "category": "CMS / PKCS #7、PKCS #9、PKCS #12（RFC 5652、2985、7292）"
  },
  {
    "oid": "1.2.840.113549.1.9.7",
    "name": "challengePassword",
    "description": "PKCS #10 证书请求口令属性",
    "category": "CMS / PKCS #7、PKCS #9、PKCS #12（RFC 5652、2985、7292）"
  },
  {
    "oid": "1.2.840.113549.1.9.14",
    "name": "extensionRequest",
    "description": "PKCS #10 证书请求中的扩展申请",
    "category": "CMS / PKCS #7、PKCS #9、PKCS #12（RFC 5652、2985、7292）"
  },
  {
    "oid": "1.2.840.113549.1.9.15",
    "name": "sMIMECapabilities",
    "description": "S/MIME 能力声明",
    "category": "CMS / PKCS #7、PKCS #9、PKCS #12（RFC 5652、2985、7292）"
  },
  {
    "oid": "1.2.840.113549.1.9.20",
    "name": "friendlyName",
    "description": "PKCS #12 密钥或证书的友好名称",
    "category": "CMS / PKCS #7、PKCS #9、PKCS #12（RFC 5652、2985、7292）"
  },
  {
    "oid": "1.2.840.113549.1.9.21",
    "name": "localKeyId",
    "description": "PKCS #12 中关联密钥和证书的本地标识",
    "category": "CMS / PKCS #7、PKCS #9、PKCS #12（RFC 5652、2985、7292）"
  },
  {
    "oid": "1.2.840.113549.1.12.10.1.1",
    "name": "keyBag",
    "description": "PKCS #12 未加密私钥容器",
    "category": "CMS / PKCS #7、PKCS #9、PKCS #12（RFC 5652、2985、7292）"
  },
  {
    "oid": "1.2.840.113549.1.12.10.1.2",
    "name": "pkcs8ShroudedKeyBag",
    "description": "PKCS #12 加密私钥容器",
    "category": "CMS / PKCS #7、PKCS #9、PKCS #12（RFC 5652、2985、7292）"
  },
  {
    "oid": "1.2.840.113549.1.12.10.1.3",
    "name": "certBag",
    "description": "PKCS #12 证书容器",
    "category": "CMS / PKCS #7、PKCS #9、PKCS #12（RFC 5652、2985、7292）"
  },
  {
    "oid": "1.2.840.113549.1.12.10.1.4",
    "name": "crlBag",
    "description": "PKCS #12 CRL 容器",
    "category": "CMS / PKCS #7、PKCS #9、PKCS #12（RFC 5652、2985、7292）"
  },
  {
    "oid": "1.2.840.113549.1.12.10.1.5",
    "name": "secretBag",
    "description": "PKCS #12 秘密数据容器",
    "category": "CMS / PKCS #7、PKCS #9、PKCS #12（RFC 5652、2985、7292）"
  },
  {
    "oid": "1.2.840.113549.1.12.10.1.6",
    "name": "safeContentsBag",
    "description": "PKCS #12 嵌套安全内容容器",
    "category": "CMS / PKCS #7、PKCS #9、PKCS #12（RFC 5652、2985、7292）"
  },
  {
    "oid": "1.2.840.113549.1.9.22.1",
    "name": "x509Certificate",
    "description": "PKCS #12 证书容器中的 X.509 证书类型",
    "category": "CMS / PKCS #7、PKCS #9、PKCS #12（RFC 5652、2985、7292）"
  },
  {
    "oid": "1.2.840.113549.1.9.16.1.4",
    "name": "id-ct-TSTInfo",
    "description": "RFC 3161 时间戳令牌中的 TSTInfo 内容类型",
    "category": "时间戳和签名证书属性（RFC 3161、5035）"
  },
  {
    "oid": "1.2.840.113549.1.9.16.2.12",
    "name": "signingCertificate",
    "description": "CMS 签名属性：使用 ESSCertID 标识签名证书",
    "category": "时间戳和签名证书属性（RFC 3161、5035）"
  },
  {
    "oid": "1.2.840.113549.1.9.16.2.14",
    "name": "signatureTimeStampToken",
    "description": "CMS 无签名属性：对签名值的时间戳令牌",
    "category": "时间戳和签名证书属性（RFC 3161、5035）"
  },
  {
    "oid": "1.2.840.113549.1.9.16.2.47",
    "name": "signingCertificateV2",
    "description": "CMS 签名属性：使用 ESSCertIDv2 标识签名证书",
    "category": "时间戳和签名证书属性（RFC 3161、5035）"
  }
]
