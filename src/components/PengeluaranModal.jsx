import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { formatAngkaInput, parseAngkaInput } from '../lib/format'
import { KATEGORI_PENGELUARAN, KATEGORI_LAINNYA, LABEL_TEMPAT_DEFAULT, ITEM_LAINNYA, cariKategori, cariOpsiItem } from '../lib/pengeluaran'
import CustomDatePicker from './CustomDatePicker'
import CustomSelect from './CustomSelect'
import './PengeluaranModal.css'
import IconClose from './IconClose'

function todayStr() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function formatRupiah(n) {
  return 'Rp' + (Number(n) || 0).toLocaleString('id-ID')
}

// `detail` = isi field tambahan item (Nama/Akun Medsos, Keterangan, dst --
// cuma ada di kategori yang Nama Item-nya dropdown, lihat `opsiItem` di
// lib/pengeluaran.js). Disimpan ke kolom `keterangan` pengeluaran_items.
// `namaCustom` = nama item yang diketik manual pas dropdown-nya dipilih
// "Lainnya (ketik manual)" (nama = ITEM_LAINNYA.label). Yang disimpan ke
// nama_item itu `namaCustom`-nya.
function itemKosong(nama = '') {
  return { nama, namaCustom: '', detail: '', detail2: '', jumlah: 1, harga: '' }
}

// Nyesuaiin 1 item ke kategori -- dipakai pas data lama dimuat buat
// diedit (ganti kategori di form SEKARANG nge-reset item, lihat
// gantiKategori, jadi nggak lewat sini lagi):
// - Kategori DROPDOWN: nama yang nggak ada di daftar opsi dijadiin
//   "Lainnya" (namanya dipindah ke Keterangan, biar nggak ilang). Field
//   tambahan dikosongin kalau opsinya nggak punya field tambahan.
// - Kategori KETIK BEBAS: item "Lainnya" dibalikin jadi nama biasa (dari
//   Keterangan-nya), field tambahan dikosongin (nggak dipakai).
function sesuaikanItem(it, infoKategori) {
  if (infoKategori?.opsiItem) {
    if (!it.nama.trim()) return { ...it, namaCustom: '', detail: '', detail2: '' }
    const opsi = cariOpsiItem(infoKategori, it.nama)
    // Nama di luar daftar -> mode "Lainnya (ketik manual)", namanya pindah
    // ke field ketik manual. Keterangan-nya DIPERTAHANKAN (opsi Lainnya
    // emang punya field Keterangan) -- penting pas data lama dimuat buat
    // diedit, biar Keterangan yang udah tersimpan nggak ilang.
    if (!opsi) return { ...it, nama: ITEM_LAINNYA.label, namaCustom: it.nama }
    const tetap = (opsi.labelDetail || opsi.gantiJumlah) ? it : { ...it, detail: '' }
    return opsi.labelDetail2 ? tetap : { ...tetap, detail2: '' }
  }
  if (it.nama === ITEM_LAINNYA.label) return { ...it, nama: it.namaCustom, namaCustom: '', detail: '', detail2: '' }
  // Kategori ketik bebas yang punya `detailBebas` (misal Nama Brand) --
  // isi field itu DIPERTAHANKAN (penting pas data lama dimuat buat diedit).
  if (infoKategori?.detailBebas) return it.detail2 ? { ...it, detail2: '' } : it
  return (it.detail || it.detail2) ? { ...it, detail: '', detail2: '' } : it
}

