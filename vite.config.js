import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      // Use injectManifest so we can provide a custom SW that includes
      // both Workbox precaching AND Firebase Cloud Messaging handlers.
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.js',
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      includeAssets: ['FantaF1_Logo_512.png'],
      injectManifest: {
        // Allow the firebase compat CDN scripts loaded via importScripts
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
      },
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
            src: '/FantaF1_Logo_512.png',
            sizes: '512x512',
            type: 'image/png'
          },
          {
            src: '/FantaF1_Logo_192.png',
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
          'firebase-vendor': ['firebase/app', 'firebase/firestore', 'firebase/auth', 'firebase/messaging'],
          // UI Libraries
          'ui-vendor': ['react-bootstrap', 'react-select'],
          // Charts (lazy-loaded with Statistics page)
          'chart-vendor': ['recharts'],
        },
      },
    },
    target: 'es2020',
    chunkSizeWarningLimit: 1000,
  },
})
