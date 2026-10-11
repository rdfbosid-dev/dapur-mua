import { useEffect, useState, useSyncExternalStore } from 'react'
import { useAuth } from '../context/AuthContext'
import {
  bisaPasangLangsung, langgananPasang, jalankanPasang, sudahTerpasang,
  perangkatSentuh, iosSafari, barusajaDitutup, catatDitutup,
} from '../lib/pasangAplikasi'
import './PasangAplikasi.css'

// Jeda sebelum banner muncul -- user dikasih waktu lihat aplikasinya dulu,
// jangan langsung ditodong pas baru masuk.
const JEDA_TAMPIL_MS = 5000

// Banner "Pasang Dapur MUA".
//  - Chrome Android: tombol "Pasang" langsung membuka dialog pasang bawaan.
//  - Safari iPhone/iPad: Apple nggak mengizinkan tombol pasang, jadi banner
//    berisi petunjuk "Bagikan -> Tambah ke Layar Utama".
// Muncul cuma kalau: sudah login (bukan admin), perangkat sentuh, aplikasi
// belum terpasang, dan belum ditutup dalam 14 hari terakhir.
export default function PasangAplikasi() {
  const { user, loading, isAdmin } = useAuth()
  const bisaPasang = useSyncExternalStore(langgananPasang, bisaPasangLangsung, () => false)
  const [jedaSelesai, setJedaSelesai] = useState(false)
  const [ditutup, setDitutup] = useState(barusajaDitutup)

  const layak = !!user && !loading && !isAdmin
  useEffect(() => {
    if (!layak) return undefined
    const t = setTimeout(() => setJedaSelesai(true), JEDA_TAMPIL_MS)
    return () => clearTimeout(t)
  }, [layak])

  if (!layak || !jedaSelesai || ditutup) return null
  if (sudahTerpasang() || !perangkatSentuh()) return null

  const mode = bisaPasang ? 'langsung' : (iosSafari() ? 'ios' : null)
  if (!mode) return null

  function tutup() {
    catatDitutup()
    setDitutup(true)
  }

  async function pasang() {
    const hasil = await jalankanPasang()
    // Diterima -> selesai. Ditolak di dialog -> anggap "nanti", jangan ditawari lagi dulu.
    if (hasil === 'dismissed') catatDitutup()
    setDitutup(true)
  }

  return (
    <div className="pasang-app" role="dialog" aria-label="Pasang aplikasi Dapur MUA">
      <img className="pasang-app-ikon" src="/icon-192.png" alt="" />
      <div className="pasang-app-teks">
        <div className="pasang-app-judul">Pasang Dapur MUA</div>
        {mode === 'langsung' ? (
          <div className="pasang-app-sub">Buka lebih cepat dari layar utama HP, tanpa lewat browser.</div>
        ) : (
          <div className="pasang-app-sub">
            Ketuk
            <svg className="pasang-app-bagikan" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-label="Bagikan">
              <path d="M12 3v12M8 7l4-4 4 4" /><path d="M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7" />
            </svg>
            lalu pilih <b>Tambah ke Layar Utama</b>.
          </div>
        )}
      </div>
      {mode === 'langsung' && (
        <button type="button" className="pasang-app-btn" onClick={pasang}>Pasang</button>
      )}
      <button type="button" className="pasang-app-tutup" onClick={tutup} aria-label="Tutup">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 6l12 12M18 6L6 18" /></svg>
      </button>
    </div>
  )
}
