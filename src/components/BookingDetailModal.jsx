import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import CustomSelect from './CustomSelect'
import CustomDatePicker from './CustomDatePicker'
import CustomTimePicker from './CustomTimePicker'
import { EVENT_OPTIONS, EVENT_CUSTOM_SENTINEL, KATEGORI_MAKEUP_OPTIONS } from '../lib/constants'
import { cariAtauBuatKlien } from '../lib/klien'
import { formatAngkaInput, parseAngkaInput } from '../lib/format'
import './BookingModal.css'
// SENGAJA ditaruh SEBELUM import komponen anak (InvoiceModal,
// RincianKeuanganModal) di bawah ini -- urutan `import` di JS nentuin
// urutan CSS digabung pas di-build. InvoiceModal & RincianKeuanganModal
// dirender NESTED di dalam DOM modal ini (lihat bagian bawah file),
// jadi elemen `.modal` punya mereka SAMA-SAMA kena aturan
// `.booking-detail-overlay .modal` di sini (spesifisitasnya sama-sama
// 2 class). Kalau CSS file ini ke-load BELAKANGAN (kayak sebelumnya),
// dia yang "menang" pas ada rebutan -- nge-timpa lebar modal Invoice/
// Rincian Keuangan yang seharusnya beda. Dengan diperduluin di sini,
// giliran CSS Invoice/RincianKeuangan (yang di-import setelahnya)
// yang ke-load belakangan & menang buat elemen mereka sendiri.
import './BookingDetailModal.css'
import InvoiceModal from './InvoiceModal'
import RincianKeuanganModal from './RincianKeuanganModal'

function formatRupiah(n) {
  const num = Number(n) || 0
  const sign = num < 0 ? '-' : ''
  return sign + 'Rp' + Math.abs(num).toLocaleString('id-ID')
}

// Sama persis logikanya kayak di Kalender.jsx/BookingList.jsx -- booking
// dianggap "selesai" kalau tanggalnya udah lewat, ATAU hari ini tapi
// udah lewat 3 jam dari jam mulai makeup. Dipakai buat nentuin warna
// avatar di list Klien (b-avatar.selesai).
function isSelesai(dateStr, jamStartMakeup) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const target = new Date(dateStr)
  target.setHours(0, 0, 0, 0)

  if (target < today) return true
  if (target > today) return false

  if (!jamStartMakeup) return false
  const [jam, menit] = jamStartMakeup.split(':').map(Number)
  const mulai = new Date(dateStr)
  mulai.setHours(jam, menit || 0, 0, 0)
  return (new Date() - mulai) / 3600000 >= 3
}

// Sama persis kayak di BookingModal.jsx -- cuma nyentuh huruf PERTAMA tiap
// kata, biar singkatan yang ditulis kapital sengaja (misal "UMS") nggak
// keubah.
function capitalizeWords(str) {
  return (str || '').replace(/(^|[\s,])([a-z])/g, (_, sep, ch) => sep + ch.toUpperCase())
}
// Ngitung berapa slot Add On Item yang KEISI dari data lama (buat nentuin
// berapa slot yang perlu ditampilin pas pertama kali masuk mode edit --
// minimal 1, maksimal 5).
function countAddOnSlots(p) {
  let count = 1
  for (let n = 5; n >= 2; n--) {
    const nama = p[`layanan_lainnya_${n}`]
    const biaya = p[`biaya_lainnya_${n}`]
    if ((nama && nama.trim()) || Number(biaya) > 0) { count = n; break }
  }
  return count
}
function formatTanggal(dateStr) {
  if (!dateStr) return '-'
  return new Date(dateStr).toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' })
}

