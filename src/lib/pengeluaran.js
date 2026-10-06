// Kategori Pengeluaran NON-BOOKING (biaya usaha yang diinput manual) +
// saran item per kategori. Pengeluaran BOOKING (bayar tim/vendor/modal
// produk) TIDAK lewat sini -- itu dihitung otomatis dari data booking.
//
// `saran` cuma SARAN nama item (muncul sebagai tombol cepat di modal),
// BUKAN field wajib -- user tetep bebas nambah/ganti/hapus item apapun.
// Mau nambah kategori/saran baru cukup edit daftar ini, nggak perlu
// ubah database (kategori disimpan sebagai teks biasa).
//
// `contohJudul` & `contohTempat` -- placeholder field Judul & Tempat di
// modal, disesuaiin sama kategorinya biar user kebayang mau ngisi apa.
//
// `labelTempat` -- label field Tempat di modal. Kalau nggak diisi, pakai
// LABEL_TEMPAT_DEFAULT ("Tempat/Toko") -- termasuk kategori yang diketik
// manual lewat "Lainnya". Kategori yang sifatnya kegiatan (bukan belanja
// di toko) pakai "Lokasi".
//
// `opsiItem` -- kalau diisi, field "Nama Item" kategori itu jadi DROPDOWN
// (bukan ketik bebas + saran). Tiap opsi bisa punya field tambahan di
// sampingnya: `labelDetail` (label field-nya) & `contohDetail`
// (placeholder). Opsi tanpa `labelDetail` = nggak ada field tambahan.
//   `labelDetail2` & `contohDetail2` -- field tambahan KEDUA, muncul di
// BAWAH field tambahan pertama (kolom kanan, baris ke-2). Disimpan di
// kolom `keterangan_tambahan` tabel pengeluaran_items.
// Opsi "Lainnya (ketik manual)" OTOMATIS ditambahin di paling bawah
// dropdown (lihat ITEM_LAINNYA di bawah). Isi field tambahan disimpan di
// kolom `keterangan` tabel pengeluaran_items. Kategori yang punya
// `opsiItem` nggak pakai `saran`.
//   Opsi juga bisa punya `tanpaJumlah: true` -- field Jumlah disembunyiin
// (jumlah selalu 1), sisa field harga + Subtotal. `labelHarga` ganti label
// field "Harga Satuan" (misal jadi "Biaya").
//   `gantiJumlah: { label, contoh }` -- field Jumlah DIGANTI field teks
// lain di posisi yang sama (misal "Durasi": 7 hari, 1 bulan). Isinya
// cuma INFO (disimpan di kolom `keterangan`), BUKAN pengali -- jumlah
// tetep 1, jadi Subtotal = harga. Jangan dipasang bareng `labelDetail`
// (dua-duanya nyimpen ke kolom `keterangan` yang sama).
//
// `tanpaTempat: true` -- field Tempat/Lokasi nggak ditampilin sama
// sekali di kategori ini (dan nggak disimpan).
//
// Khusus kategori KETIK BEBAS (tanpa `opsiItem`):
//   `namaItemSetengah: true` -- field Nama Item lebarnya setengah (sama
// kayak dropdown di kategori `opsiItem`), bukan selebar kartu.
//   `contohNamaItem` -- placeholder field Nama Item. Kalau nggak diisi,
// pakai "contoh: Foundation".
//   `detailBebas: { label, contoh }` -- field tambahan di samping Nama
// Item yang SELALU muncul (nggak tergantung isi Nama Item), misal "Nama
// Brand". Disimpan di kolom `keterangan` tabel pengeluaran_items. Paling
// pas dipasang bareng `namaItemSetengah: true`.
//
// `labelJudul` -- ganti label field "Judul" (misal "Nama Pelatihan/Kelas").
//
// `penyelenggara` -- kalau diisi ({ label, contoh }), muncul field
// tambahan di samping Judul (disimpan di kolom `penyelenggara` tabel
// pengeluaran), dan field Tempat/Lokasi turun ke baris di bawahnya.
export const KATEGORI_PENGELUARAN = [
  {
    nama: 'Belanja Alat & Kosmetik',
    namaItemSetengah: true,
    detailBebas: { label: 'Nama Brand (opsional)', contoh: 'contoh: Make Over' },
    contohJudul: 'contoh: Restock produk bulan Oktober',
    contohTempat: 'contoh: Sociolla, Shopee, toko kosmetik',
    saran: ['Foundation', 'Bedak', 'Lipstik', 'Eyeshadow', 'Bulu Mata', 'Kuas', 'Sponge', 'Skincare Prep'],
  },
  {
    nama: 'Portofolio',
    labelTempat: 'Lokasi',
    contohJudul: 'contoh: Photoshoot tema Bridal',
    contohTempat: 'contoh: Kraton Mangkunegaran',
    opsiItem: [
      { nama: 'Muse', labelDetail: 'Nama/Akun Medsos', contohDetail: 'contoh: @namamuse', labelHarga: 'Biaya' },
      { nama: 'Fotografer', labelDetail: 'Nama/Akun Medsos', contohDetail: 'contoh: @namafotografer', labelHarga: 'Biaya' },
      { nama: 'Attire', labelDetail: 'Nama/Akun Medsos', contohDetail: 'contoh: @namaattire' },
      { nama: 'Aksesoris', labelDetail: 'Keterangan', contohDetail: 'contoh: Mahkota, anting, bros' },
      { nama: 'Sewa Tempat/Studio' },
      { nama: 'Konsumsi', labelDetail: 'Keterangan', contohDetail: 'contoh: Makan, minum, atau lainnya' },
    ],
  },
  {
    nama: 'Pelatihan & Kelas',
    labelJudul: 'Nama Pelatihan/Kelas',
    labelTempat: 'Lokasi',
    contohJudul: 'contoh: Kelas Makeup Wedding',
    contohTempat: 'contoh: Nama tempat atau kota/kabupaten',
    penyelenggara: { label: 'Penyelenggara', contoh: 'contoh: Nama akademi/penyelenggara' },
    opsiItem: [
      { nama: 'Biaya Kelas' },
      { nama: 'Muse', labelDetail: 'Nama/Akun Medsos', contohDetail: 'contoh: @namamuse', labelHarga: 'Biaya' },
      { nama: 'Fotografer', labelDetail: 'Nama/Akun Medsos', contohDetail: 'contoh: @namafotografer', labelHarga: 'Biaya' },
      { nama: 'Attire', labelDetail: 'Nama/Akun Medsos', contohDetail: 'contoh: @namaattire' },
      { nama: 'Transport', labelDetail: 'Keterangan', contohDetail: 'contoh: Bensin, Tiket Kereta, atau lainnya', tanpaJumlah: true, labelHarga: 'Biaya' },
      { nama: 'Konsumsi', labelDetail: 'Keterangan', contohDetail: 'contoh: Makan, minum, atau lainnya' },
    ],
  },
  {
    nama: 'Iklan & Promosi',
    tanpaTempat: true,
    contohJudul: 'contoh: Iklan Instagram bulan Oktober',
    opsiItem: [
      { nama: 'Iklan Instagram', gantiJumlah: { label: 'Durasi', contoh: 'contoh: 7 hari' }, labelHarga: 'Biaya' },
      { nama: 'Iklan TikTok', gantiJumlah: { label: 'Durasi', contoh: 'contoh: 7 hari' }, labelHarga: 'Biaya' },
      { nama: 'Iklan Cetak', labelDetail: 'Jenis Media Promosi', contohDetail: 'contoh: Banner, kartu nama, atau lainnya' },
      { nama: 'Endorse', labelDetail: 'Akun Medsos', contohDetail: 'contoh: @namaakun', tanpaJumlah: true, labelHarga: 'Biaya' },
    ],
  },
  {
    nama: 'Perawatan Alat',
    tanpaTempat: true,
    contohJudul: 'contoh: Perawatan kuas bulanan',
    opsiItem: [
      { nama: 'Ganti Alat Rusak', labelDetail: 'Nama Alat', contohDetail: 'contoh: Lighting', labelDetail2: 'Toko/Tempat Servis', contohDetail2: 'contoh: Nama toko/tempat servis' },
      { nama: 'Servis Alat', labelDetail: 'Nama Alat', contohDetail: 'contoh: Lighting', labelDetail2: 'Toko/Tempat Servis', contohDetail2: 'contoh: Nama toko/tempat servis' },
    ],
  },
  {
    nama: 'Operasional',
    tanpaTempat: true,
    namaItemSetengah: true,
    contohJudul: 'contoh: Biaya operasional bulan Oktober',
    contohTempat: '',
    saran: ['Pulsa/Internet', 'Langganan Aplikasi', 'Sewa Tempat', 'Listrik'],
  },
]

