import { lazy } from 'react'

// Muat halaman SECARA TERPISAH (code splitting) -- file JavaScript tiap
// halaman baru diunduh waktu halaman itu dibuka, bukan semuanya sekaligus di
// awal. Bikin pembukaan pertama jauh lebih ringan, terutama buat calon klien
// yang cuma buka link booking online.
//
// Pengaman setelah update: kalau tab/aplikasi masih memakai versi LAMA lalu
// minta file halaman yang sudah nggak ada di server (karena baru di-deploy
// versi baru), pemuatannya gagal. Dalam kasus itu halaman dimuat ulang SEKALI
// otomatis supaya dapat versi terbaru. Kalau masih gagal juga (misal internet
// putus), error-nya diteruskan ke ErrorBoundary (layar darurat biasa).
const KUNCI = 'dapurmua:muat-ulang-halaman'

export function muatHalaman(impor) {
  return lazy(async () => {
    try {
      const modul = await impor()
      try { window.sessionStorage.removeItem(KUNCI) } catch { /* penyimpanan diblokir */ }
      return modul
    } catch (err) {
      // Penyimpanan diblokir -> anggap sudah pernah (jangan sampai muat ulang terus).
      let sudah
      try { sudah = window.sessionStorage.getItem(KUNCI) === '1' } catch { sudah = true }
      if (!sudah && navigator.onLine !== false) {
        try { window.sessionStorage.setItem(KUNCI, '1') } catch { /* penyimpanan diblokir */ }
        window.location.reload()
        // Tahan render sampai halaman benar-benar dimuat ulang.
        return new Promise(() => {})
      }
      throw err
    }
  })
}
