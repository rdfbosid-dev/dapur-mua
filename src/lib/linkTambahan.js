import { supabase } from './supabase'
import { IKON_MEDSOS, IKON_LINK_BIASA, ikonDipakai } from './ikonMedsos'
import { nomorWaInternasional } from './bookingOnline'

// LINK TAMBAHAN di halaman link booking (/b/slug, ala Linktree): tombol link
// buatan MUA sendiri -- TikTok, pricelist Google Drive, affiliate, dll.
// Tabel public.link_booking_tambahan (RLS: cuma pemilik yang bisa baca/ubah).
// Halaman publik membacanya lewat fungsi booking_publik_link (cuma link AKTIF
// milik slug yang dibuka). Aturan di bawah SAMA dengan pengecekan database.

export const MAKS_LINK = 10
export const MAKS_JUDUL = 40
const MAKS_URL = 500
const POLA_URL = /^https:\/\/[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+(:[0-9]{1,5})?([/?#][^\s<>"]*)?$/i

// Ketikan alamat dirapikan: nomor HP (0812..., +62 812...) -> link WhatsApp
// https://wa.me/62812..., tanpa awalan -> ditambah https://, http:// ->
// https://. Awalan lain (javascript:, data:, dst) dibiarkan biar ditolak.
export function rapikanUrl(teks) {
  let u = String(teks || '').trim()
  if (!u) return ''
  if (nomorPolos(u)) return `https://wa.me/${nomorWaInternasional(u)}`
  if (/^http:\/\//i.test(u)) u = 'https://' + u.slice(7)
  else if (!/^[a-z][a-z0-9+.-]*:/i.test(u)) u = 'https://' + u.replace(/^\/+/, '')
  return u
}

export function urlAman(url) {
  return typeof url === 'string' && url.length <= MAKS_URL && POLA_URL.test(url)
}

// Nilai kolom ikon yang sah (lihat lib/ikonMedsos.js). Selain itu -> null
// (otomatis).
export function rapikanIkon(ikon) {
  return ikon === IKON_LINK_BIASA || IKON_MEDSOS.some((m) => m.kunci === ikon) ? ikon : null
}

// '' = valid. Selain itu = pesan error siap tampil.
export function pesanLinkTidakValid({ judul, url }) {
  const j = String(judul || '').trim()
  if (!j) return 'Judul tombol wajib diisi.'
  if (j.length > MAKS_JUDUL) return `Judul tombol maksimal ${MAKS_JUDUL} karakter.`
  if (!url) return 'Alamat link wajib diisi.'
  if (url.length > MAKS_URL) return 'Alamat link terlalu panjang.'
  if (!urlAman(url)) return 'Alamat link belum benar. Contoh: https://drive.google.com/...'
  return ''
}

// ---------- LINK WHATSAPP (kolom Nomor + Teks pembuka chat) ----------
// Link WA disimpan di database sebagai alamat biasa
// https://wa.me/62812...?text=..., tapi di Pengaturan dipecah jadi 2 kolom
// yang ramah dibaca (tanpa %20). Alamatnya dirakit lagi otomatis.
export const MAKS_TEKS_WA = 200

// Isian kolom alamat yang cuma berisi nomor HP (0812..., +62 812...).
export function nomorPolos(teks) {
  const u = String(teks || '').trim()
  return /^\+?[0-9][0-9 ().-]{6,}$/.test(u) && (u.match(/\d/g) || []).length >= 8
}

export function teksSapaWa(namaBrand) {
  const nama = String(namaBrand || '').trim()
  return nama ? `Halo, ${nama}. Saya mau tanya-tanya soal layanan makeup.` : 'Halo, saya mau tanya-tanya soal layanan makeup.'
}

// Nomor + teks -> https://wa.me/62812...?text=... ('' kalau nomor kosong).
export function rakitLinkWa(nomor, teks) {
  const n = nomorWaInternasional(nomor)
  if (!n) return ''
  const t = String(teks || '').trim()
  return `https://wa.me/${n}${t ? `?text=${encodeURIComponent(t)}` : ''}`
}

// https://wa.me/62812...?text=... -> { nomor: '0812...', teks }. null kalau
// bukan link chat WA sederhana (misal link grup / katalog) -- yang begitu
// tetap diedit sebagai alamat biasa.
export function pecahLinkWa(url) {
  const m = /^https:\/\/wa\.me\/(\d{8,15})\/?(?:\?text=([^&#]*))?$/i.exec(String(url || '').trim())
  if (!m) return null
  let teks = m[2] || ''
  try { teks = decodeURIComponent(teks.replace(/\+/g, ' ')) } catch { /* biarkan apa adanya */ }
  return { nomor: m[1].startsWith('62') ? '0' + m[1].slice(2) : m[1], teks }
}

// ---------- PLACEHOLDER kolom alamat, menyesuaikan judul tombol ----------
// Judul "Threads" -> "Tempel link akun Threads-mu di sini", "Pricelist" ->
// "Tempel link pricelistmu di sini", "WhatsApp" -> "Ketik nomor WhatsApp-mu
// di sini". Ikon medsos yang dipilih manual lebih diutamakan dari judul.
const SINGKATAN_MEDSOS = {
  ig: 'instagram', insta: 'instagram', fb: 'facebook', yt: 'youtube', twitter: 'x',
  wa: 'whatsapp', whatsapp: 'whatsapp', tiktok: 'tiktok', tele: 'telegram', snap: 'snapchat',
  drive: 'googledrive', gdrive: 'googledrive',
}
function medsosDariJudul(judul) {
  const kata = String(judul || '').toLowerCase().split(/[^a-z0-9]+/).filter(Boolean)
  for (const k of kata) {
    if (SINGKATAN_MEDSOS[k]) return SINGKATAN_MEDSOS[k]
    const m = IKON_MEDSOS.find((x) => x.kunci === k || x.label.toLowerCase() === k)
    if (m) return m.kunci
  }
  return null
}
// "-mu" ikut EYD: pakai tanda hubung kalau menempel ke nama yang diawali
// huruf kapital ("Instagram-mu", "TikTok-mu", "MUA-mu"), serangkai kalau
// kata biasa huruf kecil ("pricelistmu").
function denganMu(teks) {
  const kataTerakhir = String(teks).split(' ').pop()
  return /^[A-Z]/.test(kataTerakhir) ? `${teks}-mu` : `${teks}mu`
}
export function placeholderAlamat(judul, ikon) {
  const kunci = (ikon && ikon !== IKON_LINK_BIASA ? ikon : null) || medsosDariJudul(judul)
  if (kunci === 'whatsapp') return 'Ketik nomor WhatsApp-mu di sini'
  if (kunci === 'googledrive') return 'Tempel link Google Drive-mu di sini'
  const medsos = IKON_MEDSOS.find((m) => m.kunci === kunci)
  if (medsos) return `Tempel link akun ${denganMu(medsos.label.replace(/\s*\(.*\)$/, ''))} di sini`
  let j = String(judul || '').trim().replace(/\s+/g, ' ')
  if (!j) return 'https://... atau nomor WhatsApp'
  if (j.length > 30) j = j.slice(0, 30).trim()
  // Kata dikecilkan ("Pricelist Lengkap" -> "pricelist lengkap"), kecuali
  // singkatan yang ditulis kapital semua ("MUA", "IG").
  j = j.split(' ').map((w) => (w.length > 1 && w === w.toUpperCase() && /[A-Z]/.test(w) ? w : w.toLowerCase())).join(' ')
  // Berakhiran angka ("Pricelist 2026") -> tanpa "-mu" biar enak dibaca.
  return /[0-9]$/.test(j) ? `Tempel link ${j} di sini` : `Tempel link ${denganMu(j)} di sini`
}

// Link siap pakai dari isian Profil Pengguna (Nomor WhatsApp & Instagram),
// buat tombol "+ Tambah dari Profil". Yang sudah ada di daftar (ikon
// WhatsApp/Instagram, dipilih atau ketebak dari alamat) NGGAK ditambah lagi,
// jadi nggak dobel.
export function linkDariProfil(profile, daftar) {
  const sudah = new Set(daftar.map((l) => ikonDipakai(l.ikon, rapikanUrl(l.url))))
  const hasil = []
  if (nomorWaInternasional(profile?.whatsapp) && !sudah.has('whatsapp')) {
    const wa = { nomor: String(profile.whatsapp).trim(), teks: teksSapaWa(profile?.studio_name) }
    hasil.push({ judul: 'Chat WhatsApp', url: rakitLinkWa(wa.nomor, wa.teks), ikon: 'whatsapp', wa })
  }
  const ig = String(profile?.instagram || '').trim().replace(/^@+/, '').replace(/^https?:\/\/(www\.)?instagram\.com\//i, '').replace(/[/?#].*$/, '')
  if (/^[a-z0-9._]{1,30}$/i.test(ig) && !sudah.has('instagram')) {
    hasil.push({ judul: 'Instagram', url: `https://instagram.com/${ig}`, ikon: 'instagram' })
  }
  return hasil
}

// Data milik user yang login (Pengaturan). null = fitur belum siap (SQL
// belum dijalankan) / gagal dimuat. dukungIkon = kolom ikon sudah ada
// (migrasi-link-booking-5.sql); kalau belum, fitur lain tetap jalan.
export async function muatHalamanLinkSaya(userId) {
  const tabel = () => supabase.from('link_booking_tambahan')
  const [denganIkon, profil] = await Promise.all([
    tabel().select('id, judul, url, urutan, aktif, ikon').order('urutan').order('created_at'),
    supabase.from('profiles').select('booking_tampil_paket').eq('id', userId).maybeSingle(),
  ])
  if (profil.error) return null
  let links = denganIkon
  let dukungIkon = true
  if (links.error) {
    links = await tabel().select('id, judul, url, urutan, aktif').order('urutan').order('created_at')
    dukungIkon = false
    if (links.error) return null
  }
  return {
    links: (links.data || []).map((l) => ({ ...l, ikon: rapikanIkon(l.ikon) })),
    tampilPaket: profil.data?.booking_tampil_paket !== false,
    dukungIkon,
  }
}

// Simpan semua link sekaligus: yang dihapus di form dihapus dari database,
// sisanya disimpan (baru = ditambah, lama = diubah) dengan urutan sesuai form.
export async function simpanHalamanLinkSaya(userId, { links, tampilPaket, dukungIkon = true }, idLama) {
  const idSekarang = new Set(links.map((l) => l.id))
  const dihapus = idLama.filter((id) => !idSekarang.has(id))
  if (dihapus.length > 0) {
    const { error } = await supabase.from('link_booking_tambahan').delete().in('id', dihapus)
    if (error) return error
  }
  if (links.length > 0) {
    const baris = links.map((l, i) => ({ id: l.id, judul: l.judul.trim(), url: l.url, urutan: i, aktif: l.aktif, ...(dukungIkon ? { ikon: rapikanIkon(l.ikon) } : {}) }))
    const { error } = await supabase.from('link_booking_tambahan').upsert(baris, { onConflict: 'id' })
    if (error) return error
  }
  const { error } = await supabase.from('profiles').update({ booking_tampil_paket: tampilPaket }).eq('id', userId)
  return error || null
}

// Halaman publik: { tampil_paket, links: [{ judul, url }] } atau null.
export async function muatLinkPublik(slug) {
  try {
    const { data, error } = await supabase.rpc('booking_publik_link', { p_slug: slug })
    if (error || !data) return null
    return {
      tampil_paket: data.tampil_paket !== false,
      links: (data.links || []).filter((l) => l && l.judul && urlAman(l.url)).map((l) => ({ judul: l.judul, url: l.url, ikon: rapikanIkon(l.ikon) })),
    }
  } catch {
    return null
  }
}
