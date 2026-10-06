// Pengecekan KEWAJARAN isian booking -- dipakai BARENG sama form Booking
// Baru (BookingModal.jsx) & Edit Booking (BookingDetailModal.jsx), biar
// aturannya dijamin sama persis di dua tempat itu.
//
// ATURANNYA: "bagian untuk MUA" (komisi Tim / untung Add On / untung
// Sewa / komisi vendor) TIDAK BOLEH lebih besar dari BIAYA-nya. Bagian
// MUA itu cuma sebagian dari biaya yang ditagih ke klien -- sisanya
// buat Tim/vendor/modal. Kalau bagian MUA > biaya, hasilnya nggak masuk
// akal (Bayar ke Tim jadi minus, Penghasilan lebih gede dari yang
// dibayar klien) dan bikin angka Keuangan salah.
//
// Kolom biaya/komisi yang DIKOSONGIN tetap boleh (dianggap Rp0) -- yang
// ditolak cuma kalau bagian MUA > biaya. Sama dengan Rp0 juga boleh.
//
// Semua perbandingan PER-UNIT (per sesi / per item), sama kayak cara
// angkanya disimpan di database -- jumlah sesi/item dikaliin belakangan.

function rupiah(n) {
  return 'Rp' + (Number(n) || 0).toLocaleString('id-ID')
}

function tambah(daftar, label, namaBagian, namaBiaya, biaya, bagian) {
  daftar.push({ label, namaBagian, namaBiaya, biaya: Number(biaya) || 0, bagian: Number(bagian) || 0 })
}

// Ambil yang MELANGGAR aturan (bagian MUA > biaya).
export function cariAngkaTakWajar(daftar) {
  return daftar.filter((it) => it.bagian > it.biaya)
}

// "Makeup: Komisi untuk Kamu (Rp8.866.899) lebih besar dari biayanya (Rp845.848)"
export function pesanAngkaTakWajar(it) {
  return `${it.label}: ${it.namaBagian} (${rupiah(it.bagian)}) lebih besar dari ${it.namaBiaya} (${rupiah(it.biaya)})`
}

// Adapter 1 -- bentuk data FORM BOOKING BARU (camelCase, nested).
// Kondisi tiap item DISAMAIN dengan kondisi saat disimpan di
// BookingModal.jsx (Tim-only untuk komisi, nama wajib terisi untuk
// Add On/Sewa/vendor, paket bundling harus dipakai).
export function itemKewajaranForm(p) {
  const out = []
  if (p.dikerjakanOlehMakeup === 'Tim') {
    tambah(out, 'Makeup', 'Komisi untuk Kamu', 'biayanya', p.biayaMakeup, p.komisiMakeup)
  }
  if (p.layananTambahan !== 'Tidak Ada' && p.dikerjakanOlehTambahan === 'Tim') {
    tambah(out, p.layananTambahan, 'Komisi untuk Kamu', 'biayanya', p.biayaTambahan, p.komisiTambahan)
  }
  ;(p.addOnLainnya || []).forEach((a) => {
    if ((a.nama || '').trim()) tambah(out, `Add On (Beli) ${a.nama.trim()}`, 'Untung per item', 'biaya per item', a.biaya, a.keuntungan)
  })
  ;(p.sewaLainnya || []).forEach((s) => {
    if ((s.nama || '').trim()) tambah(out, `Add On (Sewa) ${s.nama.trim()}`, 'Untung per item', 'biaya per item', s.biaya, s.untung)
  })
  if (p.pakaiPaketBundling) {
    ;(p.vendors || []).forEach((v) => {
      if (!(v.nama || '').trim()) return
      tambah(out, `Paket Bundling ${v.nama.trim()}`, 'Komisi untuk MUA', 'biaya vendor', v.biaya, v.untung)
      ;(v.addOns || []).forEach((a) => {
        if ((a.nama || '').trim()) tambah(out, `Add On Vendor ${a.nama.trim()}`, 'Komisi untuk MUA', 'biayanya', a.biaya, a.untung)
      })
    })
  }
  return out
}

// Adapter 2 -- bentuk data FORM EDIT BOOKING (snake_case, kolom database
// apa adanya, Add On/Sewa 5 slot bersufiks _2.._5). Kondisinya disamain
// dengan handleSaveEdit di BookingDetailModal.jsx.
export function itemKewajaranRow(p) {
  const out = []
  if (p.dikerjakan_oleh_makeup === 'Tim') {
    tambah(out, 'Makeup', 'Komisi untuk Kamu', 'biayanya', p.biaya_makeup, p.komisi_makeup_tim)
  }
  if (p.layanan_tambahan !== 'Tidak Ada' && p.dikerjakan_oleh_tambahan === 'Tim') {
    tambah(out, p.layanan_tambahan || 'Layanan Tambahan', 'Komisi untuk Kamu', 'biayanya', p.biaya_tambahan, p.komisi_tambahan)
  }
  for (let n = 1; n <= 5; n++) {
    const suffix = n === 1 ? '' : `_${n}`
    const namaAddOn = (p[`layanan_lainnya${suffix}`] || '').trim()
    if (namaAddOn) tambah(out, `Add On (Beli) ${namaAddOn}`, 'Untung per item', 'biaya per item', p[`biaya_lainnya${suffix}`], p[`keuntungan_lainnya${suffix}`])
    const namaSewa = (p[`nama_sewa${suffix}`] || '').trim()
    if (namaSewa) tambah(out, `Add On (Sewa) ${namaSewa}`, 'Untung per item', 'biaya per item', p[`biaya_sewa${suffix}`], p[`untung_sewa${suffix}`])
  }
  ;(p.vendors || []).forEach((v) => {
    if (!(v.nama || '').trim()) return
    tambah(out, `Paket Bundling ${v.nama.trim()}`, 'Komisi untuk MUA', 'biaya vendor', v.biaya, v.untung)
    ;(v.addOns || []).forEach((a) => {
      if ((a.nama || '').trim()) tambah(out, `Add On Vendor ${a.nama.trim()}`, 'Komisi untuk MUA', 'biayanya', a.biaya, a.untung)
    })
  })
  return out
}
