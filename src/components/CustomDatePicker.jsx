import { useEffect, useRef, useState } from 'react'
import './CustomDatePicker.css'

const BULAN_PENUH = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember']
const HARI_PENDEK = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab']

function pad2(n) { return String(n).padStart(2, '0') }
function toISO(y, m, d) { return `${y}-${pad2(m + 1)}-${pad2(d)}` }
function parseISO(iso) {
  if (!iso) return null
  const [y, m, d] = iso.split('-').map(Number)
  if (!y || !m || !d) return null
  return new Date(y, m - 1, d)
}
function formatDisplay(iso) {
  const d = parseISO(iso)
  if (!d) return ''
  return `${pad2(d.getDate())} ${BULAN_PENUH[d.getMonth()]} ${d.getFullYear()}`
}

// Bikin grid 6x7 (42 sel) buat 1 bulan, termasuk tanggal numpang dari
// bulan sebelum/sesudah -- logikanya sama persis kayak buildGrid() di
// Kalender.jsx, biar konsisten sama halaman Kalender.
function buildGrid(year, month) {
  const firstOfMonth = new Date(year, month, 1)
  const startWeekday = firstOfMonth.getDay()
  const gridStart = new Date(year, month, 1 - startWeekday)
  const cells = []
  for (let i = 0; i < 42; i++) {
    const d = new Date(gridStart)
    d.setDate(gridStart.getDate() + i)
    cells.push({ date: d, inMonth: d.getMonth() === month })
  }
  return cells
}

export default function CustomDatePicker({ value, onChange, placeholder = 'Pilih Tanggal', variant = null, bookingDates = [] }) {
  const [open, setOpen] = useState(false)
  const selected = parseISO(value)
  const today = new Date()
  const [viewYear, setViewYear] = useState((selected || today).getFullYear())
  const [viewMonth, setViewMonth] = useState((selected || today).getMonth())
  const ref = useRef(null)

  // Peta "tanggal ISO -> jumlah booking" -- dipakai buat nentuin warna
  // kepadatan tiap sel, SAMA PERSIS logika threshold-nya kayak density
  // di Kalender.jsx (0/1/2/3/4+), biar konsisten. bookingDates isinya
  // array tanggal_acara mentah dari BookingModal (lewat props), di-itung
  // di sini aja (bukan di parent) -- lebih deket ke tempat dipakainya.
  const densityByDate = {}
  bookingDates.forEach((iso) => {
    if (!iso) return
    densityByDate[iso] = (densityByDate[iso] || 0) + 1
  })
  function densityOf(count) {
    return count === 0 ? 0 : count === 1 ? 1 : count === 2 ? 2 : count === 3 ? 3 : 4
  }

  useEffect(() => {
    function handleClickOutside(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Setiap kali dibuka, balik nampilin bulan yang ada tanggal terpilihnya
  // (atau bulan ini kalau belum ada yang dipilih) -- bukan nyangkut di
  // bulan terakhir yang sempet dijelajahin. SENGAJA cuma react ke `open`
  // (nggak masukin `selected`/`today` ke dependency array -- itu bakal
  // bikin efek ini re-run tiap ketik di field lain), dan setState di sini
  // nge-sync tampilan bulan popup ke tanggal yang lagi dipilih tiap
  // dibuka -- bukan pola cascading render yang dikhawatirin rule ini.
  /* eslint-disable react-hooks/exhaustive-deps, react-hooks/set-state-in-effect */
  useEffect(() => {
    if (open) {
      const base = selected || today
      setViewYear(base.getFullYear())
      setViewMonth(base.getMonth())
    }
  }, [open])
  /* eslint-enable react-hooks/exhaustive-deps, react-hooks/set-state-in-effect */

  function goPrev() {
    if (viewMonth === 0) { setViewMonth(11); setViewYear((y) => y - 1) }
    else setViewMonth((m) => m - 1)
  }
  function goNext() {
    if (viewMonth === 11) { setViewMonth(0); setViewYear((y) => y + 1) }
    else setViewMonth((m) => m + 1)
  }
  function pickDay(d) {
    onChange(toISO(d.getFullYear(), d.getMonth(), d.getDate()))
    setOpen(false)
  }

  const grid = buildGrid(viewYear, viewMonth)

  return (
    <div className="cdate" ref={ref}>
      <button
        type="button"
        className={`cselect-trigger${variant ? ` cselect-trigger--${variant}` : ''}${open ? ' open' : ''}`}
        onClick={() => setOpen((o) => !o)}
      >
        <span className={value ? '' : 'cdate-placeholder'}>{value ? formatDisplay(value) : placeholder}</span>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" />
        </svg>
      </button>

      {open && (
        <div className="cdate-panel">
          <div className="cdate-nav">
            <button type="button" className="cdate-nav-btn" onClick={goPrev}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 18l-6-6 6-6" /></svg>
            </button>
            <div className="cdate-title">{BULAN_PENUH[viewMonth]} {viewYear}</div>
            <button type="button" className="cdate-nav-btn" onClick={goNext}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 6l6 6-6 6" /></svg>
            </button>
          </div>
          <div className="cdate-grid cdate-head">
            {HARI_PENDEK.map((h) => <div key={h} className="cdate-headcell">{h}</div>)}
          </div>
          <div className="cdate-grid">
            {grid.map((cell, i) => {
              const isSelected = selected
                && cell.date.getFullYear() === selected.getFullYear()
                && cell.date.getMonth() === selected.getMonth()
                && cell.date.getDate() === selected.getDate()
              const isToday = cell.date.toDateString() === today.toDateString()
              const cellIso = toISO(cell.date.getFullYear(), cell.date.getMonth(), cell.date.getDate())
              const density = densityOf(densityByDate[cellIso] || 0)
              return (
                <button
                  type="button"
                  key={i}
                  className={`cdate-cell density-${density}${cell.inMonth ? '' : ' outside'}${isSelected ? ' selected' : ''}${isToday ? ' today' : ''}`}
                  onClick={() => pickDay(cell.date)}
                >
                  {cell.date.getDate()}
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
