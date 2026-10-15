import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'
import { VERSI_PEMBARUAN } from '../lib/pembaruan'
import { linkBooking, muatPengaturanBooking } from '../lib/bookingOnline'
import './PembaruanModal.css'

// Info "Yang baru di Dapur MUA" -- muncul SEKALI ke user lama di Dashboard
// (aturan tampilnya di Dashboard.jsx & lib/pembaruan.js). Gayanya satu
// keluarga sama OnboardingModal, di HP jadi bottom sheet kayak modal lain.
// Rilis berikutnya: ganti isi di bawah + VERSI_PEMBARUAN di lib/pembaruan.js.
export default function PembaruanModal({ onClose }) {
  const navigate = useNavigate()
  const { user } = useAuth()
  // Logo Dapur MUA -- file & aturan tema SAMA kayak logo di Sidebar.jsx.
  const { theme } = useTheme()
  const logoSrc = theme === 'dark' ? '/icon-512-dark.png' : '/icon-512-light.png'

  // Status link booking user ini -> kartu Link Booking Online dibikin
  // "nyolek": belum aktif = ajakan mengaktifkan, sudah aktif = alamat link
  // siap disalin. Dimuat terpisah (lihat muatPengaturanBooking); selama
  // memuat / gagal -> kalimat umum + tombol ke Pengaturan.
  const uid = user?.id || null
  const [lb, setLb] = useState(null)
  useEffect(() => {
    let batal = false
    if (uid) muatPengaturanBooking(uid).then((p) => { if (!batal) setLb(p) })
    return () => { batal = true }
  }, [uid])
  const linkAktif = lb && !lb.gagal && lb.booking_online_aktif && lb.slug ? linkBooking(lb.slug) : ''
  const belumAktif = !!lb && !lb.gagal && !linkAktif
  const [tersalin, setTersalin] = useState(false)
  function salinLink() {
    navigator.clipboard?.writeText(linkAktif).then(() => {
      setTersalin(true)
      setTimeout(() => setTersalin(false), 2000)
    }).catch(() => {})
  }

  function buka(rute) {
    onClose()
    navigate(rute)
  }

  return (
    <div className="modal-overlay pmb-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="pmb-modal" role="dialog" aria-modal="true" aria-labelledby="pmb-judul">
        <div className="pmb-scroll">
          <div className="pmb-hero">
            <img className="pmb-logo" src={logoSrc} alt="Dapur MUA" />
            <span className="pmb-versi">Update {VERSI_PEMBARUAN}</span>
            <h2 id="pmb-judul">Ada yang baru di Dapur MUA!</h2>
            <p>Sekarang calon klien bisa booking sendiri lewat link, dan semua permintaannya masuk rapi ke Dapur MUA.</p>
          </div>

          <div className="pmb-fitur">
            <div className="pmb-kartu">
              <div className="pmb-ikon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9"><path d="M10 13a5 5 0 0 0 7.07 0l3-3a5 5 0 0 0-7.07-7.07l-1.5 1.5" /><path d="M14 11a5 5 0 0 0-7.07 0l-3 3a5 5 0 0 0 7.07 7.07l1.5-1.5" /></svg>
              </div>
              <div className="pmb-kartu-isi">
                <div className="pmb-kartu-judul">Link Booking Online</div>
                <div className="pmb-kartu-desc">Satu link <b>landing page</b> yang bisa kamu pasang di bio Instagram/TikTok. Calon klien bisa cek tanggal yang masih kosong, lihat paketmu, lalu kirim permintaan booking sendiri. Tambahkan juga tombol WhatsApp, Instagram, TikTok, atau pricelist-mu, lengkap dengan ikonnya.</div>
                {linkAktif ? (
                  <>
                    <div className="pmb-link-booking">Link booking-mu: <b>{linkAktif.replace(/^https?:\/\//, '')}</b></div>
                    <button type="button" className="pmb-link" onClick={salinLink}>{tersalin ? 'Tersalin!' : 'Salin Link'}</button>
                  </>
                ) : (
                  <>
                    {belumAktif && <div className="pmb-link-booking">Link booking-mu belum aktif.</div>}
                    <button type="button" className="pmb-link" onClick={() => buka('/pengaturan')}>{belumAktif ? 'Aktifkan di Pengaturan →' : 'Atur di Pengaturan →'}</button>
                  </>
                )}
              </div>
            </div>

            <div className="pmb-kartu">
              <div className="pmb-ikon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9"><path d="M22 12h-6l-2 3h-4l-2-3H2" /><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11Z" /></svg>
              </div>
              <div className="pmb-kartu-isi">
                <div className="pmb-kartu-judul">Permintaan Booking</div>
                <div className="pmb-kartu-desc">Semua permintaan dari link masuk ke sini dan langsung muncul tanpa perlu refresh. Tekan Terima, form booking terisi otomatis, atau balas calon klien lewat WhatsApp.</div>
                <button type="button" className="pmb-link" onClick={() => buka('/permintaan')}>Buka Permintaan Booking →</button>
              </div>
            </div>
          </div>

          <div className="pmb-lainnya-judul">Lainnya</div>
          <ul className="pmb-lainnya">
            <li>Permintaan baru langsung ditandai di lonceng Dashboard dan sebagai angka di menu Permintaan Booking.</li>
            <li>Perbaikan tampilan di beberapa bagian.</li>
          </ul>
        </div>

        <div className="pmb-aksi">
          <button type="button" className="btn-primary" onClick={onClose}>Oke, mengerti</button>
        </div>
      </div>
    </div>
  )
}
