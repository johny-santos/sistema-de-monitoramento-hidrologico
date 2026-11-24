import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// O proxy evita CORS: o navegador chama /api no Vite, que repassa ao Django (porta 8000).
export default defineConfig({
  plugins: [react()],
  build: {
    chunkSizeWarningLimit: 900,
    rollupOptions: {
      output: {
        // Separa bibliotecas grandes: cache melhor e carregamento paralelo.
        manualChunks(id: string) {
          if (!id.includes('node_modules')) return undefined
          if (id.includes('chart.js') || id.includes('react-chartjs-2')) return 'charts'
          if (id.includes('framer-motion') || id.includes('motion-dom') || id.includes('motion-utils')) return 'motion'
          if (id.includes('/three/') || id.includes('@react-three') || id.includes('three-stdlib') || id.includes('troika') || id.includes('maath')) return undefined
          if (id.includes('react-dom') || id.includes('/react/') || id.includes('react-router') || id.includes('scheduler') || id.includes('@tanstack') || id.includes('lucide-react') || id.includes('date-fns')) return 'vendor'
          return undefined
        },
      },
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://127.0.0.1:8000',
      '/admin': 'http://127.0.0.1:8000',
      '/static': 'http://127.0.0.1:8000',
    },
  },
})
