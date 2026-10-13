import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'
import { VERSI_PEMBARUAN } from '../lib/pembaruan'
import { kodeZona, tebakZonaPerangkat } from '../lib/zonaWaktu'
import './PembaruanModal.css'

// Info "Yang baru di Dapur MUA" -- muncul SEKALI ke user lama di Dashboard
// (aturan tampilnya di Dashboard.jsx & lib/pembaruan.js). Gayanya satu
// keluarga sama OnboardingModal, di HP jadi bottom sheet kayak modal lain.
// Rilis berikutnya: ganti isi di bawah + VERSI_PEMBARUAN di lib/pembaruan.js.
export default function PembaruanModal({ onClose }) {
  const navigate = useNavigate()
  const { profile } = useAuth()
  // Logo Dapur MUA -- file & aturan tema SAMA kayak logo di Sidebar.jsx.
  const { theme } = useTheme()
  const logoSrc = theme === 'dark' ? '/icon-512-dark.png' : '/icon-512-light.png'

  // Zona perangkat beda dari zona di profil (misal user Kalsel yang profilnya
  // masih WIB bawaan) -> kalimat zona waktu dibikin lebih "nyolek".
  const zonaProfil = kodeZona(profile)
  const zonaPerangkat = tebakZonaPerangkat()
  const perluAturZona = !!zonaPerangkat && zonaPerangkat !== zonaProfil

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
            <p>Dua fitur baru dan beberapa perbaikan, biar urusan studio MUA-mu makin rapi.</p>
          </div>

          <div className="pmb-fitur">
            <div className="pmb-kartu">
              <div className="pmb-ikon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9"><path d="M3 7a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v1" /><rect x="3" y="7" width="18" height="13" rx="2" /><path d="M16 13.5h2" /></svg>
              </div>
              <div className="pmb-kartu-isi">
                <div className="pmb-kartu-judul">Pengeluaran <span className="pmb-opsional">opsional</span></div>
                <div className="pmb-kartu-desc">Catat belanja produk, alat, iklan, dan biaya bisnis lainnya, lalu lihat ringkasannya per kategori. Agenda pelatihan &amp; portofolio ikut tampil di Kalender.</div>
                <button type="button" className="pmb-link" onClick={() => buka('/pengeluaran')}>Buka Pengeluaran →</button>
              </div>
            </div>

            <div className="pmb-kartu">
              <div className="pmb-ikon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9"><path d="M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0L3 13V3h10l7.6 7.6a2 2 0 0 1 0 2.8Z" /><circle cx="7.5" cy="7.5" r="1.5" /></svg>
              </div>
              <div className="pmb-kartu-isi">
                <div className="pmb-kartu-judul">Paket Layanan <span className="pmb-opsional">opsional</span></div>
                <div className="pmb-kartu-desc">Buat daftar paket dan harga makeup-mu sekali, misalnya Wedding Premium. Waktu bikin booking, tinggal pilih paketnya, biaya makeup langsung terisi.</div>
                <button type="button" className="pmb-link" onClick={() => buka('/layanan')}>Buka Paket Layanan →</button>
              </div>
            </div>
          </div>

          <div className="pmb-lainnya-judul">Lainnya</div>
          <ul className="pmb-lainnya">
            <li>
              <b>Zona waktu WIB, WITA, dan WIT.</b>{' '}
              {perluAturZona
                ? <>Perangkatmu terdeteksi di zona <b>{zonaPerangkat}</b>, sedangkan akunmu masih {zonaProfil}. Atur dulu biar jam di invoice &amp; kalender tepat.</>
                : <>Jam di invoice, Dashboard, dan Kalender kini mengikuti zona waktumu.</>}
              {' '}<button type="button" className="pmb-link inline" onClick={() => buka('/pengaturan')}>Atur Zona Waktu</button>
            </li>
            <li>Jam acara di kalender HP kini tepat sesuai zona waktumu.</li>
            <li>Nama layanan di invoice kini lengkap, misalnya “Makeup Wedding Premium”.</li>
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