// Opsi "Lainnya" di dropdown kategori -- nama kategorinya diketik sendiri
// sama user (field teks muncul di bawah dropdown). Teks ini cuma LABEL
// opsi di dropdown, BUKAN yang disimpan ke database -- yang disimpan itu
// nama kategori yang diketik user. Polanya sama kayak opsi Event
// "Lainnya (ketik manual)" di form Booking.
export const KATEGORI_LAINNYA = 'Lainnya (ketik manual)'

// Pengaturan form buat kategori "Lainnya (ketik manual)" -- formatnya SAMA
// kayak 1 entri di KATEGORI_PENGELUARAN (tanpa `nama`, soalnya nama
// kategorinya diketik user). Dibalikin sama cariKategori(KATEGORI_LAINNYA).
// Nama Item ketik bebas setengah lebar + Keterangan yang selalu muncul.
const INFO_KATEGORI_LAINNYA = {
  namaItemSetengah: true,
  detailBebas: { label: 'Keterangan', contoh: 'Isi sesuai kebutuhan' },
}

export const LABEL_TEMPAT_DEFAULT = 'Tempat/Toko'

// Opsi "Lainnya (ketik manual)" di dropdown Nama Item (kategori yang punya
// `opsiItem`) -- polanya SAMA kayak field Event di form Booking: pilih
// opsi ini -> muncul field ketik nama item di BAWAH dropdown. Nama yang
// diketik itulah yang disimpan ke kolom nama_item (bukan tulisan
// "Lainnya"). Field Keterangan di samping tetep ada & OPSIONAL (bebas,
// misal nama tempat sewanya).
// `label` juga dipakai sebagai penanda internal di state modal ("item ini
// lagi mode ketik manual") -- nggak pernah disimpan ke database.
export const ITEM_LAINNYA = {
  label: 'Lainnya (ketik manual)',
  labelDetail: 'Keterangan',
  contohDetail: 'Isi sesuai kebutuhan',
}

