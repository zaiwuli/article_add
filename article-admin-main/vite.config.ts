import path from 'path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'
import tailwindcss from '@tailwindcss/vite'
import { tanstackRouter } from '@tanstack/router-plugin/vite'
import { VitePWA } from 'vite-plugin-pwa'
// https://vite.dev/config/
export default defineConfig({
  server: {
    host: true,
    allowedHosts: [
      'article.05730116.xyz',
      'dev.example.com',
      'localhost'
    ]
  },
  plugins: [
    tanstackRouter({
      target: 'react',
      autoCodeSplitting: true,
    }),
    react(),
    tailwindcss(),
    VitePWA({
      mode: 'development',
      registerType: 'autoUpdate',
      injectRegister: 'inline',
      base: '/',
      includeAssets: [
        'favicon.ico',
        'apple-touch-icon.png',
        'icons/*.png',
      ],

      manifest: {
        name: 'Downloader Manager',
        short_name: 'Downloader',
        description: '下载器配置管理系统',
        theme_color: '#09090b',
        background_color: '#09090b',
        display: 'standalone',
        icons: [
          {
            src: '/logo.jpg',
            sizes: '512x512',
            type: 'image/jpeg"',
          }
        ],
      },
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
