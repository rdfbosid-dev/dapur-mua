import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import Sidebar from '../components/Sidebar'
import BookingModal from '../components/BookingModal'
import BookingDetailModal from '../components/BookingDetailModal'
import CustomDatePicker from '../components/CustomDatePicker'
import './Kalender.css'

const BULAN_PENUH = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember']
const HARI = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu']

function initialsOf(name) {
  return (name || '?')
    .split(' ')
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()
}

function sameDate(a, b) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

// Sama persis logikanya kayak di BookingList.jsx -- booking dianggap
// "selesai" kalau tanggalnya udah lewat, ATAU hari ini tapi udah lewat 4
// jam dari jam mulai makeup.
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

// Bikin grid 6x7 (42 sel) buat 1 bulan, termasuk tanggal numpang dari
// bulan sebelum/sesudah biar barisnya selalu penuh.
function buildGrid(year, month) {
  const firstOfMonth = new Date(year, month, 1)
  const startWeekday = firstOfMonth.getDay() // 0 = Minggu
  const gridStart = new Date(year, month, 1 - startWeekday)

  const cells = []
  for (let i = 0; i < 42; i++) {
    const d = new Date(gridStart)
    d.setDate(gridStart.getDate() + i)
    cells.push({ date: d, inMonth: d.getMonth() === month })
  }
  return cells
}

