# 国际化 (i18n) 实施完成 ✅

## 📋 概述

本项目已成功实施国际化功能，完全参照 [it-tools](https://github.com/CorentinTh/it-tools) 的实现方式，支持中英文双语切换。

## 🎯 实施特点

### 1. **统一配置位置**
所有翻译文件集中在项目根目录的 `locales/` 文件夹中：
```
locales/
├── en.yml    # 英文翻译
└── zh.yml    # 中文翻译
```

### 2. **自动化处理**
- ✅ Vite 插件自动加载语言文件
- ✅ 自动检测浏览器语言
- ✅ 自动保存用户语言选择到 localStorage
- ✅ 热更新支持，修改语言文件即时生效

### 3. **开发者友好**
- ✅ 简单的 `t()` 函数调用
- ✅ TypeScript 类型支持
- ✅ Vue 3 Composition API 支持
- ✅ 清晰的翻译键命名规范

## 📁 核心文件

### 语言文件
- `locales/en.yml` - 英文翻译
- `locales/zh.yml` - 中文翻译

### 插件和组件
- `src/plugins/i18n.ts` - i18n 核心配置
- `src/components/LocaleSelector.vue` - 语言选择器组件

### 配置文件
- `vite.config.ts` - 已配置 `@intlify/unplugin-vue-i18n`
- `src/main.ts` - 注册 i18n 插件

## 🚀 快速开始

### 1. 在组件中使用翻译

```vue
<script setup lang="ts">
import { useI18n } from 'vue-i18n'

const { t, locale } = useI18n()
</script>

<template>
  <div>
    <h1>{{ t('home.title') }}</h1>
    <p>{{ t('home.subtitle') }}</p>
    
    <!-- 访问当前语言 -->
    <p>当前语言: {{ locale }}</p>
  </div>
</template>
```

### 2. 添加语言选择器

```vue
<script setup lang="ts">
import LocaleSelector from '@/components/LocaleSelector.vue'
</script>

<template>
  <LocaleSelector />
</template>
```

### 3. 添加新的翻译

在 `locales/zh.yml`:
```yaml
myFeature:
  title: '我的功能'
  description: '这是描述'
```

在 `locales/en.yml`:
```yaml
myFeature:
  title: 'My Feature'
  description: 'This is description'
```

在组件中使用:
```vue
<template>
  <h1>{{ t('myFeature.title') }}</h1>
  <p>{{ t('myFeature.description') }}</p>
</template>
```

## 📝 翻译键组织

项目采用模块化的翻译键组织方式：

```yaml
# 首页
home:
  title: '标题'
  subtitle: '副标题'
  categories:
    all: '全部'
    favorites: '收藏'

# 导航
nav:
  home: '首页'
  about: '关于'
  darkMode: '深色模式'

# 工具
tools:
  uuid:
    title: 'UUID 生成器'
    version: '版本'
    generate: '生成'
  base64:
    title: 'Base64 编码/解码'
    encode: '编码'
    decode: '解码'

# 通用
common:
  copy: '复制'
  clear: '清空'
  save: '保存'
```

## 🌐 支持的语言

当前支持：
- 🇨🇳 **中文** (zh) - 默认语言
- 🇬🇧 **English** (en)

## 📦 已完成的翻译模块

### ✅ 核心模块
- [x] 首页 (HomeView)
- [x] 导航栏 (SiteHeader)
- [x] 语言选择器 (LocaleSelector)

### ✅ 工具页面
- [x] Base64 编码/解码
- [x] UUID 生成器

### ✅ 通用文本
- [x] 按钮文本（复制、清空、保存等）
- [x] 提示信息
- [x] 状态信息

## 🔧 高级用法

### 带参数的翻译

```yaml
# locales/zh.yml
message:
  welcome: '欢迎, {name}!'
  count: '共有 {n} 个项目'
```

```vue
<template>
  <p>{{ t('message.welcome', { name: '张三' }) }}</p>
  <p>{{ t('message.count', { n: 10 }) }}</p>
</template>
```

### 在 TypeScript 中使用

```typescript
import { translate } from '@/plugins/i18n'

const message = translate('home.title')
console.log(message) // 输出: "我的工具" 或 "My Tools"
```

### 动态切换语言

```typescript
import { setLocale } from '@/plugins/i18n'

// 切换到英文
setLocale('en')

// 切换到中文
setLocale('zh')
```

## 🎨 最佳实践

### 1. 命名规范
- 使用小写字母和点号分隔：`home.title`
- 按功能模块组织：`tools.uuid.generate`
- 保持简洁明了：`common.copy`

### 2. 组织结构
```yaml
# 推荐结构
module:        # 模块名
  feature:     # 功能名
    action:    # 动作名
```

### 3. 避免硬编码
❌ 不好的做法：
```vue
<button>复制</button>
```

✅ 好的做法：
```vue
<button>{{ t('common.copy') }}</button>
```

### 4. 完整翻译
添加新功能时，确保所有支持的语言都有对应翻译：
```yaml
# en.yml
newFeature:
  title: 'New Feature'

# zh.yml
newFeature:
  title: '新功能'
```

## 📚 相关文档

- **[国际化使用说明.md](./国际化使用说明.md)** - 详细的使用文档
- **[i18n实施总结.md](./i18n实施总结.md)** - 实施细节和进度

## 🛠️ 技术栈

- **vue-i18n** `^11.2.1` - Vue.js 的国际化插件
- **@intlify/unplugin-vue-i18n** `^11.0.1` - Vite 集成插件

## ⚠️ 注意事项

### 1. YAML 语法
- 使用 2 个空格缩进
- 字符串包含特殊字符时需要引号
- 避免使用 `$` 等特殊符号（会被解析为链接格式）

### 2. 热更新
修改语言文件后，开发服务器会自动重载，无需手动刷新。

### 3. 构建优化
生产构建时，只会包含使用到的翻译文件，减小包体积。

## 🐛 常见问题

### Q: 修改语言文件后不生效？
A: 检查 YAML 语法是否正确，特别注意缩进。

### Q: 如何添加新语言？
A: 在 `locales/` 目录创建新文件（如 `ja.yml`），然后在 `LocaleSelector.vue` 中添加对应选项。

### Q: 翻译键不存在会怎样？
A: 会直接显示翻译键本身，便于调试。

## 📊 实施进度

- ✅ 核心功能实现
- ✅ 语言文件创建
- ✅ 组件集成
- ✅ 示例页面更新
- ⏳ 其他工具页面待翻译
- ⏳ 添加更多语言支持

## 🎉 总结

国际化功能已成功实施，完全参照 it-tools 的最佳实践。项目现在支持：
- ✅ 中英文双语
- ✅ 自动语言检测
- ✅ 语言持久化
- ✅ 实时切换
- ✅ 统一配置
- ✅ 开发者友好

可以开始将其他工具页面逐步迁移到 i18n 系统了！🚀

---

**参考项目**: [it-tools](https://github.com/CorentinTh/it-tools)  
**实施日期**: 2025-11-25

