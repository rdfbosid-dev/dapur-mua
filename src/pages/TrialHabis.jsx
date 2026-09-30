import { Link, Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { openAdminWhatsApp } from '../lib/whatsapp'
import ThemeToggleButton from '../components/ThemeToggleButton'
import '../pages/Auth.css'

export default function TrialHabis() {
  const { profile, isLocked, signOut } = useAuth()

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
        <div className="auth-brand">
          <div className="auth-brand-mark"></div>
          <div className="auth-brand-name">Dapur MUA</div>
        </div>

        <div className="auth-title">Masa coba gratis kamu udah habis</div>
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
