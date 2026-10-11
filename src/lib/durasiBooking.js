// Aturan DURASI booking -- satu-satunya sumber kebenaran buat status
// "Selesai" di semua halaman (Dashboard, Booking, Klien, Kalender, Detail).
// Feed kalender HP (api/kalender-ics.js) jalan di server dan nggak bisa
// import file ini, jadi aturan yang SAMA disalin di sana -- kalau ubah di
// sini, ubah di sana juga.
//
// Aturan:
//  1. Jam selesai DIISI  -> pakai jam selesai itu apa adanya.
//  2. Jam selesai KOSONG -> DURASI_DEFAULT_JAM (2 jam) PER KLIEN, dihitung
//     dari jam mulai. 1 booking isi 3 klien = 6 jam.
//  3. Jam selesai lebih kecil dari jam mulai -> dianggap lewat tengah malam
//     (selesai di hari berikutnya).
//  4. Booking tanpa jam mulai: selesai kalau tanggalnya sudah lewat.

export const DURASI_DEFAULT_JAM = 2

function pecahTanggal(str) {
  const [y, m, d] = String(str || '').slice(0, 10).split('-').map(Number)
  return y && m && d ? [y, m, d] : null
}

function pecahJam(str) {
  if (!str) return null
  const [jam, menit] = String(str).slice(0, 5).split(':').map(Number)
  return Number.isFinite(jam) ? [jam, menit || 0] : null
}

export function jumlahKlienBooking(b) {
  return Math.max(1, Number(b?.total_klien) || 0)
}

// Date jam mulai, atau null kalau booking nggak punya tanggal/jam mulai.
export function waktuMulaiBooking(b) {
  const tgl = pecahTanggal(b?.tanggal_acara)
  const jam = pecahJam(b?.jam_start_makeup)
  if (!tgl || !jam) return null
  return new Date(tgl[0], tgl[1] - 1, tgl[2], jam[0], jam[1], 0, 0)
}

// Date jam selesai (sesuai aturan di atas), atau null kalau nggak ada jam mulai.
export function waktuSelesaiBooking(b) {
  const mulai = waktuMulaiBooking(b)
  if (!mulai) return null
  const jamAkhir = pecahJam(b.jam_selesai)
  if (jamAkhir) {
    const akhir = new Date(mulai)
    akhir.setHours(jamAkhir[0], jamAkhir[1], 0, 0)
    if (akhir < mulai) akhir.setDate(akhir.getDate() + 1)
    if (akhir > mulai) return akhir
    // jam selesai == jam mulai: nggak masuk akal, jatuh ke durasi default
  }
  const akhir = new Date(mulai)
  akhir.setMinutes(akhir.getMinutes() + DURASI_DEFAULT_JAM * jumlahKlienBooking(b) * 60)
  return akhir
}

export function bookingSelesai(b, sekarang = new Date()) {
  const tgl = pecahTanggal(b?.tanggal_acara)
  if (!tgl) return false
  const akhir = waktuSelesaiBooking(b)
  if (akhir) return sekarang >= akhir
  const hariIni = new Date(sekarang.getFullYear(), sekarang.getMonth(), sekarang.getDate())
  return new Date(tgl[0], tgl[1] - 1, tgl[2]) < hariIni
}
