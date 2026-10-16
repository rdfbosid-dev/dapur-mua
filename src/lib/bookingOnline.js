import { supabase } from './supabase'
import { peringatanKategoriEvent, kategoriLebihTinggi } from './layanan'

// LINK BOOKING ONLINE -- semua yang dipakai halaman publik /b/:slug
// (pages/BookingOnline.jsx) & halaman Permintaan Booking milik MUA.
// Data publik cuma lewat 3 fungsi database (lihat migrasi-link-booking.sql):
// profil + paket aktif, jadwal (kepadatan & jam terisi, TANPA data klien),
// dan kirim permintaan. Tabel booking/klien sama sekali nggak dibuka ke publik.

export const MAKS_ORANG = 10

// Add On Layanan Rambut di link publik -- cuma pilihan (tanpa paket/harga),
// nilainya SAMA dengan peserta.layanan_tambahan di form booking.
export const PILIHAN_RAMBUT = [
  { nilai: 'Tidak Ada', label: 'Tidak' },
  { nilai: 'Hairdo', label: 'Hairdo' },
  { nilai: 'Hijabdo+', label: 'Hijabdo+' },
]

// Catatan halus kategori paket vs acara buat calon klien (aturan yang SAMA
// dengan form booking, lib/layanan.js -- bukan larangan). Hasil: array teks
// per orang ('' = nggak ada catatan).
export function catatanKategoriPublik(kategoriPerOrang, ev) {
  const p = peringatanKategoriEvent(kategoriPerOrang, ev)
  return kategoriPerOrang.map((k) => {
    if (!p || !k) return ''
    if (!p.tidakAdaYangCocok && !kategoriLebihTinggi(k, p.kategori)) return ''
    return `Paket ini kategori ${k}, sedangkan acara ${p.event} biasanya memakai kategori ${p.kategori}. Pastikan paketnya sudah sesuai, ya.`
  })
}

