import { NavLink, useLocation } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'
import { openAdminWhatsApp } from '../lib/whatsapp'
import './Sidebar.css'

const navUtamaMUA = [
  { to: '/dashboard', label: 'Dashboard', icon: 'grid' },
  { to: '/booking', label: 'Booking', icon: 'list' },
  { to: '/kalender', label: 'Kalender', icon: 'calendar' },
  { to: '/klien', label: 'Klien', icon: 'users' },
]

const navRekapan = [
  { to: '/keuangan', label: 'Keuangan', icon: 'trend' },
  { to: '/laporan', label: 'Laporan', icon: 'file' },
]

// Nav admin -- SENGAJA cuma 2 item, numpang WRAPPER & class yang SAMA
// (.nav-utama-group, .mobile-bottom-tabs, dst) kayak navUtamaMUA, biar
// semua behavior mobile/z-index/safe-area yang udah teruji tetep kepake
// apa adanya, nggak perlu bikin ulang dari nol buat admin.
const navUtamaAdmin = [
  { to: '/admin', label: 'Dashboard', icon: 'grid' },
  { to: '/admin/users', label: 'Kelola User', icon: 'shield' },
]

function Icon({ name }) {
  const common = { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8 }
  switch (name) {
    case 'grid':
      return <svg {...common}><rect x="3" y="3" width="7" height="9" rx="2"/><rect x="14" y="3" width="7" height="5" rx="2"/><rect x="14" y="12" width="7" height="9" rx="2"/><rect x="3" y="16" width="7" height="5" rx="2"/></svg>
    case 'plus-circle':
      return <svg {...common}><path d="M6 8h12l-1 12H7L6 8Z"/><path d="M9 8V6a3 3 0 0 1 6 0v2"/></svg>
    case 'list':
      return <svg {...common}><path d="M8 6h13M8 12h13M8 18h13"/><path d="M3 6h.01M3 12h.01M3 18h.01"/></svg>
    case 'calendar':
      return <svg {...common}><rect x="3" y="4" width="18" height="17" rx="2"/><path d="M3 9h18M8 3v3M16 3v3"/></svg>
    case 'users':
      return <svg {...common}><circle cx="9" cy="8" r="3.2"/><path d="M2.7 19.5c0-3.3 2.8-5.8 6.3-5.8s6.3 2.5 6.3 5.8M17 15c1.6.3 2.8 1.6 2.8 3.2"/></svg>
    case 'trend':
      return <svg {...common}><path d="M3 3v18h18"/><path d="M7 14l4-5 3 3 5-7"/></svg>
    case 'file':
      return <svg {...common}><path d="M7 3h8l4 4v14H7z"/><path d="M15 3v4h4M9 12h6M9 16h6"/></svg>
    case 'settings':
      return <svg {...common}><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-1.87-.34 1.7 1.7 0 0 0-1 1.55V21a2 2 0 1 1-4 0v-.09A1.7 1.7 0 0 0 9 19.4a1.7 1.7 0 0 0-1.87.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-1.55-1H3a2 2 0 1 1 0-4h.09A1.7 1.7 0 0 0 4.6 9a1.7 1.7 0 0 0-.34-1.87l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-1.55V3a2 2 0 1 1 4 0v.09a1.7 1.7 0 0 0 1 1.55 1.7 1.7 0 0 0 1.87-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.7 1.7 0 0 0 19.4 9a1.7 1.7 0 0 0 1.55 1H21a2 2 0 1 1 0 4h-.09a1.7 1.7 0 0 0-1.51 1Z"/></svg>
    case 'help':
      return <svg {...common}><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5Z"/></svg>
    case 'book':
      return <svg {...common}><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2Z"/></svg>
    case 'shield':
      return <svg {...common}><path d="M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6l7-3Z"/><path d="m9 12 2 2 4-4"/></svg>
    case 'logout':
      return <svg {...common}><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="M16 17l5-5-5-5"/><path d="M21 12H9"/></svg>
    default:
      return null
  }
}

