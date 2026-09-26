import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import CustomSelect from './CustomSelect'
import CustomDatePicker from './CustomDatePicker'
import CustomTimePicker from './CustomTimePicker'
import { EVENT_OPTIONS, EVENT_CUSTOM_SENTINEL, KATEGORI_MAKEUP_OPTIONS } from '../lib/constants'
import { formatAngkaInput, parseAngkaInput } from '../lib/format'
import { cariAtauBuatKlien } from '../lib/klien'
import './BookingModal.css'

function todayStr() {
  // SEBELUMNYA pake new Date().toISOString().slice(0,10) -- itu bug,
  // soalnya toISOString() convert ke UTC dulu sebelum diformat. WIB itu
  // UTC+7, jadi pas jam dini hari (00:00-06:59 WIB), waktu UTC-nya masih
  // di TANGGAL SEBELUMNYA -- hasilnya "Tanggal Booking" default ketiban
  // mundur 1 hari pas jam-jam itu. Fix-nya: susun tanggal dari getter
  // LOKAL (getFullYear/getMonth/getDate), sama persis pola toISO() yang
  // udah dipakai di CustomDatePicker.jsx.
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
// Kapitalisasi huruf pertama tiap kata -- SENGAJA cuma nyentuh huruf
// PERTAMA doang di tiap kata (bukan nge-lowercase-in sisanya), biar aman
// kalau ada singkatan yang ditulis kapital sengaja (misal "UMS Pabelan"),
// nggak keubah jadi "Ums Pabelan". Kata dipisahin lewat spasi ATAU koma.
function capitalizeWords(str) {
  return (str || '').replace(/(^|[\s,])([a-z])/g, (_, sep, ch) => sep + ch.toUpperCase())
}
// Ubah array addOnLainnya (maks 5 item) jadi field flat sesuai kolom
// database (layanan_lainnya[_N], biaya_lainnya[_N], keuntungan_lainnya[_N]
// -- slot 1 nggak ada akhiran, slot 2-5 dikasih akhiran _2 s/d _5). Slot
// yang nggak dipakai (peserta cuma isi kurang dari 5) otomatis dikosongin.
function addOnsToRow(addOns) {
  const out = {}
  for (let n = 1; n <= 5; n++) {
    const suffix = n === 1 ? '' : `_${n}`
    const a = addOns[n - 1] || { nama: '', biaya: '', keuntungan: '', jumlah: 1 }
    const nama = a.nama.trim()
    // Kalau nama kosong, biaya & keuntungan-nya IKUT dianggap kosong --
    // sama persis alasannya kayak fix di BookingDetailModal.jsx.
    out[`layanan_lainnya${suffix}`] = nama || null
    out[`biaya_lainnya${suffix}`] = nama ? (Number(a.biaya) || 0) : 0
    out[`keuntungan_lainnya${suffix}`] = nama ? (Number(a.keuntungan) || 0) : 0
    // Jumlah -- SAMA aturannya, balik ke 1 kalau nama kosong.
    out[`jumlah_lainnya${suffix}`] = nama ? Math.max(1, Number(a.jumlah) || 1) : 1
  }
  return out
}

// Ubah array sewaLainnya (maks 5 item) jadi field flat sesuai kolom
// database (nama_sewa[_N], biaya_sewa[_N], jumlah_sewa[_N],
// untung_sewa[_N]) -- pola SAMA PERSIS kayak addOnsToRow di atas.
function sewaToRow(sewaList) {
  const out = {}
  for (let n = 1; n <= 5; n++) {
    const suffix = n === 1 ? '' : `_${n}`
    const s = sewaList[n - 1] || { nama: '', biaya: '', jumlah: 1, untung: '' }
    const nama = s.nama.trim()
    out[`nama_sewa${suffix}`] = nama || null
    out[`biaya_sewa${suffix}`] = nama ? (Number(s.biaya) || 0) : 0
    out[`jumlah_sewa${suffix}`] = nama ? Math.max(1, Number(s.jumlah) || 1) : 1
    out[`untung_sewa${suffix}`] = nama ? (Number(s.untung) || 0) : 0
  }
  return out
}

function blankPeserta(nama = '') {
  return {
    nama, peran: '',
    // jumlahSesiMakeup / jumlahSesiTambahan: berapa kali klien yang
    // SAMA di-makeup / di-hairdo di booking yang sama (misal sesi pagi
    // & sore). DIPISAH SENGAJA -- nggak selalu makeup 2x otomatis
    // berarti hairdo-nya ikut 2x juga (bisa aja makeup 2x tapi hairdo
    // cuma sekali, atau sebaliknya). Defaultnya 1 (kasus normal).
    // Biaya yang diisi TETAP harga PER-SESI, bukan udah dikali --
    // perkaliannya kejadian di VIEW `booking_summary` & ditampilin di
    // Invoice/Rincian Keuangan, BUKAN di sini.
    jumlahSesiMakeup: 1,
    jumlahSesiTambahan: 1,
    kategoriMakeup: 'Regular', jenisPaket: '', dikerjakanOlehMakeup: 'Me',
    pakaiPaketBundling: false,
    biayaMakeup: '', komisiMakeup: '', namaTimMakeup: '',
    // Retouch -- JASA (sekelas Makeup), bukan produk. Selalu Me,
    // nggak ada Komisi/Nama Tim.
    retouch: false, biayaRetouch: '',
    layananTambahan: 'Tidak Ada', dikerjakanOlehTambahan: 'Me',
    biayaTambahan: '', komisiTambahan: '', namaTimTambahan: '',
    // Add On Item (Beli) -- SEKARANG dikasih toggle Tidak/Ya juga,
    // sama pola persis kayak Add On Item (Sewa) di bawah, defaultnya
    // nggak aktif.
    adaAddOn: false,
    addOnLainnya: [{ nama: '', biaya: '', keuntungan: '', jumlah: 1 }],
    // Add On Item (Sewa) -- section TERPISAH dari Add On Item biasa,
    // defaultnya nggak aktif (toggle Tidak).
    adaSewa: false,
    sewaLainnya: [{ nama: '', biaya: '', jumlah: 1, untung: '' }],
    vendors: [],
  }
}

export default function BookingModal({ onClose, onSaved }) {
  const { user } = useAuth()

  const [tanggalBooking, setTanggalBooking] = useState(todayStr())
  const [namaKlien, setNamaKlien] = useState('')
  const [nomorWhatsApp, setNomorWhatsApp] = useState('')
  const [sumber, setSumber] = useState('Instagram')
  const [tanggalAcara, setTanggalAcara] = useState('')
  const [jamStartMakeup, setJamStartMakeup] = useState('')
  const [lokasi, setLokasi] = useState('')
  const [event, setEvent] = useState(EVENT_OPTIONS[0])
  const [eventCustom, setEventCustom] = useState('')
  const [biayaTransport, setBiayaTransport] = useState('')
  const [dp, setDp] = useState('')
  const [dpMetode, setDpMetode] = useState('Transfer Bank')
  const [catatan, setCatatan] = useState('')
  const [pesertaList, setPesertaList] = useState([blankPeserta()])

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const [existingClients, setExistingClients] = useState([])
  const [showSuggest, setShowSuggest] = useState(false)
  const [bookingDates, setBookingDates] = useState([])

  // Ambil semua tanggal_acara booking yang udah ada (punya user ini doang,
  // RLS + .eq user_id) -- dipakai CustomDatePicker buat nampilin indikator
  // kepadatan di field "Tanggal Acara" (lihat props bookingDates di bawah).
  // Cuma ambil kolom tanggal_acara doang (bukan select * ), soalnya cuma
  // itu yang kepake di sini.
  useEffect(() => {
    async function loadBookingDates() {
      const { data } = await supabase
        .from('bookings')
        .select('tanggal_acara')
        .eq('user_id', user.id)

      if (data) setBookingDates(data.map((b) => b.tanggal_acara))
    }
    if (user) loadBookingDates()
  }, [user])

  // Ambil daftar klien (dari tabel `klien`, yang masing-masing punya ID unik
  // asli) buat autocomplete di field Nama klien -- biar klien yang booking
  // ulang nggak perlu ngetik ulang nomor WA-nya. Karena sumbernya sekarang
  // tabel klien asli (bukan nebak dari nama di bookings), 2 klien beda orang
  // yang kebetulan namanya sama bakal tetap muncul terpisah (beda nomor WA).
  useEffect(() => {
    async function loadExistingClients() {
      const { data } = await supabase
        .from('klien')
        .select('id, nama, nomor_whatsapp')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })

      if (data) setExistingClients(data)
    }
    if (user) loadExistingClients()
  }, [user])

  const namaKlienTrim = namaKlien.trim().toLowerCase()
  const clientSuggestions = namaKlienTrim
    ? existingClients
        .filter((c) => c.nama.toLowerCase().includes(namaKlienTrim) && c.nama.toLowerCase() !== namaKlienTrim)
        .slice(0, 5)
    : []

  function pilihKlien(c) {
    setNamaKlien(c.nama)
    if (c.nomor_whatsapp) setNomorWhatsApp(c.nomor_whatsapp)
    setShowSuggest(false)
  }


  function updatePeserta(i, field, value) {
    setPesertaList((list) => list.map((p, idx) => {
      if (idx !== i) return p
      const updated = { ...p, [field]: value }
      // Begitu di-toggle BALIK ke "Me", Komisi & Nama Tim langsung
      // ke-reset di form-nya juga (bukan cuma pas nyimpen doang) --
      // pola yang sama persis kayak fix Add On sebelumnya, biar nggak
      // ada data "nyangkut" diem-diem nempel ke baris yang harusnya
      // Me.
      if (field === 'dikerjakanOlehMakeup' && value === 'Me') {
        updated.komisiMakeup = ''
        updated.namaTimMakeup = ''
      }
      if (field === 'dikerjakanOlehTambahan' && value === 'Me') {
        updated.komisiTambahan = ''
        updated.namaTimTambahan = ''
      }
      // BUG YANG BARU DIBENERIN (sama kasusnya kayak yang kejadian di
      // BookingDetailModal.jsx): begitu Layanan Tambahan di-toggle
      // BALIK ke "Tidak Ada", field Biaya Tambahan sebelumnya cuma
      // ke-sembunyiin di form, nggak ke-reset -- jadi bisa nyangkut
      // diem-diem ke Total Tagihan tanpa kelihatan barisnya di Invoice.
      if (field === 'layananTambahan' && value === 'Tidak Ada') {
        updated.dikerjakanOlehTambahan = 'Me'
        updated.biayaTambahan = ''
        updated.komisiTambahan = ''
        updated.namaTimTambahan = ''
        updated.jumlahSesiTambahan = 1
      }
      if (field === 'retouch' && value === false) {
        updated.biayaRetouch = ''
      }
      if (field === 'adaAddOn' && value === false) {
        updated.addOnLainnya = [{ nama: '', biaya: '', keuntungan: '', jumlah: 1 }]
      }
      if (field === 'adaSewa' && value === false) {
        updated.sewaLainnya = [{ nama: '', biaya: '', jumlah: 1, untung: '' }]
      }
      return updated
    }))
  }
  function addPeserta() {
    setPesertaList((list) => [...list, blankPeserta()])
  }
  function removePeserta(i) {
    setPesertaList((list) => list.filter((_, idx) => idx !== i))
  }

  function updateAddOn(pesertaIdx, addOnIdx, field, value) {
    setPesertaList((list) => list.map((p, idx) => {
      if (idx !== pesertaIdx) return p
      return {
        ...p,
        addOnLainnya: p.addOnLainnya.map((a, ai) => {
          if (ai !== addOnIdx) return a
          const updated = { ...a, [field]: value }
          // Begitu nama-nya dikosongin, biaya & keuntungan langsung
          // ke-reset di form-nya juga (bukan cuma pas nyimpen doang) --
          // biar user LANGSUNG liat angkanya ilang, nggak nyangka
          // masih "aman" padahal diem-diem masih nyangkut.
          if (field === 'nama' && !value.trim()) {
            updated.biaya = ''
            updated.keuntungan = ''
            updated.jumlah = 1
          }
          return updated
        }),
      }
    }))
  }
  function addAddOn(pesertaIdx) {
    setPesertaList((list) => list.map((p, idx) => {
      if (idx !== pesertaIdx || p.addOnLainnya.length >= 5) return p
      return { ...p, addOnLainnya: [...p.addOnLainnya, { nama: '', biaya: '', keuntungan: '', jumlah: 1 }] }
    }))
  }

  // Add On Item (Sewa) -- section TERPISAH dari Add On Item biasa,
  // pola persis sama (array + maks 5 slot) tapi rumus hitungannya
  // beda (numpang Paket Bundling: biaya penuh ke Belanja Klien, UNTUNG
  // doang yang masuk Omzet/Penghasilan -- lihat sewaToRow di atas).
  function updateSewa(pesertaIdx, sewaIdx, field, value) {
    setPesertaList((list) => list.map((p, idx) => {
      if (idx !== pesertaIdx) return p
      return {
        ...p,
        sewaLainnya: p.sewaLainnya.map((s, si) => {
          if (si !== sewaIdx) return s
          const updated = { ...s, [field]: value }
          if (field === 'nama' && !value.trim()) {
            updated.biaya = ''
            updated.untung = ''
            updated.jumlah = 1
          }
          return updated
        }),
      }
    }))
  }
  function addSewa(pesertaIdx) {
    setPesertaList((list) => list.map((p, idx) => {
      if (idx !== pesertaIdx || p.sewaLainnya.length >= 5) return p
      return { ...p, sewaLainnya: [...p.sewaLainnya, { nama: '', biaya: '', jumlah: 1, untung: '' }] }
    }))
  }
  function removeSewa(pesertaIdx, sewaIdx) {
    setPesertaList((list) => list.map((p, idx) => {
      if (idx !== pesertaIdx) return p
      return { ...p, sewaLainnya: p.sewaLainnya.filter((_, si) => si !== sewaIdx) }
    }))
  }

  // Vendor Paket Bundling -- SEKARANG nempel per KLIEN (bukan level
  // booking lagi kayak sebelumnya), aktif kalau Kategori klien itu =
  // "Paket Bundling". Vendor 1 nama-nya ke-render numpang slot "Jenis
  // Makeup" (lihat JSX), sisanya (Biaya/Untung/Add On, + Vendor 2 dst)
  // di section sendiri di bawahnya. Tiap vendor bisa punya "addOns"
  // sendiri (misal Vendor Fotografer punya add on Strobist) -- disimpen
  // nested di sini, baru di-"ratain" jadi baris bundling_items yang
  // saling terhubung lewat parent_id + peserta_id pas nyimpen.
  function addVendor(pesertaIdx) {
    setPesertaList((list) => list.map((p, idx) => (idx === pesertaIdx ? { ...p, vendors: [...p.vendors, { nama: '', biaya: '', untung: '', addOns: [] }] } : p)))
  }
  function updateVendor(pesertaIdx, vendorIdx, field, value) {
    setPesertaList((list) => list.map((p, idx) => {
      if (idx !== pesertaIdx) return p
      return { ...p, vendors: p.vendors.map((v, vi) => (vi === vendorIdx ? { ...v, [field]: value } : v)) }
    }))
  }
  function removeVendor(pesertaIdx, vendorIdx) {
    setPesertaList((list) => list.map((p, idx) => {
      if (idx !== pesertaIdx) return p
      return { ...p, vendors: p.vendors.filter((_, vi) => vi !== vendorIdx) }
    }))
  }
  function addVendorAddOn(pesertaIdx, vendorIdx) {
    setPesertaList((list) => list.map((p, idx) => {
      if (idx !== pesertaIdx) return p
      return { ...p, vendors: p.vendors.map((v, vi) => (vi === vendorIdx ? { ...v, addOns: [...v.addOns, { nama: '', biaya: '', untung: '' }] } : v)) }
    }))
  }
  function updateVendorAddOn(pesertaIdx, vendorIdx, addOnIdx, field, value) {
    setPesertaList((list) => list.map((p, idx) => {
      if (idx !== pesertaIdx) return p
      return { ...p, vendors: p.vendors.map((v, vi) => {
        if (vi !== vendorIdx) return v
        return { ...v, addOns: v.addOns.map((a, ai) => (ai === addOnIdx ? { ...a, [field]: value } : a)) }
      }) }
    }))
  }
  function removeVendorAddOn(pesertaIdx, vendorIdx, addOnIdx) {
    setPesertaList((list) => list.map((p, idx) => {
      if (idx !== pesertaIdx) return p
      return { ...p, vendors: p.vendors.map((v, vi) => {
        if (vi !== vendorIdx) return v
        return { ...v, addOns: v.addOns.filter((_, ai) => ai !== addOnIdx) }
      }) }
    }))
  }
  function removeAddOn(pesertaIdx, addOnIdx) {
    setPesertaList((list) => list.map((p, idx) => {
      if (idx !== pesertaIdx) return p
      return { ...p, addOnLainnya: p.addOnLainnya.filter((_, ai) => ai !== addOnIdx) }
    }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')

    if (!namaKlien.trim()) { setError('Nama klien wajib diisi.'); return }
    if (!tanggalAcara) { setError('Tanggal acara wajib diisi.'); return }
    if (pesertaList.length === 0) { setError('Tambahkan minimal 1 peserta.'); return }

    setSaving(true)

    let klienId
    try {
      klienId = await cariAtauBuatKlien(user.id, namaKlien, nomorWhatsApp)
    } catch (klienErr) {
      setError('Gagal memproses data klien: ' + klienErr.message)
      setSaving(false)
      return
    }

    const { data: booking, error: bookingError } = await supabase
      .from('bookings')
      .insert({
        user_id: user.id,
        klien_id: klienId,
        tanggal_booking: tanggalBooking,
        nama_klien: namaKlien.trim(),
        nomor_whatsapp: nomorWhatsApp.trim(),
        sumber,
        tanggal_acara: tanggalAcara,
        jam_start_makeup: jamStartMakeup || null,
        lokasi: lokasi.trim(),
        event: event === EVENT_CUSTOM_SENTINEL ? (eventCustom.trim() || 'Lainnya') : event,
        biaya_transport: Number(biayaTransport) || 0,
        catatan: catatan.trim(),
      })
      .select()
      .single()

    if (bookingError) {
      setError(bookingError.message)
      setSaving(false)
      return
    }

    const pesertaRows = pesertaList.map((p, i) => ({
      booking_id: booking.id,
      user_id: user.id,
      // "urutan" ini WAJIB, JANGAN andelin created_at buat nentuin
      // urutan tampilan -- semua baris peserta di 1 booking di-insert
      // dalam SATU perintah bulk insert kayak di bawah ini, jadi
      // created_at-nya PERSIS SAMA buat semuanya (now() cuma dievaluasi
      // sekali per statement). Tanpa kolom ini, urutan tampilan cuma
      // nebak dari posisi fisik data, yang bisa berubah sendiri begitu
      // salah satu baris di-edit nanti. Lihat juga fix yang sama di
      // BookingDetailModal.jsx.
      urutan: i,
      nama_anggota: p.nama.trim(),
      peran: p.peran.trim(),
      jumlah_sesi_makeup: Math.max(1, Number(p.jumlahSesiMakeup) || 1),
      jumlah_sesi_tambahan: p.layananTambahan !== 'Tidak Ada' ? Math.max(1, Number(p.jumlahSesiTambahan) || 1) : 1,
      jenis_paket: p.jenisPaket.trim(),
      kategori_makeup: p.kategoriMakeup,
      pakai_paket_bundling: p.pakaiPaketBundling,
      dikerjakan_oleh_makeup: p.dikerjakanOlehMakeup,
      biaya_makeup: Number(p.biayaMakeup) || 0,
      // Komisi & Nama Tim CUMA berlaku kalau beneran dikerjain Tim --
      // apapun yang kebetulan masih nyangkut di field itu, dipaksa
      // kosong/0 kalau statusnya "Me". Ini nutup 2 hal sekaligus: bug
      // LAMA yang udah ada dari dulu (komisi_makeup_tim/komisi_tambahan
      // nggak pernah di-cek gini sebelumnya) DAN nyegah field Nama Tim
      // yang baru kena masalah yang sama sejak awal.
      komisi_makeup_tim: p.dikerjakanOlehMakeup === 'Tim' ? (Number(p.komisiMakeup) || 0) : 0,
      nama_tim_makeup: p.dikerjakanOlehMakeup === 'Tim' ? (p.namaTimMakeup.trim() || null) : null,
      retouch: p.retouch,
      biaya_retouch: p.retouch ? (Number(p.biayaRetouch) || 0) : 0,
      layanan_tambahan: p.layananTambahan,
      // Sama pola & alasannya kayak komisi_makeup_tim/nama_tim_makeup
      // di atas -- ini akar bug invoice Ka Linda (Rp100rb nyangkut
      // nggak kelihatan di Invoice). biaya_tambahan sekarang dipaksa
      // ngikutin status layananTambahan, bukan nilai mentah form.
      dikerjakan_oleh_tambahan: p.layananTambahan !== 'Tidak Ada' ? p.dikerjakanOlehTambahan : 'Me',
      biaya_tambahan: p.layananTambahan !== 'Tidak Ada' ? (Number(p.biayaTambahan) || 0) : 0,
      komisi_tambahan: (p.layananTambahan !== 'Tidak Ada' && p.dikerjakanOlehTambahan === 'Tim') ? (Number(p.komisiTambahan) || 0) : 0,
      nama_tim_tambahan: (p.layananTambahan !== 'Tidak Ada' && p.dikerjakanOlehTambahan === 'Tim') ? (p.namaTimTambahan.trim() || null) : null,
      ...addOnsToRow(p.addOnLainnya),
      ...sewaToRow(p.sewaLainnya),
    }))

    const { data: insertedPeserta, error: pesertaError } = await supabase.from('peserta').insert(pesertaRows).select()

    if (pesertaError) {
      setSaving(false)
      setError('Booking tersimpan, tapi gagal simpan peserta: ' + pesertaError.message)
      return
    }

    if (Number(dp) > 0) {
      const { error: dpError } = await supabase.from('payments').insert({
        booking_id: booking.id,
        user_id: user.id,
        tanggal: tanggalBooking,
        jumlah: Number(dp),
        metode: dpMetode,
      })
      if (dpError) {
        setSaving(false)
        setError('Booking & peserta tersimpan, tapi gagal simpan DP: ' + dpError.message)
        return
      }
    }

    // Vendor Paket Bundling -- SEKARANG nempel ke peserta tertentu lewat
    // peserta_id (bukan cuma booking_id kayak sebelumnya), soalnya
    // Vendor Kategori itu dipilih PER KLIEN. insertedPeserta balik
    // PERSIS sesuai urutan pesertaRows yang dikirim (1 statement INSERT
    // ... RETURNING), jadi index ke-i di pesertaList itu pasangannya
    // index ke-i di insertedPeserta -- sama pola-nya kayak yang dulu
    // dipake buat nyambungin add on paket ke paket induknya.
    for (let i = 0; i < pesertaList.length; i++) {
      const p = pesertaList[i]
      if (!p.pakaiPaketBundling) continue
      const pesertaId = insertedPeserta[i]?.id
      if (!pesertaId) continue

      const filledVendors = p.vendors.filter((v) => v.nama.trim())
      if (filledVendors.length === 0) continue

      const vendorRows = filledVendors.map((v) => ({
        booking_id: booking.id,
        user_id: user.id,
        peserta_id: pesertaId,
        nama: v.nama.trim(),
        biaya: Number(v.biaya) || 0,
        keuntungan: Number(v.untung) || 0,
      }))

      const { data: insertedVendors, error: vendorError } = await supabase
        .from('bundling_items')
        .insert(vendorRows)
        .select()

      if (vendorError) {
        setSaving(false)
        setError('Booking & peserta tersimpan, tapi gagal simpan vendor paket bundling: ' + vendorError.message)
        return
      }

      const addOnRows = []
      filledVendors.forEach((v, vi) => {
        const parentId = insertedVendors[vi]?.id
        if (!parentId) return
        v.addOns.forEach((a) => {
          if (a.nama.trim()) {
            addOnRows.push({
              booking_id: booking.id,
              user_id: user.id,
              peserta_id: pesertaId,
              parent_id: parentId,
              nama: a.nama.trim(),
              biaya: Number(a.biaya) || 0,
              keuntungan: Number(a.untung) || 0,
            })
          }
        })
      })

      if (addOnRows.length > 0) {
        const { error: addOnError } = await supabase.from('bundling_items').insert(addOnRows)
        if (addOnError) {
          setSaving(false)
          setError('Booking, peserta, & vendor tersimpan, tapi gagal simpan add on vendor: ' + addOnError.message)
          return
        }
      }
    }

    setSaving(false)
    onSaved(booking.kode_booking)
  }

  return (
    <div className="modal-overlay booking-modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="modal">
        <div className="modal-head">
          <h2>Booking Baru</h2>
          <button className="modal-close" onClick={onClose} type="button">&times;</button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'contents' }}>
          <div className="modal-body">
            {error && <div className="modal-error">{error}</div>}

            <div className="field-grid-booking cols-tanggal-nama-wa">
              <div className="field">
                <label>Tanggal Booking</label>
                <CustomDatePicker value={tanggalBooking} onChange={setTanggalBooking} variant="modal" />
              </div>
              <div className="field" style={{ position: 'relative' }}>
                <label>Nama Klien</label>
                <input
                  type="text"
                  placeholder="contoh: Jenny Black Pink"
                  value={namaKlien}
                  onChange={(e) => { setNamaKlien(e.target.value); setShowSuggest(true) }}
                  onFocus={() => setShowSuggest(true)}
                  onBlur={() => { setNamaKlien((v) => capitalizeWords(v)); setTimeout(() => setShowSuggest(false), 120) }}
                  autoComplete="off"
                  required
                />
                {showSuggest && clientSuggestions.length > 0 && (
                  <div className="klien-suggest">
                    {clientSuggestions.map((c) => (
                      <div
                        key={c.id}
                        className="klien-suggest-item"
                        onMouseDown={() => pilihKlien(c)}
                      >
                        <span className="klien-suggest-name">{c.nama}</span>
                        {c.nomor_whatsapp && <span className="klien-suggest-wa">{c.nomor_whatsapp}</span>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div className="field">
                <label>Nomor WhatsApp</label>
                <input type="text" placeholder="0812xxxxxxx" value={nomorWhatsApp} onChange={(e) => setNomorWhatsApp(e.target.value)} />
              </div>
            </div>

            <div className="field-grid-booking cols-tanggal-jam-event">
              <div className="field">
                <label>Tanggal Acara</label>
                <CustomDatePicker value={tanggalAcara} onChange={setTanggalAcara} variant="modal" bookingDates={bookingDates} />
              </div>
              <div className="field">
                <label>Jam Mulai</label>
                <CustomTimePicker value={jamStartMakeup} onChange={setJamStartMakeup} variant="modal" />
              </div>
              <div className="field">
                <label>Event</label>
                <CustomSelect
                  options={EVENT_OPTIONS}
                  value={event}
                  onChange={setEvent}
                  variant="modal"
                />
                {event === EVENT_CUSTOM_SENTINEL && (
                  <input
                    type="text"
                    placeholder="Tulis nama event..."
                    value={eventCustom}
                    onChange={(e) => setEventCustom(e.target.value)}
                    style={{ marginTop: 8 }}
                  />
                )}
              </div>
            </div>

            <div className="field-grid-booking cols-lokasi-sumber">
              <div className="field">
                <label>Lokasi</label>
                <input type="text" placeholder="Kecamatan, Kota/Kabupaten" value={lokasi} onChange={(e) => setLokasi(e.target.value)} onBlur={(e) => setLokasi(capitalizeWords(e.target.value))} />
              </div>
              <div className="field">
                <label>Sumber Kanal Booking</label>
                <CustomSelect
                  options={['Instagram', 'WhatsApp', 'TikTok', 'Facebook', 'Referral']}
                  value={sumber}
                  onChange={setSumber}
                  variant="modal"
                />
              </div>
            </div>

            <div className="field-grid-booking cols-transport-dp-metode">  
              <div className="field">
                <label>Biaya Transport</label>
                <input type="text" inputMode="numeric" placeholder="Rp0" value={biayaTransport ? `Rp${formatAngkaInput(biayaTransport)}` : ''} onChange={(e) => setBiayaTransport(parseAngkaInput(e.target.value))} />
              </div>
              <div className="field">
                <label>DP Masuk</label>
                <input type="text" inputMode="numeric" placeholder="Rp0" value={dp ? `Rp${formatAngkaInput(dp)}` : ''} onChange={(e) => setDp(parseAngkaInput(e.target.value))} />
              </div>
              <div className="field">
              {Number(dp) > 0 && (
                <div className="field">
                  <label>Metode Pembayaran</label>
                  <CustomSelect
                    options={['Transfer Bank', 'E-Wallet', 'QRIS', 'Cash']}
                    value={dpMetode}
                    onChange={setDpMetode}
                    variant="modal"
                  />
                </div>
              )}
              </div>
            </div>

            <div className="field-grid-booking cols-catatan">
              <div className="field">
                <label>Catatan</label>
                <textarea placeholder="Opsional" value={catatan} onChange={(e) => setCatatan(e.target.value)} />
              </div>
            </div>

            <div className="section-label">KLIEN</div>
            <div>
              {pesertaList.map((p, i) => {
                return (
                  <div className="peserta-card" key={i}>
                    <div className="peserta-head">
                      <div className="peserta-title"><span className="peserta-num">{i + 1}</span>Klien {i + 1}</div>
                      {pesertaList.length > 1 && (
                        <button type="button" className="peserta-remove" onClick={() => removePeserta(i)}>Hapus</button>
                      )}
                    </div>
                    <div className="peserta-body">
                      <div className="field-grid-peserta cols-2">
                        <div className="field">
                          <label>Nama Klien</label>
                          <input type="text" placeholder="contoh: Jenny Black Pink" value={p.nama} onChange={(e) => updatePeserta(i, 'nama', e.target.value)} onBlur={(e) => updatePeserta(i, 'nama', capitalizeWords(e.target.value))} />
                          {/* Tombol quickfill SENGAJA dipindah ke BAWAH input
                              (bukan nempel di sebelah label "Nama Klien" lagi)
                              -- sebelumnya, di layar sempit (misal iPhone 15,
                              yang lebar logicalnya malah lebih SEMPIT dari
                              iPhone XR meski modelnya lebih baru), label +
                              tombol itu nggak muat sebaris, bikin teks "Nama
                              Klien" ke-pecah jadi 2 baris DAN kolom "Peran" di
                              sebelahnya ikut keganggu tata letaknya. Ditaruh di
                              bawah input, tombol ini dapet lebar PENUH 1 kolom
                              buat dirinya sendiri, nggak pernah rebutan ruang
                              horizontal sama kolom Peran lagi. */}
                          {i === 0 && namaKlien.trim() && (
                            <button
                              type="button"
                              className="quickfill-btn"
                              onClick={() => updatePeserta(0, 'nama', namaKlien.trim())}
                            >
                              Pakai nama klien utama
                            </button>
                          )}
                        </div>
                        <div className="field">
                          <label>Peran (Opsional)</label>
                          <input type="text" placeholder="contoh: Klien Utama/Wisudawati" value={p.peran} onChange={(e) => updatePeserta(i, 'peran', e.target.value)} />
                        </div>
                      </div>

                      {/* Jumlah Sesi Makeup -- buat kasus klien yang
                          SAMA di-makeup lebih dari 1x di booking yang
                          sama (misal sesi pagi & sore), tanpa perlu
                          dobelin jadi 2 baris peserta terpisah. Field
                          ini KHUSUS Biaya Makeup -- Jumlah Sesi buat
                          Layanan Tambahan (Hairdo/Hijabdo+) TERPISAH,
                          ada di section-nya sendiri di bawah, soalnya
                          2 hal ini nggak selalu sama (bisa aja makeup
                          2x tapi hairdo cuma sekali, atau sebaliknya).
                          Add On & Paket Bundling TETAP dihitung 1x apa
                          adanya, itu barang/jasa luar, bukan sesi
                          makeup. Angka Biaya Makeup TETAP harga
                          PER-SESI -- perkaliannya otomatis kejadian di
                          Invoice/Rincian Keuangan. */}
                      <div className="field-grid-peserta cols-2">
                        <div className="field">
                          <label>Jumlah Sesi Makeup</label>
                          <input
                            type="text"
                            inputMode="numeric"
                            placeholder="1"
                            value={p.jumlahSesiMakeup}
                            onChange={(e) => {
                              const digits = e.target.value.replace(/[^0-9]/g, '')
                              updatePeserta(i, 'jumlahSesiMakeup', digits === '' ? '' : Math.max(1, parseInt(digits, 10)))
                            }}
                            onBlur={(e) => { if (!e.target.value) updatePeserta(i, 'jumlahSesiMakeup', 1) }}
                          />
                        </div>
                      </div>

                      <div className="field-grid-peserta cols-2">
                        <div className="field">
                          <label>Kategori</label>
                          <CustomSelect
                            options={KATEGORI_MAKEUP_OPTIONS}
                            value={p.kategoriMakeup}
                            onChange={(v) => updatePeserta(i, 'kategoriMakeup', v)}
                            variant="modal"
                          />
                        </div>
                        <div className="field">
                          <label>Jenis Makeup</label>
                          <input type="text" placeholder="Standar/VIP/Sesuai kebutuhan masing-masing" value={p.jenisPaket} onChange={(e) => updatePeserta(i, 'jenisPaket', e.target.value)} />
                        </div>
                      </div>

                      <div className="field-grid-peserta cols-2">
                        <div className="field">
                          <label>Dikerjakan oleh</label>
                          <div className="toggle-row">
                            <div className={`toggle-opt${p.dikerjakanOlehMakeup === 'Me' ? ' sel' : ''}`} onClick={() => updatePeserta(i, 'dikerjakanOlehMakeup', 'Me')}>Me</div>
                            <div className={`toggle-opt${p.dikerjakanOlehMakeup === 'Tim' ? ' sel' : ''}`} onClick={() => updatePeserta(i, 'dikerjakanOlehMakeup', 'Tim')}>Tim</div>
                          </div>
                        </div>
                      </div>
                      <div className="field-grid-peserta cols-2">
                        <div className="field">
                          <label>Biaya Makeup</label>
                          <input type="text" inputMode="numeric" placeholder="Rp0" value={p.biayaMakeup ? `Rp${formatAngkaInput(p.biayaMakeup)}` : ''} onChange={(e) => updatePeserta(i, 'biayaMakeup', parseAngkaInput(e.target.value))} />
                        </div>
                        {p.dikerjakanOlehMakeup === 'Tim' && (
                        <div className="field">
                          <label>Komisi untuk Kamu</label>
                          <input type="text" inputMode="numeric" placeholder="Rp0" value={p.komisiMakeup ? `Rp${formatAngkaInput(p.komisiMakeup)}` : ''} onChange={(e) => updatePeserta(i, 'komisiMakeup', parseAngkaInput(e.target.value))} />
                        </div>
                        )}
                      </div>
                      {p.dikerjakanOlehMakeup === 'Tim' && (
                      <div className="field-grid-peserta cols-2">
                        <div className="field" style={{ gridColumn: 2 }}>
                          <label>Nama Tim</label>
                          <input type="text" placeholder="contoh: makeupbyjennie" value={p.namaTimMakeup} onChange={(e) => updatePeserta(i, 'namaTimMakeup', e.target.value)} />
                        </div>
                      </div>
                      )}

                      {/* Retouch -- BEDA dari Add On Item, ini JASA (sekelas
                          Makeup/Layanan Tambahan), BUKAN produk. SELALU
                          dikerjain Me (nggak ada opsi Tim/Komisi/Nama Tim
                          kayak yang lain) -- biayanya masuk PENUH ke Omzet/
                          Penghasilan, BUKAN dianggap "modal keluar" kayak
                          Add On Item (yang emang buat produk fisik). */}
                      <div className="field-grid-peserta cols-2">
                        <div className="field">
                          <label>Retouch</label>
                          <div className="toggle-row">
                            <div className={`toggle-opt${!p.retouch ? ' sel' : ''}`} onClick={() => updatePeserta(i, 'retouch', false)}>Tidak</div>
                            <div className={`toggle-opt${p.retouch ? ' sel' : ''}`} onClick={() => updatePeserta(i, 'retouch', true)}>Ya</div>
                          </div>
                        </div>
                        {p.retouch && (
                        <div className="field">
                          <label>Biaya Retouch</label>
                          <input type="text" inputMode="numeric" placeholder="Rp0" value={p.biayaRetouch ? `Rp${formatAngkaInput(p.biayaRetouch)}` : ''} onChange={(e) => updatePeserta(i, 'biayaRetouch', parseAngkaInput(e.target.value))} />
                        </div>
                        )}
                      </div>

                      <div className="form-divider"></div>

                      {/* Paket Bundling -- SEKARANG toggle TERPISAH dari
                          Kategori (bukan salah satu pilihan Kategori
                          lagi), soalnya 2 hal ini beda dimensi: Kategori
                          jawab "acara apa", Paket Bundling jawab "ada
                          vendor luar tambahan apa nggak". Klien Wedding/
                          Reguler/dst BISA juga sekalian pakai Paket
                          Bundling -- makanya harus bisa nyala bareng,
                          bukan saling gantiin. Biaya Makeup/Komisi/dkk
                          di atas TETEP jalan apa adanya, BEDA hal
                          (harga jasa vendor luar vs harga makeup MUA
                          sendiri). */}
                      <div className="field-grid-peserta cols-2">
                        <div className="field">
                          <label>Sertakan Paket Bundling?</label>
                          <div className="toggle-row">
                            <div className={`toggle-opt${!p.pakaiPaketBundling ? ' sel' : ''}`} onClick={() => updatePeserta(i, 'pakaiPaketBundling', false)}>Tidak</div>
                            <div className={`toggle-opt${p.pakaiPaketBundling ? ' sel' : ''}`} onClick={() => {
                              updatePeserta(i, 'pakaiPaketBundling', true)
                              if (p.vendors.length === 0) addVendor(i)
                            }}>Ya</div>
                          </div>
                        </div>
                      </div>

                      {p.pakaiPaketBundling && (
                      <div>
                        {p.vendors.map((v, vi) => (
                          <div key={vi}>
                            <div className="field-grid-peserta cols-2">
                              <div className="field">
                                <label>Vendor {vi + 1}</label>
                                <input type="text" placeholder="contoh: @attirebyjennie" value={v.nama} onChange={(e) => updateVendor(i, vi, 'nama', e.target.value)} />
                              </div>
                            </div>
                            <div className="field-grid-peserta cols-2">
                              <div className="field">
                                <label>Biaya Vendor {vi + 1}</label>
                                <input type="text" inputMode="numeric" placeholder="Rp0" value={v.biaya ? `Rp${formatAngkaInput(v.biaya)}` : ''} onChange={(e) => updateVendor(i, vi, 'biaya', parseAngkaInput(e.target.value))} />
                              </div>
                              <div className="field">
                                <label>Komisi untuk MUA</label>
                                <input type="text" inputMode="numeric" placeholder="Rp0" value={v.untung ? `Rp${formatAngkaInput(v.untung)}` : ''} onChange={(e) => updateVendor(i, vi, 'untung', parseAngkaInput(e.target.value))} />
                              </div>
                            </div>

                            {v.addOns.map((a, ai) => (
                              <div key={ai}>
                                <div className="addon-remove-row">
                                  <button type="button" className="peserta-remove" onClick={() => removeVendorAddOn(i, vi, ai)}>Hapus Add On {ai + 1}</button>
                                </div>
                                <div className="field-grid-bundling">
                                  <div className="field"><label>Nama Add On</label><input type="text" placeholder="contoh: Lighting" value={a.nama} onChange={(e) => updateVendorAddOn(i, vi, ai, 'nama', e.target.value)} /></div>
                                  <div className="field"><label>Biaya (Ditagih ke Klien)</label><input type="text" inputMode="numeric" placeholder="Rp0" value={a.biaya ? `Rp${formatAngkaInput(a.biaya)}` : ''} onChange={(e) => updateVendorAddOn(i, vi, ai, 'biaya', parseAngkaInput(e.target.value))} /></div>
                                  <div className="field"><label>Komisi untuk MUA</label><input type="text" inputMode="numeric" placeholder="Rp0" value={a.untung ? `Rp${formatAngkaInput(a.untung)}` : ''} onChange={(e) => updateVendorAddOn(i, vi, ai, 'untung', parseAngkaInput(e.target.value))} /></div>
                                </div>
                              </div>
                            ))}
                            <button type="button" className="add-peserta" onClick={() => addVendorAddOn(i, vi)}>+ Tambah Add On Vendor {vi + 1}</button>

                            {vi > 0 && (
                            <div className="addon-remove-row">
                              <button type="button" className="peserta-remove" onClick={() => removeVendor(i, vi)}>Hapus Vendor {vi + 1}</button>
                            </div>
                            )}
                          </div>
                        ))}
                        <button type="button" className="add-peserta" onClick={() => addVendor(i)}>+ Tambah Vendor</button>
                      </div>
                      )}

                      <div className="form-divider"></div>

                      <div className="field-grid-peserta cols-2">
                        <div className="field">
                        <div className="sb-label">Add On Layanan Rambut</div>
                          <div className="toggle-row-rambut">
                          <div className={`toggle-opt-rambut${p.layananTambahan === 'Tidak Ada' ? ' sel' : ''}`} onClick={() => updatePeserta(i, 'layananTambahan', 'Tidak Ada')}>Tidak</div>
                          <div className={`toggle-opt-rambut${p.layananTambahan === 'Hairdo' ? ' sel' : ''}`} onClick={() => updatePeserta(i, 'layananTambahan', 'Hairdo')}>Hairdo</div>
                          <div className={`toggle-opt-rambut${p.layananTambahan === 'Hijabdo+' ? ' sel' : ''}`} onClick={() => updatePeserta(i, 'layananTambahan', 'Hijabdo+')}>Hijabdo+</div>
                        </div>
                        </div>
                      
                        {p.layananTambahan !== 'Tidak Ada' && (
                        <>
                        <div className="field">
                        <div className="sb-label">Dikerjakan oleh</div>
                          <div className="toggle-row">
                          <div className={`toggle-opt${p.dikerjakanOlehTambahan === 'Me' ? ' sel' : ''}`} onClick={() => updatePeserta(i, 'dikerjakanOlehTambahan', 'Me')}>Me</div>
                          <div className={`toggle-opt${p.dikerjakanOlehTambahan === 'Tim' ? ' sel' : ''}`} onClick={() => updatePeserta(i, 'dikerjakanOlehTambahan', 'Tim')}>Tim</div>
                        </div>
                        </div>
                        </>
                        )}
                      </div>

                      {p.layananTambahan !== 'Tidak Ada' && (
                      <div className="field-grid-peserta cols-2">
                        <div className="field">
                          <label>Biaya Layanan Tambahan</label>
                          <input type="text" inputMode="numeric" placeholder="Rp0" value={p.biayaTambahan ? `Rp${formatAngkaInput(p.biayaTambahan)}` : ''} onChange={(e) => updatePeserta(i, 'biayaTambahan', parseAngkaInput(e.target.value))} />
                        </div>
                        {p.dikerjakanOlehTambahan === 'Tim' && (
                        <div className="field">
                          <label>Komisi untuk Kamu</label>
                          <input type="text" inputMode="numeric" placeholder="Rp0" value={p.komisiTambahan ? `Rp${formatAngkaInput(p.komisiTambahan)}` : ''} onChange={(e) => updatePeserta(i, 'komisiTambahan', parseAngkaInput(e.target.value))} />
                        </div>
                          )}
                      </div>
                      )}
                      {/* Jumlah Sesi buat Layanan Tambahan -- TERPISAH
                          dari Jumlah Sesi Makeup di atas. Nggak selalu
                          makeup 2x otomatis berarti hairdo-nya ikut 2x
                          juga. Disejajarin 1 baris sama Nama Tim (kalau
                          Tim), biar nggak makan baris sendiri-sendiri. */}
                      {p.layananTambahan !== 'Tidak Ada' && (
                      <div className="field-grid-peserta cols-2">
                        <div className="field">
                          <label>Jumlah Sesi</label>
                          <input
                            type="text"
                            inputMode="numeric"
                            placeholder="1"
                            value={p.jumlahSesiTambahan}
                            onChange={(e) => {
                              const digits = e.target.value.replace(/[^0-9]/g, '')
                              updatePeserta(i, 'jumlahSesiTambahan', digits === '' ? '' : Math.max(1, parseInt(digits, 10)))
                            }}
                            onBlur={(e) => { if (!e.target.value) updatePeserta(i, 'jumlahSesiTambahan', 1) }}
                          />
                        </div>
                        {p.dikerjakanOlehTambahan === 'Tim' && (
                        <div className="field">
                          <label>Nama Tim</label>
                          <input type="text" placeholder="contoh: hairdobycarmen" value={p.namaTimTambahan} onChange={(e) => updatePeserta(i, 'namaTimTambahan', e.target.value)} />
                        </div>
                        )}
                      </div>
                      )}

                      <div className="form-divider"></div>

                      {/* Add On Item (Sewa) -- section TERPISAH dari Add On
                          Item biasa (di bawah), konsepnya mirip Paket
                          Bundling (sewa dari pihak luar) tapi nggak perlu
                          ikut mekanisme bundling penuh -- buat kasus
                          kondisional (misal sewa Kebaya buat ibu pengantin,
                          di luar paket bundling manapun). Toggle Tidak/Ya
                          nge-gate slotnya, defaultnya Tidak. Rumus
                          hitungannya numpang Paket Bundling (biaya penuh
                          masuk Belanja Klien, UNTUNG doang yang masuk
                          Omzet/Penghasilan -- lihat migrasi SQL + Rincian
                          Keuangan). */}
                      <div className="field-grid-peserta cols-2">
                        <div className="field">
                          <label>Add On Item (Sewa)</label>
                          <div className="toggle-row">
                            <div className={`toggle-opt${!p.adaSewa ? ' sel' : ''}`} onClick={() => updatePeserta(i, 'adaSewa', false)}>Tidak</div>
                            <div className={`toggle-opt${p.adaSewa ? ' sel' : ''}`} onClick={() => updatePeserta(i, 'adaSewa', true)}>Ya</div>
                          </div>
                        </div>
                      </div>

                      {p.adaSewa && p.sewaLainnya.map((s, si) => (
                        <div key={si}>
                          {si > 0 && (
                            <div className="addon-remove-row">
                              <button type="button" className="peserta-remove" onClick={() => removeSewa(i, si)}>Hapus Add On Item (Sewa) {si + 1}</button>
                            </div>
                          )}
                          <div className="field-grid-peserta cols-2">
                            <div className="field">
                              <label>{si === 0 ? 'Nama Produk' : `Nama Produk ${si + 1}`}</label>
                              <input type="text" placeholder="contoh: Kebaya/Baju Beskap/lainnya" value={s.nama} onChange={(e) => updateSewa(i, si, 'nama', e.target.value)} />
                            </div>
                            {s.nama.trim() && (
                              <div className="field">
                                <label>Biaya (Ditagih ke Klien)</label>
                                <input type="text" inputMode="numeric" placeholder="Rp0" value={s.biaya ? `Rp${formatAngkaInput(s.biaya)}` : ''} onChange={(e) => updateSewa(i, si, 'biaya', parseAngkaInput(e.target.value))} />
                              </div>
                            )}
                          </div>
                          {s.nama.trim() && (
                            <div className="field-grid-peserta cols-2">
                              <div className="field">
                                <label>Jumlah</label>
                                <input
                                  type="text"
                                  inputMode="numeric"
                                  placeholder="1"
                                  value={s.jumlah}
                                  onChange={(e) => {
                                    const digits = e.target.value.replace(/[^0-9]/g, '')
                                    updateSewa(i, si, 'jumlah', digits === '' ? '' : Math.max(1, parseInt(digits, 10)))
                                  }}
                                  onBlur={(e) => { if (!e.target.value) updateSewa(i, si, 'jumlah', 1) }}
                                />
                              </div>
                              <div className="field">
                                <label>Untung (per Item)</label>
                                <input type="text" inputMode="numeric" placeholder="Rp0" value={s.untung ? `Rp${formatAngkaInput(s.untung)}` : ''} onChange={(e) => updateSewa(i, si, 'untung', parseAngkaInput(e.target.value))} />
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                      {p.adaSewa && p.sewaLainnya.length < 5 && (
                        <button type="button" className="add-peserta" onClick={() => addSewa(i)}>+ Tambah Add On Item (Sewa)</button>
                      )}

                      <div className="form-divider"></div>

                      {/* Add On Item (Beli) -- SEKARANG dikasih toggle
                          Tidak/Ya juga, sama pola persis kayak Add On
                          Item (Sewa) di atas. Maks 5 slot, cuma slot
                          pertama yang keliatan dari awal -- slot ke-2
                          dst nongol lewat tombol "+ Tambah Add On Item
                          (Beli)", dan bisa dihapus lagi (slot pertama
                          nggak bisa dihapus). */}
                      <div className="field-grid-peserta cols-2">
                        <div className="field">
                          <label>Add On Item (Beli)</label>
                          <div className="toggle-row">
                            <div className={`toggle-opt${!p.adaAddOn ? ' sel' : ''}`} onClick={() => updatePeserta(i, 'adaAddOn', false)}>Tidak</div>
                            <div className={`toggle-opt${p.adaAddOn ? ' sel' : ''}`} onClick={() => updatePeserta(i, 'adaAddOn', true)}>Ya</div>
                          </div>
                        </div>
                      </div>

                      {p.adaAddOn && p.addOnLainnya.map((a, ai) => (
                        <div key={ai}>
                          {/* Hapus di baris sendiri, di ATAS pasangan field --
                              sama persis alasannya kayak fix di
                              BookingDetailModal.jsx: biar kolom "Nama Produk"
                              & "Harga (Ditagih ke Klien)" SELALU sejajar, nggak
                              ketarik turun gara-gara tombol Hapus kepaksa
                              wrap ke baris baru di layar sempit. */}
                          {ai > 0 && (
                            <div className="addon-remove-row">
                              <button type="button" className="peserta-remove" onClick={() => removeAddOn(i, ai)}>Hapus Add On Item (Beli) {ai + 1}</button>
                            </div>
                          )}
                          <div className="field-grid-peserta cols-2">
                            <div className="field">
                              <label>{ai === 0 ? 'Nama Produk' : `Nama Produk ${ai + 1}`}</label>
                              <input type="text" placeholder="contoh: Softlens/Kuku Palsu/Melati/lainnya" value={a.nama} onChange={(e) => updateAddOn(i, ai, 'nama', e.target.value)} />
                            </div>
                            {a.nama.trim() && (
                              <div className="field">
                                <label>Harga (Ditagih ke Klien)</label>
                                <input type="text" inputMode="numeric" placeholder="Rp0" value={a.biaya ? `Rp${formatAngkaInput(a.biaya)}` : ''} onChange={(e) => updateAddOn(i, ai, 'biaya', parseAngkaInput(e.target.value))} />
                              </div>
                            )}
                          </div>
                          {/* Jumlah & Untung digabung 1 baris -- Jumlah di
                              kiri, Untung (per Item) di kanan. Biaya &
                              Untung yang diisi itu harga PER-UNIT,
                              dikaliin otomatis di Invoice/Rincian
                              Keuangan. */}
                          {a.nama.trim() && (
                            <div className="field-grid-peserta cols-2">
                              <div className="field">
                                <label>Jumlah</label>
                                <input
                                  type="text"
                                  inputMode="numeric"
                                  placeholder="1"
                                  value={a.jumlah}
                                  onChange={(e) => {
                                    const digits = e.target.value.replace(/[^0-9]/g, '')
                                    updateAddOn(i, ai, 'jumlah', digits === '' ? '' : Math.max(1, parseInt(digits, 10)))
                                  }}
                                  onBlur={(e) => { if (!e.target.value) updateAddOn(i, ai, 'jumlah', 1) }}
                                />
                              </div>
                              <div className="field">
                                <label>Untung (per Item)</label>
                                <input type="text" inputMode="numeric" placeholder="Rp0" value={a.keuntungan ? `Rp${formatAngkaInput(a.keuntungan)}` : ''} onChange={(e) => updateAddOn(i, ai, 'keuntungan', parseAngkaInput(e.target.value))} />
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                      {p.adaAddOn && p.addOnLainnya.length < 5 && (
                        <button type="button" className="add-peserta" onClick={() => addAddOn(i)}>+ Tambah Add On Item (Beli)</button>
                      )}
                    </div>
                  </div>
                )
              })}
              <button type="button" className="add-peserta" onClick={addPeserta}>+ Tambah Klien</button>
            </div>
          </div>

          <div className="modal-foot">
            <button type="button" className="btn-ghost" onClick={onClose}>Batal</button>
            <button type="submit" className="btn-primary-booking" disabled={saving}>
              {saving ? 'Menyimpan...' : 'Simpan Booking'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
