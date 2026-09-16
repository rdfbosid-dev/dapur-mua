import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'apple-touch-icon.png'],
      manifest: {
        name: 'Dapur MUA',
        short_name: 'Dapur MUA',
        description: 'Kelola booking, tim, dan keuangan MUA di satu tempat.',
        theme_color: '#5b68bb',
        // SEBELUMNYA '#F6F1FC' (putih pucat) -- ini beda sumber dari
        // background CSS <html> yang udah di-fix (var(--page-a)).
        // background_color ini dipakai OS buat splash screen & area
        // sistem pas app dibuka dari Home Screen, di-set SEKALI waktu
        // build (statis, nggak bisa ikut ganti Mode Gelap/Terang secara
        // real-time). Karena default app ngikut preferensi tema HP dan
        // banyak yang bakal ke dark mode, disamain ke warna --page-a
        // dark (#42535a) biar nggak nyempil putih pas app baru dibuka.
        background_color: '#42535a',
        display: 'standalone',
        start_url: '/dashboard',
        scope: '/',
        icons: [
          {
            src: 'icon-192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: 'icon-512.png',
            sizes: '512x512',
            type: 'image/png',
          },
          {
            src: 'icon-512-maskable.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        // Cache aset statis biar app tetap kebuka (walau data booking-nya
        // butuh internet buat update terbaru dari Supabase).
        globPatterns: ['**/*.{js,css,html,png,svg,ico}'],
        // Tanpa 2 baris ini, versi baru yang di-deploy bakal "nyangkut"
        // nunggu SEMUA instance app ditutup total dulu (jarang kejadian
        // di HP, orang biasa cuma minimize doang) -- jadi update kerasa
        // nggak pernah nyampe walau server-nya udah versi terbaru.
        skipWaiting: true,
        clientsClaim: true,
        // WAJIB -- tanpa ini, Service Worker bakal "nyegat" navigasi ke
        // /api/... juga (dianggep kayak pindah halaman biasa), terus
        // otomatis diarahin ke index.html yang di-cache (app shell),
        // BUKAN ke response asli dari server. Ini yang bikin link
        // .ics kalender kena redirect ke /dashboard alih-alih nampilin
        // data mentahnya.
        navigateFallbackDenylist: [/^\/api\//],
      },
    }),
  ],
})