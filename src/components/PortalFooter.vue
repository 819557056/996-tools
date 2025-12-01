<template>
  <footer class="border-t bg-muted/30 mt-auto">
    <div class="container px-4 py-12 md:py-16">
      <div class="grid grid-cols-1 md:grid-cols-4 gap-8 md:gap-12">
        <!-- 品牌信息 -->
        <div class="space-y-4">
          <div class="flex items-center space-x-2">
            <Logo className="h-6 w-6 text-primary" />
            <span class="font-bold text-lg">{{ siteConfig.name }}</span>
          </div>
          <p class="text-sm text-muted-foreground leading-relaxed">
            {{ siteConfig.description }}
          </p>
          <div class="flex items-center gap-4">
            <a
              :href="siteConfig.links.github"
              target="_blank"
              class="text-muted-foreground hover:text-primary transition-colors"
              :title="locale === 'zh' ? 'GitHub' : 'GitHub'"
            >
              <Github class="h-5 w-5" />
            </a>
          </div>
        </div>

        <!-- 快速链接 -->
        <div class="space-y-4">
          <h3 class="font-semibold text-sm">{{ locale === 'zh' ? '快速链接' : 'Quick Links' }}</h3>
          <ul class="space-y-2 text-sm">
            <li>
              <RouterLink
                to="/"
                class="text-muted-foreground hover:text-primary transition-colors"
              >
                {{ t('nav.home') }}
              </RouterLink>
            </li>
            <li>
              <RouterLink
                to="/portal/apps"
                class="text-muted-foreground hover:text-primary transition-colors"
              >
                {{ locale === 'zh' ? '应用中心' : 'App Center' }}
              </RouterLink>
            </li>
            <li>
              <RouterLink
                to="/portal/articles"
                class="text-muted-foreground hover:text-primary transition-colors"
              >
                {{ locale === 'zh' ? '文章' : 'Articles' }}
              </RouterLink>
            </li>
            <li>
              <a
                :href="siteConfig.links.github"
                target="_blank"
                class="text-muted-foreground hover:text-primary transition-colors"
              >
                GitHub
              </a>
            </li>
          </ul>
        </div>

        <!-- 分站链接 -->
        <div class="space-y-4">
          <h3 class="font-semibold text-sm">{{ locale === 'zh' ? '分站' : 'Sites' }}</h3>
          <ul class="space-y-2 text-sm">
            <li v-for="site in sites" :key="site.slug">
              <a
                :href="site.url"
                target="_blank"
                class="text-muted-foreground hover:text-primary transition-colors"
              >
                {{ site.name }}
              </a>
            </li>
          </ul>
        </div>

        <!-- 联系与支持 -->
        <div class="space-y-4">
          <h3 class="font-semibold text-sm">{{ locale === 'zh' ? '支持' : 'Support' }}</h3>
          <ul class="space-y-2 text-sm">
            <li>
              <a
                :href="siteConfig.issue"
                target="_blank"
                class="text-muted-foreground hover:text-primary transition-colors"
              >
                {{ locale === 'zh' ? '问题反馈' : 'Report Issue' }}
              </a>
            </li>
            <li>
              <a
                href="#"
                class="text-muted-foreground hover:text-primary transition-colors"
              >
                {{ locale === 'zh' ? '帮助文档' : 'Documentation' }}
              </a>
            </li>
            <li>
              <a
                href="#"
                class="text-muted-foreground hover:text-primary transition-colors"
              >
                {{ locale === 'zh' ? '关于我们' : 'About Us' }}
              </a>
            </li>
          </ul>
        </div>
      </div>

      <!-- 版权信息 -->
      <div class="mt-12 pt-8 border-t flex flex-col md:flex-row justify-between items-center gap-4">
        <p class="text-sm text-muted-foreground text-center md:text-left">
          © {{ new Date().getFullYear() }} {{ siteConfig.name }}. {{ locale === 'zh' ? '保留所有权利' : 'All rights reserved' }}.
        </p>
        <div class="flex items-center gap-6 text-sm text-muted-foreground">
          <a href="#" class="hover:text-primary transition-colors">
            {{ locale === 'zh' ? '隐私政策' : 'Privacy Policy' }}
          </a>
          <a href="#" class="hover:text-primary transition-colors">
            {{ locale === 'zh' ? '服务条款' : 'Terms of Service' }}
          </a>
        </div>
      </div>
    </div>
  </footer>
</template>

<script setup lang="ts">
import { RouterLink } from 'vue-router'
import { Github } from 'lucide-vue-next'
import { useI18n } from 'vue-i18n'
import { siteConfig } from '@/config/site'
import Logo from './Logo.vue'

const { t, locale } = useI18n()

// 分站数据（示例，后续从API获取）
const sites = [
  { name: locale.value === 'zh' ? '国密工具站' : 'Crypto Tools', slug: 'crypto', url: '#' },
  { name: locale.value === 'zh' ? '开发工具站' : 'Dev Tools', slug: 'dev', url: '#' },
  { name: locale.value === 'zh' ? '数据工具站' : 'Data Tools', slug: 'data', url: '#' },
  { name: locale.value === 'zh' ? '图像工具站' : 'Image Tools', slug: 'image', url: '#' },
]
</script>