export default function Kalender() {
  const { user, profile, refreshProfile } = useAuth()
  const today = new Date()
  const [viewYear, setViewYear] = useState(today.getFullYear())
  const [viewMonth, setViewMonth] = useState(today.getMonth())
  const [selectedDate, setSelectedDate] = useState(today)

  const [bookings, setBookings] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [showModal, setShowModal] = useState(false)
  const [selectedBooking, setSelectedBooking] = useState(null)

  const [showKalenderLink, setShowKalenderLink] = useState(false)
  const [linkCopied, setLinkCopied] = useState(false)

  // Tanggal yang lagi dicek user lewat widget "Cek Ketersediaan Tanggal"
  // -- SENGAJA state terpisah dari `selectedDate` (yang punya grid
  // bulanan), soalnya user bisa cek tanggal di bulan/tahun manapun
  // (misal Januari 2027) TANPA perlu navigasi grid-nya dulu.
  const [cekTanggal, setCekTanggal] = useState('')

  useEffect(() => {
    // Sama persis logikanya kayak di Pengaturan.jsx -- SENGAJA disalin
    // ke sini juga (bukan cuma numpang), soalnya user bisa aja buka
    // halaman Kalender ini duluan tanpa pernah mampir ke Pengaturan,
    // jadi kode_kalender-nya belum tentu ada. Kalau kode ini cuma ada di
    // Pengaturan.jsx, banner "Hubungkan Kalender" di sini bisa nyangkut
    // nunggu kode yang nggak akan pernah muncul.
    if (profile && !profile.kode_kalender && user) {
      const kode = crypto.randomUUID().replace(/-/g, '')
      supabase.from('profiles').upsert({ id: user.id, kode_kalender: kode }).then(({ error }) => {
        if (!error) refreshProfile(user.id)
      })
    }
  }, [profile, user, refreshProfile])

  function handleCopyLink() {
    const link = `${window.location.origin}/api/kalender-ics?kode=${profile?.kode_kalender}`
    navigator.clipboard.writeText(link)
    setLinkCopied(true)
    setTimeout(() => setLinkCopied(false), 2000)
  }

  async function loadBookings() {
    setLoading(true)
    setError('')
    const { data, error } = await supabase.from('booking_summary').select('*')
    if (error) setError(error.message)
    else setBookings(data || [])
    setLoading(false)
  }
  // Fetch sekali pas komponen pertama kali dipasang (dependency array
  // kosong), pola standar "load data on mount", bukan cascading render
  // yang dikhawatirin rule ini.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { loadBookings() }, [])

  const grid = useMemo(() => buildGrid(viewYear, viewMonth), [viewYear, viewMonth])

  const bookingsByDay = useMemo(() => {
    const map = new Map()
    bookings.forEach((b) => {
      const d = new Date(b.tanggal_acara)
      const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
      if (!map.has(key)) map.set(key, [])
      map.get(key).push(b)
    })
    return map
  }, [bookings])

  function dayKey(d) {
    return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
  }
  function bookingsOn(d) {
    return bookingsByDay.get(dayKey(d)) || []
  }

  function goPrevMonth() {
    if (viewMonth === 0) { setViewMonth(11); setViewYear((y) => y - 1) }
    else setViewMonth((m) => m - 1)
  }
  function goNextMonth() {
    if (viewMonth === 11) { setViewMonth(0); setViewYear((y) => y + 1) }
    else setViewMonth((m) => m + 1)
  }
  function goToday() {
    setViewYear(today.getFullYear())
    setViewMonth(today.getMonth())
    setSelectedDate(today)
  }

  const agendaHariIni = bookingsOn(selectedDate).sort((a, b) => (a.jam_start_makeup || '').localeCompare(b.jam_start_makeup || ''))

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
            <div className="greeting">Kalender</div>
            <div className="greeting-date">Lihat & kelola jadwal booking-mu</div>
          </div>
          <div className="topbar-actions">
            <button className="btn-booking-primary" onClick={() => setShowModal(true)} type="button">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M12 5v14M5 12h14" /></svg>
              Booking Baru
            </button>
          </div>
        </div>

        {error && <div className="empty-state" style={{ color: 'var(--ink-soft)' }}>Gagal memuat data: {error}</div>}

        <div className={`kalender-connect-banner${profile?.kalender_synced_at ? ' connected' : ''}`}>
          <div className="kcb-icon">
            {profile?.kalender_synced_at ? (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 6 9 17l-5-5" /></svg>
            ) : (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="3" y="4" width="18" height="17" rx="2"/><path d="M3 9h18M8 3v3M16 3v3"/><path d="M8 14l2.5 2.5L16 11"/></svg>
            )}
          </div>
          <div className="kcb-text">
            {profile?.kalender_synced_at ? (
              <div className="kcb-title">Agenda makeup-mu udah sinkron dengan kalender di HP-mu.</div>
            ) : (
              <>
                <div className="kcb-title">Hubungkan Kalender HP</div>
                <div className="kcb-sub">Sinkronisasi jadwal booking-mu ke Google Calendar/Kalender iPhone untuk update otomatis tiap ada booking baru.</div>
              </>
            )}
          </div>
          {!profile?.kalender_synced_at && (
            <button
              type="button"
              className="kcb-btn"
              onClick={() => setShowKalenderLink((v) => !v)}
              disabled={!profile?.kode_kalender}
            >
              {!profile?.kode_kalender ? 'Menyiapkan...' : showKalenderLink ? 'Tutup' : 'Hubungkan'}
            </button>
          )}
        </div>

        {showKalenderLink && profile?.kode_kalender && !profile?.kalender_synced_at && (
          <div className="kalender-connect-panel">
            <input
              type="text"
              readOnly
              value={`${window.location.origin}/api/kalender-ics?kode=${profile.kode_kalender}`}
              onFocus={(e) => e.target.select()}
            />
            <button type="button" className="kcp-btn" onClick={handleCopyLink}>
              {linkCopied ? 'Tersalin!' : 'Salin Link'}
            </button>
          </div>
        )}

        <div className="card kalender-cek-card">
          <div className="kalender-cek-head">
            <h3>Cek Ketersediaan Tanggal</h3>
            <p>Ketik/pilih tanggal buat langsung lihat agenda di hari itu -- walau beda bulan atau tahun dari yang lagi ditampilin di kalender bawah.</p>
          </div>
          <CustomDatePicker
            value={cekTanggal}
            onChange={setCekTanggal}
            placeholder="Pilih tanggal yang mau dicek"
            variant="modal"
            bookingDates={bookings.map((b) => b.tanggal_acara)}
          />
          {cekTanggal && (() => {
            const [y, m, d] = cekTanggal.split('-').map(Number)
            const target = new Date(y, m - 1, d)
            const hasil = bookingsOn(target).sort((a, b) => (a.jam_start_makeup || '').localeCompare(b.jam_start_makeup || ''))
            return (
              <div className="kalender-cek-result">
                {hasil.length === 0 ? (
                  <div className="empty-state">Belum ada agenda makeup di tanggal ini.</div>
                ) : (
                  hasil.map((b) => (
                    <div className="dash-booking-row" key={b.id} onClick={() => setSelectedBooking(b)} style={{ cursor: 'pointer' }}>
                      <div className={`dash-b-avatar${isSelesai(b.tanggal_acara, b.jam_start_makeup) ? ' selesai' : ''}`}>{initialsOf(b.nama_klien)}</div>
                      <div className="b-info">
                        <div className="b-name">{b.nama_klien}</div>
                        <div className="b-meta">
                          {b.event || 'Booking'}{b.jam_start_makeup ? ` · ${b.jam_start_makeup.slice(0, 5)} WIB` : ''}
                        </div>
                      </div>
                      <span className={`status-pill ${b.status_pembayaran === 'Lunas' ? 'lunas' : 'belum'}`}>
                        {b.status_pembayaran}
                      </span>
                    </div>
                  ))
                )}
              </div>
            )
          })()}
        </div>

        <div className="kalender-layout">
          <div className="card kalender-card">
            <div className="kalender-nav">
              <button className="nav-btn" onClick={goPrevMonth} type="button">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 18l-6-6 6-6" /></svg>
              </button>
              <div className="kalender-title">{BULAN_PENUH[viewMonth]} {viewYear}</div>
              <button className="nav-btn" onClick={goNextMonth} type="button">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 6l6 6-6 6" /></svg>
              </button>
              <button className="today-btn" onClick={goToday} type="button">Hari Ini</button>
            </div>

            <div className="kalender-grid kalender-head">
              {HARI.map((h) => <div key={h} className="kalender-headcell">{h}</div>)}
            </div>

            <div className="kalender-grid">
              {grid.map((cell, i) => {
                const dayBookings = bookingsOn(cell.date)
                const count = dayBookings.length
                const isSelected = sameDate(cell.date, selectedDate)
                const isToday = sameDate(cell.date, today)
                const density = count === 0 ? 0 : count === 1 ? 1 : count === 2 ? 2 : count === 3 ? 3 : 4
                return (
                  <div
                    key={i}
                    className={`kalender-cell${cell.inMonth ? '' : ' outside'}${isSelected ? ' selected' : ''}`}
                    onClick={() => setSelectedDate(cell.date)}
                  >
                    <div className={`cell-circle density-${density}`}>
                      <span className="cell-date">{cell.date.getDate()}</span>
                      {isToday && <span className="today-dot"></span>}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          <div className="card agenda-card">
            <div className="card-head-kalender">
              <h3>Agenda — {selectedDate.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</h3>
            </div>
            {loading ? (
              <div className="loading-state">Memuat...</div>
            ) : agendaHariIni.length === 0 ? (
              <div className="empty-state">Tidak ada agenda makeup di tanggal ini.</div>
            ) : (
              agendaHariIni.map((b) => (
                <div className="dash-booking-row" key={b.id} onClick={() => setSelectedBooking(b)} style={{ cursor: 'pointer' }}>
                  <div className={`dash-b-avatar${isSelesai(b.tanggal_acara, b.jam_start_makeup) ? ' selesai' : ''}`}>{initialsOf(b.nama_klien)}</div>
                  <div className="b-info">
                    <div className="b-name">{b.nama_klien}</div>
                    <div className="b-meta">
                      {b.event || 'Booking'}{b.jam_start_makeup ? ` · ${b.jam_start_makeup.slice(0, 5)} WIB` : ''}
                    </div>
                  </div>
                  <span className={`status-pill ${b.status_pembayaran === 'Lunas' ? 'lunas' : 'belum'}`}>
                    {b.status_pembayaran}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {showModal && <BookingModal onClose={() => setShowModal(false)} onSaved={handleSaved} />}
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
