import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { useRegisterSW } from 'virtual:pwa-register/react'
import { Analytics } from '@vercel/analytics/react'
import './index.css'
import './theme.css'
import App from './App.jsx'

// Ngecek update versi app lebih agresif -- ini yang paling kerasa buat
// user iOS, soalnya Safari nggak seagresif Chrome/Android dalam
// otomatis ngecek Service Worker baru begitu app dibuka ulang dari
// home screen. Di sini kita PAKSA cek manual: tiap 60 detik SELAMA app
// kebuka, DAN setiap kali user balik ke app ini (misal abis minimize
// terus dibuka lagi) -- bukan cuma pas pertama kali load doang.
// skipWaiting + clientsClaim (di vite.config.js) bikin versi baru
// otomatis "ngambil alih" begitu ketemu, tapi HALAMAN yang lagi kebuka
// tetep butuh di-refresh biar kode barunya beneran kepake -- makanya
// masih perlu kasih tombol kecil, bukan langsung reload paksa (biar
// nggak ganggu user yang lagi ngisi form pas itu juga).
function PwaUpdater() {
  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(swUrl, registration) {
      if (!registration) return
      const checkForUpdate = () => registration.update()
      setInterval(checkForUpdate, 60 * 1000)
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') checkForUpdate()
      })
    },
  })

  if (!needRefresh) return null

  return (
    <div
      style={{
        position: 'fixed', bottom: 16, left: '50%', transform: 'translateX(-50%)',
        background: '#2B2438', color: '#fff', padding: '10px 16px', borderRadius: 12,
        display: 'flex', alignItems: 'center', gap: 12, fontSize: 13, zIndex: 9999,
        boxShadow: '0 10px 30px -8px rgba(0,0,0,0.4)', fontFamily: "'Plus Jakarta Sans', sans-serif",
      }}
    >
      <span>Ada pembaruan baru.</span>
      <button
        onClick={() => updateServiceWorker(true)}
        style={{
          background: '#8B7FE8', color: '#fff', border: 'none', borderRadius: 8,
          padding: '6px 12px', fontSize: 12, fontWeight: 600, cursor: 'pointer',
        }}
      >
        Refresh
      </button>
    </div>
  )
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
    <PwaUpdater />
    <Analytics />
  </StrictMode>,
)
