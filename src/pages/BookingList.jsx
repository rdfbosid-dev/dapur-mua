import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import Sidebar from '../components/Sidebar'
import CustomSelect from '../components/CustomSelect'
import BookingModal from '../components/BookingModal'
import BookingDetailModal from '../components/BookingDetailModal'
import './BookingList.css'

const BULAN_PENUH = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember']
const PAGE_SIZE = 10

function formatRupiah(n) {
  const num = Number(n) || 0
  const sign = num < 0 ? '-' : ''
  return sign + 'Rp' + Math.abs(num).toLocaleString('id-ID')
}

function formatTanggal(dateStr) {
  if (!dateStr) return '-'
  return new Date(dateStr).toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' })
}
function initialsOf(name) {
  return (name || '?').split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase()
}
function isSelesai(dateStr, jamStartMakeup) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const target = new Date(dateStr)
  target.setHours(0, 0, 0, 0)

  if (target < today) return true
  if (target > today) return false

  // Booking hari ini -- baru dianggap selesai kalau udah lewat 3 jam dari
  // jam mulai makeup (sama persis kayak logika di Dashboard).
  if (!jamStartMakeup) return false
  const [jam, menit] = jamStartMakeup.split(':').map(Number)
  const mulai = new Date(dateStr)
  mulai.setHours(jam, menit || 0, 0, 0)
  return (new Date() - mulai) / 3600000 >= 3
}

