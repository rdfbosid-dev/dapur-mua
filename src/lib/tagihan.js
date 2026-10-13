// Hitungan TAGIHAN booking di sisi form -- SATU sumber rumus buat semua
// form yang bikin/ubah booking: Booking Baru (BookingModal.jsx), Edit
// Booking (BookingDetailModal.jsx), dan nanti form Link Booking Online.
//
// Angka RESMI tetap dari VIEW booking_summary di database (belanja_klien,
// omzet, penghasilan, sisa_kekurangan). File ini cuma buat form: nampilin
// total sementara selagi user ngisi & ngecek diskon nggak lebih besar dari
// tagihannya. Rumusnya SENGAJA disamain persis sama VIEW (kolom
// belanja_sebelum_diskon) + aturan simpan di kedua form (biaya Layanan
// Tambahan cuma kalau bukan "Tidak Ada", Retouch cuma kalau Ya, Add On/Sewa/
// vendor cuma kalau namanya diisi, Fee Transport Tim cuma kalau dikerjain
// Tim). Kalau salah satunya diubah, ubah juga yang lain.
//
// DISKON: nominal Rupiah per booking (bukan per klien), DITANGGUNG MUA
// sepenuhnya -- yang berkurang cuma Belanja Klien, Omzet, Penghasilan &
// Sisa Tagihan. Komisi Tim, Fee Transport Tim & bayar ke vendor TIDAK
// ikut berkurang. Yang disimpan selalu ANGKA JADI (bookings.diskon), jadi
// aturan promo apa pun nanti (kode promo, potongan %, dll) cukup ngisi
// angka itu -- rumus di database nggak perlu diubah.

function angka(x) {
  return Number(x) || 0
}
function minimalSatu(x) {
  return Math.max(1, Number(x) || 1)
}
function terisi(teks) {
  return !!String(teks || '').trim()
}

// --- Bentuk FORM BOOKING BARU (camelCase, nested) -------------------------
export function tagihanPesertaForm(p) {
  let total = angka(p.biayaMakeup) * minimalSatu(p.jumlahSesiMakeup)
  const adaTambahan = p.layananTambahan && p.layananTambahan !== 'Tidak Ada'
  if (adaTambahan) total += angka(p.biayaTambahan) * minimalSatu(p.jumlahSesiTambahan)
  if (p.retouch) total += angka(p.biayaRetouch)
  ;(p.addOnLainnya || []).forEach((a) => { if (terisi(a.nama)) total += angka(a.biaya) * minimalSatu(a.jumlah) })
  ;(p.sewaLainnya || []).forEach((s) => { if (terisi(s.nama)) total += angka(s.biaya) * minimalSatu(s.jumlah) })
  if (p.dikerjakanOlehMakeup === 'Tim') total += angka(p.transportTimMakeup)
  if (adaTambahan && p.dikerjakanOlehTambahan === 'Tim') total += angka(p.transportTimTambahan)
  if (p.pakaiPaketBundling) {
    ;(p.vendors || []).forEach((v) => {
      if (!terisi(v.nama)) return
      total += angka(v.biaya)
      ;(v.addOns || []).forEach((a) => { if (terisi(a.nama)) total += angka(a.biaya) })
    })
  }
  return total
}

export function tagihanSebelumDiskonForm(biayaTransport, pesertaList) {
  return angka(biayaTransport) + (pesertaList || []).reduce((s, p) => s + tagihanPesertaForm(p), 0)
}

