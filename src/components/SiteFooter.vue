<template>
  <footer class="border-t py-6 md:py-0">
    <div class="container flex flex-col items-center justify-between gap-4 md:h-24 md:flex-row px-4">
      <div class="flex flex-col items-center gap-4 px-8 md:flex-row md:gap-2 md:px-0">
        <p class="text-center text-sm leading-loose text-muted-foreground md:text-left">
          由 Vue 3 + TypeScript 构建。基于
          <a
            href="https://github.com/mnove/101webtools"
            target="_blank"
            rel="noreferrer"
            class="font-medium underline underline-offset-4"
          >
            101webtools
          </a>
          重构。
        </p>
      </div>
      <p class="text-center text-sm text-muted-foreground md:text-left">
        © 2024 {{ siteConfig.name }}. All rights reserved.
      </p>
    </div>
  </footer>
</template>

<script setup lang="ts">
import { siteConfig } from '@/config/site'
</script>

