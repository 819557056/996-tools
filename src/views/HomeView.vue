<template>
  <div class="relative min-h-screen">
    <!-- Background Gradient -->
    <div class="absolute inset-0 -z-10 h-full w-full bg-background bg-[linear-gradient(to_right,#8080800a_1px,transparent_1px),linear-gradient(to_bottom,#8080800a_1px,transparent_1px)] bg-[size:14px_24px]">
      <div class="absolute left-0 right-0 top-0 -z-10 m-auto h-[310px] w-[310px] rounded-full bg-primary/20 opacity-20 blur-[100px]"></div>
    </div>

    <!-- Hero Section -->
    <section class="relative pt-8 pb-8 md:pt-16 md:pb-12 overflow-hidden px-4">
      <div class="container relative z-10 mx-auto max-w-5xl text-center">
        <div class="inline-flex items-center rounded-full border px-3 py-1 text-sm font-medium bg-secondary/50 backdrop-blur-sm mb-4">
          <span class="flex h-2 w-2 rounded-full bg-primary mr-2 animate-pulse"></span>
          {{ t('home.slogan') }}
        </div>
        
        <h1 class="text-4xl md:text-6xl font-bold tracking-tight mb-6 bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
          {{ t('home.title') }}
        </h1>
        
        <p class="text-xl md:text-2xl text-muted-foreground mb-10 max-w-3xl mx-auto leading-relaxed">
          {{ t('home.subtitle') }}
        </p>

        <div class="flex flex-col sm:flex-row items-center justify-center gap-4">
          <a href="#featured" class="w-full sm:w-auto inline-flex h-12 items-center justify-center rounded-md bg-primary px-8 text-sm font-medium text-primary-foreground shadow transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50">
            {{ locale === 'zh' ? '开始使用' : 'Get Started' }}
            <ArrowDown class="ml-2 h-4 w-4" />
          </a>
          <a :href="siteConfig.links.github" target="_blank" class="w-full sm:w-auto inline-flex h-12 items-center justify-center rounded-md border border-input bg-background px-8 text-sm font-medium shadow-sm transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring">
            <Github class="mr-2 h-4 w-4" />
            GitHub
          </a>
        </div>
      </div>
    </section>

    <!-- Quick Stats -->
    <section class="container mx-auto px-4 -mt-4 relative z-20 mb-8">
      <div class="grid grid-cols-2 md:grid-cols-4 gap-4 bg-card/50 backdrop-blur-xl border rounded-2xl p-4 shadow-lg max-w-4xl mx-auto">
        <div class="p-2 md:p-4 text-center border-r border-b md:border-b-0 border-border/50 last:border-0 odd:border-r">
          <div class="text-2xl md:text-3xl font-bold text-primary mb-1">{{ Object.keys(toolsData).length }}+</div>
          <div class="text-xs md:text-sm text-muted-foreground font-medium">{{ t('home.categories.all') }}</div>
        </div>
        <div class="p-2 md:p-4 text-center md:border-r border-b md:border-b-0 border-border/50 last:border-0">
          <div class="text-2xl md:text-3xl font-bold text-primary mb-1">100%</div>
          <div class="text-xs md:text-sm text-muted-foreground font-medium">{{ locale === 'zh' ? '免费开源' : 'Free & Open Source' }}</div>
        </div>
        <div class="p-2 md:p-4 text-center border-r md:border-none border-border/50 last:border-0">
          <div class="text-2xl md:text-3xl font-bold text-primary mb-1">0</div>
          <div class="text-xs md:text-sm text-muted-foreground font-medium">{{ locale === 'zh' ? '服务器上传' : 'Server Uploads' }}</div>
        </div>
        <div class="p-2 md:p-4 text-center">
          <div class="text-2xl md:text-3xl font-bold text-primary mb-1">Vue 3</div>
          <div class="text-xs md:text-sm text-muted-foreground font-medium">{{ locale === 'zh' ? '高性能架构' : 'High Performance' }}</div>
        </div>
      </div>
    </section>

    <!-- Featured Tools (Auto Horizontal Scroll / 9-Grid-ish) -->
    <section id="featured" class="container mx-auto px-4 mb-8">
      <div class="flex items-center justify-between mb-4">
        <div>
          <h2 class="text-xl md:text-2xl font-bold tracking-tight mb-1">{{ locale === 'zh' ? '热门工具' : 'Featured Tools' }}</h2>
          <p class="text-muted-foreground text-xs">{{ locale === 'zh' ? '最受开发者欢迎的效率工具' : 'Most popular tools for developers' }}</p>
        </div>
      </div>
      
      <!-- Horizontal Scroll Grid Container -->
      <div 
        class="relative group"
        @mouseenter="pauseAutoScroll"
        @mouseleave="resumeAutoScroll"
      >
        <div 
          ref="scrollContainer"
          class="flex gap-4 overflow-x-scroll pb-4 scrollbar-hide"
          style="-webkit-overflow-scrolling: touch;"
        >
          <!-- All Tools Items (Compact) -->
          <div 
            v-for="tool in displayTools" 
            :key="`${tool.path}-${tool.duplicateId || ''}`" 
            class="snap-start flex-shrink-0 w-[280px]"
          >
            <ToolCard :tool="tool" :compact="true" class="h-full" />
          </div>
          
          <!-- View More Card -->
           <div 
             @click="openSearch"
             class="snap-start flex-shrink-0 w-[150px] flex items-center justify-center border rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors cursor-pointer"
           >
             <div class="text-center p-4 text-muted-foreground">
               <p class="text-sm mb-2">{{ locale === 'zh' ? '查看更多' : 'View More' }}</p>
               <ArrowRight class="mx-auto h-5 w-5" />
             </div>
           </div>
        </div>
      </div>
    </section>

    <!-- Features Grid -->
    <section class="py-16 bg-muted/30">
      <div class="container mx-auto px-4">
        <div class="text-center max-w-2xl mx-auto mb-12">
          <h2 class="text-2xl md:text-3xl font-bold mb-4">{{ locale === 'zh' ? '为什么选择 996 Tools' : 'Why Choose 996 Tools' }}</h2>
          <p class="text-muted-foreground">
            {{ locale === 'zh' ? '我们致力于提供最纯粹、最安全的开发工具体验' : 'Dedicated to providing the purest and safest development tool experience' }}
          </p>
        </div>
        
        <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div class="group p-6 rounded-2xl bg-card border hover:border-primary/50 transition-all hover:shadow-lg">
            <div class="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center mb-4 text-primary group-hover:scale-110 transition-transform">
              <Zap class="h-5 w-5" />
            </div>
            <h3 class="font-bold text-lg mb-2">{{ locale === 'zh' ? '闪电般快速' : 'Lightning Fast' }}</h3>
            <p class="text-sm text-muted-foreground leading-relaxed">
              {{ locale === 'zh' ? '基于现代 Web 技术构建，所有计算在本地完成，告别网络延迟。' : 'Built on modern web tech, all processing is done locally. Say goodbye to latency.' }}
            </p>
          </div>

          <div class="group p-6 rounded-2xl bg-card border hover:border-primary/50 transition-all hover:shadow-lg">
            <div class="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center mb-4 text-primary group-hover:scale-110 transition-transform">
              <Shield class="h-5 w-5" />
            </div>
            <h3 class="font-bold text-lg mb-2">{{ locale === 'zh' ? '隐私安全' : 'Privacy First' }}</h3>
            <p class="text-sm text-muted-foreground leading-relaxed">
              {{ locale === 'zh' ? '您的数据永远不会离开您的浏览器。我们不存储任何输入内容。' : 'Your data never leaves your browser. We store absolutely no input content.' }}
            </p>
          </div>

          <div class="group p-6 rounded-2xl bg-card border hover:border-primary/50 transition-all hover:shadow-lg">
            <div class="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center mb-4 text-primary group-hover:scale-110 transition-transform">
              <Code2 class="h-5 w-5" />
            </div>
            <h3 class="font-bold text-lg mb-2">{{ locale === 'zh' ? '开发者友好' : 'Developer Friendly' }}</h3>
            <p class="text-sm text-muted-foreground leading-relaxed">
              {{ locale === 'zh' ? '开源透明，支持自定义扩展。这就是为您量身打造的工具箱。' : 'Open source, customizable. This is the toolkit built just for you.' }}
            </p>
          </div>
        </div>
      </div>
    </section>

    <!-- Search Command Component Reference to trigger open -->
    <SearchCommand ref="searchCommandRef" class="hidden" />
  </div>
