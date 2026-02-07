import { defineConfig } from 'vite'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

export default defineConfig({
  root: '.', 
  plugins: [
    tailwindcss(),
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
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      'utils': path.resolve(__dirname, './src/utils'),
      'interactors': path.resolve(__dirname, './src/interactors'),
      'controllers': path.resolve(__dirname, './src/controllers'),
    },
  },
})
