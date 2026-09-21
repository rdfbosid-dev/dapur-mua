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
    const a = addOns[n - 1] || { nama: '', biaya: '', keuntungan: '' }
    const nama = a.nama.trim()
    // Kalau nama kosong, biaya & keuntungan-nya IKUT dianggap kosong --
    // sama persis alasannya kayak fix di BookingDetailModal.jsx.
    out[`layanan_lainnya${suffix}`] = nama || null
    out[`biaya_lainnya${suffix}`] = nama ? (Number(a.biaya) || 0) : 0
    out[`keuntungan_lainnya${suffix}`] = nama ? (Number(a.keuntungan) || 0) : 0
  }
  return out
}

function blankPeserta(nama = '') {
  return {
    nama, peran: '',
    kategoriMakeup: 'Regular', jenisPaket: '', dikerjakanOlehMakeup: 'Me',
    biayaMakeup: '', komisiMakeup: '', namaTimMakeup: '',
    layananTambahan: 'Tidak Ada', dikerjakanOlehTambahan: 'Me',
    biayaTambahan: '', komisiTambahan: '', namaTimTambahan: '',
    addOnLainnya: [{ nama: '', biaya: '', keuntungan: '' }],
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
          }
          return updated
        }),
      }
    }))
  }
  function addAddOn(pesertaIdx) {
    setPesertaList((list) => list.map((p, idx) => {
      if (idx !== pesertaIdx || p.addOnLainnya.length >= 5) return p
      return { ...p, addOnLainnya: [...p.addOnLainnya, { nama: '', biaya: '', keuntungan: '' }] }
    }))
  }

  // Paket Bundling -- level BOOKING (bukan per klien kayak Add On),
  // buat kerjasama vendor luar. Sama persis konsepnya kayak yang udah
  // ada di BookingDetailModal.jsx, cuma di sini buat booking BARU.
  // Tiap paket bisa punya "addOns" sendiri (misal paket Fotografer
  // punya add on Strobist) -- disimpen sebagai array bersarang di sini,
  // baru pas nyimpen ke database di-"ratain" jadi baris-baris terpisah
  // yang saling terhubung lewat parent_id.
  const [bundlingList, setBundlingList] = useState([])
  function addBundling() {
    setBundlingList((list) => [...list, { nama: '', biaya: '', untung: '', addOns: [] }])
  }
  function updateBundling(i, field, value) {
    setBundlingList((list) => list.map((b, idx) => (idx === i ? { ...b, [field]: value } : b)))
  }
  function removeBundling(i) {
    setBundlingList((list) => list.filter((_, idx) => idx !== i))
  }
  function addBundlingAddOn(bundlingIdx) {
    setBundlingList((list) => list.map((b, idx) => (idx === bundlingIdx ? { ...b, addOns: [...b.addOns, { nama: '', biaya: '', untung: '' }] } : b)))
  }
  function updateBundlingAddOn(bundlingIdx, addOnIdx, field, value) {
    setBundlingList((list) => list.map((b, idx) => {
      if (idx !== bundlingIdx) return b
      return { ...b, addOns: b.addOns.map((a, ai) => (ai === addOnIdx ? { ...a, [field]: value } : a)) }
    }))
  }
  function removeBundlingAddOn(bundlingIdx, addOnIdx) {
    setBundlingList((list) => list.map((b, idx) => {
      if (idx !== bundlingIdx) return b
      return { ...b, addOns: b.addOns.filter((_, ai) => ai !== addOnIdx) }
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
      jenis_paket: p.jenisPaket.trim(),
      kategori_makeup: p.kategoriMakeup,
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
      layanan_tambahan: p.layananTambahan,
      dikerjakan_oleh_tambahan: p.dikerjakanOlehTambahan,
      biaya_tambahan: Number(p.biayaTambahan) || 0,
      komisi_tambahan: p.dikerjakanOlehTambahan === 'Tim' ? (Number(p.komisiTambahan) || 0) : 0,
      nama_tim_tambahan: p.dikerjakanOlehTambahan === 'Tim' ? (p.namaTimTambahan.trim() || null) : null,
      ...addOnsToRow(p.addOnLainnya),
    }))

    const { error: pesertaError } = await supabase.from('peserta').insert(pesertaRows)

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

    // Baris yang nama-nya masih kosong (user klik "+ Tambah Paket
    // Bundling" tapi nggak jadi diisi) SENGAJA di-skip, nggak dikirim
    // ke database -- sama persis filosofinya kayak Add On Item.
    const filledBundling = bundlingList.filter((b) => b.nama.trim())

    if (filledBundling.length > 0) {
      const bundlingParentRows = filledBundling.map((b) => ({
        booking_id: booking.id,
        user_id: user.id,
        nama: b.nama.trim(),
        biaya: Number(b.biaya) || 0,
        keuntungan: Number(b.untung) || 0,
      }))

      // Insert paket dulu (tanpa parent_id, ini level teratas), pake
      // .select() biar dapet balik ID masing-masing baris yang baru
      // ke-insert -- ID itu WAJIB buat nyambungin add on di bawahnya
      // lewat parent_id, jadi ini nggak bisa digabung jadi 1 insert
      // doang kayak peserta.
      const { data: insertedBundling, error: bundlingError } = await supabase
        .from('bundling_items')
        .insert(bundlingParentRows)
        .select()

      if (bundlingError) {
        setSaving(false)
        setError('Booking, peserta, & DP tersimpan, tapi gagal simpan paket bundling: ' + bundlingError.message)
        return
      }

      // Supabase ngebalikin baris hasil insert PERSIS sesuai urutan
      // yang dikirim (1 statement INSERT ... RETURNING), jadi index
      // ke-i di filledBundling itu pasangannya index ke-i di
      // insertedBundling.
      const addOnRows = []
      filledBundling.forEach((b, idx) => {
        const parentId = insertedBundling[idx]?.id
        if (!parentId) return
        b.addOns.forEach((a) => {
          if (a.nama.trim()) {
            addOnRows.push({
              booking_id: booking.id,
              user_id: user.id,
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
          setError('Booking, peserta, DP, & paket bundling tersimpan, tapi gagal simpan add on paket: ' + addOnError.message)
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
                          <label>Peran</label>
                          <input type="text" placeholder="contoh: Klien Utama/Wisudawati" value={p.peran} onChange={(e) => updatePeserta(i, 'peran', e.target.value)} />
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
                          <input type="text" placeholder="Standar/VIP/Gold/Premium" value={p.jenisPaket} onChange={(e) => updatePeserta(i, 'jenisPaket', e.target.value)} />
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
                        <div className="field">
                          <label>Nama Tim</label>
                          <input type="text" placeholder="contoh: Salsa" value={p.namaTimMakeup} onChange={(e) => updatePeserta(i, 'namaTimMakeup', e.target.value)} />
                        </div>
                      </div>
                      )}

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
                      {p.layananTambahan !== 'Tidak Ada' && p.dikerjakanOlehTambahan === 'Tim' && (
                      <div className="field-grid-peserta cols-2">
                        <div className="field">
                          <label>Nama Tim</label>
                          <input type="text" placeholder="contoh: Salsa" value={p.namaTimTambahan} onChange={(e) => updatePeserta(i, 'namaTimTambahan', e.target.value)} />
                        </div>
                      </div>
                      )}

                      {/* Add On Item Lainnya -- TERPISAH dari Add On Layanan Rambut di atas
                          (klien bisa punya dua-duanya sekaligus, misal Hairdo + Softlens).
                          Maks 5 slot, cuma slot pertama yang keliatan dari awal -- slot
                          ke-2 dst nongol lewat tombol "+ Tambah Add On Item", dan bisa
                          dihapus lagi (slot pertama nggak bisa dihapus). Field Biaya &
                          Keuntungan cuma nongol begitu nama item-nya diisi. */}
                      {p.addOnLainnya.map((a, ai) => (
                        <div key={ai}>
                          {/* Hapus di baris sendiri, di ATAS pasangan field --
                              sama persis alasannya kayak fix di
                              BookingDetailModal.jsx: biar kolom "Add On Item"
                              & "Biaya Add On Item" SELALU sejajar, nggak
                              ketarik turun gara-gara tombol Hapus kepaksa
                              wrap ke baris baru di layar sempit. */}
                          {ai > 0 && (
                            <div className="addon-remove-row">
                              <button type="button" className="peserta-remove" onClick={() => removeAddOn(i, ai)}>Hapus Add On Item {ai + 1}</button>
                            </div>
                          )}
                          <div className="field-grid-peserta cols-2">
                            <div className="field">
                              <label>{ai === 0 ? 'Add On Item' : `Add On Item ${ai + 1}`}</label>
                              <input type="text" placeholder="contoh: Softlens/Kuku Palsu/Melati/lainnya" value={a.nama} onChange={(e) => updateAddOn(i, ai, 'nama', e.target.value)} />
                            </div>
                            {a.nama.trim() && (
                              <div className="field">
                                <label>Biaya Add On Item</label>
                                <input type="text" inputMode="numeric" placeholder="Rp0" value={a.biaya ? `Rp${formatAngkaInput(a.biaya)}` : ''} onChange={(e) => updateAddOn(i, ai, 'biaya', parseAngkaInput(e.target.value))} />
                              </div>
                            )}
                          </div>
                          {a.nama.trim() && (
                            <div className="field-grid-peserta cols-2">
                              <div className="field" style={{ gridColumn: 2 }}>
                                <label>Keuntungan Add On Item</label>
                                <input type="text" inputMode="numeric" placeholder="Rp0" value={a.keuntungan ? `Rp${formatAngkaInput(a.keuntungan)}` : ''} onChange={(e) => updateAddOn(i, ai, 'keuntungan', parseAngkaInput(e.target.value))} />
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                      {p.addOnLainnya.length < 5 && (
                        <button type="button" className="add-peserta" onClick={() => addAddOn(i)}>+ Tambah Add On Item</button>
                      )}
                    </div>
                  </div>
                )
              })}
              <button type="button" className="add-peserta" onClick={addPeserta}>+ Tambah Klien</button>
            </div>

            {/* Paket Bundling -- level BOOKING, di LUAR loop peserta di
                atas (beda sama Add On yang nempel per klien). */}
            <div className="section-label">PAKET BUNDLING</div>
            <div>
              {bundlingList.map((b, i) => (
                <div className="peserta-card" key={i}>
                  <div className="peserta-head">
                    <div className="peserta-title"><span className="peserta-num">{i + 1}</span>Paket {i + 1}</div>
                    <button type="button" className="peserta-remove" onClick={() => removeBundling(i)}>Hapus</button>
                  </div>
                  <div className="peserta-body">
                    <div className="field-grid-bundling">
                      <div className="field"><label>Nama Paket</label><input type="text" placeholder="contoh: Fotografer/Attire" value={b.nama} onChange={(e) => updateBundling(i, 'nama', e.target.value)} /></div>
                      <div className="field"><label>Biaya Paket (Ditagih ke Klien)</label><input type="text" inputMode="numeric" placeholder="Rp0" value={b.biaya ? `Rp${formatAngkaInput(b.biaya)}` : ''} onChange={(e) => updateBundling(i, 'biaya', parseAngkaInput(e.target.value))} /></div>
                      <div className="field"><label>Untung untuk MUA (jika ada)</label><input type="text" inputMode="numeric" placeholder="Rp0" value={b.untung ? `Rp${formatAngkaInput(b.untung)}` : ''} onChange={(e) => updateBundling(i, 'untung', parseAngkaInput(e.target.value))} /></div>
                    </div>

                    {/* Add On DI DALAM paket ini (misal paket Fotografer
                        punya tambahan Strobist) -- nempel ke paket ini
                        lewat parent_id pas disimpen, ikut kehitung
                        terpisah ke Tagihan/Omzet/Penghasilan sama
                        persis aturannya kayak paket induknya. */}
                    <div className="sb-label">Add On di Paket Ini</div>
                    {b.addOns.map((a, ai) => (
                      <div key={ai}>
                        <div className="addon-remove-row">
                          <button type="button" className="peserta-remove" onClick={() => removeBundlingAddOn(i, ai)}>Hapus Add On {ai + 1}</button>
                        </div>
                        <div className="field-grid-bundling">
                          <div className="field"><label>Nama Add On</label><input type="text" placeholder="contoh: Lighting" value={a.nama} onChange={(e) => updateBundlingAddOn(i, ai, 'nama', e.target.value)} /></div>
                          <div className="field"><label>Biaya (Ditagih ke Klien)</label><input type="text" inputMode="numeric" placeholder="Rp0" value={a.biaya ? `Rp${formatAngkaInput(a.biaya)}` : ''} onChange={(e) => updateBundlingAddOn(i, ai, 'biaya', parseAngkaInput(e.target.value))} /></div>
                          <div className="field"><label>Untung untuk MUA (jika ada)</label><input type="text" inputMode="numeric" placeholder="Rp0" value={a.untung ? `Rp${formatAngkaInput(a.untung)}` : ''} onChange={(e) => updateBundlingAddOn(i, ai, 'untung', parseAngkaInput(e.target.value))} /></div>
                        </div>
                      </div>
                    ))}
                    <button type="button" className="add-peserta" onClick={() => addBundlingAddOn(i)}>+ Tambah Add On Paket Ini</button>
                  </div>
                </div>
              ))}
              <button type="button" className="add-peserta" onClick={addBundling}>+ Tambah Paket Bundling</button>
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
