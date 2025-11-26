import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export const useFavoritesStore = defineStore('favorites', () => {
  const favorites = ref<Set<string>>(new Set())

  // 从localStorage加载收藏
  const stored = localStorage.getItem('favorites')
  if (stored) {
    try {
      const parsed = JSON.parse(stored)
      favorites.value = new Set(parsed)
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

