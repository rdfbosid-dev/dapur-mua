import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import CustomSelect from './CustomSelect'
import CustomDatePicker from './CustomDatePicker'
import CustomTimePicker from './CustomTimePicker'
import { EVENT_OPTIONS, EVENT_CUSTOM_SENTINEL, KATEGORI_MAKEUP_OPTIONS } from '../lib/constants'
import { cariAtauBuatKlien } from '../lib/klien'
import { formatAngkaInput, parseAngkaInput } from '../lib/format'
import InvoiceModal from './InvoiceModal'
import './BookingModal.css'
import './BookingDetailModal.css'

function formatRupiah(n) {
  const num = Number(n) || 0
  const sign = num < 0 ? '-' : ''
  return sign + 'Rp' + Math.abs(num).toLocaleString('id-ID')
}

// Sama persis logikanya kayak di Kalender.jsx/BookingList.jsx -- booking
// dianggap "selesai" kalau tanggalnya udah lewat, ATAU hari ini tapi
// udah lewat 4 jam dari jam mulai makeup. Dipakai buat nentuin warna
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
  return (new Date() - mulai) / 3600000 >= 4
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
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [editMode, setEditMode] = useState(false)
  const [showInvoice, setShowInvoice] = useState(false)
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

    const [{ data: pesertaData, error: pesertaErr }, { data: paymentData, error: paymentErr }, { data: bookingData, error: bookingErr }] = await Promise.all([
      supabase.from('peserta').select('*').eq('booking_id', booking.id).order('created_at'),
      supabase.from('payments').select('*').eq('booking_id', booking.id).order('tanggal', { ascending: false }),
      supabase.from('booking_summary').select('*').eq('id', booking.id).single(),
    ])

    if (pesertaErr || paymentErr) {
      setError((pesertaErr || paymentErr).message)
    } else {
      setPeserta(pesertaData || [])
      setPayments(paymentData || [])
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
    setEditPeserta(peserta.map((p) => ({ ...p, _addonCount: countAddOnSlots(p) })))
    setRemovedPesertaIds([])
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
      return updated
    }))
  }
  function addEditPeserta() {
    setEditPeserta((list) => [...list, {
      nama_anggota: '', peran: '', kategori_makeup: 'Reguler', jenis_paket: '', dikerjakan_oleh_makeup: 'Me',
      biaya_makeup: 0, komisi_makeup_tim: 0, layanan_tambahan: 'Tidak Ada',
      dikerjakan_oleh_tambahan: 'Me', biaya_tambahan: 0, komisi_tambahan: 0,
      layanan_lainnya: '', biaya_lainnya: 0, keuntungan_lainnya: 0,
      layanan_lainnya_2: '', biaya_lainnya_2: 0, keuntungan_lainnya_2: 0,
      layanan_lainnya_3: '', biaya_lainnya_3: 0, keuntungan_lainnya_3: 0,
      layanan_lainnya_4: '', biaya_lainnya_4: 0, keuntungan_lainnya_4: 0,
      layanan_lainnya_5: '', biaya_lainnya_5: 0, keuntungan_lainnya_5: 0,
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

    for (const p of editPeserta) {
      const payload = {
        nama_anggota: p.nama_anggota?.trim() || '',
        peran: p.peran?.trim() || '',
        jenis_paket: (p.jenis_paket || '').trim(),
        kategori_makeup: p.kategori_makeup,
        dikerjakan_oleh_makeup: p.dikerjakan_oleh_makeup,
        biaya_makeup: Number(p.biaya_makeup) || 0,
        komisi_makeup_tim: Number(p.komisi_makeup_tim) || 0,
        layanan_tambahan: p.layanan_tambahan,
        dikerjakan_oleh_tambahan: p.dikerjakan_oleh_tambahan,
        biaya_tambahan: Number(p.biaya_tambahan) || 0,
        komisi_tambahan: Number(p.komisi_tambahan) || 0,
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
      if (p.id) {
        const { error: upErr } = await supabase.from('peserta').update(payload).eq('id', p.id)
        if (upErr) { setSaving(false); setError(upErr.message); return }
      } else {
        const { error: insErr } = await supabase.from('peserta').insert({ ...payload, booking_id: booking.id, user_id: user.id })
        if (insErr) { setSaving(false); setError(insErr.message); return }
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
    // peserta & payments punya "on delete cascade" ke booking_id, jadi
    // ikut kehapus otomatis begitu baris booking-nya dihapus.
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
                <button className="btn-ghost" style={{ marginLeft: 'auto', marginRight: 10}} onClick={() => setShowInvoice(true)}>Invoice</button>
                <button className="btn-ghost" onClick={enterEditMode}>Edit Booking</button>
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
                      {p.jenis_paket || p.kategori_makeup} ({p.dikerjakan_oleh_makeup}) — {formatRupiah(p.biaya_makeup)}
                      {p.layanan_tambahan !== 'Tidak Ada' ? ` · ${p.layanan_tambahan} (${p.dikerjakan_oleh_tambahan})` : ''}
                      {[1, 2, 3, 4, 5].map((n) => {
                        const suffix = n === 1 ? '' : `_${n}`
                        const nama = p[`layanan_lainnya${suffix}`]
                        return nama ? ` · ${nama} (${formatRupiah(p[`biaya_lainnya${suffix}`])})` : ''
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
                            value={p.kategori_makeup || 'Reguler'}
                            onChange={(v) => updateEditPeserta(i, 'kategori_makeup', v)}
                            variant="modal"
                          />
                        </div>
                        <div className="field">
                          <label>Jenis Makeup</label>
                          <input type="text" placeholder="Standar/VIP/Gold/Premium" value={p.jenis_paket || ''} onChange={(e) => updateEditPeserta(i, 'jenis_paket', e.target.value)} />
                        </div>
                      </div>
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

                      <div className="field-grid-peserta cols-2">
                        <div className="field">
                        <div className="sb-label">Add On Layanan Rambut</div>
                          <div className="toggle-row-rambut">
                          <div className={`toggle-opt-rambut${p.layanan_tambahan === 'Tidak Ada' ? ' sel' : ''}`} onClick={() => updateEditPeserta(i, 'layanan_tambahan', 'Tidak Ada')}>Tidak</div>
                          <div className={`toggle-opt-rambut${p.layanan_tambahan === 'Hairdo' ? ' sel' : ''}`} onClick={() => updateEditPeserta(i, 'layanan_tambahan', 'Hairdo')}>Hairdo</div>
                          <div className={`toggle-opt-rambut${p.layanan_tambahan === 'Hijabdo Plus' ? ' sel' : ''}`} onClick={() => updateEditPeserta(i, 'layanan_tambahan', 'Hijabdo Plus')}>Hijabdo+</div>
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

                      {Array.from({ length: p._addonCount }, (_, idx) => idx + 1).map((n) => {
                        const suffix = n === 1 ? '' : `_${n}`
                        const namaField = `layanan_lainnya${suffix}`
                        const biayaField = `biaya_lainnya${suffix}`
                        const untungField = `keuntungan_lainnya${suffix}`
                        return (
                          <div key={n}>
                            <div className="field-grid-peserta cols-2">
                              <div className="field">
                                <div className="field-label-row">
                                  <label>{n === 1 ? 'Add On Item Lainnya' : `Add On Item Lainnya ${n}`}</label>
                                  {n === p._addonCount && n > 1 && (
                                    <button type="button" className="peserta-remove" onClick={() => removeAddOnSlot(i)}>Hapus</button>
                                  )}
                                </div>
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
              <span>{peserta.length} peserta dan {payments.length} catatan pembayaran juga akan ikut terhapus.< br/>
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
          booking={booking}
          peserta={peserta}
          payments={payments}
          onClose={() => setShowInvoice(false)}
        />
      )}
    </div>
  )
}
