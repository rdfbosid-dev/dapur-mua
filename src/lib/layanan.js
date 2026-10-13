import { supabase } from './supabase'
import { EVENT_OPTIONS, EVENT_CUSTOM_SENTINEL, EVENT_KELOMPOK, SARAN_KATEGORI, KATEGORI_MAKEUP_OPTIONS } from './constants'

// LAYANAN SAYA -- template layanan makeup milik masing-masing MUA (tabel
// `layanan`, RLS: cuma bisa dibaca/diubah pemiliknya sendiri).
//
// PRINSIP UTAMA (biar rumus perhitungan nggak pernah berantakan walau isi
// layanan tiap user beda-beda banget):
// Layanan = DAFTAR HARGA: Kategori, Nama, Jenis Makeup, Biaya per sesi.
// Layanan NGGAK terikat ke Event -- Event dipilih bebas di form booking.
// Pilih layanan di kartu klien:
//   - Kategori       -> peserta.kategori_makeup  (dikunci, ikut layanan)
//   - Jenis Makeup   -> peserta.jenis_paket      (dikunci, ikut layanan)
//   - Biaya Makeup   -> peserta.biaya_makeup     (keisi, tetap bisa diedit)
// Nilainya disimpan ke kolom-kolom lama itu PERSIS kayak diketik manual.
// Semua rumus (VIEW booking_summary, Invoice, Rincian Keuangan, Laporan)
// tetap baca kolom-kolom lama itu -- nggak ada satu rumus pun yang baca
// tabel `layanan`. peserta.layanan_id cuma CATATAN asal-usul. Hapus layanan
// -> layanan_id jadi NULL (FK ON DELETE SET NULL), angka booking lama tetap.
//
// Biar tetap terarah tanpa ngunci: tiap Event standar punya kategori yang
// BIASA dipakai (EVENT_KELOMPOK di constants.js). Dropdown Layanan naikin
// layanan berkategori itu ke paling atas, dan ada peringatan halus kalau
// semua layanan yang dipilih kategorinya beda dari acaranya.

// Opsi pertama dropdown Layanan di kartu Klien = isi manual (perilaku lama).
export const PILIHAN_ISI_MANUAL = 'Pilih Manual'

// Label layanan nonaktif yang masih nempel di peserta booking lama.
const AKHIRAN_NONAKTIF = ' (nonaktif)'

export const KOLOM_LAYANAN = 'id, nama, kategori_makeup, jenis_makeup, biaya_makeup, aktif'

// Semua layanan milik user ini (aktif & nonaktif), urut nama. Gagal muat ->
// [] (form booking tetap jalan normal kayak sebelum ada fitur ini).
export async function muatLayanan(userId) {
  if (!userId) return []
  const { data, error } = await supabase
    .from('layanan')
    .select(KOLOM_LAYANAN)
    .eq('user_id', userId)
    .order('nama')
  if (error || !data) return []
  return data
}

// Nilai Event layanan -> state form booking { event, eventCustom }.
// Event yang ada di daftar EVENT_OPTIONS langsung dipilih; selain itu masuk
// ke "Lainnya (ketik manual)" + teks event-nya -- sama persis kayak cara
// BookingDetailModal memuat event booking lama.
export function eventKeForm(ev) {
  const teks = String(ev || '').trim()
  if (!teks) return { event: '', eventCustom: '' }
  if (teks && teks !== EVENT_CUSTOM_SENTINEL && EVENT_OPTIONS.includes(teks)) {
    return { event: teks, eventCustom: '' }
  }
  return { event: EVENT_CUSTOM_SENTINEL, eventCustom: teks }
}

// Biaya layanan -> string angka buat field Biaya Makeup (format yang sama
// kayak hasil parseAngkaInput). 0 -> '' (field kosong, placeholder Rp0).
export function biayaKeForm(biaya) {
  const n = Math.round(Number(biaya) || 0)
  return n > 0 ? String(n) : ''
}

