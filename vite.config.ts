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
    // 这个选项就是控制 Minification 的开关
    // 'terser' 是默认值，表示使用 Terser 进行压缩
    // 'esbuild' 是另一个选项，压缩速度更快，但压缩率略低于 Terser
    // false 则可以完全禁用压缩，通常只在调试生产环境构建问题时使用
    minify: 'terser',
    // 当 minify: 'terser' 时，可以通过这个选项来配置 Terser 的行为
    terserOptions: {
      compress: {
        // 生产环境中移除 console.log 输出
        drop_console: true,
        // 生产环境中移除 debugger
        drop_debugger: true,
      },
      // 可以进一步配置其他选项，例如 mangle (混淆变量名) 等
      // mangle: { ... }
    },
    rollupOptions: {
      output: {
        // 将体积较大的第三方库拆分到独立 chunk，避免普通工具页面加载 PKI/编辑器等重依赖
        manualChunks: {
          monaco: ['monaco-editor', '@guolao/vue-monaco-editor'],
          pki: ['node-forge'],
          qrcode: ['qr-code-styling'],
        },
        // 为所有资源文件添加内容哈希，实现缓存失效策略
        // 当文件内容改变时，哈希值改变，浏览器会请求新文件
        chunkFileNames: 'assets/js/[name]-[hash].js',
        entryFileNames: 'assets/js/[name]-[hash].js',
        assetFileNames: (assetInfo) => {
          // 根据文件类型分类存放并添加哈希
          const info = assetInfo.name?.split('.') || []
          const ext = info[info.length - 1]
          if (/\.(png|jpe?g|gif|svg|webp|ico)$/i.test(assetInfo.name || '')) {
            return 'assets/images/[name]-[hash].[ext]'
          }
          if (/\.(woff2?|eot|ttf|otf)$/i.test(assetInfo.name || '')) {
            return 'assets/fonts/[name]-[hash].[ext]'
          }
          if (/\.css$/i.test(assetInfo.name || '')) {
            return 'assets/css/[name]-[hash].[ext]'
          }
          return 'assets/[name]-[hash].[ext]'
        },
      },
    },
  },
  server: {
    port: 3000,
    open: true
  }
})

