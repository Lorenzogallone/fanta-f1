import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          // React e dipendenze core
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          // Firebase
          'firebase-vendor': ['firebase/app', 'firebase/firestore', 'firebase/auth'],
          // UI Libraries
          'ui-vendor': ['react-bootstrap', 'react-select'],
        },
      },
    },
    // Aumenta il limite di warning a 1000 kB per i vendor chunks
    chunkSizeWarningLimit: 1000,
  },
})
