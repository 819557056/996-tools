import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { fileURLToPath, URL } from 'node:url'
import { resolve } from 'node:path'
import VueI18n from '@intlify/unplugin-vue-i18n/vite'
import viteCompression from 'vite-plugin-compression'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    vue(),
    VueI18n({
      runtimeOnly: true,
      jitCompilation: true,
      compositionOnly: true,
      fullInstall: true,
      strictMessage: false,
      include: [
        resolve(__dirname, 'locales/**'),
      ],
    }),
    // 构建阶段生成 gzip / br 压缩资源，配合 Nginx gzip_static 使用
    viteCompression({
      algorithm: 'gzip',
      ext: '.gz',
      threshold: 1024,
    }),
    viteCompression({
      algorithm: 'brotliCompress',
      ext: '.br',
      threshold: 1024,
    }),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    }
  },
  build: {
    rollupOptions: {
      output: {
        // 将体积较大的第三方库拆分到独立 chunk，避免普通工具页面加载 PKI/编辑器等重依赖
        manualChunks: {
          monaco: ['monaco-editor', '@guolao/vue-monaco-editor'],
          pki: ['node-forge'],
          qrcode: ['qr-code-styling'],
        },
      },
    },
  },
  server: {
    port: 3000,
    open: true
  }
})

