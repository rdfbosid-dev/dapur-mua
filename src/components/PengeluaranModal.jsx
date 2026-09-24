import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { formatAngkaInput, parseAngkaInput } from '../lib/format'
import CustomSelect from './CustomSelect'
import CustomDatePicker from './CustomDatePicker'
import './PengeluaranModal.css'

function todayStr() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// Modal tambah/edit 1 baris Pengeluaran. `editData` null = mode tambah baru,
// diisi (row dari tabel `pengeluaran`) = mode edit. `bookings` dikirim dari
// parent (Keuangan.jsx) -- BUKAN di-fetch ulang di sini, soalnya parent
// udah pasti punya data itu duluan (buat tab Pemasukan/Neraca), jadi numpang
// aja biar nggak query dobel.
export default function PengeluaranModal({ onClose, onSaved, editData = null, bookings = [] }) {
  const { user } = useAuth()
  const isEdit = !!editData

  const [kategori, setKategori] = useState(editData?.kategori || '')
  const [nempelBooking, setNempelBooking] = useState(!!editData?.booking_id)
  const [bookingId, setBookingId] = useState(editData?.booking_id || '')
  const [keterangan, setKeterangan] = useState(editData?.keterangan || '')
  const [jumlah, setJumlah] = useState(editData?.jumlah || '')
  const [tanggal, setTanggal] = useState(editData?.tanggal || todayStr())
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  // Label yang ditampilin di dropdown booking -- "kode_booking - nama
  // klien (tanggal acara)". Peta 2 arah (label<->id) biar CustomSelect
  // (yang cuma kerja dengan array of string) bisa dipetain balik ke id
  // aslinya pas user milih.
  const bookingLabel = (b) => `${b.kode_booking || '(tanpa kode)'} - ${b.nama_klien || ''} (${b.tanggal_acara ? new Date(b.tanggal_acara).toLocaleDateString('id-ID') : '-'})`
  const bookingOptions = bookings.map(bookingLabel)
  const labelToId = {}
  bookings.forEach((b) => { labelToId[bookingLabel(b)] = b.id })
  const selectedBookingLabel = bookingId ? bookingLabel(bookings.find((b) => b.id === bookingId) || {}) : ''

  async function handleSubmit(e) {
    e.preventDefault()
    if (!kategori.trim()) { setError('Kategori wajib diisi.'); return }
    if (nempelBooking && !bookingId) { setError('Pilih booking-nya dulu, atau matiin toggle "Nempel ke Booking".'); return }
    setSaving(true)
    setError('')

    const payload = {
      user_id: user.id,
      booking_id: nempelBooking ? bookingId : null,
      kategori: kategori.trim(),
      keterangan: keterangan.trim() || null,
      jumlah: Number(jumlah) || 0,
      tanggal,
    }

    const { error: err } = isEdit
      ? await supabase.from('pengeluaran').update(payload).eq('id', editData.id)
      : await supabase.from('pengeluaran').insert(payload)

    setSaving(false)
    if (err) { setError(err.message); return }
    onSaved()
  }

  return (
    <div className="pengeluaran-modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="modal">
        <div className="modal-head">
          <h2>{isEdit ? 'Edit Pengeluaran' : 'Tambah Pengeluaran'}</h2>
          <button className="modal-close" onClick={onClose} type="button">&times;</button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            {error && <div className="pengeluaran-error">{error}</div>}

            <div className="field-grid-pengeluaran cols-2">
              <div className="field">
                <label>Kategori</label>
                <input type="text" placeholder="contoh: Kosmetik, Portofolio" value={kategori} onChange={(e) => setKategori(e.target.value)} />
              </div>
              <div className="field">
                <label>Jumlah</label>
                <input type="text" inputMode="numeric" placeholder="Rp0" value={jumlah ? `Rp${formatAngkaInput(jumlah)}` : ''} onChange={(e) => setJumlah(parseAngkaInput(e.target.value))} />
              </div>
            </div>

            <div className="field-grid-pengeluaran cols-2">
              <div className="field">
                <label>Tanggal</label>
                <CustomDatePicker value={tanggal} onChange={setTanggal} variant="modal" />
              </div>
            </div>

            {/* Toggle nempel-ke-booking -- pola SAMA kayak "Sertakan Paket
                Bundling?" di BookingModal.jsx, biar konsisten. Kalau "Ya",
                dropdown booking baru muncul di bawahnya. */}
            <div className="field-grid-pengeluaran cols-2">
              <div className="field">
                <label>Nempel ke Booking?</label>
                <div className="toggle-row">
                  <div className={`toggle-opt${!nempelBooking ? ' sel' : ''}`} onClick={() => { setNempelBooking(false); setBookingId('') }}>Tidak</div>
                  <div className={`toggle-opt${nempelBooking ? ' sel' : ''}`} onClick={() => setNempelBooking(true)}>Ya</div>
                </div>
              </div>
            </div>

            {nempelBooking && (
              <div className="field-grid-pengeluaran cols-2">
                <div className="field">
                  <label>Booking</label>
                  <CustomSelect
                    options={bookingOptions}
                    value={selectedBookingLabel}
                    onChange={(label) => setBookingId(labelToId[label] || '')}
                    placeholder="Pilih booking"
                    variant="modal"
                  />
                </div>
              </div>
            )}

            <div className="field-grid-pengeluaran cols-1">
              <div className="field">
                <label>Keterangan (opsional)</label>
                <textarea rows={2} placeholder="Catatan tambahan" value={keterangan} onChange={(e) => setKeterangan(e.target.value)} />
              </div>
            </div>
          </div>

          <div className="modal-foot">
            <button type="button" className="btn-ghost" onClick={onClose}>Batal</button>
            <button type="submit" className="btn-primary-pengeluaran" disabled={saving}>
              {saving ? 'Menyimpan...' : 'Simpan Pengeluaran'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
