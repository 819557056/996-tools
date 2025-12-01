# JSON 高级工具集实现说明

## 📋 项目概述

本次更新将 JSON 格式化功能提升到了 **IDE 级别**，新增了 4 个专业的 JSON 处理工具，涵盖查询、对比、代码生成和可视化等企业级功能。

## ✨ 新增工具列表

### 1. 🎯 代码生成器 (Code Generator)
**路径:** `/tools/code-generator`

**功能特性:**
- 将 JSON 自动转换为多种编程语言的类型定义
- 支持语言：
  - TypeScript (Interface)
  - Go (Struct)
  - Java (Class with getters/setters)
  - Python (Dataclass)
  - Rust (Struct with serde)
  - Protobuf (Message)
- 智能识别嵌套对象和数组
- 支持自定义根类型名称
- 实时预览和一键复制

**使用场景:**
- API 对接时快速生成类型定义
- 前后端协作，统一数据结构
- 代码重构，提高开发效率

---

### 2. 🔍 JSON 查询工具 (JSON Query)
**路径:** `/tools/json-query`

**功能特性:**
- 支持两种强大的查询引擎：
  - **JSONPath**: `$.store.book[?(@.price < 10)].title`
  - **JMESPath**: `store.book[?price < \`10\`].title`
- 实时查询和结果预览
- 查询历史记录（最多保存 20 条）
- 内置快速示例和语法帮助
- 支持复杂过滤、递归查找、数组操作

**使用场景:**
- 从大型 JSON 响应中提取特定数据
- API 调试和数据分析
- 日志文件解析

**示例查询:**
```json
// 输入数据
{
  "store": {
    "book": [
      { "title": "Book A", "price": 8.95 },
      { "title": "Book B", "price": 12.99 }
    ]
  }
}

// JSONPath 查询: $.store.book[?(@.price < 10)].title
// 结果: ["Book A"]
```

---

### 3. ⚖️ JSON 对比工具 (JSON Diff)
**路径:** `/tools/json-diff`

**功能特性:**
- 双栏对比视图，层级对齐
- 使用 Monaco Diff Editor 实现专业级对比
- 实时统计差异：
  - 🟢 新增字段数
  - 🟡 修改字段数
  - 🔴 删除字段数
- 支持格式化左右两侧 JSON
- 交换、复制等便捷操作

**使用场景:**
- API 版本迭代对比
- 配置文件变更审查
- 数据一致性检查

---

### 4. 📊 JSON 可视化工具 (JSON Visualizer)
**路径:** `/tools/json-visualizer`

**功能特性:**
- 三种可视化方式：
  - **树状图 (Tree)**: 清晰展示层级结构，支持展开/折叠
  - **关系图谱 (Graph)**: 显示节点关系，支持拖拽和缩放
  - **旭日图 (Sunburst)**: 径向层次可视化，点击聚焦
- 基于 ECharts 实现，交互流畅
- 支持导出为高清 PNG 图片
- 自动计算节点大小和颜色

**使用场景:**
- 数据结构可视化，帮助理解复杂 JSON
- 团队沟通，产品经理也能看懂
- 文档配图，技术分享

---

## 🛠️ 技术实现

### 依赖库
```json
{
  "jmespath": "^0.x",           // JMESPath 查询引擎
  "jsonpath-plus": "^9.x",       // JSONPath 查询引擎
  "echarts": "^6.0.0",           // 数据可视化
  "json5": "^2.2.3",             // 支持注释的 JSON 解析
  "@guolao/vue-monaco-editor": "^1.6.0"  // Monaco 编辑器
}
```

### 项目结构
```
src/views/tools/
├── CodeGenerator/
│   ├── index.vue              # 代码生成器主界面
│   └── useCodeGenerator.ts    # 代码生成逻辑
├── JsonQuery/
│   ├── index.vue              # 查询工具主界面
│   └── useJsonQuery.ts        # 查询引擎封装
├── JsonDiff/
│   ├── index.vue              # 对比工具主界面
│   └── useJsonDiff.ts         # 差异计算逻辑
└── JsonVisualizer/
    ├── index.vue              # 可视化主界面
    └── useJsonVisualizer.ts   # ECharts 图表配置
```

### 路由配置
已在 `src/router/index.ts` 中添加 4 个新路由：
- `/tools/code-generator`
- `/tools/json-query`
- `/tools/json-diff`
- `/tools/json-visualizer`

### 国际化支持
已在 `locales/zh.yml` 和 `locales/en.yml` 中添加完整的中英文翻译。

---

## 🚀 使用指南

### 启动项目
```bash
pnpm dev
```

访问: http://localhost:3000/

### 快速体验

1. **代码生成器**
   - 点击侧边栏 "Development" → "代码生成器"
   - 点击 "示例" 加载示例 JSON
   - 选择目标语言（如 TypeScript）
   - 点击 "生成"，即可看到生成的类型定义

2. **JSON 查询**
   - 点击侧边栏 "Development" → "JSON 查询"
   - 点击 "示例" 加载示例数据
   - 尝试快速示例：点击 "价格小于10的书"
   - 或手动输入查询表达式

3. **JSON 对比**
   - 点击侧边栏 "Development" → "JSON 对比"
   - 点击 "示例" 加载两个示例 JSON
   - 点击 "对比"，查看差异统计和高亮

4. **JSON 可视化**
   - 点击侧边栏 "Development" → "JSON 可视化"
   - 点击 "示例" 加载示例数据
   - 切换不同可视化类型（树状图/关系图谱/旭日图）
   - 点击 "导出" 保存为图片

---

## 🎨 UI/UX 亮点

- ✅ **双栏布局**: 输入输出分离，操作流畅
- ✅ **Monaco 编辑器**: VSCode 级别的编辑体验
- ✅ **实时预览**: 输入即响应
- ✅ **快速示例**: 一键加载，快速上手
- ✅ **深色模式**: 完美适配明暗主题
- ✅ **响应式设计**: 适配不同屏幕尺寸
- ✅ **键盘快捷键**: Enter 触发操作

---

## 📈 性能优化

- 使用 `defineAsyncComponent` 异步加载 Monaco 编辑器
- ECharts 按需引入，减小打包体积
- 查询历史限制 20 条，避免内存泄漏
- 图表实例销毁机制，防止重复创建

---

## 🔜 未来扩展方向

1. **JSON Schema 验证器**
2. **JSON 格式转换器** (JSON ↔ YAML ↔ TOML)
3. **JSON 路径测试工具**
4. **批量 JSON 处理**
5. **JSON Mock 数据生成器**

---

## 📝 注意事项

1. **浏览器兼容性**: 需要现代浏览器支持 ES2020+
2. **大文件处理**: 建议 JSON 文件不超过 5MB
3. **复杂查询**: 过于复杂的 JMESPath 表达式可能影响性能

---

## 🙏 致谢

感谢开源社区提供的优秀库：
- [jmespath](https://github.com/jmespath/jmespath.js)
- [JSONPath Plus](https://github.com/JSONPath-Plus/JSONPath)
- [Apache ECharts](https://echarts.apache.org/)
- [Monaco Editor](https://microsoft.github.io/monaco-editor/)

---

**版本**: v1.1.0  
**更新日期**: 2024-12-01  
**作者**: 996工具箱团队

