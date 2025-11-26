<script setup lang="ts">
import { useI18n } from 'vue-i18n'

const { locale } = useI18n()

// 改变语言
function changeLocale(event: Event) {
  const target = event.target as HTMLSelectElement
  const newLocale = target.value
  locale.value = newLocale
  localStorage.setItem('locale', newLocale)
}
</script>

<template>
  <select
    :value="locale"
    @change="changeLocale"
    class="h-9 rounded-md border border-input bg-background px-3 py-1 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 cursor-pointer hover:bg-accent transition-colors"
  >
    <option value="zh">中文</option>
    <option value="en">English</option>
  </select>
</template>

