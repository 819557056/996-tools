# 996 Tools - Vue 3 在线工具集合

这是一个使用 Vue 3 + TypeScript 重构的在线工具集合，原项目基于 [101webtools](https://github.com/mnove/101webtools)。

## 项目特色

- ✨ **现代化技术栈**: Vue 3 + TypeScript + Vite
- 🎨 **精美界面**: Tailwind CSS 响应式设计
- 🌙 **深色模式**: 支持明暗主题切换
- 🚀 **快速高效**: Vite 构建，开发体验极佳
- 🔒 **隐私保护**: 所有处理都在浏览器中进行
- 📱 **移动友好**: 完全响应式设计

## 在线演示

- 访问在线演示[站点](https://921996.xyz)。

## 可用工具

| 一级菜单     | 工具                                                                 |
| ------------ | -------------------------------------------------------------------- |
| 加密工具     | MD5 哈希生成器、SHA1 哈希生成器、SHA256 哈希生成器                  |
| 安全工具     | 密码生成器                                                           |
| 公钥基础设施 | [SSL 证书生成](doc/ssl-certificate.md)：本地创建 RSA / SM2 根 CA 并签发 SSL 证书 |
| 文本处理     | Base64 编码/解码、URL 编码/解码、Lorem Ipsum 生成器                  |
| 代码工具     | JSON 格式化                                                          |
| 代码生成器   | 二维码生成器                                                         |
| ID 生成器    | UUID 生成器、Nano ID 生成器、ULID 生成器                             |

## 后续待完善的工具

- 证书 ASN.1 解析功能优化
- 证书查看器，增加显示特定行业证书内容
- 密码学相关算法生成（RSA 和国密 GM 系列）
- JSON 支持输入变量名称提取对应内容
- 配置文件多格式转换（如 JSON/YAML/TOML 等互转）
- JWT（JSON Web Token）调试器
- 时间转换器（Unix 时间戳、人类可读时间等互转）

## 快速开始

### 前置要求

- Node.js 18+
- npm / pnpm / yarn

### 安装

```bash
# 克隆仓库
git clone <repository-url>
cd 996-Tools

# 安装依赖 (推荐使用 pnpm)
pnpm install
# 或使用 npm
npm install
# 或使用 yarn
yarn install
```

### 开发

```bash
# 启动开发服务器
pnpm dev
# 或
npm run dev
```

在浏览器中打开 [http://localhost:3000](http://localhost:3000) 查看应用。

### 构建

```bash
# 构建生产版本
pnpm build
# 或
npm run build
```

### 预览构建

```bash
# 预览生产构建
pnpm preview
# 或
npm run preview
```

## 技术栈

- **框架**: [Vue 3](https://vuejs.org/)
- **语言**: [TypeScript](https://www.typescriptlang.org/)
- **构建工具**: [Vite](https://vitejs.dev/)
- **路由**: [Vue Router](https://router.vuejs.org/)
- **状态管理**: [Pinia](https://pinia.vuejs.org/)
- **样式**: [Tailwind CSS](https://tailwindcss.com/)
- **图标**: [Lucide Vue Next](https://lucide.dev/)
- **工具库**:
  - UUID: `uuid`
  - Nano ID: `nanoid`
  - ULID: `ulid`
  - QR Code: `qr-code-styling`
  - 加密: `crypto-js`

## 项目结构

```
996-Tools/
├── public/                 # 静态资源
├── src/
│   ├── assets/            # 资源文件
│   │   └── main.css       # 全局样式
│   ├── components/        # 组件
│   │   ├── ui/           # UI基础组件
│   │   ├── SiteHeader.vue
│   │   ├── SiteFooter.vue
│   │   └── ToolCard.vue
│   ├── composables/       # 组合式函数
│   │   └── useToast.ts
│   ├── config/            # 配置文件
│   │   └── site.ts
│   ├── lib/               # 工具函数
│   │   ├── tools-data.ts
│   │   └── utils.ts
│   ├── router/            # 路由配置
│   │   └── index.ts
│   ├── stores/            # 状态管理
│   │   ├── theme.ts
│   │   └── favorites.ts
│   ├── views/             # 页面视图
│   │   ├── HomeView.vue
│   │   └── tools/        # 工具页面
│   ├── App.vue
│   └── main.ts
├── index.html
├── package.json
├── tsconfig.json
├── vite.config.ts
└── tailwind.config.js
```

## 功能说明

### 主题切换
点击右上角的太阳/月亮图标可以切换明暗主题。主题偏好会自动保存到本地存储。

### 工具使用
1. 在主页浏览所有可用工具
2. 点击工具卡片进入对应工具页面
3. 根据工具说明使用功能
4. 使用复制按钮快速复制结果

### SSL 证书生成

从「公钥基础设施 → SSL 证书生成」进入，或访问 `/tools/ssl-certificate`。
支持 RSA2048、RSA4096、SM2 根 CA、自动生成或导入公私钥对、DN / SAN 和有效期设置。
密钥生成、签发、验签及打包全部在浏览器本地完成，无需后端接口。
详见 [功能说明与验证方法](doc/ssl-certificate.md)。

### 添加新工具
1. 在 `src/lib/tools-data.ts` 中添加工具配置
2. 在 `src/views/tools/` 中创建工具页面组件
3. 在 `src/router/index.ts` 中添加路由

## 贡献

欢迎贡献代码、报告问题或提出新功能建议！

## 许可证

MIT License

## 致谢

本项目基于 [101webtools](https://github.com/mnove/101webtools) 使用 Vue 3 重构。

特别感谢以下开源项目：

- [asn1js](https://github.com/lapo-luchini/asn1js) —— 提供 ASN.1 解析相关实现，为证书解析等功能提供了重要参考。


---