export default function BookingList() {
  const [bookings, setBookings] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [search, setSearch] = useState('')
  const [filterTahun, setFilterTahun] = useState('Semua Tahun')
  const [filterBulan, setFilterBulan] = useState('Semua Bulan')

  const [showModal, setShowModal] = useState(false)
  const [selectedBooking, setSelectedBooking] = useState(null)
  const [page, setPage] = useState(1)

  async function loadBookings() {
    setLoading(true)
    setError('')
    const { data, error } = await supabase
      .from('booking_summary')
      .select('*')
      .order('tanggal_acara', { ascending: false })
      .order('jam_start_makeup', { ascending: true })

    if (error) setError(error.message)
    else setBookings(data || [])
    setLoading(false)
  }

  // Fetch sekali pas komponen pertama kali dipasang, pola standar
  // "load data on mount" -- bukan cascading render yang dikhawatirin.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { loadBookings() }, [])

  const tahunOptions = useMemo(() => {
    const years = new Set(bookings.map((b) => new Date(b.tanggal_acara).getFullYear()))
    years.add(new Date().getFullYear())
    return ['Semua Tahun', ...Array.from(years).sort((a, b) => b - a).map(String)]
  }, [bookings])

  const filtered = bookings.filter((b) => {
    const q = search.trim().toLowerCase()
    if (q) {
      const matches = [b.nama_klien, b.kode_booking, b.event, b.lokasi]
        .some((field) => field?.toLowerCase().includes(q))
      if (!matches) return false
    }
    const d = new Date(b.tanggal_acara)
    if (filterTahun !== 'Semua Tahun' && String(d.getFullYear()) !== filterTahun) return false
    if (filterBulan !== 'Semua Bulan' && BULAN_PENUH[d.getMonth()] !== filterBulan) return false
    return true
  })

  // Reset ke halaman 1 tiap kali pencarian/filter berubah, biar nggak
  // nyangkut di halaman yang udah nggak ada datanya.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { setPage(1) }, [search, filterTahun, filterBulan])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const pageSafe = Math.min(page, totalPages)
  const paged = filtered.slice((pageSafe - 1) * PAGE_SIZE, pageSafe * PAGE_SIZE)
  const rangeStart = filtered.length === 0 ? 0 : (pageSafe - 1) * PAGE_SIZE + 1
  const rangeEnd = Math.min(pageSafe * PAGE_SIZE, filtered.length)

  function handleSaved() {
    setShowModal(false)
    loadBookings()
  }

  return (
    <div className="app-shell">
      <Sidebar />
      <div className="main">
        <div className="topbar">
          <div>
            <div className="greeting">Booking</div>
            <div className="greeting-date">{filtered.length} dari {bookings.length} total booking</div>
          </div>
          <div className="topbar-actions">
            <button className="btn-booking-primary" onClick={() => setShowModal(true)} type="button">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M12 5v14M5 12h14" /></svg>
              Booking Baru
            </button>
          </div>
        </div>

        <div className="filter-bar">
          <div className="search-box-booking">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="7" /><path d="M21 21l-4.3-4.3" /></svg>
            <input
              type="text"
              placeholder="Cari nama klien, kode booking, event, atau lokasi ...."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="filter-select"><CustomSelect options={tahunOptions} value={filterTahun} onChange={setFilterTahun} /></div>
          <div className="filter-select"><CustomSelect options={['Semua Bulan', ...BULAN_PENUH]} value={filterBulan} onChange={setFilterBulan} /></div>
        </div>

        {(loading || error || (!loading && !error && filtered.length === 0)) && (
          <div>
            {loading && <div className="loading-state">Memuat data...</div>}
            {error && <div className="empty-state-bookinglist" style={{ color: 'var(--ink-soft)' }}>Gagal memuat data: {error}</div>}
            {!loading && !error && filtered.length === 0 && (
              <div className="empty-state-bookinglist">
                {bookings.length === 0 ? 'Belum ada booking tercatat.' : 'Tidak ada booking yang cocok dengan pencarian/filter.'}
              </div>
            )}
          </div>
        )}

        {!loading && !error && filtered.length > 0 && (
          <div className="table-card">
            <table className="booking-table">
              <colgroup>
                <col style={{ width: '20%' }} />
                <col style={{ width: '15%' }} />
                <col style={{ width: '15%' }} />
                <col style={{ width: '25%' }} />
                <col style={{ width: '13%' }} />
                <col style={{ width: '12%' }} />
              </colgroup>
              <thead>
                <tr>
                  <th>Nama Klien</th>
                  <th>Event</th>
                  <th>Tanggal Acara</th>
                  <th>Lokasi</th>
                  <th className="right">Tagihan</th>
                  <th className="center">Status</th>
                </tr>
              </thead>
              <tbody>
                {paged.map((b) => (
                  <tr key={b.id} onClick={() => setSelectedBooking(b)}>
                    <td>
                      <div className="tbl-klien">
                        <div className={`bl-avatar${isSelesai(b.tanggal_acara, b.jam_start_makeup) ? ' selesai' : ''}`}>{initialsOf(b.nama_klien)}</div>
                        <div>
                          <div className="b-name-bookinglist">{b.nama_klien}</div>
                          <div className="b-meta-bookinglist">
                            {b.kode_booking}
                            {isSelesai(b.tanggal_acara, b.jam_start_makeup) && <span className="selesai-badge">Selesai</span>}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td>{b.event || '-'}</td>
                    <td className="mono">{formatTanggal(b.tanggal_acara)}</td>
                    <td>{b.lokasi || '-'}</td>
                    <td className="right mono">{formatRupiah(b.sisa_kekurangan)}</td>
                    <td className="center mono">
                      <span className={`status-pill ${b.status_pembayaran === 'Lunas' ? 'lunas' : 'belum'}`}>
                        {b.status_pembayaran}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {!loading && !error && filtered.length > 0 && (
          <div className="booking-pagination">
            <div className="booking-pagination-info">Menampilkan {rangeStart}–{rangeEnd} dari {filtered.length} booking</div>
            <div className="booking-pagination-buttons">
              <button type="button" disabled={pageSafe <= 1} onClick={() => setPage(pageSafe - 1)}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 18l-6-6 6-6" /></svg>
              </button>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((n) => (
                <button type="button" key={n} className={n === pageSafe ? 'sel' : ''} onClick={() => setPage(n)}>{n}</button>
              ))}
              <button type="button" disabled={pageSafe >= totalPages} onClick={() => setPage(pageSafe + 1)}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 18l6-6-6-6" /></svg>
              </button>
            </div>
          </div>
        )}
      </div>

      {showModal && (
        <BookingModal onClose={() => setShowModal(false)} onSaved={handleSaved} />
      )}

      {selectedBooking && (
        <BookingDetailModal
          booking={selectedBooking}
          onClose={() => setSelectedBooking(null)}
          onChanged={loadBookings}
        />
      )}
    </div>
  )
}
