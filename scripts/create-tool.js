#!/usr/bin/env node

/**
 * 工具创建脚本
 * 
 * 使用方法:
 *   node scripts/create-tool.js <tool-path-name> [options]
 * 
 * 选项:
 *   --key, -k      工具标识键 (默认从路径名自动生成)
 *   --name, -n     工具名称 (中文)
 *   --desc, -d     工具描述
 *   --category, -c 工具分类（决定在哪个一级菜单下）
 *   --new-category 创建新的一级菜单分类
 *   --icon, -i     图标名称
 *   --yes, -y      使用默认值，跳过确认
 * 
 * 示例:
 *   # 交互式创建
 *   node scripts/create-tool.js timestamp-converter
 * 
 *   # 指定分类（一级菜单）
 *   node scripts/create-tool.js timestamp-converter -c Text_Manipulation -y
 * 
 *   # 创建新的一级菜单
 *   node scripts/create-tool.js my-tool --new-category "Date_Tools" -y
 * 
 *   # 完整选项
 *   node scripts/create-tool.js timestamp-converter -k timestamp -n "时间戳转换器" -d "Unix时间戳与日期互转" -c Text_Manipulation -i Clock -y
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const projectRoot = path.resolve(__dirname, '..')

// ==================== 配置 ====================

// 现有的分类（一级菜单）
const CATEGORIES = {
  'Encryption_Tools': { zh: '加密工具', en: 'Encryption Tools' },
  'Security_Tools': { zh: '安全工具', en: 'Security Tools' },
  'Text_Manipulation': { zh: '文本处理', en: 'Text Manipulation' },
  'Image_Videos': { zh: 'Image & Videos', en: 'Image & Videos' },
  'ID_Generators': { zh: 'ID 生成器', en: 'ID Generators' },
  'Code_Tools': { zh: '代码工具', en: 'Code Tools' },
}

const ICONS = [
  'Text', 'Hash', 'Lock', 'Link', 'QrCode', 'IdCard', 'FileJson',
  'Binary', 'Clock', 'Calculator', 'Code', 'Database', 'Settings',
  'Search', 'Filter', 'Regex', 'Palette', 'Image', 'FileText',
  'Calendar', 'Globe', 'Cpu', 'Terminal', 'Braces', 'Brackets'
]

// ==================== 工具函数 ====================

// kebab-case 转 PascalCase
function kebabToPascal(str) {
  return str
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join('')
}

// kebab-case 转 camelCase
function kebabToCamel(str) {
  const pascal = kebabToPascal(str)
  return pascal.charAt(0).toLowerCase() + pascal.slice(1)
}

// 获取颜色输出
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  red: '\x1b[31m',
  dim: '\x1b[2m',
}

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`)
}

function logStep(step, message) {
  console.log(`${colors.cyan}[${step}]${colors.reset} ${message}`)
}

function logSuccess(message) {
  console.log(`${colors.green}✓${colors.reset} ${message}`)
}

function logError(message) {
  console.log(`${colors.red}✗${colors.reset} ${message}`)
}

// 解析命令行参数
function parseArgs(args) {
  const result = {
    toolPathName: null,
    toolKey: null,
    toolName: null,
    description: null,
    category: null,
    newCategory: null,
    icon: null,
    yes: false,
  }
  
  for (let i = 0; i < args.length; i++) {
    const arg = args[i]
    const nextArg = args[i + 1]
    
    if (arg === '-y' || arg === '--yes') {
      result.yes = true
    } else if ((arg === '-k' || arg === '--key') && nextArg) {
      result.toolKey = nextArg
      i++
    } else if ((arg === '-n' || arg === '--name') && nextArg) {
      result.toolName = nextArg
      i++
    } else if ((arg === '-d' || arg === '--desc') && nextArg) {
      result.description = nextArg
      i++
    } else if ((arg === '-c' || arg === '--category') && nextArg) {
      result.category = nextArg
      i++
    } else if (arg === '--new-category' && nextArg) {
      result.newCategory = nextArg
      i++
    } else if ((arg === '-i' || arg === '--icon') && nextArg) {
      result.icon = nextArg
      i++
    } else if (!arg.startsWith('-') && !result.toolPathName) {
      result.toolPathName = arg
    }
  }
  
  return result
}

// ==================== 文件操作 ====================

// 读取模板文件
function readTemplate(templateName) {
  const templatePath = path.join(__dirname, 'templates', templateName)
  return fs.readFileSync(templatePath, 'utf-8')
}

// 创建视图组件
function createViewComponent(toolPathName, toolKey) {
  const toolPascalName = kebabToPascal(toolPathName)
  const toolDir = path.join(projectRoot, 'src/views/tools', toolPascalName)
  
  // 创建工具目录
  if (fs.existsSync(toolDir)) {
    logError(`工具目录已存在: ${toolDir}`)
    return false
  }
  fs.mkdirSync(toolDir, { recursive: true })

  // 创建 useTool.ts
  const useToolTemplate = readTemplate('useTool.ts.tpl')
  const useToolContent = useToolTemplate.replace(/\{\{toolPascalName\}\}/g, toolPascalName)
  const useToolPath = path.join(toolDir, `use${toolPascalName}.ts`)
  fs.writeFileSync(useToolPath, useToolContent, 'utf-8')

  // 创建 index.vue
  const indexTemplate = readTemplate('index.vue.tpl')
  const indexContent = indexTemplate
    .replace(/\{\{toolKey\}\}/g, toolKey)
    .replace(/\{\{toolPascalName\}\}/g, toolPascalName)
  const indexPath = path.join(toolDir, 'index.vue')
  fs.writeFileSync(indexPath, indexContent, 'utf-8')
  
  logSuccess(`创建工具目录: src/views/tools/${toolPascalName}`)
  logSuccess(`创建逻辑文件: src/views/tools/${toolPascalName}/use${toolPascalName}.ts`)
  logSuccess(`创建界面文件: src/views/tools/${toolPascalName}/index.vue`)
  return true
}

// 更新 tools-data.ts
function updateToolsData(toolPathName, toolKey, toolName, description, category, icon) {
  const filePath = path.join(projectRoot, 'src/lib/tools-data.ts')
  let content = fs.readFileSync(filePath, 'utf-8')
  
  const dataKey = kebabToCamel(toolPathName)
  
  // 检查是否已存在
  if (content.includes(`${dataKey}:`)) {
    logError(`tools-data.ts 中已存在 ${dataKey}`)
    return false
  }
  
  // 检测换行符类型
  const lineEnding = content.includes('\r\n') ? '\r\n' : '\n'
  
  // 构建新的工具配置（使用检测到的换行符）
  const newToolConfig = `${lineEnding}  ${dataKey}: {${lineEnding}    label: "${toolName}",${lineEnding}    description: "${description}",${lineEnding}    badges: ["${toolKey.charAt(0).toUpperCase() + toolKey.slice(1)}"],${lineEnding}    category: "${category}",${lineEnding}    path: "/tools/${toolPathName}",${lineEnding}    icon: "${icon}",${lineEnding}    isNew: true,${lineEnding}  },`
  
  // 查找最后一个工具配置的结束位置 "  },"
  const lastToolEnd = content.lastIndexOf('  },')
  
  if (lastToolEnd !== -1) {
    // 在 "  }," 之后插入新配置
    const insertPosition = lastToolEnd + 4 // "  }," 的长度
    content = content.slice(0, insertPosition) + newToolConfig + content.slice(insertPosition)
    fs.writeFileSync(filePath, content, 'utf-8')
    logSuccess(`更新工具数据: src/lib/tools-data.ts`)
    return true
  }
  
  logError('无法找到 tools-data.ts 的插入位置')
  return false
}

// 更新路由
function updateRouter(toolPathName) {
  const filePath = path.join(projectRoot, 'src/router/index.ts')
  let content = fs.readFileSync(filePath, 'utf-8')
  
  // 检查是否已存在
  if (content.includes(`'/tools/${toolPathName}'`)) {
    logError(`路由中已存在 /tools/${toolPathName}`)
    return false
  }
  
  const toolPascalName = kebabToPascal(toolPathName)
  
  // 构建新路由
  const newRoute = `        {
          path: '/tools/${toolPathName}',
          name: '${toolPathName}',
          component: () => import('../views/tools/${toolPascalName}/index.vue'),
        },`
  
  // 在 children 数组的最后一个路由后插入
  // 匹配类似: component: () => import('../views/tools/Xxx/index.vue'), 或 component: () => import('../views/tools/XxxView.vue'),
  const childrenEndMatch = content.match(/component: \(\) => import\('\.\.\/views\/tools\/[^']+'\),\s*\},/g)
  if (!childrenEndMatch || childrenEndMatch.length === 0) {
    logError('无法找到路由插入位置')
    return false
  }
  
  const lastRoute = childrenEndMatch[childrenEndMatch.length - 1]
  const insertPosition = content.lastIndexOf(lastRoute) + lastRoute.length
  
  content = content.slice(0, insertPosition) + '\n' + newRoute + content.slice(insertPosition)
  
  fs.writeFileSync(filePath, content, 'utf-8')
  logSuccess(`更新路由配置: src/router/index.ts`)
  return true
}

// 更新国际化文件 - 工具翻译
function updateLocale(localeFile, toolKey, isZh, toolName, description) {
  const filePath = path.join(projectRoot, 'locales', localeFile)
  let content = fs.readFileSync(filePath, 'utf-8')
  
  // 检查是否已存在
  if (content.includes(`  ${toolKey}:`)) {
    logError(`${localeFile} 中已存在 ${toolKey}`)
    return false
  }
  
  // 根据语言生成不同的翻译
  const translations = isZh ? `
  ${toolKey}:
    title: '${toolName}'
    description: '${description}'
    input: '输入'
    output: '输出'
    action: '执行'` : `
  ${toolKey}:
    title: '${toolName}'
    description: '${description}'
    input: 'Input'
    output: 'Output'
    action: 'Execute'`
  
  // 在 tools: 部分的末尾插入（在 common: 之前）
  const commonIndex = content.indexOf('\ncommon:')
  if (commonIndex === -1) {
    logError(`无法在 ${localeFile} 中找到插入位置`)
    return false
  }
  
  content = content.slice(0, commonIndex) + translations + '\n' + content.slice(commonIndex)
  
  fs.writeFileSync(filePath, content, 'utf-8')
  logSuccess(`更新国际化: locales/${localeFile}`)
  return true
}

// 添加新的一级菜单分类到 locale 文件
function addCategoryToLocale(localeFile, categoryKey, categoryName) {
  const filePath = path.join(projectRoot, 'locales', localeFile)
  let content = fs.readFileSync(filePath, 'utf-8')
  
  // 检查是否已存在
  if (content.includes(`${categoryKey}:`)) {
    return true // 已存在，不需要添加
  }
  
  // 检测换行符类型
  const lineEnding = content.includes('\r\n') ? '\r\n' : '\n'
  
  // 查找最后一个分类条目 (ID_Generators 或其他)
  // 格式如: "    ID_Generators: 'ID 生成器'"
  const categoryPattern = /    \w+: '[^']+'/g
  let lastMatch = null
  let match
  
  while ((match = categoryPattern.exec(content)) !== null) {
    // 确保在 sidebar.categories 区域内
    const beforeMatch = content.slice(0, match.index)
    if (beforeMatch.includes('categories:') && !beforeMatch.includes('tools:')) {
      lastMatch = match
    }
  }
  
  if (lastMatch) {
    // 在最后一个分类后插入
    const insertPosition = lastMatch.index + lastMatch[0].length
    const newCategory = `${lineEnding}    ${categoryKey}: '${categoryName}'`
    content = content.slice(0, insertPosition) + newCategory + content.slice(insertPosition)
    fs.writeFileSync(filePath, content, 'utf-8')
    return true
  }
  
  logError(`无法在 ${localeFile} 中找到分类插入位置`)
  return false
}

// ==================== 交互式输入 ====================

async function prompt(question) {
  const readline = await import('readline')
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  })
  
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close()
      resolve(answer.trim())
    })
  })
}

async function selectFromList(question, options, defaultIndex = 0) {
  console.log(`\n${question}`)
  options.forEach((opt, i) => {
    const marker = i === defaultIndex ? `${colors.green}*${colors.reset}` : ' '
    console.log(`  ${marker}${colors.cyan}${i + 1}${colors.reset}. ${opt}`)
  })
  
  const answer = await prompt(`请选择 (1-${options.length}, 默认 ${defaultIndex + 1}): `)
  
  if (!answer) return options[defaultIndex]
  
  const index = parseInt(answer) - 1
  if (index >= 0 && index < options.length) {
    return options[index]
  }
  return options[defaultIndex]
}

async function selectCategory() {
  const categoryKeys = Object.keys(CATEGORIES)
  const categoryOptions = categoryKeys.map(key => `${key} (${CATEGORIES[key].zh})`)
  categoryOptions.push(`${colors.yellow}+ 创建新分类${colors.reset}`)
  
  console.log(`\n${colors.bright}请选择工具分类（决定在哪个一级菜单下）：${colors.reset}`)
  categoryOptions.forEach((opt, i) => {
    const marker = i === 2 ? `${colors.green}*${colors.reset}` : ' ' // 默认 Text_Manipulation
    console.log(`  ${marker}${colors.cyan}${i + 1}${colors.reset}. ${opt}`)
  })
  
  const answer = await prompt(`请选择 (1-${categoryOptions.length}, 默认 3): `)
  
  if (!answer) return { key: categoryKeys[2], isNew: false }
  
  const index = parseInt(answer) - 1
  
  if (index === categoryKeys.length) {
    // 创建新分类
    const newKey = await prompt('请输入新分类标识 (如 Date_Tools): ')
    if (!newKey) {
      return { key: categoryKeys[2], isNew: false }
    }
    const zhName = await prompt('请输入中文名称 (如 日期工具): ')
    const enName = await prompt('请输入英文名称 (如 Date Tools): ')
    
    return { 
      key: newKey, 
      isNew: true, 
      zhName: zhName || newKey.replace(/_/g, ' '),
      enName: enName || newKey.replace(/_/g, ' ')
    }
  }
  
  if (index >= 0 && index < categoryKeys.length) {
    return { key: categoryKeys[index], isNew: false }
  }
  
  return { key: categoryKeys[2], isNew: false }
}

// ==================== 主流程 ====================

async function main() {
  console.log(`
${colors.bright}╔════════════════════════════════════════╗
║      996-Tools 工具创建向导           ║
╚════════════════════════════════════════╝${colors.reset}
`)

  // 解析命令行参数
  const args = parseArgs(process.argv.slice(2))
  
  let { toolPathName, toolKey, toolName, description, category, newCategory, icon, yes } = args
  
  // 验证必需参数
  if (!toolPathName) {
    if (yes) {
      logError('非交互模式下必须提供工具路径名称')
      console.log('\n使用方法: node scripts/create-tool.js <tool-path-name> [options]')
      process.exit(1)
    }
    toolPathName = await prompt('请输入工具路径名称 (kebab-case, 如 timestamp-converter): ')
  }
  
  if (!toolPathName) {
    logError('工具路径名称不能为空')
    process.exit(1)
  }
  
  // 验证格式
  if (!/^[a-z][a-z0-9]*(-[a-z0-9]+)*$/.test(toolPathName)) {
    logError('工具路径名称格式不正确，请使用 kebab-case (如 my-tool)')
    process.exit(1)
  }
  
  // 设置默认值
  toolKey = toolKey || kebabToCamel(toolPathName)
  
  // 处理分类
  let categoryInfo = { key: category, isNew: false, zhName: '', enName: '' }
  
  if (newCategory) {
    // 命令行指定了新分类
    categoryInfo = { 
      key: newCategory, 
      isNew: true,
      zhName: newCategory.replace(/_/g, ' '),
      enName: newCategory.replace(/_/g, ' ')
    }
  } else if (category) {
    // 命令行指定了已有分类
    if (!CATEGORIES[category]) {
      log(`警告: 分类 "${category}" 不在预设列表中，将作为新分类创建`, 'yellow')
      categoryInfo = { 
        key: category, 
        isNew: true,
        zhName: category.replace(/_/g, ' '),
        enName: category.replace(/_/g, ' ')
      }
    }
  }
  
  if (yes) {
    // 非交互模式，使用默认值
    toolName = toolName || `新工具 - ${kebabToPascal(toolPathName)}`
    description = description || '这是一个新工具'
    if (!categoryInfo.key) {
      categoryInfo = { key: 'Text_Manipulation', isNew: false }
    }
    icon = icon || 'Text'
  } else {
    // 交互模式
    log('\n请输入工具的基本信息：', 'bright')
    
    toolName = toolName || await prompt(`工具名称 (中文，如 时间戳转换器): `) || `新工具 - ${kebabToPascal(toolPathName)}`
    description = description || await prompt('工具描述 (中文): ') || '这是一个新工具'
    
    if (!categoryInfo.key) {
      categoryInfo = await selectCategory()
    }
    
    icon = icon || await selectFromList('请选择图标:', ICONS, 0)
    
    // 确认信息
    console.log(`
${colors.bright}即将创建以下工具：${colors.reset}
  路径名称: ${colors.cyan}${toolPathName}${colors.reset}
  标识键:   ${colors.cyan}${toolKey}${colors.reset}
  工具名称: ${colors.cyan}${toolName}${colors.reset}
  描述:     ${colors.cyan}${description}${colors.reset}
  分类:     ${colors.cyan}${categoryInfo.key}${colors.reset}${categoryInfo.isNew ? ` ${colors.yellow}(新建)${colors.reset}` : ''}
  图标:     ${colors.cyan}${icon}${colors.reset}
`)
    
    const confirm = await prompt('确认创建？(y/n): ')
    if (confirm.toLowerCase() !== 'y' && confirm.toLowerCase() !== 'yes') {
      log('已取消创建', 'yellow')
      process.exit(0)
    }
  }
  
  category = categoryInfo.key
  
  console.log('')
  log('开始创建工具...', 'bright')
  console.log('')
  
  // 如果是新分类，先添加到 locale 文件
  if (categoryInfo.isNew) {
    logStep('0/4', '创建新的一级菜单分类')
    const zhSuccess = addCategoryToLocale('zh.yml', category, categoryInfo.zhName || category.replace(/_/g, ' '))
    const enSuccess = addCategoryToLocale('en.yml', category, categoryInfo.enName || category.replace(/_/g, ' '))
    if (zhSuccess && enSuccess) {
      logSuccess(`创建新分类: ${category}`)
    } else {
      logError('创建新分类失败')
    }
  }
  
  // 执行创建步骤
  let success = true
  
  logStep('1/4', '创建视图组件')
  if (!createViewComponent(toolPathName, toolKey)) {
    success = false
  }
  
  logStep('2/4', '更新工具数据')
  if (!updateToolsData(toolPathName, toolKey, toolName, description, category, icon)) {
    success = false
  }
  
  logStep('3/4', '更新路由配置')
  if (!updateRouter(toolPathName)) {
    success = false
  }
  
  logStep('4/4', '更新国际化文件')
  if (!updateLocale('zh.yml', toolKey, true, toolName, description)) {
    success = false
  }
  if (!updateLocale('en.yml', toolKey, false, toolName, description)) {
    success = false
  }
  
  console.log('')
  
  if (success) {
    log('═══════════════════════════════════════', 'green')
    log('  ✓ 工具创建成功！', 'green')
    log('═══════════════════════════════════════', 'green')
    console.log(`
${colors.bright}后续步骤：${colors.reset}

1. 编辑工具逻辑:
   ${colors.cyan}src/views/tools/${kebabToPascal(toolPathName)}/use${kebabToPascal(toolPathName)}.ts${colors.reset}

2. 编辑工具界面 (可选):
   ${colors.cyan}src/views/tools/${kebabToPascal(toolPathName)}/index.vue${colors.reset}

3. 更新国际化文本:
   ${colors.cyan}locales/zh.yml${colors.reset} - 修改 tools.${toolKey} 部分
   ${colors.cyan}locales/en.yml${colors.reset} - 修改 tools.${toolKey} 部分

4. 启动开发服务器测试:
   ${colors.cyan}pnpm dev${colors.reset}

5. 访问工具页面:
   ${colors.cyan}http://localhost:5173/tools/${toolPathName}${colors.reset}

${colors.dim}工具位于一级菜单: ${category}${colors.reset}
`)
  } else {
    log('工具创建过程中出现问题，请检查上述错误信息', 'yellow')
  }
}

main().catch(console.error)
