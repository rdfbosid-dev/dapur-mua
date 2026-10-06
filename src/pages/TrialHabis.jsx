import { Link, Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'
import { openAdminWhatsApp } from '../lib/whatsapp'
import ThemeToggleButton from '../components/ThemeToggleButton'
import '../pages/Auth.css'

export default function TrialHabis() {
  const { profile, isLocked, signOut } = useAuth()
  // Pola SAMA PERSIS kayak di Login.jsx/Sidebar.jsx -- logo brand ganti
  // otomatis ngikutin Mode Gelap/Terang yang lagi aktif.
  const { theme } = useTheme()
  const logoSrc = theme === 'dark' ? '/icon-512-dark.png' : '/icon-512-light.png'

  // Kalau ternyata akunnya nggak/belum kekunci (misal user coba buka
  // /trial-habis langsung padahal masih aktif), lempar balik ke
  // Dashboard -- halaman ini cuma relevan buat akun yang beneran kekunci.
  if (!isLocked) return <Navigate to="/dashboard" replace />

  function handleHubungiAdmin() {
    const namaStudio = profile?.studio_name || 'Studio Saya'
    const pesan = `Halo, Kak!\n\nSaya mau lanjut berlangganan Dapur MUA.\n\nNama Brand: ${namaStudio}\n\nMohon info cara pembayarannya ya.\n\nTerima kasih!`
    openAdminWhatsApp(pesan)
  }

  return (
    <div className="auth-page">
      <div className="auth-page-toggle"><ThemeToggleButton /></div>
      <div className="auth-card">
        <div className="auth-brand auth-brand-centered">
          <div className="auth-brand-mark"><img src={logoSrc} alt="Dapur MUA" /></div>
          <div className="auth-brand-name">Dapur MUA</div>
        </div>

        {/* Halaman ini dipakai 2 kasus kunci (lihat isLocked di
            AuthContext.jsx): trial habis & langganan habis. Status 'active'
            yang kekunci = pasti langganannya yang habis. */}
        <div className="auth-title-trial">
          {profile?.subscription_status === 'active' ? 'Masa langganan kamu udah habis' : 'Masa coba gratis kamu udah habis'}
        </div>
        <div className="auth-subtitle">
          Data booking, klien, dan keuangan kamu tetap aman kok, cuma belum bisa diakses
          sementara.<br />
          <br />
          Yuk lanjut berlangganan biar bisa lanjut kelola Dapur MUA kamu lagi.
        </div>

        {/* Rute /langganan SENGAJA numpang TrialGateRoute (lihat App.jsx)
            -- bukan ProtectedRoute -- biar user yang isLocked kayak di
            halaman ini beneran bisa masuk ke situ, bukan kelempar balik
            ke sini terus. */}
        <Link className="auth-btn" to="/langganan">
          Pilih Paket &amp; Bayar Langganan
        </Link>

        <div className="auth-switch">
          <a href="#" onClick={(e) => { e.preventDefault(); handleHubungiAdmin() }}>Butuh bantuan? Hubungi Admin</a>
        </div>
        <div className="auth-switch">
          <a href="#" onClick={(e) => { e.preventDefault(); signOut() }}>Keluar dari akun ini</a>
        </div>
      </div>
    </div>
  )
}