// Slug link: huruf kecil, angka & strip, 3-40 karakter (aturan yang SAMA
// dengan constraint profiles_slug_format di database).
export const POLA_SLUG = /^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$/
export function rapikanSlug(teks) {
  return String(teks || '')
    .toLowerCase()
    .normalize('NFKD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
    .replace(/-+$/g, '')
}

export function linkBooking(slug) {
  return `${window.location.origin}/b/${slug}`
}

export async function muatProfilPublik(slug) {
  const { data, error } = await supabase.rpc('booking_publik_profil', { p_slug: slug })
  if (error) throw error
  return data
}

export async function muatJadwalPublik(slug, dari, sampai) {
  const { data, error } = await supabase.rpc('booking_publik_jadwal', { p_slug: slug, p_dari: dari, p_sampai: sampai })
  if (error) throw error
  return data || []
}

// Hasil: { ok: true } atau { ok: false, pesan }.
export async function kirimPermintaan(slug, isian) {
  const { data, error } = await supabase.rpc('booking_publik_kirim', { p_slug: slug, p_data: isian })
  if (!error) return { ok: true, id: data?.id || null }
  return { ok: false, pesan: pesanGagalKirim(error.message) }
}

export function pesanGagalKirim(pesan) {
  const teks = String(pesan || '')
  if (teks.includes('VALIDASI:')) return teks.slice(teks.indexOf('VALIDASI:') + 9).trim()
  if (teks.includes('TERLALU_SERING')) return 'Terlalu banyak permintaan dalam waktu singkat. Coba lagi nanti, atau langsung hubungi MUA lewat WhatsApp.'
  if (teks.includes('LINK_NONAKTIF')) return 'Link booking ini sedang tidak aktif.'
  return 'Permintaan belum terkirim. Periksa koneksi internet lalu coba lagi.'
}

// "0812-3456-7890" -> "6281234567890" (format wa.me).
export function nomorWaInternasional(nomor) {
  const angka = String(nomor || '').replace(/\D/g, '')
  if (!angka) return ''
  if (angka.startsWith('62')) return angka
  if (angka.startsWith('0')) return '62' + angka.slice(1)
  if (angka.startsWith('8')) return '62' + angka
  return angka
}

// Sama dengan aturan di lib/nomorWa.js (tanpa huruf, 8-15 angka).
export function nomorWaValid(nomor) {
  const n = String(nomor || '').replace(/\D/g, '').length
  return !/[^0-9+\- ().]/.test(String(nomor || '')) && n >= 8 && n <= 15
}

// Label paket buat calon klien: "Regular · VIP", "Wedding · Jogja",
// "Wedding (paket dasar)".
export function labelPaketPublik(p) {
  const inti = p.jenis ? `${p.kategori} · ${p.jenis}` : p.kategori
  return p.keterangan ? `${inti} · ${p.keterangan}` : inti
}

export function formatRupiah(n) {
  return 'Rp' + (Math.round(Number(n) || 0)).toLocaleString('id-ID')
}

// "YYYY-MM-DD" <-> Date lokal (tanpa geser zona waktu).
export function keTanggal(str) {
  const [y, m, d] = String(str || '').split('-').map(Number)
  return new Date(y, (m || 1) - 1, d || 1)
}
export function dariTanggal(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
export function tanggalPanjang(str) {
  return keTanggal(str).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
}

function menit(jam) {
  const [h, m] = String(jam || '').split(':').map(Number)
  return Number.isFinite(h) ? h * 60 + (m || 0) : null
}
// Jam "HH:MM" jatuh di dalam salah satu slot terisi? Slot yang lewat
// tengah malam (misal 23:00-01:00) ikut dihitung.
export function jamBentrok(jam, slot = []) {
  const j = menit(jam)
  if (j === null) return false
  return slot.some(({ m, s }) => {
    const a = menit(m)
    const b = menit(s)
    if (a === null || b === null) return false
    return a < b ? j >= a && j < b : j >= a || j < b
  })
}

// Pesan WhatsApp yang dikirim calon klien ke MUA setelah permintaan masuk.
export function pesanWaPermintaan({ namaMua, isian, zona }) {
  const rambut = isian.peserta.filter((o) => o.rambut && o.rambut !== 'Tidak Ada').map((o) => `${o.rambut} (${o.nama})`).join(', ')
  const baris = [
    `Halo, Kak ${namaMua}. Saya *${isian.nama_klien}* baru saja mengirim permintaan booking lewat link booking online.`,
    '',
    `*Hari, Tanggal*: ${tanggalPanjang(isian.tanggal_acara)}`,
    `*Jam Mulai Makeup*: ${isian.jam_mulai ? `${isian.jam_mulai} ${zona}` : ''}`,
    `*Acara*: ${isian.event}`,
    `*Lokasi*: ${isian.lokasi}`,
    `*Jumlah klien*: ${isian.peserta.length}`,
    ...(rambut ? [`*Add on rambut*: ${rambut}`] : []),
    '',
    'Mohon konfirmasinya ya, Kak. Terima kasih!',
  ]
  return baris.join('\n')
}

// Jumlah permintaan berstatus "baru" milik user yang login (RLS).
export async function hitungPermintaanBaru() {
  const { count, error } = await supabase
    .from('permintaan_booking')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'baru')
  return error ? 0 : (count || 0)
}

// Pengaturan link booking milik user yang login. SENGAJA dimuat terpisah
// (bukan lewat AuthContext) -- kalau SQL-nya belum dijalankan, cuma bagian
// link booking yang bilang "belum siap", halaman lain tetap normal.
export const KOLOM_PENGATURAN_BOOKING = 'slug, booking_online_aktif, booking_tampil_harga, booking_tampil_jam, booking_pesan, booking_clean_hijabdo_termasuk'
export async function muatPengaturanBooking(userId) {
  if (!userId) return null
  const { data, error } = await supabase.from('profiles').select(KOLOM_PENGATURAN_BOOKING).eq('id', userId).maybeSingle()
  if (error) return { gagal: true }
  return data || null
}

// Permintaan "baru" terbaru (buat lonceng notifikasi Dashboard). Gagal -> [].
export async function muatPermintaanBaru() {
  const { data, error } = await supabase
    .from('permintaan_booking')
    .select('id, nama_klien, tanggal_acara, event, created_at')
    .eq('status', 'baru')
    .order('created_at', { ascending: false })
    .limit(20)
  return error ? [] : (data || [])
}
