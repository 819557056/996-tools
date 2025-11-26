import { createI18n } from 'vue-i18n'
import messages from '@intlify/unplugin-vue-i18n/messages'

// 获取浏览器语言
function getBrowserLocale(): string {
  const navigatorLocale = navigator.language
  if (!navigatorLocale) {
    return 'en'
  }
  // 将 'zh-CN' 转换为 'zh'
  return navigatorLocale.split('-')[0]
}

// 从本地存储获取语言设置
function getStoredLocale(): string | null {
  return localStorage.getItem('locale')
}

// 保存语言设置到本地存储
function setStoredLocale(locale: string): void {
  localStorage.setItem('locale', locale)
}

// 确定初始语言
function getInitialLocale(): string {
  const stored = getStoredLocale()
  if (stored && ['en', 'zh'].includes(stored)) {
    return stored
  }
  const browser = getBrowserLocale()
  if (['en', 'zh'].includes(browser)) {
    return browser
  }
  return 'zh' // 默认中文
}

export const i18n = createI18n({
  legacy: false,
  locale: getInitialLocale(),
  fallbackLocale: 'en',
  messages,
  globalInjection: true,
})

// 导出一个辅助函数来改变语言
export function setLocale(locale: string): void {
  i18n.global.locale.value = locale
  setStoredLocale(locale)
}

// 导出翻译函数
export function translate(key: string): string {
  const hasKey = i18n.global.te(key)
  return hasKey ? i18n.global.t(key) : key
}

// 导出 i18n 实例供其他地方使用
export default i18n