</template>

<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted, nextTick } from 'vue'
import { useI18n } from 'vue-i18n'
import { ArrowDown, Github, Zap, Shield, Code2, ArrowRight } from 'lucide-vue-next'
import { toolsData } from '@/lib/tools-data'
import { siteConfig } from '@/config/site'
import ToolCard from '@/components/ToolCard.vue'
import SearchCommand from '@/components/SearchCommand.vue' // Import SearchCommand to use its method

const { t, locale } = useI18n()

// Get ALL tools
const allTools = computed(() => Object.values(toolsData))

// Create a duplicated list for infinite scroll effect (x3 to be safe)
const displayTools = computed(() => {
  const tools = Object.values(toolsData)
  // Add a unique ID suffix to avoid key collisions
  const set1 = tools.map(t => ({ ...t, duplicateId: '1' }))
  const set2 = tools.map(t => ({ ...t, duplicateId: '2' }))
  const set3 = tools.map(t => ({ ...t, duplicateId: '3' }))
  return [...set1, ...set2, ...set3]
})

const scrollContainer = ref<HTMLElement | null>(null)
let scrollInterval: ReturnType<typeof setInterval> | null = null
const isPaused = ref(false)
const autoScrollSpeed = 1 // pixels per tick
const autoScrollDelay = 30 // ms per tick

