import { supabase } from './supabase'

// PAKET LAYANAN RAMBUT -- daftar harga Hairdo/Hijabdo+ milik masing-masing
// MUA (tabel `layanan_rambut`, RLS: cuma bisa dibaca/diubah pemiliknya).
// TERPISAH dari tabel `layanan` (paket makeup), jadi paket rambut nggak
// pernah nyampur ke dropdown Paket Layanan Makeup maupun link booking online.
//
// PRINSIP (sama kayak paket makeup di lib/layanan.js):
// Paket rambut cuma JALAN PINTAS buat ngisi field yang sama dengan isian
// manual. Pilih paket di kartu Klien:
//   - Jenis (Hairdo/Hijabdo+) -> peserta.layanan_tambahan (tombol 3 pilihan)
//   - Nama Paket              -> peserta.detail_tambahan  (tetap bisa diedit)
//   - Harga                   -> peserta.biaya_tambahan   (tetap bisa diedit)
// Dikerjakan oleh (Me/Tim), Komisi, Nama Tim, Fee Transport Tim, Jumlah
// Sesi TETAP diisi manual. peserta.layanan_tambahan_id cuma CATATAN asal-
// usul (FK ON DELETE SET NULL) -- nggak ada rumus yang baca tabel ini, jadi
// ubah/hapus paket nggak pernah ngubah booking yang udah tersimpan.
//
// Identitas paket = JENIS + NAMA (opsional) + KETERANGAN (opsional):
// - Nama kosong = paket dasar (di invoice cuma "Hairdo").
// - Keterangan = pembeda harga INTERNAL (misal "Jogja", "Weekend"), NGGAK
//   pernah disimpan ke booking, jadi nggak pernah tampil di invoice.

export const JENIS_RAMBUT = ['Hairdo', 'Hijabdo+']
export const TIDAK_ADA_RAMBUT = 'Tidak Ada'
export const PANJANG_MAKS_NAMA_RAMBUT = 60
export const PANJANG_MAKS_KETERANGAN_RAMBUT = 40
// Detail Layanan Rambut di booking (peserta.detail_tambahan) -- batasnya
// sama dengan Nama Paket, biar nama paket apa pun pasti muat.
export const PANJANG_MAKS_DETAIL_RAMBUT = 60

export const KOLOM_LAYANAN_RAMBUT = 'id, jenis, nama, keterangan, biaya, aktif'

const AKHIRAN_NONAKTIF = ' (nonaktif)'

// Semua paket rambut milik user ini (aktif & nonaktif). Gagal muat (misal
// SQL-nya belum dijalankan) -> [] (form booking tetap jalan kayak dulu).
export async function muatLayananRambut(userId) {
  if (!userId) return []
  const { data, error } = await supabase
    .from('layanan_rambut')
    .select(KOLOM_LAYANAN_RAMBUT)
    .eq('user_id', userId)
  if (error || !data) return []
  return data
}

export function namaPaketRambut(l) {
  return String(l?.nama || '').trim()
}
export function keteranganPaketRambut(l) {
  return String(l?.keterangan || '').trim()
}

// Label di dalam dropdown (jenisnya udah jelas dari judul dropdown):
// "Sanggul Modern", "Sanggul Modern · Jogja", "Hairdo (paket dasar)".
export function labelPendekPaketRambut(l) {
  const inti = namaPaketRambut(l) || `${l.jenis} (paket dasar)`
  const ket = keteranganPaketRambut(l)
  return ket ? `${inti} · ${ket}` : inti
}

// Label di halaman Paket Layanan: "Hairdo - Sanggul Modern",
// "Hairdo" (paket dasar), "Hijabdo+ - Syar'i (Jogja)".
export function labelHalamanPaketRambut(l) {
  const nama = namaPaketRambut(l)
  const ket = keteranganPaketRambut(l)
  return `${l.jenis}${nama ? ` | ${nama}` : ''}${ket ? ` (${ket})` : ''}`
}

const bandingTeks = (x, y) => (x === y ? 0 : x === '' ? -1 : y === '' ? 1 : x.localeCompare(y, 'id', { sensitivity: 'base', numeric: true }))

// Urutan: Hairdo dulu lalu Hijabdo+, paket dasar dulu, Nama A-Z, tanpa
// Keterangan dulu lalu Keterangan A-Z ("Sanggul" & "Sanggul · Jogja"
// selalu berdampingan).
export function bandingPaketRambut(a, b) {
  return (JENIS_RAMBUT.indexOf(a.jenis) - JENIS_RAMBUT.indexOf(b.jenis))
    || bandingTeks(namaPaketRambut(a), namaPaketRambut(b))
    || bandingTeks(keteranganPaketRambut(a), keteranganPaketRambut(b))
}