// Modal tambah/edit 1 transaksi Pengeluaran NON-BOOKING (biaya usaha yang
// diinput manual: belanja alat, portofolio, promosi, dst). Pengeluaran
// BOOKING (bayar tim/vendor/modal produk) TIDAK lewat sini -- itu udah
// otomatis dihitung dari data booking.
//
// Struktur datanya kayak booking: 1 transaksi (tabel `pengeluaran`) isinya
// banyak item (tabel `pengeluaran_items`). Total = jumlah x harga satuan
// semua item, dihitung di VIEW `pengeluaran_summary` (bukan disimpan).
//
// `editData` null = mode tambah. Diisi (1 baris dari `pengeluaran_summary`)
// = mode edit -- item-item-nya di-fetch sendiri di sini.
export default function PengeluaranModal({ onClose, onSaved, editData = null }) {
  const { user } = useAuth()
  const isEdit = !!editData

  // Kategori yang tersimpan di DB itu teks biasa. Kalau bukan salah satu
  // kategori bawaan, berarti dulu diisi lewat "Lainnya" (nama ketik sendiri).
  const kategoriAwalBawaan = editData ? !!cariKategori(editData.kategori) : true
  const [kategori, setKategori] = useState(editData ? (kategoriAwalBawaan ? editData.kategori : KATEGORI_LAINNYA) : '')
  const [kategoriCustom, setKategoriCustom] = useState(editData && !kategoriAwalBawaan ? editData.kategori : '')
  const [judul, setJudul] = useState(editData?.judul || '')
  const [tanggal, setTanggal] = useState(editData?.tanggal || todayStr())
  const [tempat, setTempat] = useState(editData?.tempat || '')
  const [penyelenggara, setPenyelenggara] = useState(editData?.penyelenggara || '')
  const [keterangan, setKeterangan] = useState(editData?.keterangan || '')
  const [items, setItems] = useState(isEdit ? [] : [itemKosong()])
  const [loadingItems, setLoadingItems] = useState(isEdit)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  // Mode edit: ambil item-item transaksi ini sekali pas modal dibuka.
  useEffect(() => {
    if (!editData) return
    supabase
      .from('pengeluaran_items')
      .select('nama_item, keterangan, keterangan_tambahan, jumlah, harga_satuan')
      .eq('pengeluaran_id', editData.id)
      .order('urutan')
      .then(({ data, error: err }) => {
        // Kategori yang nggak ada di daftar bawaan = dulu diisi lewat
        // "Lainnya (ketik manual)" -> pakai pengaturan kategori Lainnya,
        // biar Keterangan item-nya nggak ikut kehapus pas dimuat.
        const infoAwal = cariKategori(editData.kategori) || cariKategori(KATEGORI_LAINNYA)
        if (err) setError(err.message)
        else setItems(data.length > 0 ? data.map((it) => sesuaikanItem({ nama: it.nama_item, namaCustom: '', detail: it.keterangan || '', detail2: it.keterangan_tambahan || '', jumlah: it.jumlah, harga: String(Number(it.harga_satuan) || '') }, infoAwal)) : [itemKosong()])
        setLoadingItems(false)
      })
  }, [editData])

  const infoKategori = cariKategori(kategori)
  // true = Nama Item kategori ini dropdown (punya `opsiItem`), bukan ketik bebas.
  const pakaiOpsiItem = !!infoKategori?.opsiItem

  // Kategori = KUNCI AWAL form. Rincian Item dkk baru muncul setelah
  // kategori dipilih, dan kalau kategorinya DIGANTI, semua item DI-RESET
  // jadi 1 item kosong -- tiap kategori bentuk item-nya beda (ketik bebas
  // vs dropdown + field tambahan), jadi isian dari kategori lama nggak
  // dibawa-bawa (biar nggak ada data "ngumpet" yang ikut kesimpen).
  // Milih ulang kategori yang SAMA nggak nge-reset apa-apa.
  function gantiKategori(baru) {
    if (baru === kategori) return
    setKategori(baru)
    setKategoriCustom('')
    setPenyelenggara('')
    setItems([itemKosong()])
    setError('')
  }
  // Pilih Nama Item dari dropdown. Field ketik manual & field tambahan
  // dikosongin tiap ganti pilihan.
  // Opsi `tanpaJumlah` (misal Transport) / `gantiJumlah` (misal Durasi
  // iklan) -> jumlah dipaksa 1, soalnya field Jumlah-nya nggak ada.
  function pilihNamaItem(idx, label) {
    const opsiBaru = cariOpsiItem(infoKategori, label)
    const tanpaJumlah = !!(opsiBaru?.tanpaJumlah || opsiBaru?.gantiJumlah)
    setItems((list) => list.map((it, i) => (i === idx ? { ...it, nama: label, namaCustom: '', detail: '', detail2: '', ...(tanpaJumlah ? { jumlah: 1 } : {}) } : it)))
  }
  const total = items.reduce((s, it) => s + (Math.max(1, Number(it.jumlah) || 1) * (Number(it.harga) || 0)), 0)

  function updateItem(idx, field, value) {
    setItems((list) => list.map((it, i) => (i === idx ? { ...it, [field]: value } : it)))
  }
  function hapusItem(idx) {
    setItems((list) => list.filter((_, i) => i !== idx))
  }
  // Tombol saran: kalau masih ada baris yang BELUM diisi namanya (misal
  // baris kosong bawaan pas modal baru dibuka), saran itu ngisi baris
  // tersebut dulu -- bukan nambah baris baru -- biar nggak numpuk baris
  // kosong yang harus dihapus manual.
  function pakaiSaran(nama) {
    setItems((list) => {
      const idxKosong = list.findIndex((it) => !it.nama.trim() && !it.harga)
      if (idxKosong >= 0) return list.map((it, i) => (i === idxKosong ? { ...it, nama } : it))
      return [...list, itemKosong(nama)]
    })
  }

  async function handleSubmit(e) {
    e.preventDefault()
    const kategoriFinal = kategori === KATEGORI_LAINNYA ? kategoriCustom.trim() : kategori
    if (!kategori) { setError('Pilih kategori pengeluarannya dulu.'); return }
    if (!kategoriFinal) { setError('Isi nama kategorinya dulu.'); return }
    if (items.length === 0) { setError('Tambahkan minimal 1 item.'); return }
    const idxTanpaNama = items.findIndex((it) => !it.nama.trim())
    if (idxTanpaNama >= 0) { setError(pakaiOpsiItem ? `Pilih Nama Item ke-${idxTanpaNama + 1} dulu.` : `Nama item ke-${idxTanpaNama + 1} belum diisi.`); return }
    if (pakaiOpsiItem) {
      const idxLainnyaKosong = items.findIndex((it) => it.nama === ITEM_LAINNYA.label && !it.namaCustom.trim())
      if (idxLainnyaKosong >= 0) { setError(`Nama item ke-${idxLainnyaKosong + 1} (ketik manual) belum diisi.`); return }
    }
    if (total <= 0) { setError('Total pengeluaran masih Rp0. Isi harga item-nya dulu.'); return }

    setSaving(true)
    setError('')

    const header = {
      kategori: kategoriFinal,
      judul: judul.trim() || null,
      tanggal,
      // Kategori `tanpaTempat` (misal Iklan & Promosi) -> field-nya nggak
      // tampil, jadi nggak disimpan (biar sisa ketikan kategori lain nggak
      // ikut kesimpen diam-diam).
      tempat: (!infoKategori?.tanpaTempat && tempat.trim()) || null,
      // Cuma disimpan kalau kategorinya emang punya field Penyelenggara.
      penyelenggara: (infoKategori?.penyelenggara && penyelenggara.trim()) || null,
      keterangan: keterangan.trim() || null,
    }

    let pengeluaranId = editData?.id
    if (isEdit) {
      const { error: err } = await supabase.from('pengeluaran').update(header).eq('id', pengeluaranId)
      if (err) { setSaving(false); setError(err.message); return }
    } else {
      const { data, error: err } = await supabase.from('pengeluaran').insert({ ...header, user_id: user.id }).select('id').single()
      if (err) { setSaving(false); setError(err.message); return }
      pengeluaranId = data.id
    }

    // Item lama (mode edit) dicatat ID-nya DULUAN, baru dihapus SETELAH
    // item baru berhasil masuk -- kalau insert-nya gagal, item lama masih
    // utuh, nggak ada data yang ilang di tengah jalan.
    let idItemLama = []
    if (isEdit) {
      const { data } = await supabase.from('pengeluaran_items').select('id').eq('pengeluaran_id', pengeluaranId)
      idItemLama = (data || []).map((r) => r.id)
    }

    const rows = items.map((it, i) => ({
      pengeluaran_id: pengeluaranId,
      user_id: user.id,
      urutan: i,
      nama_item: it.nama === ITEM_LAINNYA.label ? it.namaCustom.trim() : it.nama.trim(),
      // Field tambahan cuma disimpan kalau opsi item-nya emang punya field
      // tambahan -- selain itu NULL (biar nggak nyimpen sisa ketikan).
      keterangan: ((cariOpsiItem(infoKategori, it.nama)?.labelDetail || cariOpsiItem(infoKategori, it.nama)?.gantiJumlah || (!pakaiOpsiItem && infoKategori?.detailBebas)) && it.detail.trim()) ? it.detail.trim() : null,
      keterangan_tambahan: (cariOpsiItem(infoKategori, it.nama)?.labelDetail2 && it.detail2.trim()) ? it.detail2.trim() : null,
      jumlah: (cariOpsiItem(infoKategori, it.nama)?.tanpaJumlah || cariOpsiItem(infoKategori, it.nama)?.gantiJumlah) ? 1 : Math.max(1, Number(it.jumlah) || 1),
      harga_satuan: Number(it.harga) || 0,
    }))
    const { error: itemErr } = await supabase.from('pengeluaran_items').insert(rows)
    if (itemErr) {
      // Transaksi BARU yang item-nya gagal disimpan -- dihapus lagi biar
      // nggak ada transaksi kosong Rp0 nyangkut di daftar.
      if (!isEdit) await supabase.from('pengeluaran').delete().eq('id', pengeluaranId)
      setSaving(false)
      setError(itemErr.message)
      return
    }
    if (idItemLama.length > 0) {
      const { error: delErr } = await supabase.from('pengeluaran_items').delete().in('id', idItemLama)
      if (delErr) { setSaving(false); setError(delErr.message); return }
    }

    setSaving(false)
    onSaved()
  }

  return (
    <div className="pengeluaran-modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="modal">
        <div className="modal-head">
          <h2>{isEdit ? 'Edit Pengeluaran' : 'Tambah Pengeluaran'}</h2>
          <button className="modal-close" onClick={onClose} type="button" aria-label="Tutup"><IconClose /></button>
        </div>

        <form onSubmit={handleSubmit} className="pengeluaran-form">
          <div className="modal-body">
            {/* Kategori -- dropdown (CustomSelect, sama kayak field Event di
                form Booking). Opsi "Lainnya (ketik manual)" munculin field
                teks di bawahnya buat nulis nama kategori sendiri. */}
            <div className="field-grid-pengeluaran cols-2">
              <div className="field">
                <label>Kategori Pengeluaran</label>
                <CustomSelect
                  options={[...KATEGORI_PENGELUARAN.map((k) => k.nama), KATEGORI_LAINNYA]}
                  value={kategori}
                  onChange={gantiKategori}
                  placeholder="Pilih Kategori"
                  variant="modal"
                />
                {kategori === KATEGORI_LAINNYA && (
                  <input
                    type="text"
                    placeholder="Tulis nama kategori..."
                    value={kategoriCustom}
                    onChange={(e) => setKategoriCustom(e.target.value)}
                    style={{ marginTop: 8 }}
                  />
                )}
              </div>
              <div className="field">
                <label>Tanggal</label>
                <CustomDatePicker value={tanggal} onChange={setTanggal} variant="modal" />
              </div>
            </div>

            {/* Judul -- label-nya ikut kategori (labelJudul, misal "Nama
                Pelatihan/Kelas"). Tempat -- BERSYARAT: baru muncul setelah
                kategori dipilih, label-nya ikut kategori (labelTempat):
                "Lokasi" buat Portofolio/Pelatihan/Promosi, sisanya
                (termasuk kategori ketik manual) "Tempat/Toko".
                Kategori yang punya field Penyelenggara (Pelatihan & Kelas):
                Judul | Penyelenggara di baris 1, Lokasi turun ke baris 2
                (sejajar Judul). Kategori lain: Judul | Tempat sebaris. */}
            <div className="field-grid-pengeluaran cols-2">
              <div className="field">
                <label>{infoKategori?.labelJudul || 'Judul'} (opsional)</label>
                <input type="text" placeholder={infoKategori?.contohJudul || 'contoh: Belanja kebutuhan usaha'} value={judul} onChange={(e) => setJudul(e.target.value)} />
              </div>
              {infoKategori?.penyelenggara ? (
              <div className="field">
                <label>{infoKategori.penyelenggara.label} (opsional)</label>
                <input type="text" placeholder={infoKategori.penyelenggara.contoh || ''} value={penyelenggara} onChange={(e) => setPenyelenggara(e.target.value)} />
              </div>
              ) : kategori && !infoKategori?.tanpaTempat && (
              <div className="field">
                <label>{infoKategori?.labelTempat || LABEL_TEMPAT_DEFAULT} (opsional)</label>
                <input type="text" placeholder={infoKategori?.contohTempat || 'contoh: Nama toko/tempat'} value={tempat} onChange={(e) => setTempat(e.target.value)} />
              </div>
              )}
            </div>
            {infoKategori?.penyelenggara && (
            <div className="field-grid-pengeluaran cols-2">
              <div className="field">
                <label>{infoKategori.labelTempat || LABEL_TEMPAT_DEFAULT} (opsional)</label>
                <input type="text" placeholder={infoKategori.contohTempat || 'contoh: Nama toko/tempat'} value={tempat} onChange={(e) => setTempat(e.target.value)} />
              </div>
            </div>
            )}

            {/* Rincian Item, Total & Catatan SENGAJA disembunyiin sampai
                kategori dipilih -- biar user nggak langsung ngisi item
                tanpa milih kategori dulu (lihat gantiKategori). */}
            {kategori && (
            <>
            <div className="form-divider"></div>

            <div className="item-section-head">
              <span className="item-section-title">Rincian Item</span>
            </div>

            {/* Saran item cuma buat kategori ketik bebas -- kategori yang
                Nama Item-nya dropdown (opsiItem) nggak butuh saran. */}
            {infoKategori && !pakaiOpsiItem && infoKategori.saran && (
              <div className="saran-wrap">
                <span className="saran-label">Saran item:</span>
                {infoKategori.saran.map((s) => (
                  <button type="button" key={s} className="saran-chip" onClick={() => pakaiSaran(s)}>+ {s}</button>
                ))}
              </div>
            )}

            {loadingItems ? (
              <div className="item-loading">Memuat item...</div>
            ) : (
              items.map((it, idx) => (
                // 2 lapis kayak kartu Klien di form Booking: lapis luar
                // (berwarna) isinya judul "Item N" + tombol Hapus, lapis
                // dalam (putih) isinya field-field item-nya.
                <div className="item-card" key={idx}>
                  <div className="item-card-head">
                    {/* Kalau item-nya cuma 1, judulnya "Item" aja (tanpa angka) --
                        angka urut baru muncul pas item-nya lebih dari 1. */}
                    <div className="item-title"><span className="item-num">{idx + 1}</span>{items.length > 1 ? `Item ${idx + 1}` : 'Item'}</div>
                    {items.length > 1 && (
                      <button type="button" className="item-remove" onClick={() => hapusItem(idx)}>Hapus</button>
                    )}
                  </div>
                  <div className="item-body">
                  {pakaiOpsiItem ? (
                    // Kategori dropdown: Nama Item (setengah lebar) + field
                    // tambahan di sampingnya (kalau opsinya punya).
                    <div className="field-grid-item-nama">
                      <div className="field">
                        <label>Nama Item</label>
                        <CustomSelect
                          options={[...infoKategori.opsiItem.map((o) => o.nama), ITEM_LAINNYA.label]}
                          value={it.nama}
                          onChange={(label) => pilihNamaItem(idx, label)}
                          placeholder="Pilih item"
                          variant="modal"
                        />
                        {/* Sama kayak field Event di form Booking: opsi
                            "Lainnya (ketik manual)" munculin field ketik
                            nama item di bawah dropdown. */}
                        {it.nama === ITEM_LAINNYA.label && (
                          <input
                            type="text"
                            placeholder="Tulis nama item ..."
                            value={it.namaCustom}
                            onChange={(e) => updateItem(idx, 'namaCustom', e.target.value)}
                            style={{ marginTop: 8 }}
                          />
                        )}
                      </div>
                      {cariOpsiItem(infoKategori, it.nama)?.labelDetail && (
                        <div className="field">
                          <label>{cariOpsiItem(infoKategori, it.nama).labelDetail}</label>
                          <input type="text" placeholder={cariOpsiItem(infoKategori, it.nama).contohDetail || ''} value={it.detail} onChange={(e) => updateItem(idx, 'detail', e.target.value)} />
                        </div>
                      )}
                      {/* Field tambahan KEDUA (labelDetail2, misal Toko/Tempat
                          Servis) -- kolom kanan baris ke-2, tepat di bawah
                          field tambahan pertama. */}
                      {cariOpsiItem(infoKategori, it.nama)?.labelDetail2 && (
                        <div className="field field-detail2">
                          <label>{cariOpsiItem(infoKategori, it.nama).labelDetail2}</label>
                          <input type="text" placeholder={cariOpsiItem(infoKategori, it.nama).contohDetail2 || ''} value={it.detail2} onChange={(e) => updateItem(idx, 'detail2', e.target.value)} />
                        </div>
                      )}
                    </div>
                  ) : (
                  // Kategori ketik bebas. `namaItemSetengah` -> dibungkus grid
                  // 2 kolom yang sama kayak kategori dropdown, jadi Nama Item
                  // setengah lebar (kolom kanan kosong).
                  <div className={infoKategori?.namaItemSetengah ? 'field-grid-item-nama' : undefined}>
                  <div className="field">
                    <label>Nama Item</label>
                    <input type="text" placeholder={infoKategori?.contohNamaItem || 'contoh: Foundation'} value={it.nama} onChange={(e) => updateItem(idx, 'nama', e.target.value)} />
                  </div>
                  {/* `detailBebas` (misal Nama Brand) -- SELALU muncul di
                      samping Nama Item, mau namanya dari saran item atau
                      ketik manual. */}
                  {infoKategori?.detailBebas && (
                  <div className="field">
                    <label>{infoKategori.detailBebas.label}</label>
                    <input type="text" placeholder={infoKategori.detailBebas.contoh || ''} value={it.detail} onChange={(e) => updateItem(idx, 'detail', e.target.value)} />
                  </div>
                  )}
                  </div>
                  )}
                  {/* Opsi `tanpaJumlah` (misal Transport): field Jumlah
                      disembunyiin, sisa Biaya | Subtotal. */}
                  <div className={`field-grid-item${cariOpsiItem(infoKategori, it.nama)?.tanpaJumlah ? ' tanpa-jumlah' : ''}`}>
                    {/* Opsi `gantiJumlah` (misal Durasi iklan): posisi Jumlah
                        diisi field teks info (disimpan di kolom keterangan). */}
                    {cariOpsiItem(infoKategori, it.nama)?.gantiJumlah && (
                    <div className="field">
                      <label>{cariOpsiItem(infoKategori, it.nama).gantiJumlah.label}</label>
                      <input type="text" placeholder={cariOpsiItem(infoKategori, it.nama).gantiJumlah.contoh || ''} value={it.detail} onChange={(e) => updateItem(idx, 'detail', e.target.value)} />
                    </div>
                    )}
                    {!cariOpsiItem(infoKategori, it.nama)?.tanpaJumlah && !cariOpsiItem(infoKategori, it.nama)?.gantiJumlah && (
                    <div className="field">
                      <label>Jumlah</label>
                      <input
                        type="text"
                        inputMode="numeric"
                        placeholder="1"
                        value={it.jumlah}
                        onChange={(e) => {
                          const digits = e.target.value.replace(/[^0-9]/g, '')
                          updateItem(idx, 'jumlah', digits === '' ? '' : Math.max(1, parseInt(digits, 10)))
                        }}
                        onBlur={(e) => { if (!e.target.value) updateItem(idx, 'jumlah', 1) }}
                      />
                    </div>
                    )}
                    <div className="field">
                      <label>{cariOpsiItem(infoKategori, it.nama)?.labelHarga || 'Harga Satuan'}</label>
                      <input type="text" inputMode="numeric" placeholder="Rp0" value={it.harga ? `Rp${formatAngkaInput(it.harga)}` : ''} onChange={(e) => updateItem(idx, 'harga', parseAngkaInput(e.target.value))} />
                    </div>
                    <div className="field">
                      <label>Subtotal</label>
                      <div className="item-subtotal">{formatRupiah(Math.max(1, Number(it.jumlah) || 1) * (Number(it.harga) || 0))}</div>
                    </div>
                  </div>
                  </div>
                </div>
              ))
            )}

            {!loadingItems && (
              <button type="button" className="add-item" onClick={() => setItems((list) => [...list, itemKosong()])}>+ Tambah Item</button>
            )}

            <div className="total-row">
              <span>Total Pengeluaran</span>
              <b>{formatRupiah(total)}</b>
            </div>

            <div className="field field-catatan">
              <label>Catatan (opsional)</label>
              <textarea rows={2} placeholder="Catatan tambahan" value={keterangan} onChange={(e) => setKeterangan(e.target.value)} />
            </div>
            </>
            )}

            {error && <div className="pengeluaran-error">{error}</div>}
          </div>

          {/* Tombol Hapus SENGAJA nggak ada di sini -- adanya di Detail
              Pengeluaran (PengeluaranDetailModal.jsx), sama kayak tombol
              Hapus Booking yang adanya di Detail Booking, bukan di form
              edit-nya. */}
          <div className="modal-foot">
            <div className="foot-right">
              <button type="button" className="btn-ghost" onClick={onClose}>Batal</button>
              <button type="submit" className="btn-primary-pengeluaran" disabled={saving || loadingItems}>
                {saving ? 'Menyimpan...' : 'Simpan Pengeluaran'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}
