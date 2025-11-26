import { defineStore } from 'pinia'
import { ref, watch } from 'vue'

export type Theme = 'light' | 'dark' | 'system'

export const useThemeStore = defineStore('theme', () => {
  const theme = ref<Theme>('system')
  const actualTheme = ref<'light' | 'dark'>('light')

  // 从localStorage加载主题
  const storedTheme = localStorage.getItem('theme') as Theme | null
  if (storedTheme) {
    theme.value = storedTheme
  }

  // 监听系统主题变化
  const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
  
  function updateActualTheme() {
    if (theme.value === 'system') {
      actualTheme.value = mediaQuery.matches ? 'dark' : 'light'
    } else {
      actualTheme.value = theme.value
    }
    
    // 更新DOM
    if (actualTheme.value === 'dark') {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
  }

  mediaQuery.addEventListener('change', updateActualTheme)

  // 监听主题变化
  watch(theme, (newTheme) => {
    localStorage.setItem('theme', newTheme)
    updateActualTheme()
  }, { immediate: true })

  function setTheme(newTheme: Theme) {
    theme.value = newTheme
  }

  function toggleTheme() {
    if (actualTheme.value === 'light') {
      theme.value = 'dark'
    } else {
      theme.value = 'light'
    }
  }

  return {
    theme,
    actualTheme,
    setTheme,
    toggleTheme,
  }
})

