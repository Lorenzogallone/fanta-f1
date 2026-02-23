import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      includeAssets: ['FantaF1_Logo_big.png'],
      manifest: {
        name: 'FantaF1',
        short_name: 'FantaF1',
        description: 'Build your dream Formula 1 team! Predict race podiums, earn points, and compete with friends in the ultimate F1 fantasy game.',
        theme_color: '#1a1a1a',
        background_color: '#1a1a1a',
        display: 'standalone',
        orientation: 'portrait-primary',
        icons: [
          {
            src: '/FantaF1_Logo_big.png',
            sizes: '512x512',
            type: 'image/png'
          },
          {
            src: '/FantaF1_Logo_big.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any maskable'
          }
        ]
      }
    })
  ],
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
