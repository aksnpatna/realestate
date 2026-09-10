/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    exclude: ['tests/e2e/**', 'node_modules/**', '.kilo/**'],
  },
  build: {
    sourcemap: true,
    minify: 'esbuild',
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/react-dom') || (id.includes('node_modules/react') && !id.includes('react-leaflet'))) return 'vendor-react';
          if (id.includes('node_modules/leaflet') || id.includes('node_modules/react-leaflet') || id.includes('node_modules/leaflet.vectorgrid')) return 'vendor-leaflet';
          if (id.includes('node_modules/recharts')) return 'vendor-recharts';
        },
      },
      external: [],
      treeshake: false,
    },
  },
  server: {
    host: '0.0.0.0',
    port: 5174,
    strictPort: true,
    proxy: {
      '/api': {
        target: 'http://localhost:8082',
        changeOrigin: true,
      },
      '/tiles': {
        target: 'http://localhost:7800',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/tiles/, '')
      }
    }
  }
})
