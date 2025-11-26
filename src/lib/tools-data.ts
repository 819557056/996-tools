export type Tool = {
  key: string // Added key
  label: string
  i18nKey: string // Added i18n key
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
  const order = ['Development', 'Converters', 'ID_Generators', 'Encryption_Tools', 'Security_Tools', 'pki', 'Image_Videos'];

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

// 根据路径获取工具
export function getToolByPath(path: string): Tool | undefined {
  return Object.values(toolsData).find((tool) => tool.path === path)
}
