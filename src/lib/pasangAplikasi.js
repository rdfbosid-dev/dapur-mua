// Bantuan buat banner "Pasang Dapur MUA" (components/PasangAplikasi.jsx).
//
// KENAPA di file terpisah & dengerin event di level modul: Chrome Android
// menembakkan `beforeinstallprompt` SEKALI, cepat setelah halaman dimuat --
// bisa jadi SEBELUM komponen React-nya sempat tampil (login masih loading).
// Kalau pendengarnya baru dipasang di dalam komponen, eventnya kelewat dan
// banner nggak akan pernah muncul. File ini dievaluasi saat bundel dimuat
// (App.jsx mengimpor komponennya), jauh sebelum render pertama.
//
// iPhone/Safari TIDAK punya event ini sama sekali (aturan Apple) -- di sana
// banner cuma bisa berupa petunjuk "Bagikan -> Tambah ke Layar Utama".

const KUNCI_DITUTUP = 'dapurmua:pasang-ditutup'
const JEDA_HARI = 14

let eventTertunda = null
const pendengar = new Set()

function kabari() {
  pendengar.forEach((fn) => { try { fn() } catch { /* satu pendengar rusak nggak boleh ngerusak yang lain */ } })
}

function aman(fn, cadangan) {
  try { return fn() } catch { return cadangan }
}

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    // Cegah mini-infobar bawaan Chrome; kita tampilkan banner sendiri.
    e.preventDefault()
    eventTertunda = e
    kabari()
  })
  window.addEventListener('appinstalled', () => {
    eventTertunda = null
    kabari()
  })
}

export function langgananPasang(fn) {
  pendengar.add(fn)
  return () => { pendengar.delete(fn) }
}

export function bisaPasangLangsung() {
  return !!eventTertunda
}

// Menampilkan dialog pasang bawaan browser. Hasil: 'accepted' | 'dismissed' | 'tidak-tersedia'.
export async function jalankanPasang() {
  const e = eventTertunda
  if (!e) return 'tidak-tersedia'
  // Event cuma bisa dipakai SEKALI.
  eventTertunda = null
  kabari()
  try {
    e.prompt()
    const pilihan = await e.userChoice
    return pilihan && pilihan.outcome ? pilihan.outcome : 'dismissed'
  } catch {
    return 'dismissed'
  }
}

// Sudah dibuka dari layar utama (terpasang)?
export function sudahTerpasang() {
  return aman(() => (
    (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches)
    || window.navigator.standalone === true
  ), false)
}

// Banner cuma buat perangkat sentuh (HP/tablet). Di desktop, Chrome sudah
// punya ikon pasang sendiri di address bar -- nggak perlu diganggu banner.
export function perangkatSentuh() {
  return aman(() => !!window.matchMedia && window.matchMedia('(pointer: coarse)').matches, false)
}

// iPhone/iPad yang memakai Safari (browser lain di iOS punya menu sendiri).
export function iosSafari() {
  return aman(() => {
    const ua = window.navigator.userAgent || ''
    const iPadOS = /Macintosh/.test(ua) && window.navigator.maxTouchPoints > 1
    const iOS = /iPhone|iPad|iPod/.test(ua) || iPadOS
    const bukanSafari = /CriOS|FxiOS|EdgiOS|OPiOS|GSA|DuckDuckGo/.test(ua)
    return iOS && !bukanSafari
  }, false)
}

// Pernah ditutup user dalam JEDA_HARI terakhir?
export function barusajaDitutup() {
  return aman(() => {
    const t = Number(window.localStorage.getItem(KUNCI_DITUTUP)) || 0
    return t > 0 && Date.now() - t < JEDA_HARI * 24 * 3600 * 1000
  }, false)
}

export function catatDitutup() {
  aman(() => window.localStorage.setItem(KUNCI_DITUTUP, String(Date.now())))
}
