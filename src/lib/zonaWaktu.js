// ZONA WAKTU user (WIB / WITA / WIT) -- disimpan di profiles.zona_waktu,
// default 'WIB'. Jam booking di database (jam_start_makeup, jam_selesai)
// itu jam POLOS tanpa zona -- jam setempat yang diketik MUA sendiri. Jadi
// data jamnya NGGAK pernah dikonversi; zona ini cuma nentuin:
// 1. label di belakang jam ("14:00 WITA") di invoice, Dashboard, Kalender;
// 2. zona yang dikirim ke kalender HP (api/kalender-ics.js), biar acara
//    jam 14:00 WITA nggak muncul jam 15:00 di HP.
// api/kalender-ics.js punya SALINAN daftar kode -> IANA di bawah (endpoint
// server) -- kalau ubah di sini, ubah juga di sana.
export const ZONA_WAKTU = [
  { kode: 'WIB', iana: 'Asia/Jakarta', utc: 'UTC+7', wilayah: 'Sumatera, Jawa, Kalimantan Barat & Kalimantan Tengah' },
  { kode: 'WITA', iana: 'Asia/Makassar', utc: 'UTC+8', wilayah: 'Bali, NTB, NTT, Kalimantan Selatan, Kalimantan Timur, Kalimantan Utara & Sulawesi' },
  { kode: 'WIT', iana: 'Asia/Jayapura', utc: 'UTC+9', wilayah: 'Maluku & Papua' },
]
export const ZONA_DEFAULT = 'WIB'

// Kode zona yang valid dari profil (profil belum kebaca / isinya aneh -> WIB).
export function kodeZona(profile) {
  const z = profile?.zona_waktu
  return ZONA_WAKTU.some((x) => x.kode === z) ? z : ZONA_DEFAULT
}

// "14:00:00" -> "14:00 WITA". Jam kosong -> ''.
export function jamZona(jam, zona) {
  if (!jam) return ''
  return `${String(jam).slice(0, 5)} ${zona || ZONA_DEFAULT}`
}

// Tebakan zona dari jam perangkat (HP/laptop) -- dipakai buat SARAN di
// Pengaturan, bukan buat ngubah otomatis. null = perangkat di luar 3 zona
// Indonesia (misal lagi di luar negeri), nggak usah nyaranin apa-apa.
// Pakai NAMA zona perangkat (bukan cuma selisih jam), biar perangkat yang
// diset ke Singapura/Malaysia (sama-sama UTC+8) nggak dikira WITA.
const ZONA_PERANGKAT = {
  'Asia/Jakarta': 'WIB',
  'Asia/Pontianak': 'WIB',
  'Asia/Makassar': 'WITA',
  'Asia/Ujung_Pandang': 'WITA',
  'Asia/Jayapura': 'WIT',
}
export function tebakZonaPerangkat() {
  try {
    return ZONA_PERANGKAT[Intl.DateTimeFormat().resolvedOptions().timeZone] || null
  } catch {
    return null
  }
}
