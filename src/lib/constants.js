export const EVENT_OPTIONS = [
  'Akad/Pemberkatan',
  'Akad & Resepsi (Paket)',
  'Bridesmaid',
  'Engagement/Tunangan',
  'Keluarga Pengantin',
  'Kondangan',
  'Lamaran',
  'Midodareni',
  'Ngunduh Mantu',
  'Party',
  'Pengajian',
  'Photoshoot',
  'Pre/Post-Grad',
  'Pre-Wedding',
  'Seremonial',
  'Siraman',
  'Sumpah Profesi',
  'Wisuda',
  'Yearbook',
  'Lainnya (ketik manual)',
]

export const EVENT_CUSTOM_SENTINEL = 'Lainnya (ketik manual)'

// Kategori LEVEL LAPORAN, sengaja dikunci cuma 3 opsi (beda sama Event
// yang bebas 19+ pilihan) -- ini yang jadi "payung besar" biar donut
// chart Jenis Paket di Laporan nggak berantakan jadi puluhan slice beda-
// beda kalau semua MUA nulis istilah sendiri-sendiri. Penamaan detail
// (Gold Wedding, Premium, dll) tetep bebas lewat field teks "Jenis
// Makeup" yang terpisah.
export const KATEGORI_MAKEUP_OPTIONS = ['Wedding', 'Special Occasion', 'Reguler']