// --- Bentuk FORM EDIT BOOKING (snake_case, kolom database apa adanya) -----
export function tagihanPesertaRow(p) {
  let total = angka(p.biaya_makeup) * minimalSatu(p.jumlah_sesi_makeup)
  const adaTambahan = p.layanan_tambahan && p.layanan_tambahan !== 'Tidak Ada'
  if (adaTambahan) total += angka(p.biaya_tambahan) * minimalSatu(p.jumlah_sesi_tambahan)
  if (p.retouch) total += angka(p.biaya_retouch)
  for (let n = 1; n <= 5; n++) {
    const suffix = n === 1 ? '' : `_${n}`
    if (terisi(p[`layanan_lainnya${suffix}`])) total += angka(p[`biaya_lainnya${suffix}`]) * minimalSatu(p[`jumlah_lainnya${suffix}`])
    if (terisi(p[`nama_sewa${suffix}`])) total += angka(p[`biaya_sewa${suffix}`]) * minimalSatu(p[`jumlah_sewa${suffix}`])
  }
  if (p.dikerjakan_oleh_makeup === 'Tim') total += angka(p.transport_tim_makeup)
  if (adaTambahan && p.dikerjakan_oleh_tambahan === 'Tim') total += angka(p.transport_tim_tambahan)
  ;(p.vendors || []).forEach((v) => {
    if (!terisi(v.nama)) return
    total += angka(v.biaya)
    ;(v.addOns || []).forEach((a) => { if (terisi(a.nama)) total += angka(a.biaya) })
  })
  return total
}

export function tagihanSebelumDiskonRow(biayaTransport, pesertaRows) {
  return angka(biayaTransport) + (pesertaRows || []).reduce((s, p) => s + tagihanPesertaRow(p), 0)
}

// --- Diskon -----------------------------------------------------------------
// Ringkasan tagihan: { sebelumDiskon, diskon, total }. Diskon dibatasi
// 0..sebelumDiskon -- SAMA kayak VIEW (jaga-jaga, form-nya sendiri udah
// nolak diskon yang kebesaran sebelum disimpan).
export function hitungTagihan(sebelumDiskon, diskon) {
  const kotor = Math.max(0, angka(sebelumDiskon))
  const potongan = Math.min(Math.max(0, angka(diskon)), kotor)
  return { sebelumDiskon: kotor, diskon: potongan, total: kotor - potongan }
}

// Persen diskon dari tagihan (buat info di form), dibulatkan 1 desimal.
export function persenDiskon(diskon, sebelumDiskon) {
  const kotor = angka(sebelumDiskon)
  if (kotor <= 0 || angka(diskon) <= 0) return 0
  return Math.round((angka(diskon) / kotor) * 1000) / 10
}

function rupiah(n) {
  return 'Rp' + (Number(n) || 0).toLocaleString('id-ID')
}

// Pesan kalau diskon nggak boleh disimpan; null kalau aman.
export function pesanDiskonTidakValid(diskon, sebelumDiskon) {
  const d = angka(diskon)
  if (d < 0) return 'Diskon tidak boleh minus.'
  if (d > Math.max(0, angka(sebelumDiskon))) {
    return `Diskon (${rupiah(d)}) lebih besar dari total tagihan sebelum diskon (${rupiah(sebelumDiskon)}).`
  }
  return null
}

// Nilai yang DISIMPAN ke tabel bookings. Toggle "Tidak" / nominal kosong /
// Rp0 -> diskon 0 & keterangan dikosongin (booking tampil persis kayak
// sebelum ada fitur diskon).
export const PANJANG_MAKS_KETERANGAN_DISKON = 60
export function nilaiSimpanDiskon(adaDiskon, diskon, keterangan) {
  const d = adaDiskon ? Math.max(0, Math.round(angka(diskon))) : 0
  return {
    diskon: d,
    keterangan_diskon: d > 0 ? String(keterangan || '').trim().slice(0, PANJANG_MAKS_KETERANGAN_DISKON) : '',
  }
}

// Label diskon buat Invoice / Detail / Rincian: "Diskon – Promo Akhir Tahun"
// atau "Diskon" doang kalau keterangannya kosong.
export function labelDiskon(keterangan) {
  const k = String(keterangan || '').trim()
  return k ? `Diskon – ${k}` : 'Diskon'
}