// Cari pengaturan 1 opsi item (termasuk "Lainnya") di kategori tertentu.
// Null kalau kategorinya nggak pakai dropdown, atau namanya nggak ketemu.
export function cariOpsiItem(infoKategori, namaItem) {
  if (!infoKategori?.opsiItem) return null
  if (namaItem === ITEM_LAINNYA.label) return ITEM_LAINNYA
  return infoKategori.opsiItem.find((o) => o.nama === namaItem) || null
}

// `nama` = KATEGORI_LAINNYA -> pengaturan khusus kategori ketik manual.
export function cariKategori(nama) {
  if (nama === KATEGORI_LAINNYA) return INFO_KATEGORI_LAINNYA
  return KATEGORI_PENGELUARAN.find((k) => k.nama === nama) || null
}

// Label buat NAMPILIN 1 item yang udah tersimpan (dipakai Detail
// Pengeluaran & Nota) -- disamain persis sama aturan di form
// (PengeluaranModal.jsx), biar label yang dibaca user di detail/nota
// SAMA kayak label pas dia ngisi:
// - labelDetail  -> label isi kolom `keterangan` (Nama Brand, Nama/Akun
//                   Medsos, Nama Alat, Durasi, Keterangan, dst)
// - labelDetail2 -> label isi kolom `keterangan_tambahan` (misal
//                   Toko/Tempat Servis)
// Nama item yang nggak ada di daftar opsi dropdown = dulu diisi lewat
// "Lainnya (ketik manual)" -> pakai label opsi Lainnya ("Keterangan").
// Akhiran " (opsional)" dibuang -- itu cuma petunjuk pas ngisi form.
export function labelTampilItem(infoKategori, namaItem) {
  const bersih = (s) => (s ? s.replace(/\s*\(opsional\)\s*$/i, '') : null)
  if (infoKategori?.opsiItem) {
    const opsi = cariOpsiItem(infoKategori, namaItem) || ITEM_LAINNYA
    return {
      labelDetail: bersih(opsi.labelDetail || opsi.gantiJumlah?.label),
      labelDetail2: bersih(opsi.labelDetail2),
    }
  }
  return { labelDetail: bersih(infoKategori?.detailBebas?.label), labelDetail2: null }
}

// Pengaturan kategori buat data yang UDAH TERSIMPAN -- nama kategori yang
// nggak ada di daftar bawaan = dulu diisi lewat "Lainnya (ketik manual)".
export function infoKategoriTersimpan(namaKategori) {
  return cariKategori(namaKategori) || cariKategori(KATEGORI_LAINNYA)
}

// Rincian Item dikelompokin per NAMA item (urutan = kemunculan pertama):
// - nama yang cuma muncul 1x -> 1 baris "Nama | isi tambahan".
// - nama yang muncul >1x (misal 2 item "Konsumsi": Makan & Minum) -> 1
//   judul "Konsumsi", di bawahnya baris anak (↳) yang nampilin isi
//   tambahannya aja ("Makan", "Minum").
// Isi tambahan = isi kolom keterangan & keterangan_tambahan (Nama Brand,
// Nama/Akun Medsos, Nama Alat, Toko/Tempat Servis, Durasi, dst), digabung
// pakai " | ". Angka di kanan = SUBTOTAL (jumlah x harga satuan).
// Dipakai BARENG sama Detail Pengeluaran & Nota, biar pengelompokannya
// dijamin identik di dua tempat itu.
export function kelompokkanItem(items) {
  const grup = []
  items.forEach((it) => {
    const tambahan = [it.keterangan, it.keterangan_tambahan].filter((x) => x && String(x).trim()).join(' | ')
    const baris = { tambahan, jumlah: it.jumlah, harga: Number(it.harga_satuan), subtotal: Number(it.jumlah) * Number(it.harga_satuan) }
    const g = grup.find((x) => x.nama === it.nama_item)
    if (g) g.baris.push(baris)
    else grup.push({ nama: it.nama_item, baris: [baris] })
  })
  return grup
}
