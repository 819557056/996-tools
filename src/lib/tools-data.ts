import { localPkiTools } from './local-pki-tools'

export type Tool = {
  key: string
  label: string
  i18nKey: string
  description: string
  badges: string[]
  category: string
  path: string
  icon: string
  isNew?: boolean
}

export type ToolsData = {
  [key: string]: Tool
}

export type ToolsCategory = {
  name: string
  tools: Tool[]
}

export const toolsData: ToolsData = {
  pdfVerify: {"key":"pdfVerify","label":"PDF 本地验签","i18nKey":"tools.pdfVerify","description":"离线检查 PDF 签名、摘要、证书及签名覆盖范围","badges":["Local"],"category":"Document_Tools","path":"/tools/pdf-verify","icon":"FileSignature","isNew":true},
  offlineRevocation: {"key":"offlineRevocation","label":"OCSP / CRL 离线工具","i18nKey":"tools.offlineRevocation","description":"生成 OCSP 请求和测试响应，离线校验响应及 CRL","badges":["Local"],"category":"pki","path":"/tools/offline-revocation","icon":"Shield","isNew":true},
  ...Object.fromEntries(localPkiTools.map(tool => [tool.key, { key: tool.key, label: tool.title, i18nKey: `tools.${tool.key}`, description: tool.description, badges: ['Local'], category: 'pki', path: `/tools/${tool.mode}`, icon: tool.icon, isNew: true }])),
  fileDigest: {"key":"fileDigest","label":"文件摘要","i18nKey":"tools.fileDigest","description":"本地分块计算 MD5、SHA-1、SHA-256 和 SM3","badges":["Local"],"category":"Encryption_Tools","path":"/tools/file-digest","icon":"Hash","isNew":true},
  oidExplorer: {"key":"oidExplorer","label":"OID 查询","i18nKey":"tools.oidExplorer","description":"按 OID、名称、分类查找并查看上级节点","badges":["Local"],"category":"pki","path":"/tools/oid-explorer","icon":"Search","isNew":true},
  transcoding: {
    key: "transcoding",
    label: "编码转换",
    i18nKey: "tools.transcoding",
    description: "数据编码转换",
    badges: ["编码转换"],
    category: "Converters",
    path: "/tools/transcoding",
    icon: "Text",
    isNew: true,
  },
  certificateEncodingConverter: {
    key: "certificateEncodingConverter",
    label: "证书编码转换",
    i18nKey: "tools.certificate-encoding-converter",
    description: "在 PEM、Base64、DER 和 HEX 格式之间转换证书编码",
    badges: ["证书", "PEM", "DER", "编码转换"],
    category: "pki",
    path: "/tools/certificate-encoding-converter",
    icon: "PKI",
    isNew: true,
  },

  hashTextGenerator: {
    key: "hashTextGenerator",
    label: "哈希文本生成器",
    i18nKey: "tools.hashTextGenerator",
    description: "使用多种算法（MD5, SHA1, SHA256等）为文本生成哈希值",
    badges: ["Hash", "MD5", "SHA", "Generator"],
    category: "Encryption_Tools",
    path: "/tools/hash-text",
    icon: "Hash",
    isNew: true,
  },
  sm2Encrypt: {
    key: "sm2Encrypt",
    label: "SM2 加解密",
    i18nKey: "tools.sm2Encrypt",
    description: "SM2 加密解密工具，支持 C1C3C2/C1C2C3 模式，支持 Hex 和 ASN.1 DER 输出",
    badges: ["SM2", "加密", "解密", "ASN.1"],
    category: "Encryption_Tools",
    path: "/tools/sm2-encrypt",
    icon: "Lock",
    isNew: true,
  },
  sm2Sign: {
    key: "sm2Sign",
    label: "SM2 签名验签",
    i18nKey: "tools.sm2Sign",
    description: "SM2 签名验签工具，支持 Hex 和 ASN.1 DER 格式",
    badges: ["SM2", "签名", "验签", "ASN.1"],
    category: "Encryption_Tools",
    path: "/tools/sm2-sign",
    icon: "FileSignature",
    isNew: true,
  },
  sm2tool: {
    key: "sm2tool",
    label: "SM2 工具",
    i18nKey: "tools.sm2tool",
    description: "SM2 加密/解密/签名/验签",
    badges: ["SM2", "加密"],
    category: "Encryption_Tools",
    path: "/tools/sm2-tool",
    icon: "Lock",
    isNew: true,
  },
  sm4tool: {
    key: "sm4tool",
    label: "SM4 工具",
    i18nKey: "tools.sm4tool",
    description: "SM4 分组密码算法，支持 ECB 和 CBC 模式",
    badges: ["SM4", "加密"],
    category: "Encryption_Tools",
    path: "/tools/sm4-tool",
    icon: "Lock",
    isNew: true,
  },
  digitalEnvelope: {
    key: "digitalEnvelope",
    label: "数字信封",
    i18nKey: "tools.digitalEnvelope",
    description: "基于GM/T 0010标准的数字信封生成与解密",
    badges: ["SM2", "SM4", "数字信封"],
    category: "Encryption_Tools",
    path: "/tools/digital-envelope",
    icon: "Mail",
    isNew: true,
  },

  passwordGenerator: {
    key: "passwordGenerator",
    label: "密码生成器",
    i18nKey: "tools.password",
    description: "生成强度高且安全的密码，支持自定义选项",
    badges: ["Password", "Generator"],
    category: "Security_Tools",
    path: "/tools/password-generator",
    icon: "Lock",
  },

  qrcodeGenerator: {
    key: "qrcodeGenerator",
    label: "二维码",
    i18nKey: "tools.qrcode",
    description: "在线生成二维码，支持文本、网址、WiFi等多种格式，可自定义颜色、Logo和样式",
    badges: ["QR Code"],
    category: "Image_Videos",
    path: "/tools/qrcode-generator",
    icon: "QrCode",
    isNew: true,
  },

  nanoidGenerator: {
    key: "nanoidGenerator",
    label: "Nano ID 生成器",
    i18nKey: "tools.nanoid",
    description: "生成随机ID，支持自定义长度和字符集",
    badges: ["Nano ID", "Random ID"],
    category: "ID_Generators",
    path: "/tools/nanoid-generator",
    icon: "IdCard",
  },

  uuidGenerator: {
    key: "uuidGenerator",
    label: "UUID 生成器",
    i18nKey: "tools.uuid",
    description: "生成UUID（通用唯一识别码）",
    badges: ["UUID", "Random ID"],
    category: "ID_Generators",
    path: "/tools/uuid-generator",
    icon: "IdCard",
  },

  ulidGenerator: {
    key: "ulidGenerator",
    label: "ULID 生成器",
    i18nKey: "tools.ulid",
    description: "生成ULID（通用唯一按字典序排序的标识符）",
    badges: ["ULID", "Random ID"],
    category: "ID_Generators",
    path: "/tools/ulid-generator",
    icon: "IdCard",
  },

  jsonFormatter: {
    key: "jsonFormatter",
    label: "JSON 格式化",
    i18nKey: "tools.json",
    description: "查看、验证和格式化JSON数据，支持交互式树形结构",
    badges: ["JSON", "Viewer", "Formatter"],
    category: "Development",
    path: "/tools/json-formatter",
    icon: "FileJson",
  },

  codeGenerator: {
    key: "codeGenerator",
    label: "代码生成器",
    i18nKey: "tools.codeGenerator",
    description: "将JSON转换为TypeScript、Go、Java、Python、Rust或Protobuf类型定义",
    badges: ["JSON", "TypeScript", "Go", "Java", "Code Generation"],
    category: "Development",
    path: "/tools/code-generator",
    icon: "Code2",
    isNew: true,
  },

  jsonQuery: {
    key: "jsonQuery",
    label: "JSON 查询",
    i18nKey: "tools.jsonQuery",
    description: "使用JMESPath或JSONPath强大查询语法查询和提取JSON数据",
    badges: ["JSON", "Query", "JMESPath", "JSONPath"],
    category: "Development",
    path: "/tools/json-query",
    icon: "Search",
    isNew: true,
  },

  jsonDiff: {
    key: "jsonDiff",
    label: "JSON 对比",
    i18nKey: "tools.jsonDiff",
    description: "对比两个JSON文件的差异，高亮显示新增、删除和修改的字段",
    badges: ["JSON", "Diff", "Compare"],
    category: "Development",
    path: "/tools/json-diff",
    icon: "GitCompare",
    isNew: true,
  },

  jsonVisualizer: {
    key: "jsonVisualizer",
    label: "JSON 可视化",
    i18nKey: "tools.jsonVisualizer",
    description: "将JSON数据可视化为树状图、关系图谱或旭日图，直观理解数据结构",
    badges: ["JSON", "Visualization", "Tree", "Graph"],
    category: "Development",
    path: "/tools/json-visualizer",
    icon: "Network",
    isNew: true,
  },

  certificateParser: {
    key: "certificateParser",
    label: "证书解析",
    i18nKey: "tools.certificate-parser",
    description: "证书ASN1编码解析",
    badges: ["Certificate-parser"],
    category: "pki",
    path: "/tools/certificate-parser",
    icon: "PKI",
    isNew: true,
  },
  binaryViewer: {
    key: "binaryViewer",
    label: "二进制查看器",
    i18nKey: "tools.binary-viewer",
    description: "二进制数据查看器",
    badges: ["Binary-viewer"],
    category: "Development",
    path: "/tools/binary-viewer",
    icon: "Watch",
    isNew: true,
  },
  certificateViewer: {
    key: "certificateViewer",
    label: "证书查看器",
    i18nKey: "tools.certificate-viewer",
    description: "证书查看器",
    badges: ["Certificate-viewer"],
    category: "pki",
    path: "/tools/certificate-viewer",
    icon: "Watch",
    isNew: true,
  },

  formatConverter: {
    key: "formatConverter",
    label: "配置文件格式互转",
    i18nKey: "tools.formatConverter",
    description: "支持 JSON、YAML、TOML、XML、CSV、INI、Properties 等多种格式之间的互转",
    badges: ["JSON", "YAML", "TOML", "XML", "CSV", "转换"],
    category: "Converters",
    path: "/tools/format-converter",
    icon: "ArrowLeftRight",
    isNew: true,
  },

  yamlTomlEditor: {
    key: "yamlTomlEditor",
    label: "YAML/TOML/Properties 编辑器",
    i18nKey: "tools.yamlTomlEditor",
    description: "带实时语法校验的配置文件编辑器，支持 YAML、TOML 和 Properties 格式，自动缩进检测和格式化",
    badges: ["YAML", "TOML", "Properties", "校验", "格式化"],
    category: "Development",
    path: "/tools/yaml-toml-editor",
    icon: "FileCode",
    isNew: true,
  },

  csvAdvanced: {
    key: "csvAdvanced",
    label: "CSV 高级操作",
    i18nKey: "tools.csvAdvanced",
    description: "CSV 分割、列提取重排、转 SQL 语句等高级操作",
    badges: ["CSV", "SQL", "数据处理"],
    category: "Development",
    path: "/tools/csv-advanced",
    icon: "Table",
    isNew: true,
  },
  
}

// 获取工具按分类分组
export function getToolsByCategory(): ToolsCategory[] {
  const categories: { [key: string]: Tool[] } = {}

  Object.values(toolsData).forEach((tool) => {
    if (!categories[tool.category]) {
      categories[tool.category] = []
    }
    categories[tool.category].push(tool)
  })

  // Define preferred order, with Text_Manipulation first
  const order = ['Development', 'Converters', 'ID_Generators', 'Encryption_Tools', 'Security_Tools', 'pki', 'Document_Tools', 'Image_Videos'];

  return Object.entries(categories)
    .sort(([nameA], [nameB]) => {
        const indexA = order.indexOf(nameA);
        const indexB = order.indexOf(nameB);
        // If both are in the list, sort by index
        if (indexA !== -1 && indexB !== -1) return indexA - indexB;
        // If only A is in list, A comes first
        if (indexA !== -1) return -1;
        // If only B is in list, B comes first
        if (indexB !== -1) return 1;
        // Otherwise sort alphabetically
        return nameA.localeCompare(nameB);
    })
    .map(([name, tools]) => ({
      name,
      tools,
    }))
}

export function getToolByPath(path: string): Tool | undefined {
  return Object.values(toolsData).find(tool => tool.path === path)
}
