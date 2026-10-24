import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { toolsData } from '@/lib/tools-data'

export const useFavoritesStore = defineStore('favorites', () => {
  const favorites = ref<Set<string>>(new Set())

  // 从localStorage加载收藏
  const stored = localStorage.getItem('favorites')
  if (stored) {
    try {
      const parsed = JSON.parse(stored)
      if (!Array.isArray(parsed)) throw new Error('Invalid favorites format')
      favorites.value = new Set(parsed.filter((key): key is string => typeof key === 'string')
        .map(key => key === 'pkiWorkbench' ? 'csrCreate' : key === 'pdfSeal' ? 'pdfVerify' : key)
        .filter(key => Object.prototype.hasOwnProperty.call(toolsData, key)))
      localStorage.setItem('favorites', JSON.stringify([...favorites.value]))
    } catch (e) {
      console.error('Failed to load favorites:', e)
    }
  }

  function toggleFavorite(toolKey: string) {
    if (favorites.value.has(toolKey)) {
      favorites.value.delete(toolKey)
    } else {
      favorites.value.add(toolKey)
    }
    // 保存到localStorage
    localStorage.setItem('favorites', JSON.stringify([...favorites.value]))
  }

  function isFavorite(toolKey: string): boolean {
    return favorites.value.has(toolKey)
  }

  const favoritesList = computed(() => [...favorites.value])

  return {
    favorites,
    favoritesList,
    toggleFavorite,
    isFavorite,
  }
})

