// Pemulihan aplikasi kalau tampilannya "nyangkut" (layar kosong / error terus).
//
// Penyebab yang paling sering di PWA, terutama iPhone: cache service worker
// setengah terbarui (misal PWA lagi kebuka pas versi baru tayang), jadi
// aplikasi memuat file lama/rusak dari cache. Di iPhone, PWA dari Home Screen
// punya penyimpanan & cache SENDIRI (terpisah dari Safari), dan "tutup
// aplikasi" TIDAK menghapusnya -- makanya dulu harus hapus & pasang ulang
// aplikasinya. Fungsi ini ngelakuin hal yang sama secara otomatis.
//
// Default (lengkap = false): cuma menghapus service worker + cache aplikasi.
// Data login & pengaturan TETAP ada, jadi user nggak perlu login ulang.
// lengkap = true: tambah menghapus localStorage & sessionStorage (user perlu
// login ulang) -- jalan keluar terakhir kalau reset biasa belum cukup.
//
// CATATAN: index.html punya salinan kecil logika yang sama (penjaga startup,
// buat kasus aplikasi gagal dimuat SAMA SEKALI sebelum React jalan). Kalau
// mengubah di sini, ubah juga di sana.
export async function pulihkanAplikasi({ lengkap = false } = {}) {
  try {
    if ('serviceWorker' in navigator) {
      const daftar = await navigator.serviceWorker.getRegistrations()
      await Promise.all(daftar.map((r) => r.unregister()))
    }
  } catch { /* lanjut ke langkah berikutnya */ }
  try {
    if ('caches' in window) {
      const kunci = await window.caches.keys()
      await Promise.all(kunci.map((k) => window.caches.delete(k)))
    }
  } catch { /* lanjut ke langkah berikutnya */ }
  if (lengkap) {
    try { window.localStorage.clear() } catch { /* nggak bisa diakses -- abaikan */ }
    try { window.sessionStorage.clear() } catch { /* nggak bisa diakses -- abaikan */ }
  }
}

// Reset lalu muat ulang. Kalau lagi OFFLINE, minta konfirmasi dulu -- cache itu
// satu-satunya yang bikin aplikasi bisa dibuka tanpa internet, jadi kalau
// dihapus saat offline aplikasinya nggak bisa dibuka lagi sampai online.
export async function resetLaluMuatUlang({ lengkap = false } = {}) {
  if (navigator.onLine === false) {
    const lanjut = window.confirm(
      'Kamu sedang tidak terhubung ke internet. Kalau di-reset sekarang, aplikasi baru bisa dibuka lagi setelah internet menyala. Tetap reset?'
    )
    if (!lanjut) return
  }
  if (lengkap) {
    const yakin = window.confirm('Reset lengkap akan mengeluarkan kamu dari akun, jadi perlu login lagi. Lanjutkan?')
    if (!yakin) return
  }
  await pulihkanAplikasi({ lengkap })
  window.location.reload()
}