export default function BookingDetailModal({ booking, onClose, onChanged }) {
  const { user } = useAuth()

  const [peserta, setPeserta] = useState([])
  const [payments, setPayments] = useState([])
  const [bundlingItems, setBundlingItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [editMode, setEditMode] = useState(false)
  const [showInvoice, setShowInvoice] = useState(false)
  const [showRincian, setShowRincian] = useState(false)
  const [confirmDeleteBooking, setConfirmDeleteBooking] = useState(false)
  const [confirmDeletePaymentId, setConfirmDeletePaymentId] = useState(null)
  const [saving, setSaving] = useState(false)
  const [bookingDates, setBookingDates] = useState([])

  // Sama persis pola & alasannya kayak di BookingModal.jsx -- dipakai
  // CustomDatePicker buat nampilin indikator kepadatan di field "Tanggal
  // Acara" versi edit ini juga.
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

  // form state buat mode edit
  const [tanggalBooking, setTanggalBooking] = useState('')
  const [namaKlien, setNamaKlien] = useState('')
  const [nomorWhatsApp, setNomorWhatsApp] = useState('')
  const [sumber, setSumber] = useState('')
  const [tanggalAcara, setTanggalAcara] = useState('')
  const [jamStartMakeup, setJamStartMakeup] = useState('')
  const [lokasi, setLokasi] = useState('')
  const [event, setEvent] = useState('')
  const [eventCustom, setEventCustom] = useState('')
  const [biayaTransport, setBiayaTransport] = useState('')
  const [catatan, setCatatan] = useState('')
  const [editPeserta, setEditPeserta] = useState([])
  const [removedPesertaIds, setRemovedPesertaIds] = useState([])

  // form pembayaran baru
  const [showAddPayment, setShowAddPayment] = useState(false)
  const [payAmount, setPayAmount] = useState('')
  const [payMethod, setPayMethod] = useState('Transfer Bank')
  const [payDate, setPayDate] = useState(new Date().toISOString().slice(0, 10))
  const [payNote, setPayNote] = useState('')

  // Vendor Paket Bundling SEKARANG nempel di dalam editPeserta[i].vendors
  // (bukan state sendiri lagi kayak sebelumnya) -- disimpen nested,
  // konsisten sama pola Add On Lainnya. removedVendorIds nampung id
  // vendor/add-on yang di-hapus dari form (baris yang UDAH ADA di
  // database), biar ke-delete beneran pas Simpan Booking -- sama pola
  // persis kayak removedPesertaIds di atas.
  const [removedVendorIds, setRemovedVendorIds] = useState([])

  // edit pembayaran yang udah ada
  const [editingPaymentId, setEditingPaymentId] = useState(null)
  const [editPayAmount, setEditPayAmount] = useState('')
  const [editPayMethod, setEditPayMethod] = useState('')
  const [editPayDate, setEditPayDate] = useState('')
  const [editPayNote, setEditPayNote] = useState('')

  // `booking` (prop dari halaman induk) itu cuma "foto" sekali pas modal ini
  // pertama dibuka -- nggak otomatis ke-update walau kita udah nyimpen
  // perubahan peserta/pembayaran di sini. `liveBooking` ini yang jadi sumber
  // data buat ditampilin di mode lihat, di-refresh ulang dari database
  // (bukan dihitung sendiri di frontend) tiap kali loadDetail() jalan --
  // biar angkanya PASTI sama kayak yang muncul di tabel Booking di luar.
  const [liveBooking, setLiveBooking] = useState(booking)

  // SENGAJA cuma react ke `booking.id` -- `loadDetail` sendiri nggak
  // dimasukin ke dependency array, soalnya dia "dilahirkan ulang" tiap
  // render (bukan di-wrap useCallback); kalau dimasukin, efek ini bakal
  // ke-trigger ulang TIAP render (bukan cuma pas ganti booking beneran),
  // bikin fetch data berkali-kali nggak perlu.
  useEffect(() => {
    loadDetail()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [booking.id])

  async function loadDetail() {
    setLoading(true)
    setError('')

    const [{ data: pesertaData, error: pesertaErr }, { data: paymentData, error: paymentErr }, { data: bundlingData, error: bundlingErr }, { data: bookingData, error: bookingErr }] = await Promise.all([
      supabase.from('peserta').select('*').eq('booking_id', booking.id).order('urutan'),
      supabase.from('payments').select('*').eq('booking_id', booking.id).order('tanggal', { ascending: false }),
      supabase.from('bundling_items').select('*').eq('booking_id', booking.id).order('created_at'),
      supabase.from('booking_summary').select('*').eq('id', booking.id).single(),
    ])

    if (pesertaErr || paymentErr || bundlingErr) {
      setError((pesertaErr || paymentErr || bundlingErr).message)
    } else {
      setPeserta(pesertaData || [])
      setPayments(paymentData || [])
      setBundlingItems(bundlingData || [])
      if (!bookingErr && bookingData) setLiveBooking(bookingData)
    }
    setLoading(false)
  }

  function enterEditMode() {
    setConfirmDeleteBooking(false)
    setTanggalBooking(liveBooking.tanggal_booking || '')
    setNamaKlien(liveBooking.nama_klien || '')
    setNomorWhatsApp(liveBooking.nomor_whatsapp || '')
    setSumber(liveBooking.sumber || 'Instagram')
    setTanggalAcara(liveBooking.tanggal_acara || '')
    setJamStartMakeup(liveBooking.jam_start_makeup || '')
    setLokasi(liveBooking.lokasi || '')
    if (EVENT_OPTIONS.includes(liveBooking.event)) {
      setEvent(liveBooking.event)
      setEventCustom('')
    } else {
      setEvent(EVENT_CUSTOM_SENTINEL)
      setEventCustom(liveBooking.event || '')
    }
    setBiayaTransport(liveBooking.biaya_transport ?? '')
    setCatatan(liveBooking.catatan || '')
    // Vendor yang UDAH ADA (dari bundlingItems, di-filter per peserta_id
    // masing-masing klien) dimuat jadi array "vendors" nested di tiap
    // baris editPeserta -- format-nya PERSIS sama kayak yang dipake
    // BookingModal.jsx buat booking baru, cuma di sini isinya udah keisi
    // dari data lama. "id" tiap vendor/add-on ikut dibawa biar nanti pas
    // Simpan Booking ketauan mana yang UPDATE vs INSERT baru.
    setEditPeserta(peserta.map((p) => ({
      ...p,
      _addonCount: countAddOnSlots(p),
      vendors: bundlingItems.filter((b) => b.peserta_id === p.id && !b.parent_id).map((v) => ({
        id: v.id,
        nama: v.nama,
        biaya: v.biaya,
        untung: v.keuntungan,
        addOns: bundlingItems.filter((c) => c.parent_id === v.id).map((c) => ({
          id: c.id, nama: c.nama, biaya: c.biaya, untung: c.keuntungan,
        })),
      })),
    })))
    setRemovedPesertaIds([])
    setRemovedVendorIds([])
    setEditMode(true)
  }

  function updateEditPeserta(i, field, value) {
    setEditPeserta((list) => list.map((p, idx) => {
      if (idx !== i) return p
      const updated = { ...p, [field]: value }
      // Field addon namanya "layanan_lainnya" (slot 1) atau
      // "layanan_lainnya_N" (slot 2-5) -- begitu salah satu dikosongin,
      // pasangan biaya & keuntungannya (suffix yang sama) langsung
      // ke-reset juga di form, bukan cuma pas nyimpen doang. Nutup bug
      // nyata: user hapus nama tapi field biaya-nya nyangkut diem-diem
      // masih kehitung ke Total Tagihan.
      if (field.startsWith('layanan_lainnya') && !value.trim()) {
        const suffix = field.replace('layanan_lainnya', '')
        updated[`biaya_lainnya${suffix}`] = 0
        updated[`keuntungan_lainnya${suffix}`] = 0
      }
      // Sama persis alasannya kayak Add On di atas -- begitu di-toggle
      // BALIK ke "Me", Komisi & Nama Tim langsung ke-reset di form-nya
      // juga, biar nggak ada data nyangkut diem-diem nempel ke baris
      // yang harusnya Me.
      if (field === 'dikerjakan_oleh_makeup' && value === 'Me') {
        updated.komisi_makeup_tim = 0
        updated.nama_tim_makeup = ''
      }
      if (field === 'dikerjakan_oleh_tambahan' && value === 'Me') {
        updated.komisi_tambahan = 0
        updated.nama_tim_tambahan = ''
      }
      // Toggle "Sertakan Paket Bundling?" dimatiin -> vendor yang udah
      // sempet keisi ikut ke-reset juga, biar nggak nyangkut diem-diem.
      // Vendor yang UDAH ADA di database (punya .id) dicatat dulu ke
      // removedVendorIds biar beneran ke-delete pas Simpan Booking.
      if (field === 'pakai_paket_bundling' && value === false) {
        const idsToRemove = (p.vendors || []).filter((v) => v.id).map((v) => v.id)
        if (idsToRemove.length > 0) setRemovedVendorIds((ids) => [...ids, ...idsToRemove])
        updated.vendors = []
      }
      return updated
    }))
  }
  function addVendor(pesertaIdx) {
    setEditPeserta((list) => list.map((p, idx) => (idx === pesertaIdx ? { ...p, vendors: [...(p.vendors || []), { nama: '', biaya: '', untung: '', addOns: [] }] } : p)))
  }
  function updateVendor(pesertaIdx, vendorIdx, field, value) {
    setEditPeserta((list) => list.map((p, idx) => {
      if (idx !== pesertaIdx) return p
      return { ...p, vendors: p.vendors.map((v, vi) => (vi === vendorIdx ? { ...v, [field]: value } : v)) }
    }))
  }
  function removeVendor(pesertaIdx, vendorIdx) {
    setEditPeserta((list) => list.map((p, idx) => {
      if (idx !== pesertaIdx) return p
      const v = p.vendors[vendorIdx]
      if (v?.id) setRemovedVendorIds((ids) => [...ids, v.id])
      return { ...p, vendors: p.vendors.filter((_, vi) => vi !== vendorIdx) }
    }))
  }
  function addVendorAddOn(pesertaIdx, vendorIdx) {
    setEditPeserta((list) => list.map((p, idx) => {
      if (idx !== pesertaIdx) return p
      return { ...p, vendors: p.vendors.map((v, vi) => (vi === vendorIdx ? { ...v, addOns: [...v.addOns, { nama: '', biaya: '', untung: '' }] } : v)) }
    }))
  }
  function updateVendorAddOn(pesertaIdx, vendorIdx, addOnIdx, field, value) {
    setEditPeserta((list) => list.map((p, idx) => {
      if (idx !== pesertaIdx) return p
      return { ...p, vendors: p.vendors.map((v, vi) => {
        if (vi !== vendorIdx) return v
        return { ...v, addOns: v.addOns.map((a, ai) => (ai === addOnIdx ? { ...a, [field]: value } : a)) }
      }) }
    }))
  }
  function removeVendorAddOn(pesertaIdx, vendorIdx, addOnIdx) {
    setEditPeserta((list) => list.map((p, idx) => {
      if (idx !== pesertaIdx) return p
      return { ...p, vendors: p.vendors.map((v, vi) => {
        if (vi !== vendorIdx) return v
        const a = v.addOns[addOnIdx]
        if (a?.id) setRemovedVendorIds((ids) => [...ids, a.id])
        return { ...v, addOns: v.addOns.filter((_, ai) => ai !== addOnIdx) }
      }) }
    }))
  }
  function addEditPeserta() {
    setEditPeserta((list) => [...list, {
      nama_anggota: '', peran: '', kategori_makeup: 'Regular', jenis_paket: '', dikerjakan_oleh_makeup: 'Me',
      pakai_paket_bundling: false,
      biaya_makeup: 0, komisi_makeup_tim: 0, nama_tim_makeup: '', layanan_tambahan: 'Tidak Ada',
      dikerjakan_oleh_tambahan: 'Me', biaya_tambahan: 0, komisi_tambahan: 0, nama_tim_tambahan: '',
      layanan_lainnya: '', biaya_lainnya: 0, keuntungan_lainnya: 0,
      layanan_lainnya_2: '', biaya_lainnya_2: 0, keuntungan_lainnya_2: 0,
      layanan_lainnya_3: '', biaya_lainnya_3: 0, keuntungan_lainnya_3: 0,
      layanan_lainnya_4: '', biaya_lainnya_4: 0, keuntungan_lainnya_4: 0,
      layanan_lainnya_5: '', biaya_lainnya_5: 0, keuntungan_lainnya_5: 0,
      vendors: [],
      _addonCount: 1,
    }])
  }
  function addAddOnSlot(i) {
    setEditPeserta((list) => list.map((p, idx) => (idx === i && p._addonCount < 5) ? { ...p, _addonCount: p._addonCount + 1 } : p))
  }
  // Slot dihapus SELALU dari yang PALING BELAKANG (bukan slot manapun
  // dipilih) -- soalnya field-nya nempel di kolom bernomor tetap
  // (layanan_lainnya_2, _3, dst), jadi ngehapus slot tengah butuh geser
  // semua field setelahnya, lebih ribet & rawan salah dibanding cuma
  // ngosongin slot terakhir yang lagi keliatan.
  function removeAddOnSlot(i) {
    setEditPeserta((list) => list.map((p, idx) => {
      if (idx !== i || p._addonCount <= 1) return p
      const n = p._addonCount
      const suffix = n === 1 ? '' : `_${n}`
      return { ...p, _addonCount: n - 1, [`layanan_lainnya${suffix}`]: '', [`biaya_lainnya${suffix}`]: 0, [`keuntungan_lainnya${suffix}`]: 0 }
    }))
  }
  function removeEditPeserta(i) {
    if (i === 0) return // Klien 1 nggak boleh dihapus -- dia yang jadi "Nama Klien" utama di form atas
    const p = editPeserta[i]
    if (p.id) setRemovedPesertaIds((ids) => [...ids, p.id])
    setEditPeserta((list) => list.filter((_, idx) => idx !== i))
  }

  async function handleSaveEdit() {
    setSaving(true)
    setError('')

    let klienId
    try {
      klienId = await cariAtauBuatKlien(user.id, namaKlien, nomorWhatsApp)
    } catch (klienErr) {
      setSaving(false)
      setError('Gagal memproses data klien: ' + klienErr.message)
      return
    }

    const { error: updateErr } = await supabase
      .from('bookings')
      .update({
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
      .eq('id', booking.id)

    if (updateErr) {
      setSaving(false)
      setError(updateErr.message)
      return
    }

    if (removedPesertaIds.length > 0) {
      const { error: delErr } = await supabase.from('peserta').delete().in('id', removedPesertaIds)
      if (delErr) { setSaving(false); setError(delErr.message); return }
    }
    // Vendor/add-on yang di-hapus dari form (baris yang UDAH ADA di
    // database) di-delete beneran di sini. bundling_items yang nempel ke
    // peserta yang barusan ke-hapus di atas juga OTOMATIS ikut kehapus
    // (ON DELETE CASCADE lewat peserta_id), jadi nggak perlu dicatat
    // manual ke removedVendorIds.
    if (removedVendorIds.length > 0) {
      const { error: delVendorErr } = await supabase.from('bundling_items').delete().in('id', removedVendorIds)
      if (delVendorErr) { setSaving(false); setError(delVendorErr.message); return }
    }

    for (const [i, p] of editPeserta.entries()) {
      const payload = {
        // "urutan" ditulis ulang dari POSISI ASLI di array ini setiap
        // kali disimpan -- jadi tampilan (baik di sini maupun di
        // Invoice) selalu sinkron persis sama urutan yang keliatan di
        // form ini, apapun yang terjadi ke baris lain. Lihat penjelasan
        // lengkap kenapa ini perlu di BookingModal.jsx.
        urutan: i,
        nama_anggota: p.nama_anggota?.trim() || '',
        peran: p.peran?.trim() || '',
        jenis_paket: (p.jenis_paket || '').trim(),
        kategori_makeup: p.kategori_makeup,
        pakai_paket_bundling: !!p.pakai_paket_bundling,
        dikerjakan_oleh_makeup: p.dikerjakan_oleh_makeup,
        biaya_makeup: Number(p.biaya_makeup) || 0,
        // Komisi & Nama Tim CUMA berlaku kalau beneran dikerjain Tim --
        // apapun yang kebetulan masih nyangkut di field itu, dipaksa
        // kosong/0 kalau statusnya "Me". Nutup bug LAMA yang udah ada
        // dari dulu (komisi nggak pernah di-cek gini) sekalian nyegah
        // Nama Tim yang baru kena masalah sama.
        komisi_makeup_tim: p.dikerjakan_oleh_makeup === 'Tim' ? (Number(p.komisi_makeup_tim) || 0) : 0,
        nama_tim_makeup: p.dikerjakan_oleh_makeup === 'Tim' ? ((p.nama_tim_makeup || '').trim() || null) : null,
        layanan_tambahan: p.layanan_tambahan,
        dikerjakan_oleh_tambahan: p.dikerjakan_oleh_tambahan,
        biaya_tambahan: Number(p.biaya_tambahan) || 0,
        komisi_tambahan: p.dikerjakan_oleh_tambahan === 'Tim' ? (Number(p.komisi_tambahan) || 0) : 0,
        nama_tim_tambahan: p.dikerjakan_oleh_tambahan === 'Tim' ? ((p.nama_tim_tambahan || '').trim() || null) : null,
      }
      for (let n = 1; n <= 5; n++) {
        const suffix = n === 1 ? '' : `_${n}`
        const namaAddOn = (p[`layanan_lainnya${suffix}`] || '').trim()
        // Kalau nama add-on kosong, biaya & keuntungan-nya WAJIB ikut
        // dianggap kosong -- apapun angka yang kebetulan masih nyangkut
        // di field itu (misal user hapus nama tapi lupa/nggak ngeh field
        // biaya-nya nggak ikut ke-reset), nggak boleh diem-diem numpang
        // ikut masuk ke Total Tagihan. Ini nutup bug nyata yang pernah
        // beneran kejadian.
        payload[`layanan_lainnya${suffix}`] = namaAddOn || null
        payload[`biaya_lainnya${suffix}`] = namaAddOn ? (Number(p[`biaya_lainnya${suffix}`]) || 0) : 0
        payload[`keuntungan_lainnya${suffix}`] = namaAddOn ? (Number(p[`keuntungan_lainnya${suffix}`]) || 0) : 0
      }
      let pesertaId = p.id
      if (p.id) {
        const { error: upErr } = await supabase.from('peserta').update(payload).eq('id', p.id)
        if (upErr) { setSaving(false); setError(upErr.message); return }
      } else {
        // .select() WAJIB di sini (beda sama sebelumnya) -- ID klien
        // baru ini dibutuhin buat nyambungin vendor Paket Bundling-nya
        // di bawah, lewat peserta_id.
        const { data: insertedP, error: insErr } = await supabase.from('peserta').insert({ ...payload, booking_id: booking.id, user_id: user.id }).select().single()
        if (insErr) { setSaving(false); setError(insErr.message); return }
        pesertaId = insertedP.id
      }

      // Sync Vendor Paket Bundling klien ini -- baris yang UDAH ADA
      // id-nya (dari database) di-UPDATE, yang belum di-INSERT baru,
      // dapet id-nya buat nyambungin add on di dalamnya lewat parent_id.
      const filledVendors = (p.vendors || []).filter((v) => v.nama.trim())
      for (const v of filledVendors) {
        const vendorPayload = {
          booking_id: booking.id,
          user_id: user.id,
          peserta_id: pesertaId,
          nama: v.nama.trim(),
          biaya: Number(v.biaya) || 0,
          keuntungan: Number(v.untung) || 0,
        }
        let vendorId = v.id
        if (v.id) {
          const { error: vUpErr } = await supabase.from('bundling_items').update(vendorPayload).eq('id', v.id)
          if (vUpErr) { setSaving(false); setError(vUpErr.message); return }
        } else {
          const { data: insertedV, error: vInsErr } = await supabase.from('bundling_items').insert(vendorPayload).select().single()
          if (vInsErr) { setSaving(false); setError(vInsErr.message); return }
          vendorId = insertedV.id
        }

        const filledAddOns = (v.addOns || []).filter((a) => a.nama.trim())
        for (const a of filledAddOns) {
          const addOnPayload = {
            booking_id: booking.id,
            user_id: user.id,
            peserta_id: pesertaId,
            parent_id: vendorId,
            nama: a.nama.trim(),
            biaya: Number(a.biaya) || 0,
            keuntungan: Number(a.untung) || 0,
          }
          if (a.id) {
            const { error: aUpErr } = await supabase.from('bundling_items').update(addOnPayload).eq('id', a.id)
            if (aUpErr) { setSaving(false); setError(aUpErr.message); return }
          } else {
            const { error: aInsErr } = await supabase.from('bundling_items').insert(addOnPayload)
            if (aInsErr) { setSaving(false); setError(aInsErr.message); return }
          }
        }
      }
    }

    setSaving(false)
    setEditMode(false)
    await loadDetail()
    onChanged()
  }

  function startEditPayment(p) {
    setEditingPaymentId(p.id)
    setEditPayAmount(p.jumlah)
    setEditPayMethod(p.metode || 'Transfer Bank')
    setEditPayDate(p.tanggal)
    setEditPayNote(p.catatan || '')
  }

  async function handleSaveEditPayment(paymentId) {
    if (!editPayAmount || Number(editPayAmount) <= 0) { setError('Jumlah pembayaran harus lebih dari 0.'); return }
    setSaving(true)
    setError('')
    const { error: err } = await supabase
      .from('payments')
      .update({ jumlah: Number(editPayAmount), metode: editPayMethod, tanggal: editPayDate, catatan: editPayNote.trim() })
      .eq('id', paymentId)
    setSaving(false)
    if (err) { setError(err.message); return }
    setEditingPaymentId(null)
    await loadDetail()
    onChanged()
  }

  async function handleDeletePayment(paymentId) {
    setSaving(true)
    setError('')
    const { error: err } = await supabase.from('payments').delete().eq('id', paymentId)
    setSaving(false)
    setConfirmDeletePaymentId(null)
    if (err) { setError(err.message); return }
    await loadDetail()
    onChanged()
  }

  async function handleDeleteBooking() {
    setSaving(true)
    setError('')
    // peserta, payments, & bundling_items punya "on delete cascade" ke
    // booking_id, jadi ikut kehapus otomatis begitu baris booking-nya
    // dihapus.
    const { error: err } = await supabase.from('bookings').delete().eq('id', booking.id)
    setSaving(false)
    if (err) { setError(err.message); return }
    onChanged()
    onClose()
  }

  async function handleAddPayment(e) {
    e.preventDefault()
    if (!payAmount || Number(payAmount) <= 0) { setError('Jumlah pembayaran harus lebih dari 0.'); return }

    setSaving(true)
    setError('')
    const { error: payErr } = await supabase.from('payments').insert({
      booking_id: booking.id,
      user_id: user.id,
      tanggal: payDate,
      jumlah: Number(payAmount),
      metode: payMethod,
      catatan: payNote.trim(),
    })
    setSaving(false)

    if (payErr) { setError(payErr.message); return }

    setShowAddPayment(false)
    setPayAmount(''); setPayNote('')
    await loadDetail()
    onChanged()
  }

  const sisa = (liveBooking.belanja_klien || 0) - payments.reduce((s, p) => s + Number(p.jumlah), 0)

  return (
    <div className="modal-overlay booking-detail-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="modal">
        <div className="modal-head">
          <h2>{editMode ? 'Edit Booking' : liveBooking.nama_klien}</h2>
          <button className="modal-close" onClick={onClose} type="button">&times;</button>
        </div>

        <div className="modal-body">
          {error && <div className="modal-error">{error}</div>}
          {loading && <div className="empty-state">Memuat detail...</div>}

          {!loading && !editMode && (
            <>
              <div className="detail-header">
                <span className={`status-pill ${liveBooking.status_pembayaran === 'Lunas' ? 'lunas' : 'belum'}`}>
                  {liveBooking.status_pembayaran}
                </span>
                <div className="detail-actions">
                  <button className="btn-ghost" onClick={() => setShowRincian(true)}>Rincian Keuangan</button>
                  <button className="btn-ghost" onClick={() => setShowInvoice(true)}>Invoice</button>
                  <button className="btn-ghost" onClick={enterEditMode}>Edit Booking</button>
                </div>
              </div>

              <div className="detail-grid">
                <div><span className="detail-label">Event</span><div>{liveBooking.event}</div></div>
                <div><span className="detail-label">Tanggal Acara</span><div>{formatTanggal(liveBooking.tanggal_acara)}</div></div>
                <div><span className="detail-label">Jam Mulai</span><div>{liveBooking.jam_start_makeup ? liveBooking.jam_start_makeup.slice(0, 5) : '-'}</div></div>
                <div><span className="detail-label">Lokasi</span><div>{liveBooking.lokasi || '-'}</div></div>
                <div><span className="detail-label">Nomor WhatsApp</span><div>{liveBooking.nomor_whatsapp || '-'}</div></div>
                <div><span className="detail-label">Sumber Kanal Booking</span><div>{liveBooking.sumber || '-'}</div></div>
              </div>

              <div className="section-label">Pembayaran</div>
              <div className="pay-summary">
                <div><span className="detail-label-summary">Total Tagihan</span><div className="pay-value" style={{ color: 'var(--ink-soft)' }}>{formatRupiah(liveBooking.belanja_klien)}</div></div>
                <div><span className="detail-label-summary">Sudah Dibayar</span><div className="pay-value" style={{ color: 'var(--bar-transport)' }}>{formatRupiah(liveBooking.belanja_klien - sisa)}</div></div>
                <div><span className="detail-label-summary">Sisa Tagihan</span><div className="pay-value" style={{ color: sisa > 0 ? 'var(--notif)' : 'var(--ink-soft)' }}>{formatRupiah(sisa)}</div></div>
              </div>

              <div className="detail-label-history">Riwayat Pembayaran</div>
              {payments.length > 0 && (
                <div className="pay-history">
                  {payments.map((p) => (
                    editingPaymentId === p.id ? (
                      <div className="pay-edit-row" key={p.id}>
                        <div className="field-grid-detail add-edit-pay-cols-3">
                          <div className="field"><label>Tanggal Pembayaran</label><CustomDatePicker value={editPayDate} onChange={setEditPayDate} variant="modal" /></div>
                          <div className="field"><label>Jumlah</label><input type="text" inputMode="numeric" placeholder="Rp0" value={editPayAmount ? `Rp${formatAngkaInput(editPayAmount)}` : ''} onChange={(e) => setEditPayAmount(parseAngkaInput(e.target.value))} /></div>
                          <div className="field">
                          <label>Metode Pembayaran</label>
                          <CustomSelect
                            options={['Transfer Bank', 'E-Wallet', 'QRIS', 'Cash']}
                            value={editPayMethod}
                            onChange={setEditPayMethod}
                            variant="modal"
                          />
                        </div>
                        </div>
                        <div className="field-grid-detail add-edit-pay-cols-1">
                        <div className="field"><label>Catatan</label><textarea placeholder="Opsional" value={editPayNote} onChange={(e) => setEditPayNote(e.target.value)} /></div>
                        </div>
                        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                          <button type="button" className="btn-payment" onClick={() => setEditingPaymentId(null)}>Batal</button>
                          <button type="button" className="btn-payment" onClick={() => handleSaveEditPayment(p.id)} disabled={saving}>Simpan</button>
                        </div>
                      </div>
                    ) : (
                      <div className="pay-row" key={p.id}>
                        <span>{formatTanggal(p.tanggal)}</span>
                        <span>{p.metode}</span>
                        <span className="pay-amount">{formatRupiah(p.jumlah)}</span>
                        <span className="pay-note">{p.catatan || '-'}</span>
                        <div className="pay-actions">
                          <button type="button" onClick={() => startEditPayment(p)}>Edit</button>
                          <button type="button" onClick={() => setConfirmDeletePaymentId(p.id)}>Hapus</button>
                          {confirmDeletePaymentId === p.id && (
                            <div className="pay-confirm-popup">
                              <p>Yakin mau hapus catatan pembayaran ini?</p>
                              <div className="pay-confirm-popup-actions">
                                <button type="button" className="pay-confirm-cancel" onClick={() => setConfirmDeletePaymentId(null)}>Batal</button>
                                <button type="button" className="pay-confirm-yes" onClick={() => handleDeletePayment(p.id)} disabled={saving}>
                                  {saving ? '...' : 'Ya, hapus'}
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    )
                  ))}
                </div>
              )}

              {!showAddPayment ? (
                <button type="button" className="add-payment" onClick={() => setShowAddPayment(true)}>+ Tambah Pembayaran</button>
              ) : (
                <form onSubmit={handleAddPayment} className="add-payment-card" style={{ marginTop: 8 }}>
                  <div className="field-grid-detail add-edit-pay-cols-3">
                    <div className="field"><label>Tanggal Pembayaran</label><CustomDatePicker value={payDate} onChange={setPayDate} variant="modal" /></div>
                    <div className="field"><label>Jumlah</label><input type="text" inputMode="numeric" placeholder="Rp0" value={payAmount ? `Rp${formatAngkaInput(payAmount)}` : ''} onChange={(e) => setPayAmount(parseAngkaInput(e.target.value))} /></div>
                    <div className="field">
                      <label>Metode Pembayaran</label>
                      <CustomSelect
                        options={['Transfer Bank', 'E-Wallet', 'QRIS', 'Cash']}
                        value={payMethod}
                        onChange={setPayMethod}
                        variant="modal"
                      />
                    </div>
                  </div>
                  <div className="field-grid-detail add-edit-pay-cols-1">
                    <div className="field"><label>Catatan</label><textarea placeholder="Opsional" value={payNote} onChange={(e) => setPayNote(e.target.value)} /></div>
                  </div>
                  <div style={{ display: 'flex', gap: 5, marginTop: 4 }}>
                    <button type="button" className="btn-payment" onClick={() => setShowAddPayment(false)}>Batal</button>
                    <button type="submit" className="btn-payment" disabled={saving}>{saving ? 'Menyimpan...' : 'Tambah Pembayaran'}</button>
                  </div>
                </form>
              )}

              <div className="section-label">Klien ({peserta.length})</div>
              {peserta.map((p) => (
                <div className="peserta-view-row" key={p.id}>
                  <div className={`b-avatar${isSelesai(liveBooking.tanggal_acara, liveBooking.jam_start_makeup) ? ' selesai' : ''}`}>{(p.nama_anggota || '?').slice(0, 2).toUpperCase()}</div>
                  <div className="b-info">
                    <div className="b-name">{p.nama_anggota} {p.peran ? `— (${p.peran})` : ''}</div>
                    <div className="b-meta">
                      {`${p.jenis_paket || p.kategori_makeup} (${p.dikerjakan_oleh_makeup}${p.dikerjakan_oleh_makeup === 'Tim' && p.nama_tim_makeup ? ' - ' + p.nama_tim_makeup : ''}) — ${formatRupiah(p.biaya_makeup)}`}
                      {p.pakai_paket_bundling
                        ? bundlingItems.filter((b) => b.peserta_id === p.id && !b.parent_id).map((v) => {
                            const addOns = bundlingItems.filter((c) => c.parent_id === v.id)
                            return ` | ${v.nama} ${formatRupiah(v.biaya)}` + addOns.map((a) => ` | ↳ ${a.nama} ${formatRupiah(a.biaya)}`).join('')
                          }).join('')
                        : ''}
                      {p.layanan_tambahan !== 'Tidak Ada' ? ` | ${p.layanan_tambahan} (${p.dikerjakan_oleh_tambahan}${p.dikerjakan_oleh_tambahan === 'Tim' && p.nama_tim_tambahan ? ' - ' + p.nama_tim_tambahan : ''})` : ''}
                      {[1, 2, 3, 4, 5].map((n) => {
                        const suffix = n === 1 ? '' : `_${n}`
                        const nama = p[`layanan_lainnya${suffix}`]
                        return nama ? ` | ${nama} ${formatRupiah(p[`biaya_lainnya${suffix}`])}` : ''
                      }).join('')}
                    </div>
                  </div>
                </div>
              ))}

              {liveBooking.catatan && (
                <>
                  <div className="section-label">Catatan</div>
                  <div style={{ fontSize: 13, color: 'var(--ink-soft)', whiteSpace: 'pre-line' }}>{liveBooking.catatan}</div>
                </>
              )}
            </>
          )}

          {!loading && editMode && (
            <>
              <div className="field-grid-booking cols-tanggal-nama-wa">
                <div className="field">
                  <label>Tanggal Booking</label>
                  <CustomDatePicker value={tanggalBooking} onChange={setTanggalBooking} variant="modal" />
                </div>
                <div className="field" style={{ position: 'relative' }}>
                  <label>Nama Klien</label>
                  <input type="text" value={namaKlien} onChange={(e) => setNamaKlien(e.target.value)} onBlur={(e) => setNamaKlien(capitalizeWords(e.target.value))} />
                </div>
                <div className="field">
                  <label>Nomor WhatsApp</label>
                  <input type="text" value={nomorWhatsApp} onChange={(e) => setNomorWhatsApp(e.target.value)} />
                </div>
              </div>

              <div className="field-grid-booking cols-tanggal-jam-event" style={{ marginTop: 12 }}>
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

              <div className="field-grid-booking cols-lokasi-sumber" style={{ marginTop: 12 }}>
                <div className="field">
                  <label>Lokasi</label><input type="text" value={lokasi} onChange={(e) => setLokasi(e.target.value)} onBlur={(e) => setLokasi(capitalizeWords(e.target.value))} />
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

              <div className="field-grid-booking cols-transport-catatan">
                <div className="field">
                  <label>Biaya Transport</label>
                  <input type="text" inputMode="numeric" placeholder="Rp0" value={biayaTransport ? `Rp${formatAngkaInput(biayaTransport)}` : ''} onChange={(e) => setBiayaTransport(parseAngkaInput(e.target.value))} />
                </div>
                <div className="field">
                  <label>Catatan</label>
                  <textarea value={catatan} onChange={(e) => setCatatan(e.target.value)} />
                </div>
              </div>

            <div className="section-label">Klien</div>
              {editPeserta.map((p, i) => (
                <div className="peserta-card" key={p.id || `new-${i}`}>
                  <div className="peserta-head">
                    <div className="peserta-title"><span className="peserta-num">{i + 1}</span>Klien {i + 1}</div>
                    {i > 0 && (
                      <button type="button" className="peserta-remove" onClick={() => removeEditPeserta(i)}>Hapus</button>
                    )}
                  </div>
                  <div className="peserta-body">
                  <div className="field-grid-peserta cols-2">
                        <div className="field">
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                            <label>Nama Klien</label>
                          </div>
                          <input type="text" placeholder="contoh: Jenny Black Pink" value={p.nama_anggota} onChange={(e) => updateEditPeserta(i, 'nama_anggota', e.target.value)} onBlur={(e) => updateEditPeserta(i, 'nama_anggota', capitalizeWords(e.target.value))} />
                        </div>
                        <div className="field">
                          <label>Peran</label>
                          <input type="text" placeholder="contoh: Klien Utama/Wisudawati" value={p.peran} onChange={(e) => updateEditPeserta(i, 'peran', e.target.value)} />
                        </div>
                      </div>

                      <div className="field-grid-peserta cols-2">
                        <div className="field">
                          <label>Kategori</label>
                          <CustomSelect
                            options={KATEGORI_MAKEUP_OPTIONS}
                            value={p.kategori_makeup || 'Regular'}
                            onChange={(v) => updateEditPeserta(i, 'kategori_makeup', v)}
                            variant="modal"
                          />
                        </div>
                        <div className="field">
                          <label>Jenis Makeup</label>
                          <input type="text" placeholder="Standar/VIP/Gold/Premium" value={p.jenis_paket || ''} onChange={(e) => updateEditPeserta(i, 'jenis_paket', e.target.value)} />
                        </div>
                      </div>

                      {/* Paket Bundling -- toggle TERPISAH dari Kategori
                          (bukan salah satu pilihan Kategori lagi),
                          soalnya 2 hal ini beda dimensi: Kategori jawab
                          "acara apa", Paket Bundling jawab "ada vendor
                          luar tambahan apa nggak". Klien Wedding/Reguler/
                          dst BISA juga sekalian pakai Paket Bundling --
                          makanya harus bisa nyala bareng, bukan saling
                          gantiin. Biaya Makeup/Komisi/dkk di bawah TETEP
                          jalan apa adanya, BEDA hal (harga jasa vendor
                          luar vs harga makeup MUA sendiri). */}
                      <div className="field-grid-peserta cols-2">
                        <div className="field">
                          <label>Sertakan Paket Bundling?</label>
                          <div className="toggle-row">
                            <div className={`toggle-opt${!p.pakai_paket_bundling ? ' sel' : ''}`} onClick={() => updateEditPeserta(i, 'pakai_paket_bundling', false)}>Tidak</div>
                            <div className={`toggle-opt${p.pakai_paket_bundling ? ' sel' : ''}`} onClick={() => {
                              updateEditPeserta(i, 'pakai_paket_bundling', true)
                              if ((p.vendors || []).length === 0) addVendor(i)
                            }}>Ya</div>
                          </div>
                        </div>
                      </div>

                      {p.pakai_paket_bundling && (
                      <div>
                        {(p.vendors || []).map((v, vi) => (
                          <div key={v.id || vi}>
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
                                <label>Untung untuk MUA (jika ada)</label>
                                <input type="text" inputMode="numeric" placeholder="Rp0" value={v.untung ? `Rp${formatAngkaInput(v.untung)}` : ''} onChange={(e) => updateVendor(i, vi, 'untung', parseAngkaInput(e.target.value))} />
                              </div>
                            </div>

                            {v.addOns.map((a, ai) => (
                              <div key={a.id || ai}>
                                <div className="addon-remove-row">
                                  <button type="button" className="peserta-remove" onClick={() => removeVendorAddOn(i, vi, ai)}>Hapus Add On {ai + 1}</button>
                                </div>
                                <div className="field-grid-bundling">
                                  <div className="field"><label>Nama Add On</label><input type="text" placeholder="contoh: Lighting" value={a.nama} onChange={(e) => updateVendorAddOn(i, vi, ai, 'nama', e.target.value)} /></div>
                                  <div className="field"><label>Biaya (Ditagih ke Klien)</label><input type="text" inputMode="numeric" placeholder="Rp0" value={a.biaya ? `Rp${formatAngkaInput(a.biaya)}` : ''} onChange={(e) => updateVendorAddOn(i, vi, ai, 'biaya', parseAngkaInput(e.target.value))} /></div>
                                  <div className="field"><label>Untung untuk MUA (jika ada)</label><input type="text" inputMode="numeric" placeholder="Rp0" value={a.untung ? `Rp${formatAngkaInput(a.untung)}` : ''} onChange={(e) => updateVendorAddOn(i, vi, ai, 'untung', parseAngkaInput(e.target.value))} /></div>
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
                      <div className="field-grid-peserta cols-2">
                        <div className="field">
                          <label>Dikerjakan oleh</label>
                          <div className="toggle-row">
                            <div className={`toggle-opt${p.dikerjakan_oleh_makeup === 'Me' ? ' sel' : ''}`} onClick={() => updateEditPeserta(i, 'dikerjakan_oleh_makeup', 'Me')}>Me</div>
                            <div className={`toggle-opt${p.dikerjakan_oleh_makeup === 'Tim' ? ' sel' : ''}`} onClick={() => updateEditPeserta(i, 'dikerjakan_oleh_makeup', 'Tim')}>Tim</div>
                          </div>
                        </div>
                      </div>
                      <div className="field-grid-peserta cols-2">
                        <div className="field">
                          <label>Biaya Makeup</label>
                          <input type="text" inputMode="numeric" placeholder="Rp0" value={p.biaya_makeup ? `Rp${formatAngkaInput(p.biaya_makeup)}` : ''} onChange={(e) => updateEditPeserta(i, 'biaya_makeup', parseAngkaInput(e.target.value))} />
                        </div>
                        {p.dikerjakan_oleh_makeup === 'Tim' && (
                        <div className="field">
                          <label>Komisi untuk Kamu</label>
                          <input type="text" inputMode="numeric" placeholder="Rp0" value={p.komisi_makeup_tim ? `Rp${formatAngkaInput(p.komisi_makeup_tim)}` : ''} onChange={(e) => updateEditPeserta(i, 'komisi_makeup_tim', parseAngkaInput(e.target.value))} />
                        </div>
                        )}
                      </div>
                      {p.dikerjakan_oleh_makeup === 'Tim' && (
                      <div className="field-grid-peserta cols-2">
                        <div className="field" style={{ gridColumn: 2 }}>
                          <label>Nama Tim</label>
                          <input type="text" placeholder="contoh: makeupbyjennie" value={p.nama_tim_makeup || ''} onChange={(e) => updateEditPeserta(i, 'nama_tim_makeup', e.target.value)} />
                        </div>
                      </div>
                      )}

                      <div className="field-grid-peserta cols-2">
                        <div className="field">
                        <div className="sb-label">Add On Layanan Rambut</div>
                          <div className="toggle-row-rambut">
                          <div className={`toggle-opt-rambut${p.layanan_tambahan === 'Tidak Ada' ? ' sel' : ''}`} onClick={() => updateEditPeserta(i, 'layanan_tambahan', 'Tidak Ada')}>Tidak</div>
                          <div className={`toggle-opt-rambut${p.layanan_tambahan === 'Hairdo' ? ' sel' : ''}`} onClick={() => updateEditPeserta(i, 'layanan_tambahan', 'Hairdo')}>Hairdo</div>
                          <div className={`toggle-opt-rambut${p.layanan_tambahan === 'Hijabdo+' ? ' sel' : ''}`} onClick={() => updateEditPeserta(i, 'layanan_tambahan', 'Hijabdo+')}>Hijabdo+</div>
                        </div>
                        </div>

                        {p.layanan_tambahan !== 'Tidak Ada' && (
                        <>
                        <div className="field">
                        <div className="sb-label">Dikerjakan oleh</div>
                          <div className="toggle-row">
                          <div className={`toggle-opt${p.dikerjakan_oleh_tambahan === 'Me' ? ' sel' : ''}`} onClick={() => updateEditPeserta(i, 'dikerjakan_oleh_tambahan', 'Me')}>Me</div>
                          <div className={`toggle-opt${p.dikerjakan_oleh_tambahan === 'Tim' ? ' sel' : ''}`} onClick={() => updateEditPeserta(i, 'dikerjakan_oleh_tambahan', 'Tim')}>Tim</div>
                        </div>
                        </div>
                        </>
                        )}
                      </div>

                      {p.layanan_tambahan !== 'Tidak Ada' && (
                      <div className="field-grid-peserta cols-2">
                        <div className="field">
                          <label>Biaya Layanan Tambahan</label>
                          <input type="text" inputMode="numeric" placeholder="Rp0" value={p.biaya_tambahan ? `Rp${formatAngkaInput(p.biaya_tambahan)}` : ''} onChange={(e) => updateEditPeserta(i, 'biaya_tambahan', parseAngkaInput(e.target.value))} />
                        </div>
                        {p.dikerjakan_oleh_tambahan === 'Tim' && (
                        <div className="field">
                          <label>Komisi untuk Kamu</label>
                          <input type="text" inputMode="numeric" placeholder="Rp0" value={p.komisi_tambahan ? `Rp${formatAngkaInput(p.komisi_tambahan)}` : ''} onChange={(e) => updateEditPeserta(i, 'komisi_tambahan', parseAngkaInput(e.target.value))} />
                        </div>
                          )}
                      </div>
                      )}
                      {p.layanan_tambahan !== 'Tidak Ada' && p.dikerjakan_oleh_tambahan === 'Tim' && (
                      <div className="field-grid-peserta cols-2">
                        <div className="field" style={{ gridColumn: 2 }}>
                          <label>Nama Tim</label>
                          <input type="text" placeholder="contoh: hairdobycarmen" value={p.nama_tim_tambahan || ''} onChange={(e) => updateEditPeserta(i, 'nama_tim_tambahan', e.target.value)} />
                        </div>
                      </div>
                      )}

                      {Array.from({ length: p._addonCount }, (_, idx) => idx + 1).map((n) => {
                        const suffix = n === 1 ? '' : `_${n}`
                        const namaField = `layanan_lainnya${suffix}`
                        const biayaField = `biaya_lainnya${suffix}`
                        const untungField = `keuntungan_lainnya${suffix}`
                        return (
                          <div key={n}>
                            {/* Tombol Hapus SENGAJA dipindah jadi baris sendiri,
                                di ATAS pasangan field Nama+Biaya -- bukan nempel
                                di sebelah label kayak sebelumnya. Alasannya: kalau
                                nempel di label, di mobile (ruang sempit) dia suka
                                "terdorong" turun ke baris ke-2 -- efeknya field
                                "Add On Item Lainnya N" jadi lebih tinggi dari field
                                "Biaya Add On Item" di sebelahnya (yang labelnya
                                cuma 1 baris), bikin 2 input-nya nggak sejajar lagi.
                                Dengan taruh Hapus di baris sendiri (di luar grid
                                2 kolom), tinggi label kedua field itu SELALU sama,
                                jadi kedua input-nya dijamin selalu sejajar, apapun
                                lebar layarnya. */}
                            {n === p._addonCount && n > 1 && (
                              <div className="addon-remove-row">
                                <button type="button" className="peserta-remove" onClick={() => removeAddOnSlot(i)}>Hapus Add On Item {n}</button>
                              </div>
                            )}
                            <div className="field-grid-peserta cols-2">
                              <div className="field">
                                <label>{n === 1 ? 'Add On Item' : `Add On Item ${n}`}</label>
                                <input type="text" placeholder="contoh: Softlens" value={p[namaField] || ''} onChange={(e) => updateEditPeserta(i, namaField, e.target.value)} />
                              </div>
                              {(p[namaField] || '').trim() && (
                                <div className="field">
                                  <label>Biaya Add On Item</label>
                                  <input type="text" inputMode="numeric" placeholder="Rp0" value={p[biayaField] ? `Rp${formatAngkaInput(p[biayaField])}` : ''} onChange={(e) => updateEditPeserta(i, biayaField, parseAngkaInput(e.target.value))} />
                                </div>
                              )}
                            </div>
                            {(p[namaField] || '').trim() && (
                              <div className="field-grid-peserta cols-2">
                                <div className="field" style={{ gridColumn: 2 }}>
                                  <label>Keuntungan Add On Item</label>
                                  <input type="text" inputMode="numeric" placeholder="Rp0" value={p[untungField] ? `Rp${formatAngkaInput(p[untungField])}` : ''} onChange={(e) => updateEditPeserta(i, untungField, parseAngkaInput(e.target.value))} />
                                </div>
                              </div>
                            )}
                          </div>
                        )
                      })}
                      {p._addonCount < 5 && (
                        <button type="button" className="add-peserta" onClick={() => addAddOnSlot(i)}>+ Tambah Add On Item</button>
                      )}
                    </div>
                  </div>
                )
              )}
              <button type="button" className="add-peserta" onClick={addEditPeserta}>+ Tambah Klien</button>
            </>
          )}
        </div>

        {confirmDeleteBooking && (
          <div className="delete-confirm-banner">
            <div className="delete-confirm-text">
              <b>Yakin menghapus data booking {liveBooking.nama_klien}?</b>
              <span>{peserta.length} peserta, {payments.length} catatan pembayaran, dan {bundlingItems.length} paket bundling juga akan ikut terhapus.< br/>
              Data yang sudah dihapus tidak bisa dikembalikan.</span>
            </div>
          </div>
        )}

        <div className="modal-foot">
          {editMode ? (
            <>
              <button className="btn-batal" onClick={() => setEditMode(false)}>Batal</button>
              <button className="btn-primary-detail" onClick={handleSaveEdit} disabled={saving}>{saving ? 'Menyimpan...' : 'Simpan Perubahan'}</button>
            </>
          ) : confirmDeleteBooking ? (
            <>
              <button className="btn-danger batal" onClick={() => setConfirmDeleteBooking(false)}>Batal</button>
              <button className="btn-danger" onClick={handleDeleteBooking} disabled={saving}>
                {saving ? 'Menghapus...' : 'Ya, hapus permanen'}
              </button>
            </>
          ) : (
            <>
              <button className="btn-danger-ghost" onClick={() => setConfirmDeleteBooking(true)}>Hapus Booking</button>
              <button className="btn-ghost" onClick={onClose}>Tutup</button>
            </>
          )}
        </div>
      </div>

      {showInvoice && (
        <InvoiceModal
          booking={liveBooking}
          peserta={peserta}
          payments={payments}
          bundlingItems={bundlingItems}
          onClose={() => setShowInvoice(false)}
        />
      )}

      {/* liveBooking (BUKAN booking prop asli) -- biar rincian ini selalu
          ikut ke-update kalau ada perubahan data di sesi ini (edit
          peserta/pembayaran), sama persis sumbernya kayak section
          PEMBAYARAN di atas. */}
      {showRincian && (
        <RincianKeuanganModal
          booking={liveBooking}
          peserta={peserta}
          bundlingItems={bundlingItems}
          onClose={() => setShowRincian(false)}
        />
      )}
    </div>
  )
}