const startAutoScroll = () => {
  if (scrollInterval) return
  
  scrollInterval = setInterval(() => {
    if (scrollContainer.value && !isPaused.value) {
      const container = scrollContainer.value
      const { scrollLeft, scrollWidth } = container
      
      // Calculate one set width based on total content width
      const oneSetWidth = scrollWidth / 3
      
      // Scroll forward
      container.scrollLeft += autoScrollSpeed
      
      // If we've scrolled past the first set, jump back to start to create infinite loop
      // When scrollLeft equals oneSetWidth, we are viewing the start of the second set,
      // which looks exactly like the start of the first set (scrollLeft = 0).
      if (scrollLeft >= oneSetWidth) {
        container.scrollLeft = scrollLeft - oneSetWidth
      }
    }
  }, autoScrollDelay)
}

const stopAutoScroll = () => {
  if (scrollInterval) {
    clearInterval(scrollInterval)
    scrollInterval = null
  }
}

const pauseAutoScroll = () => {
  isPaused.value = true
}

const resumeAutoScroll = () => {
  isPaused.value = false
}

// Search Command handling
const searchCommandRef = ref<InstanceType<typeof SearchCommand>>()

// We need to access the global search command instance or trigger the event
// Since SearchCommand is likely in the Layout or Header, we might need a different approach.
// But looking at SiteHeader.vue, it uses a ref.
// Let's dispatch a custom event that the App or Header listens to, OR simpler:
// just simulate the keypress or use a global store if available.
// For now, let's try dispatching a keyboard event as a fallback if we can't access the component directly.
// Actually, re-reading SiteHeader.vue, it has the SearchCommand. 
// A robust way without a global bus is to simulate Ctrl+K
const openSearch = () => {
  window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true }))
}

onMounted(() => {
  startAutoScroll()
})

onUnmounted(() => {
  stopAutoScroll()
})
</script>

<style scoped>
/* Hide scrollbar for Chrome, Safari and Opera */
.scrollbar-hide::-webkit-scrollbar {
    display: none;
}

/* Hide scrollbar for IE, Edge and Firefox */
.scrollbar-hide {
    -ms-overflow-style: none;  /* IE and Edge */
    scrollbar-width: none;  /* Firefox */
}
</style>
