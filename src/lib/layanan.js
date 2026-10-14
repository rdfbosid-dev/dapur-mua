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
// semua layanan yang dipilih kategorinya beda dari acaranya, ATAU ada klien
// yang kategorinya lebih TINGGI dari kategori acaranya (lihat
// peringatanKategoriEvent).
//
// Identitas paket = KATEGORI + JENIS MAKEUP (opsional) + KETERANGAN (opsional):
// - Jenis kosong = "paket dasar" kategori itu (di invoice: "Makeup Wedding").
// - Keterangan = pembeda harga INTERNAL (misal "Jogja", "Weekend") -- cuma
//   tampil di pilihan paket & halaman Paket Layanan, NGGAK pernah disimpan ke
//   booking, jadi nggak pernah tampil di invoice.

// Opsi pertama dropdown Layanan di kartu Klien = isi manual (perilaku lama).
export const PILIHAN_ISI_MANUAL = 'Pilih Manual'

// Label layanan nonaktif yang masih nempel di peserta booking lama.
const AKHIRAN_NONAKTIF = ' (nonaktif)'

export const KOLOM_LAYANAN = 'id, nama, kategori_makeup, jenis_makeup, keterangan, biaya_makeup, aktif'

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

// Jenis Makeup paket -- INI yang disimpan ke booking (peserta.jenis_paket).
// '' = paket dasar (Jenis sengaja dikosongkan). Kolom `nama` di database
// diisi otomatis (= Jenis, atau = Kategori buat paket dasar); data lama yang
// Jenis-nya kosong tapi Nama-nya beda dari Kategori -> pakai Nama.
export function namaLayanan(l) {
  const jenis = String(l.jenis_makeup || '').trim()
  if (jenis) return jenis
  const nama = String(l.nama || '').trim()
  return nama && normalKategori(nama) !== normalKategori(l.kategori_makeup) ? nama : ''
}

export function keteranganLayanan(l) {
  return String(l.keterangan || '').trim()
}

// Label PENDEK (anak di menu dropdown, udah di bawah judul Kategori):
// "Premium", "Standard · Jogja", "Wedding (paket dasar)".
export function labelPendekLayanan(l) {
  const inti = namaLayanan(l) || `${l.kategori_makeup} (paket dasar)`
  const ket = keteranganLayanan(l)
  return ket ? `${inti} · ${ket}` : inti
}

// Label LENGKAP (tombol dropdown, catatan harga): "Wedding · Premium",
// "Regular · Standard · Jogja", "Wedding (paket dasar)".
export function labelLengkapLayanan(l) {
  const jenis = namaLayanan(l)
  const inti = jenis ? `${l.kategori_makeup} · ${jenis}` : `${l.kategori_makeup} (paket dasar)`
  const ket = keteranganLayanan(l)
  return ket ? `${inti} · ${ket}` : inti
}

// Label di halaman Paket Layanan: "Wedding - Premium", "Wedding",
// "Regular - Standard (Jogja)", "Wedding (Jogja)".
export function labelHalamanLayanan(l) {
  const jenis = namaLayanan(l)
  const ket = keteranganLayanan(l)
  return `${l.kategori_makeup}${jenis ? ` | ${jenis}` : ''}${ket ? ` (${ket})` : ''}`
}

// Urutan di halaman Paket Layanan: Kategori A-Z, lalu sama kayak di dropdown
// (paket dasar dulu, Jenis A-Z, tanpa Keterangan dulu). Paket nonaktif tetap
// di posisi urutannya.
export function bandingHalamanLayanan(a, b) {
  return String(a.kategori_makeup || '').localeCompare(String(b.kategori_makeup || ''), 'id', { sensitivity: 'base' }) || bandingPaket(a, b)
}

function labelDari(l) {
  return l.aktif ? labelPendekLayanan(l) : labelPendekLayanan(l) + AKHIRAN_NONAKTIF
}

