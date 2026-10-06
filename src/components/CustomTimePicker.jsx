import { useEffect, useRef, useState } from 'react'
import './CustomDatePicker.css'

const HOURS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'))
const MINUTES = ['00', '05', '10', '15', '20', '25', '30', '35', '40', '45', '50', '55']

// Placeholder default "--:--" (BUKAN "Pilih Jam") -- field jam di form
// Booking/Edit Booking itu kolom sempit (~87px pas padding modal 26px).
// "Pilih Jam" kepanjangan & dulu ngedorong ikon jam sampai mepet ke
// bingkai. "--:--" selebar nilai jam aslinya ("08:30"), jadi ikon selalu
// pas di posisi yang sama kayak ikon field lain. Label "Jam Mulai"/"Jam
// Selesai" di atasnya udah cukup jelas buat ngasih tau isinya apa.
export default function CustomTimePicker({ value, onChange, placeholder = '--:--', variant = null }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  const [h, m] = value ? value.split(':') : ['', '']

  useEffect(() => {
    function handleClickOutside(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  function pick(newH, newM) {
    onChange(`${newH}:${newM}`)
  }

  return (
    <div className="ctime" ref={ref}>
      <button
        type="button"
        className={`cselect-trigger${variant ? ` cselect-trigger--${variant}` : ''}${open ? ' open' : ''}`}
        onClick={() => setOpen((o) => !o)}
      >
        <span className={value ? '' : 'cdate-placeholder'}>{value || placeholder}</span>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 3" />
        </svg>
      </button>

      {open && (
        <div className="ctime-panel">
          <div className="ctime-col">
            {HOURS.map((hh) => (
              <div
                key={hh}
                className={`ctime-opt${hh === h ? ' sel' : ''}`}
                onClick={() => pick(hh, m || '00')}
              >
                {hh}
              </div>
            ))}
          </div>
          <div className="ctime-col">
            {MINUTES.map((mm) => (
              <div
                key={mm}
                className={`ctime-opt${mm === m ? ' sel' : ''}`}
                onClick={() => pick(h || '00', mm)}
              >
                {mm}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