// Nama tampilan layanan = Jenis Makeup (data lama yang Jenis-nya kosong ->
// pakai Nama). Di menu dropdown udah dikelompokkan per Kategori, jadi cukup
// Jenis-nya; di tombol dropdown (labelLayanan) ditulis lengkap "Kategori · Jenis".
export function namaLayanan(l) {
  return String(l.jenis_makeup || '').trim() || String(l.nama || '').trim()
}

function labelDari(l) {
  return l.aktif ? namaLayanan(l) : namaLayanan(l) + AKHIRAN_NONAKTIF
}

// Objek layanan yang lagi dipakai baris ini (null = isi manual / layanannya
// udah dihapus / daftar gagal dimuat -> diperlakukan kayak isi manual).
export function layananDipakai(daftar, id) {
  if (!id) return null
  return daftar.find((l) => l.id === id) || null
}

// Event final dari state form (dropdown + teks "Lainnya (ketik manual)").
export function eventDariForm(event, eventCustom) {
  return event === EVENT_CUSTOM_SENTINEL ? String(eventCustom || '').trim() : String(event || '').trim()
}

// Kategori yang biasa dipakai sebuah Event (null = event manual/lama).
export function kategoriUntukEvent(ev) {
  const teks = String(ev || '').trim().toLowerCase()
  if (!teks) return null
  const k = EVENT_KELOMPOK.find((x) => x.events.some((e) => e.toLowerCase() === teks))
  return k ? k.kategori : null
}

// "Regular" (nilai lama) & "Regular" dianggap kategori yang SAMA -- data
// lama banyak yang "Regular", pilihan sekarang "Regular".
function normalKategori(k) {
  const t = String(k || '').trim().toLowerCase()
  return t === 'regular' ? 'reguler' : t
}

// Label makeup di Detail Booking & Invoice: "Makeup <Kategori> <Jenis>",
// misal "Makeup Wedding Premium", "Makeup Special Occasion VIP".
// - Jenis kosong (data lama)          -> "Makeup Wedding"
// - Kategori kosong (data lama)       -> "Makeup VIP"
// - Jenis udah diawali kategori       -> nggak diulang: Wedding + "Wedding Gold"
//   -> "Makeup Wedding Gold"; Regular + "Regular" -> "Makeup Regular"
// - Jenis udah diawali kata "Makeup"  -> "Makeup"-nya nggak dobel.
// Kategori ditulis apa adanya sesuai yang tersimpan (Regular / Regular).
export function labelMakeup(kategori, jenis) {
  const k = String(kategori || '').trim()
  let j = String(jenis || '').trim()
  const samakan = (t) => t.toLowerCase().replace(/\bregular\b/g, 'reguler')
  const nk = samakan(k)
  const nj = samakan(j)
  if (k && (nj === nk || nj.startsWith(nk + ' '))) j = j.slice(k.length).trim()
  const inti = [k, j].filter(Boolean).join(' ')
  if (!inti) return 'Makeup'
  return /^makeup\b/i.test(j) && !k ? inti : 'Makeup ' + inti
}

// Kategori efektif tiap klien: dari layanan kalau pakai layanan, selain itu
// dari isian manual. '' = belum dipilih.
export function kategoriKlien(daftar, idLayanan, kategoriManual) {
  const l = layananDipakai(daftar, idLayanan)
  return l ? l.kategori_makeup : String(kategoriManual || '').trim()
}

// Peringatan (bukan larangan): ada klien yang kategorinya udah dipilih, tapi
// NGGAK SATU PUN berkategori yang biasa dipakai acara ini. Klien manual ikut
// dihitung. Booking campuran (misal pengantin Wedding + ibu Regular di Akad)
// aman, karena minimal 1 klien cocok.
// Hasil: { event, kategori, kategoriKlien: [unik], kunci } atau null.
// `kunci` dipakai buat konfirmasi Simpan: kalau kombinasinya berubah,
// user ditanya lagi.
export function peringatanKategoriEvent(daftarKategori, ev) {
  const kategori = kategoriUntukEvent(ev)
  if (!kategori) return null
  const terisi = daftarKategori.map((k) => String(k || '').trim()).filter(Boolean)
  if (terisi.length === 0) return null
  if (terisi.some((k) => normalKategori(k) === normalKategori(kategori))) return null
  const unik = [...new Set(terisi)]
  return { event: String(ev).trim(), kategori, kategoriKlien: unik, kunci: `${String(ev).trim()}|${unik.join(',')}` }
}

