import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [vue()],
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true
      }
    },
    // 启用服务器缓存
    hmr: true,
    // 提高服务器响应速度
    port: 5173,
    open: true
  },
  // 构建优化
  build: {
    // 输出到backend/public目录
    outDir: '../backend/public',
    // 清空输出目录
    emptyOutDir: true,
    // 启用代码分割
    rollupOptions: {
      output: {
        manualChunks: {
          // 将第三方依赖打包成单独的chunk
          vendor: ['vue', 'vue-router']
        }
      }
    },
    // 启用压缩（使用默认的esbuild）
    minify: 'esbuild',
    esbuild: {
      drop: ['console', 'debugger']
    },
    // 生成源映射
    sourcemap: false,
    // 提高构建速度
    chunkSizeWarningLimit: 1000
  },
  // 配置别名，简化导入路径
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
      '@components': resolve(__dirname, 'src/components'),
      '@views': resolve(__dirname, 'src/views'),
      '@services': resolve(__dirname, 'src/services'),
      '@utils': resolve(__dirname, 'src/utils'),
      '@config': resolve(__dirname, 'src/config'),
      '@assets': resolve(__dirname, 'src/assets')
    }
  },
  // 预构建优化
  optimizeDeps: {
    // 预构建的依赖
    include: ['vue', 'vue-router'],
    // 禁用动态导入的预构建
    exclude: []
  }
})
