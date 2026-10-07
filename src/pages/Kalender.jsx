import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import Sidebar from '../components/Sidebar'
import BookingModal from '../components/BookingModal'
import BookingDetailModal from '../components/BookingDetailModal'
import PengeluaranModal from '../components/PengeluaranModal'
import PengeluaranDetailModal from '../components/PengeluaranDetailModal'
import { KATEGORI_AGENDA } from '../lib/agendaPengeluaran'
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

// Singkatan di lingkaran avatar baris agenda (pelatihan/portofolio).
const SINGKATAN_AGENDA = { Portofolio: 'PF', 'Pelatihan & Kelas': 'PK' }

// "YYYY-MM-DD" (kolom date) -> kunci hari yang sama persis kayak dayKey() di
// bawah. Di-parse MANUAL (bukan new Date(str)) biar nggak geser sehari gara-gara zona waktu.
function kunciTanggal(str) {
  const [y, m, d] = String(str || '').split('-').map(Number)
  return `${y}-${(m || 1) - 1}-${d || 1}`
}

function sameDate(a, b) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

// Sama persis logikanya kayak di BookingList.jsx -- booking dianggap
// "selesai" kalau tanggalnya udah lewat, ATAU hari ini tapi udah lewat 3
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
  return (new Date() - mulai) / 3600000 >= 3
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

  // AGENDA = pelatihan/portofolio yang dicatat di halaman Pengeluaran. Ditampilin
  // di kalender ini (penanda --pill-later + baris di panel Agenda) karena
  // kegiatan itu makan waktu & ngaruh ke jadwal booking. Baris penuh dari VIEW
  // pengeluaran_summary (biar bisa dibuka lagi lewat modal Detail Pengeluaran).
  const [agendaList, setAgendaList] = useState([])
  const [detailAgenda, setDetailAgenda] = useState(null)
  const [editAgenda, setEditAgenda] = useState(null)
  const [showFormAgenda, setShowFormAgenda] = useState(false)

  const [showKalenderLink, setShowKalenderLink] = useState(false)
  const [linkCopied, setLinkCopied] = useState(false)

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

  // Ngembaliin daftar terbaru (kosong kalau gagal) -- dipakai buat nyegerin
  // modal Detail abis diedit. Gagal = kalender tetap jalan, cuma tanpa agenda.
  function loadAgenda() {
    return supabase
      .from('pengeluaran_summary').select('*').in('kategori', KATEGORI_AGENDA)
      .then(({ data, error: err }) => {
        const daftar = err ? [] : (data || [])
        setAgendaList(daftar)
        return daftar
      })
  }
  useEffect(() => { loadAgenda() }, [])

  const grid = useMemo(() => buildGrid(viewYear, viewMonth), [viewYear, viewMonth])

  const agendaByDay = useMemo(() => {
    const map = new Map()
    agendaList.forEach((a) => {
      const key = kunciTanggal(a.tanggal)
      if (!map.has(key)) map.set(key, [])
      map.get(key).push(a)
    })
    return map
  }, [agendaList])

  // Isi LEGEND di bawah kalender = kategori agenda yang ada di BULAN YANG LAGI DILIHAT
  // ("Agenda Pelatihan & Kelas" dan/atau "Agenda Portofolio") -- namanya sama persis
  // kayak kategori yang dipilih di halaman Pengeluaran. Bulan tanpa agenda nggak
  // dikasih keterangan sama sekali, dan bulan yang cuma punya Portofolio nggak
  // dibikin bingung sama keterangan Pelatihan. Tanggal numpang dari bulan lain
  // (sel redup di ujung grid) SENGAJA nggak dihitung. Urut abjad biar tetap.
  const kategoriLegend = useMemo(() => {
    const awalanBulan = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-`
    const diBulanIni = agendaList.filter((a) => String(a.tanggal || '').startsWith(awalanBulan))
    return KATEGORI_AGENDA.filter((k) => diBulanIni.some((a) => a.kategori === k)).sort((a, b) => a.localeCompare(b, 'id'))
  }, [agendaList, viewYear, viewMonth])

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
  function agendaOn(d) {
    return agendaByDay.get(dayKey(d)) || []
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

  const agendaPengeluaranHariIni = agendaOn(selectedDate)

  function handleSaved() {
    setShowModal(false)
    loadBookings()
  }

  // Alur SAMA kayak halaman Pengeluaran: klik baris -> Detail -> (Edit) -> form
  // edit -> abis disimpan balik ke Detail pakai data terbaru. Batal: balik ke Detail.
  function bukaEditDariDetail() {
    setEditAgenda(detailAgenda)
    setDetailAgenda(null)
    setShowFormAgenda(true)
  }
  async function handleAgendaSaved() {
    const idDiedit = editAgenda?.id
    setShowFormAgenda(false)
    setEditAgenda(null)
    const terbaru = await loadAgenda()
    const baris = idDiedit ? terbaru.find((p) => p.id === idDiedit) : null
    if (baris) setDetailAgenda(baris)
  }
  function handleBatalFormAgenda() {
    if (editAgenda) setDetailAgenda(editAgenda)
    setShowFormAgenda(false)
    setEditAgenda(null)
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
                <div className="kcb-sub">Sinkronisasi jadwal booking dan agenda pelatihan/portofolio-mu ke Google Calendar/Kalender iPhone untuk update otomatis tiap ada jadwal baru.</div>
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
                // Kepadatan dihitung dari JUMLAH PESERTA (total_klien dari VIEW
                // booking_summary = count(*) baris peserta per booking), BUKAN
                // jumlah booking -- 1 booking isi 3 peserta = 3 orang yang
                // di-makeup, sama capeknya kayak 3 booking terpisah.
                // Math.max(1, ...) jaga-jaga booking tanpa peserta (total_klien
                // 0) tetep kehitung 1, biar tanggalnya nggak keliatan kosong.
                const count = dayBookings.reduce((sum, b) => sum + Math.max(1, Number(b.total_klien) || 0), 0)
                const isSelected = sameDate(cell.date, selectedDate)
                const isToday = sameDate(cell.date, today)
                const density = count === 0 ? 0 : count === 1 ? 1 : count === 2 ? 2 : count === 3 ? 3 : 4
                // Penanda agenda pelatihan/portofolio (--pill-later): isi lembut kalau tanggal
                // itu BELUM ada booking (.agenda-solo) + titik kecil yang SELALU tampil,
                // jadi tetap kebaca walau tanggalnya juga sudah berwarna kepadatan booking.
                const dayAgenda = agendaOn(cell.date)
                return (
                  <div
                    key={i}
                    className={`kalender-cell${cell.inMonth ? '' : ' outside'}${isSelected ? ' selected' : ''}`}
                    onClick={() => setSelectedDate(cell.date)}
                    title={dayAgenda.length > 0 ? dayAgenda.map((a) => (a.judul ? `${a.kategori}: ${a.judul}` : a.kategori)).join('\n') : undefined}
                  >
                    <div className={`cell-circle density-${density}${dayAgenda.length > 0 && density === 0 ? ' agenda-solo' : ''}`}>
                      <span className="cell-date">{cell.date.getDate()}</span>
                      {dayAgenda.length > 0 && <span className="agenda-dot"></span>}
                      {isToday && <span className="today-dot"></span>}
                    </div>
                  </div>
                )
              })}
            </div>
            {kategoriLegend.length > 0 && (
              <div className="kalender-legend">
                {kategoriLegend.map((k) => (
                  <span className="kalender-legend-item" key={k}><span className="legend-agenda-dot"></span>Agenda {k}</span>
                ))}
              </div>
            )}
          </div>

          <div className="card agenda-card">
            <div className="card-head-kalender">
              <h3>Agenda — {selectedDate.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</h3>
            </div>
            {loading ? (
              <div className="loading-state">Memuat...</div>
            ) : agendaHariIni.length === 0 && agendaPengeluaranHariIni.length === 0 ? (
              <div className="empty-state">Tidak ada agenda makeup di tanggal ini.</div>
            ) : (
              <>
              {/* Agenda SEHARIAN (pelatihan/portofolio) di atas, kayak event seharian di
                  aplikasi kalender biasa; baru booking berjam di bawahnya. */}
              {agendaPengeluaranHariIni.map((a) => (
                <div className="dash-booking-row" key={`agenda-${a.id}`} onClick={() => setDetailAgenda(a)} style={{ cursor: 'pointer' }}>
                  <div className={`dash-b-avatar agenda${isSelesai(a.tanggal, null) ? ' selesai' : ''}`}>{SINGKATAN_AGENDA[a.kategori] || 'AG'}</div>
                  <div className="b-info">
                    <div className="b-name">{a.judul || a.kategori}</div>
                    <div className="b-meta">{[a.judul ? a.kategori : null, a.tempat, a.penyelenggara].filter(Boolean).join(' · ') || 'Agenda'}</div>
                  </div>
                  <span className="status-pill agenda">Seharian</span>
                </div>
              ))}
              {agendaHariIni.map((b) => (
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
              ))}
              </>
            )}
          </div>
        </div>
      </div>

      {showModal && <BookingModal onClose={() => setShowModal(false)} onSaved={handleSaved} />}
      {detailAgenda && (
        <PengeluaranDetailModal
          key={detailAgenda.id}
          data={detailAgenda}
          onClose={() => setDetailAgenda(null)}
          onEdit={bukaEditDariDetail}
          onDeleted={() => { setDetailAgenda(null); loadAgenda() }}
        />
      )}
      {showFormAgenda && (
        <PengeluaranModal editData={editAgenda} onClose={handleBatalFormAgenda} onSaved={handleAgendaSaved} />
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
