// Info PEMBARUAN ("Update 1.2", dst) -- modal yang muncul SEKALI per user
// (per akun, per perangkat) di Dashboard, plus item di lonceng notifikasi
// selama beberapa hari setelahnya. Isi modalnya di components/PembaruanModal.jsx.
//
// Rilis berikutnya: ganti VERSI_PEMBARUAN (misal '1.2') & isi modalnya --
// karena kunci penyimpanannya ikut nomor versi, modalnya otomatis muncul
// lagi sekali ke semua user lama.
// 1.1 = Pengeluaran, Paket Layanan, zona waktu.
// 1.2 = Link Booking Online & Permintaan Booking.
export const VERSI_PEMBARUAN = '1.2'

// Berapa hari item "Yang baru di Update x" tetap ada di lonceng setelah
// modalnya ditutup (buat yang kelewat baca / mau buka lagi).
export const HARI_DI_LONCENG = 14

// Isi yang disimpan:
// - angka (waktu ditutup, ms) = user lama yang udah lihat modalnya;
// - 'baru' = akun baru (dapat sambutan/OnboardingModal, jadi info
//   pembaruan nggak perlu ditampilin sama sekali, termasuk di lonceng).
function kunci(userId) {
  return `dapurmua:pembaruan:${VERSI_PEMBARUAN}:${userId}`
}

// null = belum pernah lihat. Penyimpanan diblokir (mode privat) -> dianggap
// SUDAH lihat, biar modalnya nggak muncul terus tiap buka Dashboard.
export function bacaPembaruan(userId) {
  if (!userId) return null
  try {
    return window.localStorage.getItem(kunci(userId))
  } catch {
    return 'baru'
  }
}

export function tandaiPembaruan(userId, nilai) {
  if (!userId) return
  try {
    if (!window.localStorage.getItem(kunci(userId))) window.localStorage.setItem(kunci(userId), String(nilai))
  } catch { /* penyimpanan diblokir: nggak apa-apa */ }
}

// Item lonceng masih tampil? Cuma buat user lama, sampai HARI_DI_LONCENG lewat.
export function pembaruanDiLonceng(nilai, sekarang = Date.now()) {
  const waktu = Number(nilai)
  return waktu > 0 && sekarang < waktu + HARI_DI_LONCENG * 24 * 60 * 60 * 1000
}
