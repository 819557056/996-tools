<template>
  <div class="min-h-screen flex flex-col">
    <PortalHeader />
    <Breadcrumb v-if="showBreadcrumb" :items="breadcrumbItems" />
    <main class="flex-1">
      <slot />
    </main>
    <PortalFooter />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import PortalHeader from '@/components/PortalHeader.vue'
import PortalFooter from '@/components/PortalFooter.vue'
import Breadcrumb from '@/components/Breadcrumb.vue'

interface Props {
  showBreadcrumb?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  showBreadcrumb: true
})

const route = useRoute()

const breadcrumbItems = computed(() => {
  const items: Array<{ label: string; to?: string }> = []
  
  // 根据路由生成面包屑
  if (route.path !== '/') {
    const pathSegments = route.path.split('/').filter(Boolean)
    
    pathSegments.forEach((segment, index) => {
      const path = '/' + pathSegments.slice(0, index + 1).join('/')
      const isLast = index === pathSegments.length - 1
      
      // 简单的标签生成（可以根据路由meta或i18n优化）
      let label = segment
      if (segment === 'portal') {
        label = '门户'
      } else if (segment === 'apps') {
        label = '应用中心'
      } else if (segment === 'articles') {
        label = '文章'
      } else {
        // 首字母大写
        label = segment.charAt(0).toUpperCase() + segment.slice(1)
      }
      
      items.push({
        label,
        to: isLast ? undefined : path
      })
    })
  }
  
  return items
})
</script>

