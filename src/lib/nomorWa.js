// ATURAN NOMOR WHATSAPP -- satu sumber buat semua form yang punya field
// Nomor WhatsApp (form Booking Baru, Edit Booking, Pengaturan, & link booking
// online), biar aturannya pasti sama di mana pun.
//
// Karakter yang boleh: angka, spasi biasa, "+", "-", titik, & tanda kurung
// (SAMA dengan pengecekan server di booking_publik_kirim) -- jadi format
// umum tetap bisa: 0812-3456-7890, +62 812 3456 7890, (0271) 123456.
// Huruf & simbol lain langsung dibuang waktu diketik/ditempel
// (rapikanKetikanWa), dan ditolak waktu disimpan (pesanNomorWaTidakValid) --
// jaga-jaga kalau isinya datang dari isian otomatis browser / data lama.

const BUKAN_KARAKTER_WA = /[^0-9+\- ().]/g

// Dipakai di onChange field: buang karakter yang nggak boleh.
export function rapikanKetikanWa(teks) {
  return String(teks || '').replace(BUKAN_KARAKTER_WA, '')
}

export function nomorWaAdaHuruf(nomor) {
  return /[^0-9+\- ().]/.test(String(nomor || ''))
}

export function jumlahAngkaWa(nomor) {
  return (String(nomor || '').match(/\d/g) || []).length
}

// '' = valid. Selain itu = pesan error yang siap ditampilkan.
// - maksAngka: batas jumlah angka (link publik pakai 15, sama dengan server).
export function pesanNomorWaTidakValid(nomor, { maksAngka = null } = {}) {
  if (nomorWaAdaHuruf(nomor)) return 'Nomor WhatsApp cuma boleh berisi angka (boleh pakai spasi, +, -, atau tanda kurung).'
  const n = jumlahAngkaWa(nomor)
  if (n < 8) return 'Nomor WhatsApp belum benar (minimal 8 angka).'
  if (maksAngka && n > maksAngka) return `Nomor WhatsApp terlalu panjang (maksimal ${maksAngka} angka).`
  return ''
}
