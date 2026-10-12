// Status pembayaran booking -- nilainya dihitung di VIEW booking_summary
// (kolom status_pembayaran), file ini cuma ngurus TAMPILANnya biar seragam
// di semua halaman (Booking, Dashboard, Kalender, Klien, Detail Booking).
//
//   Total tagihan Rp0            -> 'Belum Ada Tagihan' (pill abu-abu netral)
//   Total > 0, sisa tagihan <= 0 -> 'Lunas'             (pill hijau)
//   Total > 0, sisa tagihan > 0  -> 'Belum Lunas'       (pill merah)
import './statusPembayaran.css'

export const STATUS_BELUM_ADA_TAGIHAN = 'Belum Ada Tagihan'

// Class CSS pill-nya: 'lunas' | 'belum' | 'kosong'.
export function kelasStatusPembayaran(status) {
  if (status === 'Lunas') return 'lunas'
  if (status === STATUS_BELUM_ADA_TAGIHAN) return 'kosong'
  return 'belum'
}

// Ada nilai tagihan yang diisi di form? Dicek dari SEMUA field yang namanya
// diawali "biaya"/"transport" (camelCase di form Booking Baru maupun
// snake_case di form Edit), termasuk yang ada di dalam daftar Add On, Sewa &
// vendor Paket Bundling. Komisi/untung/DP SENGAJA nggak dihitung -- itu bukan
// tagihan ke klien. Dipakai buat pengingat "tagihan masih Rp0" sebelum simpan;
// status resminya tetap dari database.
const POLA_FIELD_TAGIHAN = /^(biaya|transport)/i
export function adaNilaiTagihan(...sumber) {
  function cek(nilai) {
    if (Array.isArray(nilai)) return nilai.some(cek)
    if (!nilai || typeof nilai !== 'object') return false
    return Object.entries(nilai).some(([kunci, isi]) => (
      (POLA_FIELD_TAGIHAN.test(kunci) && Number(isi) > 0) || (isi && typeof isi === 'object' && cek(isi))
    ))
  }
  return sumber.some(cek)
}
