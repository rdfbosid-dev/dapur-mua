export const EVENT_OPTIONS = [
  'Akad',
  'Akad & Resepsi (Paket)',
  'Engagement/Tunangan',
  'Kondangan',
  'Lamaran',
  'Midodareni',
  'Ngunduh Mantu',
  'Party',
  'Pemberkatan',
  'Pengajian',
  'Photoshoot',
  'Post-Grad',
  'Post-Wedding',
  'Pre-Grad',
  'Pre-Wedding',
  'Resepsi',
  'Seremonial',
  'Siraman',
  'Sumpah Profesi',
  'Wisuda',
  'Yearbook',
  'Lainnya (ketik manual)',
]

export const EVENT_CUSTOM_SENTINEL = 'Lainnya (ketik manual)'

// Event LAMA yang udah nggak ada di daftar: "Akad/Pemberkatan" (dipecah jadi
// Akad & Pemberkatan), "Pre/Post-Grad" (dipecah jadi Pre-Grad & Post-Grad),
// "Bridesmaid" & "Keluarga Pengantin" (itu PERAN -> field "Peran (Opsional)"
// di kartu klien). Data lama SENGAJA nggak diubah: booking lama pas diedit
// kebaca sebagai "Lainnya (ketik manual)" + teks aslinya.

// Kategori LEVEL LAPORAN, sengaja dikunci cuma 3 opsi (beda sama Event
// yang bebas 19+ pilihan) -- ini yang jadi "payung besar" biar donut
// chart Jenis Paket di Laporan nggak berantakan jadi puluhan slice beda-
// beda kalau semua MUA nulis istilah sendiri-sendiri. Penamaan detail
// (Gold Wedding, Premium, dll) tetep bebas lewat field teks "Jenis
// Makeup" yang terpisah.
export const KATEGORI_MAKEUP_OPTIONS = ['Wedding', 'Special Occasion', 'Regular']
// Kategori yang BIASANYA dipakai tiap Event (1 kelompok per kategori).
// Dipakai form booking buat: (1) naikin layanan yang kategorinya cocok ke
// paling atas dropdown Layanan, (2) peringatan halus kalau semua layanan
// yang dipilih kategorinya beda dari acaranya. Bukan larangan -- misal ibu
// pengantin tetap boleh pakai layanan Regular di acara Akad.
// Semua isi EVENT_OPTIONS (selain "Lainnya") WAJIB masuk tepat 1 kelompok.
export const EVENT_KELOMPOK = [
  { kategori: 'Wedding', events: ['Akad', 'Akad & Resepsi (Paket)', 'Ngunduh Mantu', 'Pemberkatan', 'Resepsi'] },
  { kategori: 'Special Occasion', events: ['Lamaran', 'Midodareni', 'Engagement/Tunangan', 'Pre-Wedding', 'Post-Wedding', 'Siraman'] },
  { kategori: 'Regular', events: ['Kondangan', 'Wisuda', 'Pre-Grad', 'Post-Grad', 'Yearbook', 'Sumpah Profesi', 'Party', 'Photoshoot', 'Seremonial', 'Pengajian'] },
]

// Saran Kategori dari Nama Layanan -- dicek BERURUTAN, yang pertama cocok
// yang dipakai (peran pendamping dulu, biar "Wedding Ibu" -> Regular).
// Kata kunci cocok kalau jadi AWAL salah satu kata di nama (huruf kecil);
// kata kunci 2 kata dicocokkan sebagai frasa.
export const SARAN_KATEGORI = [
  { kategori: 'Regular', kataKunci: ['ibu', 'mama', 'bunda', 'keluarga', 'besan', 'bridesmaid', 'tamu', 'kondangan', 'regular', 'harian', 'daily', 'wisuda', 'graduation', 'grad', 'lulus', 'yearbook', 'sumpah', 'party', 'pesta', 'photoshoot', 'foto', 'photo', 'seremonial', 'pengajian', 'ultah', 'ulang tahun', 'birthday', 'prom'] },
  { kategori: 'Special Occasion', kataKunci: ['lamaran', 'tunangan', 'engagement', 'siraman', 'midodareni', 'prewed', 'postwed', 'pre wedding', 'post wedding'] },
  { kategori: 'Wedding', kataKunci: ['wedding', 'nikah', 'menikah', 'pernikahan', 'pengantin', 'manten', 'akad', 'resepsi', 'pemberkatan', 'ijab', 'bride', 'bridal', 'adat', 'ngunduh', 'mantu'] },
]
