export type IndustryType = 'standard' | 'tax' | 'customs';

export const INDUSTRY_OPTIONS: { label: string; value: IndustryType }[] = [
    { label: '标准 (Standard)', value: 'standard' },
    { label: '税务 (Tax)', value: 'tax' },
    { label: '海关 (Customs)', value: 'customs' },
];

// 标准 OID 映射
export const STANDARD_OID_NAMES: Record<string, string> = {
    // 算法
    '1.2.840.113549.1.1.1': 'RSA',
    '1.2.840.113549.1.1.5': 'SHA1withRSA',
    '1.2.840.113549.1.1.11': 'SHA256withRSA',
    '1.2.840.113549.1.1.12': 'SHA384withRSA',
    '1.2.840.113549.1.1.13': 'SHA512withRSA',
    '1.2.840.10045.2.1': 'EC Public Key',
    '1.2.840.10045.4.3.2': 'SHA256withECDSA',
    '1.2.840.10045.4.3.3': 'SHA384withECDSA',
    '1.2.840.10045.4.3.4': 'SHA512withECDSA',
    '1.2.156.10197.1.301': 'SM2 (国密)',
    '1.2.156.10197.1.501': 'SM3withSM2 (国密)',

    // 常用名称 (DN)
    '2.5.4.3': '通用名称 (CN)',
    '2.5.4.6': '国家/地区 (C)',
    '2.5.4.7': '城市/地点 (L)',
    '2.5.4.8': '省/市/自治区 (ST)',
    '2.5.4.10': '组织 (O)',
    '2.5.4.11': '组织单位 (OU)',
    '2.5.4.9': '街道地址',
    '2.5.4.5': '序列号',
    '2.5.4.17': '邮政编码',
    '1.2.840.113549.1.9.1': '电子邮件',

    // 扩展
    '2.5.29.14': '使用者密钥标识符 (Subject Key Identifier)',
    '2.5.29.15': '密钥用法 (Key Usage)',
    '2.5.29.17': '使用者可选名称 (Subject Alternative Name)',
    '2.5.29.19': '基本约束 (Basic Constraints)',
    '2.5.29.31': 'CRL 分发点 (CRL Distribution Points)',
    '2.5.29.32': '证书策略 (Certificate Policies)',
    '2.5.29.35': '授权密钥标识符 (Authority Key Identifier)',
    '2.5.29.37': '增强密钥用法 (Extended Key Usage)',
    '1.3.6.1.5.5.7.1.1': '授权信息访问 (Authority Info Access)',
    '1.3.6.1.4.1.11129.2.4.2': 'SCT 列表 (Signed Certificate Timestamp List)',

    // 增强密钥用法
    '1.3.6.1.5.5.7.3.1': '服务器身份验证',
    '1.3.6.1.5.5.7.3.2': '客户端身份验证',
    '1.3.6.1.5.5.7.3.3': '代码签名',
    '1.3.6.1.5.5.7.3.4': '电子邮件保护',
    '1.3.6.1.5.5.7.3.8': '时间戳',
    '1.3.6.1.5.5.7.3.9': 'OCSP 签名',
};

// 税务行业扩展 OID 映射 (示例)
export const TAX_OID_MAP: Record<string, string> = {
    // 假设的税务专用 OID
    '1.2.156.10197.6.1.4.2.1': '税务登记号',
    '1.2.156.10197.6.1.4.2.2': '纳税人识别号',
    '1.2.156.10197.6.1.4.2.3': '税务机关代码',
    '1.2.156.10197.6.1.4.2.4': '税务人员代码',
    // 覆盖标准 OID 示例 (如果需要)
    // '2.5.4.10': '税务机关名称 (O)', 
};

// 海关行业扩展 OID 映射 (示例)
export const CUSTOMS_OID_MAP: Record<string, string> = {
    // 假设的海关专用 OID
    '1.2.156.10197.6.1.4.3.1': '海关代码',
    '1.2.156.10197.6.1.4.3.2': '电子口岸卡号',
    '1.2.156.10197.6.1.4.3.3': '报关员证号',
    '1.2.156.10197.6.1.4.3.4': '企业海关编码',
};

export const INDUSTRY_OID_MAPS: Record<IndustryType, Record<string, string>> = {
    standard: {},
    tax: TAX_OID_MAP,
    customs: CUSTOMS_OID_MAP,
};
