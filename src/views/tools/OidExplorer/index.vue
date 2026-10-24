<script setup lang="ts">
import { ref, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import BaseCard from '@/components/ui/BaseCard.vue'
import { oidEntries } from '@/lib/oid-data'
const { t } = useI18n()
const query = ref(''), category = ref('')
const categories = [...new Set(oidEntries.map(item => item.category))]
const matches = computed(() => oidEntries.filter(item => (!category.value || item.category === category.value) && [item.oid,item.name,item.description].join(' ').toLowerCase().includes(query.value.trim().toLowerCase())))
const parent = computed(() => {
  const q = query.value.trim()
  if (!/^\d+(\.\d+)+$/.test(q) || oidEntries.some(item => item.oid === q)) return null
  return oidEntries.filter(item => q.startsWith(item.oid + '.')).sort((a,b) => b.oid.length-a.oid.length)[0]
})
</script>
<template>
  <BaseCard class="p-4 md:p-6 space-y-5 min-w-0">
    <h1 class="text-2xl font-bold">{{ t('tools.oidExplorer.title') }}</h1>
    <div class="flex flex-wrap gap-3"><input v-model="query" :aria-label="t('localTools.searchOid')" :placeholder="t('localTools.searchOid')" class="tool-input flex-1 min-w-40" /><select v-model="category" :aria-label="t('localTools.allCategories')" class="tool-input md:!w-72"><option value="">{{ t('localTools.allCategories') }}</option><option v-for="item in categories" :key="item">{{ item }}</option></select></div>
    <p class="text-sm text-muted-foreground">{{ t('localTools.local') }} · {{ matches.length }} / {{ oidEntries.length }}</p>
    <p v-if="parent" class="text-sm rounded border p-3">{{ t('localTools.oidMissing') }} {{ t('localTools.oidParent') }}: <button class="text-primary underline" @click="query=parent.oid">{{ parent.oid }} · {{ parent.name }}</button></p>
    <div class="overflow-x-auto"><table class="w-full text-left text-sm"><thead><tr class="border-b"><th class="p-3">OID</th><th class="p-3">Name</th><th class="p-3">Description</th></tr></thead><tbody><tr v-for="item in matches" :key="item.oid" class="border-b"><td class="p-3 font-mono whitespace-nowrap select-all">{{ item.oid }}</td><td class="p-3">{{ item.name }}</td><td class="p-3">{{ item.description }}</td></tr></tbody></table></div>
    <p v-if="!matches.length" class="text-sm">{{ t('localTools.empty') }}</p>
  </BaseCard>
</template>
