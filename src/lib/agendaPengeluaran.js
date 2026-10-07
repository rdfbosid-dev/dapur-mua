import { supabase } from './supabase'

// AGENDA = kegiatan di luar booking yang dicatat lewat halaman Pengeluaran
// (pelatihan/kelas & portofolio). Kegiatan ini makan waktu, jadi tanggalnya
// perlu kelihatan di kalender form Booking (biar nggak menerima booking di
// hari yang sama), dan sebaliknya jadwal booking perlu kelihatan di kalender
// form Pengeluaran (biar nggak ikut kelas/bikin portofolio di hari yang penuh).
//
// NAMA kategori di bawah HARUS sama persis dengan `nama` di
// KATEGORI_PENGELUARAN (lib/pengeluaran.js) -- disimpan sebagai teks di database.
export const KATEGORI_AGENDA = ['Portofolio', 'Pelatihan & Kelas']

export function kategoriPunyaAgenda(kategori) {
  return KATEGORI_AGENDA.includes(kategori)
}

// Tanggal agenda pelatihan/portofolio milik user ini -> [{ id, tanggal, label, kategori }].
// `id` dipakai form Pengeluaran buat MENGECUALIKAN entri yang lagi diedit (biar
// entri itu nggak ditandai sebagai "agenda lain" di kalendernya sendiri).
// `kategori` dipakai CustomDatePicker buat nulis legend ("Agenda Portofolio" /
// "Agenda Pelatihan & Kelas") -- cuma buat bulan yang lagi dilihat.
// Dibaca dari VIEW pengeluaran_summary (security_invoker, jadi RLS tabel asli
// ikut berlaku: otomatis cuma punya user yang login). Gagal -> daftar kosong
// (kalender tetap jalan, cuma tanpa penanda).
export function muatAgendaPengeluaran() {
  return supabase
    .from('pengeluaran_summary')
    .select('id, tanggal, kategori, judul')
    .in('kategori', KATEGORI_AGENDA)
    .then(({ data, error }) => {
      if (error || !data) return []
      return data
        .filter((r) => r.tanggal)
        .map((r) => ({ id: r.id, tanggal: r.tanggal, label: r.judul ? `${r.kategori}: ${r.judul}` : r.kategori, kategori: r.kategori }))
    })
}

// Jadwal booking (tanggal acara + jumlah peserta) -> [{ tanggal, peserta }],
// persis format `bookingDates` yang dipakai CustomDatePicker. Query-nya SAMA
// dengan yang dipakai BookingModal/BookingDetailModal buat indikator kepadatan.
export function muatJadwalBooking(userId) {
  return supabase
    .from('booking_summary')
    .select('tanggal_acara, total_klien')
    .eq('user_id', userId)
    .then(({ data, error }) => {
      if (error || !data) return []
      return data.map((b) => ({ tanggal: b.tanggal_acara, peserta: b.total_klien }))
    })
}