export default function Sidebar({ headerAction = null }) {
  const { user, profile, isAdmin, signOut } = useAuth()
  const { theme, toggleTheme } = useTheme()
  const logoSrc = theme === 'dark' ? '/icon-512-dark.png' : '/icon-512-light.png'
  const studioName = profile?.studio_name || ''
  const navUtama = isAdmin ? navUtamaAdmin : navUtamaMUA
  const [mobileOpen, setMobileOpen] = useState(false)
  const location = useLocation()

  // otomatis nutup drawer tiap kali pindah halaman
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { setMobileOpen(false) }, [location.pathname])

  const initials = (studioName || user?.email || '?')
    .split(' ')
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()

  function handleBantuan() {
    const pesan = `Halo, Kak!\n\nSaya mau tanya-tanya/ada kendala soal Dapur MUA.\n\nAkun: ${studioName || user?.email || '-'}`
    openAdminWhatsApp(pesan)
  }

  return (
    <>
      <div className="mobile-topbar">
        <button type="button" className="hamburger-btn" onClick={() => setMobileOpen(true)}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 7h16M4 12h16M4 17h16" /></svg>
        </button>
        <div className="mobile-topbar-brand">
          <img src={logoSrc} alt="" />
          <span>Dapur MUA</span>
        </div>
        {headerAction}
      </div>

      {mobileOpen && <div className="sidebar-backdrop" onClick={() => setMobileOpen(false)}></div>}

      <div className={`sidebar${mobileOpen ? ' open' : ''}`}>
        <button type="button" className="sidebar-close" onClick={() => setMobileOpen(false)}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 6l12 12M18 6L6 18" /></svg>
        </button>

        <div className="brand">
        <div className="brand-mark">
          {profile?.logo_url && <img src={profile.logo_url} alt="Logo" />}
        </div>
        <div>
          <div className="brand-name">Dapur MUA</div>
          <div className="brand-sub">{isAdmin ? 'Admin' : (studioName || 'Studio Saya')}</div>
        </div>
      </div>

      {/* Section "Utama" (Dashboard/Booking/Kalender/Klien) dibungkus
          wrapper ini -- di DESKTOP tetep keliatan normal, tapi di MOBILE
          disembunyiin lewat CSS (lihat .nav-utama-group di Sidebar.css),
          soalnya 4 item itu sekarang udah ada di bottom tab bar. Nggak
          dihapus dari JSX-nya sama sekali -- biar desktop (yang nggak
          punya bottom tab bar) tetep dapet akses penuh. */}
      <div className="nav-utama-group">
        <div className="nav-section">Utama</div>
        {navUtama.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) => 'nav-item' + (isActive ? ' active' : '')}
          >
            <Icon name={item.icon} />
            {item.label}
          </NavLink>
        ))}
      </div>

      {!isAdmin && (
        <>
          <div className="nav-section">Rekapan</div>
          {navRekapan.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) => 'nav-item' + (isActive ? ' active' : '')}
            >
              <Icon name={item.icon} />
              {item.label}
            </NavLink>
          ))}
        </>
      )}

      <div className="sidebar-bottom">
        <button type="button" className="theme-toggle" onClick={toggleTheme}>
          <span className="theme-toggle-track">
            <span className={`theme-toggle-thumb${theme === 'dark' ? ' dark' : ''}`}>
              {theme === 'dark' ? (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12.8A9 9 0 1 1 11.2 3 7 7 0 0 0 21 12.8Z"/></svg>
              ) : (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>
              )}
            </span>
          </span>
          <span className="theme-toggle-label">{theme === 'dark' ? 'Mode Gelap' : 'Mode Terang'}</span>
        </button>

        {!isAdmin && (
          <>
            <NavLink to="/panduan" className={({ isActive }) => 'nav-item' + (isActive ? ' active' : '')}>
              <Icon name="book" />
              Panduan
            </NavLink>

            <button type="button" className="nav-item nav-item-bantuan" onClick={handleBantuan}>
              <Icon name="help" />
              Bantuan
            </button>

            <NavLink to="/pengaturan" className={({ isActive }) => 'nav-item nav-item-pengaturan' + (isActive ? ' active' : '')} style={{ marginBottom: 12 }}>
              <Icon name="settings" />
              Pengaturan
            </NavLink>
          </>
        )}
        {/* Tombol "Keluar" ini CUMA buat admin -- user MUA biasa udah
            punya tombol sign-out sendiri di halaman Pengaturan (nggak
            ke-lihat dari sini soalnya itu bukan bagian dari Sidebar.jsx).
            Admin nggak punya akses ke Pengaturan sama sekali (disembunyiin
            di atas), jadi tanpa ini dia nggak punya jalan keluar. */}
        {isAdmin && (
          <button type="button" className="nav-item nav-item-bantuan" onClick={signOut} style={{ marginBottom: 12 }}>
            <Icon name="logout" />
            Keluar
          </button>
        )}
        <div className="profile">
          <div className="avatar">{profile?.logo_url ? <img src={profile.logo_url} alt="Logo" /> : initials}</div>
          <div>
            <div className="profile-name">{isAdmin ? 'Admin' : (studioName || 'Studio Saya')}</div>
            <div className="profile-role">{user?.email}</div>
          </div>
        </div>
        </div>
      </div>

      {/* Bottom tab bar -- CUMA keliatan di mobile (diatur lewat CSS,
          display:none di desktop). Numpang array `navUtama` yang SAMA
          persis dipakai sidebar desktop di atas, biar rute/ikon/label-nya
          otomatis selalu sinkron -- kalau nanti nav utama ganti/nambah
          dari 4 item, tab bar ini ikut ke-update sendiri, nggak perlu
          diubah manual dobel. Item Keuangan/Laporan/Panduan/Bantuan/
          Pengaturan SENGAJA nggak dimasukin ke sini (sesuai permintaan) --
          tetep diakses lewat hamburger menu seperti biasa. */}
      <nav className="mobile-bottom-tabs">
        {navUtama.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) => 'bottom-tab-item' + (isActive ? ' active' : '')}
          >
            <Icon name={item.icon} />
            <span>{item.label}</span>
          </NavLink>
        ))}
        {!isAdmin && (
          <NavLink
            to="/pengaturan"
            className={({ isActive }) => 'bottom-tab-item' + (isActive ? ' active' : '')}
          >
            <Icon name="settings" />
            <span>Pengaturan</span>
          </NavLink>
        )}
      </nav>
    </>
  )
}
