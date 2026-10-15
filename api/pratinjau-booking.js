/* global process */
// PRATINJAU LINK BOOKING ONLINE (/b/:slug) untuk WhatsApp, Instagram,
// Facebook, Threads, Telegram, dll.
//
// Aplikasi Dapur MUA itu SPA (isinya dibuat JavaScript di browser), sedangkan
// "robot pratinjau" milik WhatsApp dkk. cuma membaca HTML mentah -- jadi
// tanpa ini, link booking setiap MUA selalu tampil sebagai "Dapur MUA" polos.
//
// Cara kerja: vercel.json mengarahkan /b/:slug ke sini HANYA kalau
// pengunjungnya robot pratinjau (dilihat dari User-Agent). Pengunjung biasa
// (calon klien) TIDAK lewat sini sama sekali -- tetap dapat aplikasi seperti
// biasa, jadi kalau fungsi ini error pun halaman booking tetap aman.
//
// KEAMANAN: data diambil lewat fungsi publik yang SAMA dengan halaman booking
// (booking_publik_profil) memakai kunci ANON (bukan service role), jadi cuma
// nama, logo, & pesan yang memang sudah tampil di halaman publik. Link
// nonaktif / langganan MUA habis -> fungsi itu balikin null -> pratinjau umum
// Dapur MUA (nggak membocorkan apa pun).

const MAKS_DESKRIPSI = 180

function escapeHtml(teks) {
  return String(teks ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function ringkas(teks, maks = MAKS_DESKRIPSI) {
  const satuBaris = String(teks || '').replace(/\s+/g, ' ').trim()
  return satuBaris.length > maks ? `${satuBaris.slice(0, maks - 1).trimEnd()}…` : satuBaris
}

// Cuma alamat https yang dipakai sebagai gambar (logo dari Supabase Storage).
function gambarAman(url, cadangan) {
  return /^https:\/\/[^\s"'<>]+$/.test(String(url || '')) ? url : cadangan
}

async function ambilProfil(slug) {
  const url = process.env.VITE_SUPABASE_URL
  const anon = process.env.VITE_SUPABASE_ANON_KEY
  if (!url || !anon) return null
  const ctrl = new AbortController()
  const batas = setTimeout(() => ctrl.abort(), 4000)
  try {
    const res = await fetch(`${url}/rest/v1/rpc/booking_publik_profil`, {
      method: 'POST',
      headers: { apikey: anon, Authorization: `Bearer ${anon}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ p_slug: slug }),
      signal: ctrl.signal,
    })
    if (!res.ok) return null
    const data = await res.json()
    return data && typeof data === 'object' && data.nama ? data : null
  } catch {
    return null
  } finally {
    clearTimeout(batas)
  }
}

export function buatHtml({ asal, slug, profil }) {
  const alamat = slug ? `${asal}/b/${slug}` : asal
  const gambarUmum = `${asal}/icon-512.png`
  const judul = profil ? `Booking ${profil.nama}` : 'Dapur MUA'
  const deskripsi = profil
    ? ringkas(profil.pesan) || `Cek jadwal yang masih kosong, lihat paket makeup, lalu kirim permintaan booking ke ${profil.nama}.`
    : 'Kelola booking, tim, dan keuangan MUA di satu tempat.'
  const gambar = profil ? gambarAman(profil.logo_url, gambarUmum) : gambarUmum
  const e = escapeHtml
  return `<!doctype html>
<html lang="id">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${e(judul)}</title>
<meta name="description" content="${e(deskripsi)}">
<link rel="canonical" href="${e(alamat)}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="Dapur MUA">
<meta property="og:locale" content="id_ID">
<meta property="og:url" content="${e(alamat)}">
<meta property="og:title" content="${e(judul)}">
<meta property="og:description" content="${e(deskripsi)}">
<meta property="og:image" content="${e(gambar)}">
<meta property="og:image:alt" content="${e(profil ? `Logo ${profil.nama}` : 'Logo Dapur MUA')}">
<meta name="twitter:card" content="summary">
<meta name="twitter:title" content="${e(judul)}">
<meta name="twitter:description" content="${e(deskripsi)}">
<meta name="twitter:image" content="${e(gambar)}">
</head>
<body>
<h1>${e(judul)}</h1>
<p>${e(deskripsi)}</p>
<p><a href="${e(alamat)}">Buka halaman booking</a></p>
</body>
</html>`
}

export default async function handler(req, res) {
  const mentah = String(req.query?.slug || '').toLowerCase()
  // Format slug SAMA dengan aturan Alamat Link di Pengaturan.
  const slug = /^[a-z0-9-]{1,40}$/.test(mentah) ? mentah : ''
  const host = String(req.headers?.['x-forwarded-host'] || req.headers?.host || 'dapurmua.biz.id').split(',')[0].trim()
  const asal = `https://${/^[a-z0-9.-]+(:\d+)?$/i.test(host) ? host : 'dapurmua.biz.id'}`

  const profil = slug ? await ambilProfil(slug) : null

  res.setHeader('Content-Type', 'text/html; charset=utf-8')
  // Disimpan sebentar di CDN Vercel (10 menit) biar hemat panggilan database;
  // ganti logo/pesan di Pengaturan -> pratinjau ikut berubah paling lama
  // 10 menit kemudian (aplikasi chat juga punya cache sendiri).
  res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=600, stale-while-revalidate=86400')
  res.status(200).send(buatHtml({ asal, slug, profil }))
}
