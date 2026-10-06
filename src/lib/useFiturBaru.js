import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'

// Penanda "Fitur Baru" yang tampil SEMENTARA di menu.
//
// Cara kerja: tiap user dihitung SENDIRI-SENDIRI. Waktu mulainya = saat user
// itu PERTAMA KALI membuka aplikasi setelah fitur ini ada (dicatat sekali di
// localStorage browser, per akun). Tandanya tampil sampai `durasiJam` lewat,
// lalu hilang sendiri (kalau aplikasinya lagi terbuka pun hilang tepat waktu).
//
// Mau menandai fitur baru lain nanti? Tambah 1 baris di FITUR_BARU di bawah,
// lalu kasih `fiturBaru: '<kunci>'` di item menunya (lihat Sidebar.jsx).
// Mau menghentikan tandanya lebih cepat? Hapus barisnya dari FITUR_BARU.
export const FITUR_BARU = {
  pengeluaran: { durasiJam: 48 },
}

const MS_PER_JAM = 60 * 60 * 1000
// setTimeout maksimal ~24,8 hari; 48 jam jauh di bawahnya, ini cuma pengaman.
const BATAS_TIMEOUT_MS = 2 ** 31 - 1

function kunciStorage(fitur, userId) {
  return `dapurmua:fitur-baru:${fitur}:${userId}`
}

// Waktu mulai (ms) fitur ini untuk user ini. Belum pernah dicatat -> dicatat
// SEKARANG (artinya ini pertama kali user membuka aplikasi). Balikin null
// kalau penyimpanan browser nggak bisa dipakai (mode privat/diblokir) --
// SENGAJA nggak ditampilin dalam kasus itu, biar tandanya nggak pernah
// nyangkut selamanya gara-gara waktu mulainya nggak bisa diingat.
function ambilWaktuMulai(fitur, userId) {
  try {
    const kunci = kunciStorage(fitur, userId)
    const tersimpan = Number(window.localStorage.getItem(kunci))
    if (tersimpan > 0) return tersimpan
    const sekarang = Date.now()
    window.localStorage.setItem(kunci, String(sekarang))
    return sekarang
  } catch {
    return null
  }
}

function hitungAktif(userId) {
  const hasil = {}
  Object.entries(FITUR_BARU).forEach(([fitur, cfg]) => {
    if (!userId) { hasil[fitur] = false; return }
    const mulai = ambilWaktuMulai(fitur, userId)
    hasil[fitur] = mulai !== null && Date.now() < mulai + cfg.durasiJam * MS_PER_JAM
  })
  return hasil
}

// Hasil: objek { <kunciFitur>: true/false }, misal { pengeluaran: true }.
export function useFiturBaru() {
  const { user } = useAuth()
  const userId = user?.id
  const [aktif, setAktif] = useState(() => hitungAktif(userId))

  // Pasang timer biar tandanya hilang tepat waktu walau aplikasi nggak
  // di-reload. setState-nya di dalam callback timer (bukan langsung di badan
  // effect), jadi aman buat aturan lint react-hooks.
  useEffect(() => {
    if (!userId) return undefined
    const timers = Object.entries(FITUR_BARU).map(([fitur, cfg]) => {
      const mulai = ambilWaktuMulai(fitur, userId)
      if (mulai === null) return null
      const sisa = mulai + cfg.durasiJam * MS_PER_JAM - Date.now()
      if (sisa <= 0) return null
      return setTimeout(() => setAktif((prev) => ({ ...prev, [fitur]: false })), Math.min(sisa, BATAS_TIMEOUT_MS))
    })
    return () => timers.forEach((t) => { if (t) clearTimeout(t) })
  }, [userId])

  return aktif
}