export function paketRambutDipakai(daftar, id) {
  if (!id) return null
  return daftar.find((l) => l.id === id) || null
}

// Pilihan dropdown "Paket Hairdo"/"Paket Hijabdo+": paket AKTIF berjenis
// itu + paket yang lagi kepilih di baris ini (walau nonaktif).
export function opsiPaketRambut(daftar, jenis, idTerpilih) {
  return daftar
    .filter((l) => l.jenis === jenis && (l.aktif || l.id === idTerpilih))
    .sort(bandingPaketRambut)
    .map((l) => ({ id: l.id, label: l.aktif ? labelPendekPaketRambut(l) : labelPendekPaketRambut(l) + AKHIRAN_NONAKTIF }))
}

// Dropdown paket rambut cuma tampil kalau ada paket aktif berjenis itu,
// ATAU baris ini udah nempel ke paket (booking lama). User yang nggak pakai
// fitur ini -> form 100% sama kayak dulu.
export function tampilkanPilihanPaketRambut(daftar, jenis, idTerpilih) {
  return daftar.some((l) => l.jenis === jenis && l.aktif) || !!paketRambutDipakai(daftar, idTerpilih)
}

export function labelPilihanPaketRambut(daftar, id) {
  const l = paketRambutDipakai(daftar, id)
  if (!l) return null
  return l.aktif ? labelPendekPaketRambut(l) : labelPendekPaketRambut(l) + AKHIRAN_NONAKTIF
}

// Biaya paket -> string angka buat field Biaya Layanan Tambahan.
export function biayaRambutKeForm(biaya) {
  const n = Math.round(Number(biaya) || 0)
  return n > 0 ? String(n) : ''
}

// Label Layanan Rambut di Detail Booking, Invoice & Rincian Keuangan:
// "Hairdo Sanggul Modern", "Hijabdo+ Syar'i". Detail kosong (booking lama /
// paket dasar) -> "Hairdo" doang, persis kayak dulu. Detail yang udah
// diawali jenisnya ("Hairdo Sanggul") nggak diulang.
export function labelLayananRambut(jenis, detail) {
  const j = String(jenis || '').trim()
  const d = String(detail || '').trim()
  if (!d) return j
  if (!j) return d
  const dl = d.toLowerCase()
  const jl = j.toLowerCase()
  if (dl === jl || dl.startsWith(jl + ' ')) return d
  return `${j} ${d}`
}

// Nilai yang disimpan ke tabel peserta (BookingModal & BookingDetailModal).
// "Tidak Ada" -> detail & id ikut dikosongkan, biar nggak ada data nyangkut.
export function nilaiSimpanRambut(jenis, detail, idPaket) {
  const ada = jenis && jenis !== TIDAK_ADA_RAMBUT
  return {
    detail_tambahan: ada ? String(detail || '').trim().slice(0, PANJANG_MAKS_DETAIL_RAMBUT) : '',
    layanan_tambahan_id: ada ? (idPaket || null) : null,
  }
}

// Perubahan state peserta waktu tombol Tidak/Hairdo/Hijabdo+ diganti.
// - Ke "Tidak Ada": Detail & paket ikut dikosongkan.
// - Pindah jenis (Hairdo <-> Hijabdo+) waktu lagi pakai paket: paketnya
//   dilepas, dan Detail/Biaya yang MASIH SAMA dengan isi paket ikut
//   dikosongkan (nama "Sanggul Modern" nggak cocok buat Hijabdo+). Isian
//   yang udah diubah manual tetap dibiarkan.
// - Isi manual: semua isian dibiarkan.
// Hasil: { detail, idPaket, biayaKosong } (biayaKosong = true -> biaya
// dikosongkan).
export function gantiJenisRambut(daftar, jenisBaru, { detail, idPaket, biaya }) {
  if (jenisBaru === TIDAK_ADA_RAMBUT) return { detail: '', idPaket: null, biayaKosong: false }
  const l = paketRambutDipakai(daftar, idPaket)
  if (!l || l.jenis === jenisBaru) return { detail, idPaket: idPaket || null, biayaKosong: false }
  const detailDariPaket = String(detail || '').trim() === namaPaketRambut(l)
  const biayaDariPaket = Math.round(Number(biaya) || 0) === Math.round(Number(l.biaya) || 0)
  return { detail: detailDariPaket ? '' : detail, idPaket: null, biayaKosong: biayaDariPaket }
}