// Kelompok pilihan dropdown Layanan di kartu Klien: per Kategori, kategori
// yang cocok sama Event ditaruh paling atas. Isinya layanan AKTIF + layanan
// yang lagi kepilih di baris itu (termasuk yang nonaktif / data lama).
// Hasil: [{ judul, cocok, opsi: [{ id, label }] }] (kelompok kosong dibuang).
export function kelompokOpsiLayanan(daftar, idTerpilih, eventAktif = '') {
  const kategoriCocok = kategoriUntukEvent(eventAktif)
  const urutan = [...KATEGORI_MAKEUP_OPTIONS]
  if (kategoriCocok) urutan.sort((a, b) => (a === kategoriCocok ? -1 : b === kategoriCocok ? 1 : 0))
  const lainnya = daftar.filter((l) => !KATEGORI_MAKEUP_OPTIONS.some((k) => normalKategori(k) === normalKategori(l.kategori_makeup)))
  const kelompok = urutan.map((k) => ({
    judul: k === kategoriCocok ? `${k} · sesuai acara ${String(eventAktif).trim()}` : k,
    cocok: k === kategoriCocok,
    opsi: daftar.filter((l) => normalKategori(l.kategori_makeup) === normalKategori(k) && (l.aktif || l.id === idTerpilih)).map((l) => ({ id: l.id, label: labelDari(l) })),
  }))
  kelompok.push({ judul: 'Lainnya', cocok: false, opsi: lainnya.filter((l) => l.aktif || l.id === idTerpilih).map((l) => ({ id: l.id, label: labelDari(l) })) })
  return kelompok.filter((k) => k.opsi.length > 0)
}

// Label yang ditampilin dropdown buat layanan_id tertentu. Kosong / nggak
// ketemu (misal layanannya udah dihapus) -> "Pilih Manual".
export function labelLayanan(daftar, id) {
  if (!id) return PILIHAN_ISI_MANUAL
  const l = daftar.find((x) => x.id === id)
  return l ? `${l.kategori_makeup} · ${labelDari(l)}` : PILIHAN_ISI_MANUAL
}

// Dropdown Layanan perlu ditampilin di kartu Klien? Cuma kalau user punya
// minimal 1 layanan aktif, ATAU baris ini udah nempel ke layanan (booking
// lama). User yang nggak pakai fitur ini -> form 100% sama kayak dulu.
export function tampilkanPilihanLayanan(daftar, idTerpilih) {
  return daftar.some((l) => l.aktif) || (!!idTerpilih && daftar.some((l) => l.id === idTerpilih))
}

// SARAN Kategori dari Nama Layanan (bukan AI -- cuma pencocokan kata kunci
// di constants.js, jadi hasilnya selalu sama & bisa ditebak). Kata kunci
// cocok kalau jadi AWAL salah satu kata di nama ("grad" cocok sama
// "Graduation"); kata kunci 2 kata dicocokkan sebagai frasa ("pre wedding"
// cocok sama "Pre-Wedding"). Hasil: nama kategori atau null.
function cocokKataKunci(nama, kataKunci) {
  const teks = String(nama || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
  const kata = teks.split(' ').filter(Boolean)
  return kataKunci.some((k) => (k.includes(' ') ? ` ${teks} `.includes(` ${k} `) : kata.some((w) => w.startsWith(k))))
}

export function saranKategoriDariNama(nama) {
  const s = SARAN_KATEGORI.find((x) => cocokKataKunci(nama, x.kataKunci))
  return s ? s.kategori : null
}