// Urutan paket di dalam 1 kategori: paket dasar dulu, lalu Jenis A-Z; Jenis
// yang sama -> tanpa Keterangan dulu, lalu Keterangan A-Z. Jadi "Standard"
// & "Standard · Jogja" selalu berdampingan.
function bandingPaket(a, b) {
  const banding = (x, y) => (x === y ? 0 : x === '' ? -1 : y === '' ? 1 : x.localeCompare(y, 'id', { sensitivity: 'base', numeric: true }))
  return banding(namaLayanan(a), namaLayanan(b)) || banding(keteranganLayanan(a), keteranganLayanan(b))
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

// "Reguler" (data lama) & "Regular" dianggap kategori yang SAMA -- jaga-jaga
// kalau masih ada data lama bertuliskan "Reguler".
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

// TINGKATAN kategori: Wedding > Special Occasion > Regular. Kategori lain
// (data lama/aneh) -> 0 = nggak ikut dibandingkan.
const TINGKAT_KATEGORI = { wedding: 3, 'special occasion': 2, reguler: 1 }
export function tingkatKategori(k) {
  return TINGKAT_KATEGORI[normalKategori(k)] || 0
}

// Klien ini kategorinya LEBIH TINGGI dari kategori acaranya? (misal Wedding
// di acara Wisuda). Lebih RENDAH itu wajar (ibu/keluarga pakai Regular di
// acara Wedding), jadi nggak dianggap masalah.
export function kategoriLebihTinggi(kategoriKlien, kategoriAcara) {
  const a = tingkatKategori(kategoriAcara)
  const k = tingkatKategori(kategoriKlien)
  return a > 0 && k > a
}

// Peringatan (bukan larangan) Event vs kategori klien. Klien manual ikut
// dihitung. Muncul kalau SALAH SATU:
// 1. NGGAK SATU PUN klien berkategori yang biasa dipakai acara ini (misal
//    Akad tapi semua klien Regular).
// 2. Ada klien yang kategorinya LEBIH TINGGI dari kategori acara (misal
//    Wisuda, klien 1 Regular tapi klien 2 Wedding).
// Booking campuran yang wajar (pengantin Wedding + ibu Regular di Akad) aman.
// Jenis Makeup (Standard/VIP/...) NGGAK dibandingkan -- cuma kategorinya.
// Hasil: { event, kategori, kategoriKlien: [unik], tidakAdaYangCocok,
// lebihTinggi: [{ nomor, kategori }], kunci } atau null.
// `kunci` dipakai buat konfirmasi Simpan: kalau kategori klien mana pun
// berubah, user ditanya lagi.
export function peringatanKategoriEvent(daftarKategori, ev) {
  const kategori = kategoriUntukEvent(ev)
  if (!kategori) return null
  const semua = daftarKategori.map((k) => String(k || '').trim())
  const terisi = semua.filter(Boolean)
  if (terisi.length === 0) return null
  const tidakAdaYangCocok = !terisi.some((k) => normalKategori(k) === normalKategori(kategori))
  const lebihTinggi = semua
    .map((k, i) => ({ nomor: i + 1, kategori: k }))
    .filter((x) => x.kategori && kategoriLebihTinggi(x.kategori, kategori))
  if (!tidakAdaYangCocok && lebihTinggi.length === 0) return null
  const unik = [...new Set(terisi)]
  return {
    event: String(ev).trim(),
    kategori,
    kategoriKlien: unik,
    tidakAdaYangCocok,
    lebihTinggi,
    kunci: `${String(ev).trim()}|${semua.map(normalKategori).join(',')}`,
  }
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
    opsi: daftar.filter((l) => normalKategori(l.kategori_makeup) === normalKategori(k) && (l.aktif || l.id === idTerpilih)).sort(bandingPaket).map((l) => ({ id: l.id, label: labelDari(l) })),
  }))
  kelompok.push({ judul: 'Lainnya', cocok: false, opsi: lainnya.filter((l) => l.aktif || l.id === idTerpilih).sort(bandingPaket).map((l) => ({ id: l.id, label: labelDari(l) })) })
  return kelompok.filter((k) => k.opsi.length > 0)
}

// Label yang ditampilin dropdown buat layanan_id tertentu. Kosong / nggak
// ketemu (misal layanannya udah dihapus) -> "Pilih Manual".
export function labelLayanan(daftar, id) {
  if (!id) return PILIHAN_ISI_MANUAL
  const l = daftar.find((x) => x.id === id)
  if (!l) return PILIHAN_ISI_MANUAL
  return l.aktif ? labelLengkapLayanan(l) : labelLengkapLayanan(l) + AKHIRAN_NONAKTIF
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
