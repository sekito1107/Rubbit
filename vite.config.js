import { defineConfig } from 'vite'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

export default defineConfig({
  root: '.', 
  plugins: [
    tailwindcss(),
  ],
  preview: {
    host: '127.0.0.1',
    port: 4173,
    strictPort: true,
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      output: {
        manualChunks: {
          'monaco': ['monaco-editor'],
        }
      }
    },
    chunkSizeWarningLimit: 4000,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      'utils': path.resolve(__dirname, './src/utils'),
      'controllers': path.resolve(__dirname, './src/controllers'),
      'lsp': path.resolve(__dirname, './src/lsp'),
      'analysis': path.resolve(__dirname, './src/analysis'),
      'rurima': path.resolve(__dirname, './src/rurima'),
      'runtime': path.resolve(__dirname, './src/runtime'),
      'persistence': path.resolve(__dirname, './src/persistence'),
    },
  },
})
