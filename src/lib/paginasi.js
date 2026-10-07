// Daftar item paginasi yang RINGKAS & lebarnya TETAP, dipakai halaman Booking & Klien.
//
// MASALAH YANG DIATASI: dulu semua nomor halaman ditampilin berderet. Makin
// banyak data, makin banyak tombol, sampai baris tombolnya lebih lebar dari
// layar HP -> seluruh halaman jadi bisa digeser ke samping (layar "keluar batas").
//
// Sekarang selalu maksimal 7 item (angka atau "…"), berapa pun jumlah halamannya:
//   - total <= 7                  : semua angka        1 2 3 4 5 6 7
//   - dekat awal (halaman <= 4)   : 1 2 3 4 5 … 9
//   - dekat akhir                 : 1 … 5 6 7 8 9
//   - di tengah                   : 1 … 4 5 6 … 9
// "…" SELALU mewakili minimal 2 halaman yang dilompati (nggak pernah cuma 1 --
// kalau cuma 1, mending angkanya langsung ditampilin).
//
// Hasil: array berisi angka (halaman) dan string '…' (penanda lompatan, bukan
// tombol).
export const LOMPATAN = '…'

export function daftarHalaman(sekarang, total) {
  const t = Math.max(1, Math.floor(Number(total) || 1))
  const c = Math.min(Math.max(1, Math.floor(Number(sekarang) || 1)), t)
  if (t <= 7) return Array.from({ length: t }, (_, i) => i + 1)
  if (c <= 4) return [1, 2, 3, 4, 5, LOMPATAN, t]
  if (c >= t - 3) return [1, LOMPATAN, t - 4, t - 3, t - 2, t - 1, t]
  return [1, LOMPATAN, c - 1, c, c + 1, LOMPATAN, t]
}
