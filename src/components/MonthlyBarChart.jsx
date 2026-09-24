import { useLayoutEffect, useRef, useState } from 'react'
import './MonthlyBarChart.css'

// 2 mode pakai komponen ini:
// 1. SINGLE (values + color + format) -- pola lama, 1 bar per bulan.
//    Dipakai chart "Total Pembayaran Klien" & "Total Biaya Transport"
//    yang TETAP utuh, nggak berubah sama sekali.
// 2. GROUPED (series -- array of {label, values, color, format?}) --
//    BARU, 2+ bar sejajar per bulan (misal Bayar ke Tim + Komisi dari
//    Tim dalam 1 chart). Legend warna otomatis muncul di bawah axis
//    bulan kalau mode ini yang dipakai.
export default function MonthlyBarChart({ months, values, color, format, series, mounted }) {
  const [hoverIdx, setHoverIdx] = useState(null)
  const [tooltipLeft, setTooltipLeft] = useState(0)
  const barsRef = useRef(null)
  const tooltipRef = useRef(null)
  const seriesList = series || [{ label: null, values, color, format }]
  // Max SATU angka buat SEMUA series dalam 1 chart -- biar tinggi bar
  // antar-series bisa dibandingin proporsional langsung (bukan tiap
  // series punya skala sendiri-sendiri, yang bikin perbandingannya
  // nyesatin).
  const max = Math.max(...seriesList.flatMap((s) => s.values), 1)
  const grouped = seriesList.length > 1

  // Posisi tooltip diukur BENERAN (pixel asli), bukan ditebak dari index
  // kolom (0/tengah/terakhir) kayak sebelumnya -- itu cukup buat tooltip
  // 1 baris pendek ("Rp0" doang), tapi begitu isinya lebih lebar (mode
  // GROUPED, 2 baris label+angka), gampang nembus keluar kartu kalau
  // pas nge-hover kolom deket pinggir. Teknik & alasannya SAMA PERSIS
  // kayak TrendChart.jsx: ukur lebar tooltip & kontainer asli lewat
  // getBoundingClientRect, baru posisinya "diclamp" (dipentok) biar
  // nggak pernah nongol dari sisi manapun. useLayoutEffect (bukan
  // useEffect biasa) supaya pengukuran & koreksi posisi kelar SEBELUM
  // browser sempet ngegambar (nggak keliatan "loncat" sekilas).
  useLayoutEffect(() => {
    if (hoverIdx === null || !barsRef.current || !tooltipRef.current) return
    const colEl = barsRef.current.children[hoverIdx]
    if (!colEl) return
    const containerRect = barsRef.current.getBoundingClientRect()
    const colRect = colEl.getBoundingClientRect()
    const anchorPx = colRect.left + colRect.width / 2 - containerRect.left
    const tooltipWidth = tooltipRef.current.offsetWidth
    const margin = 4
    let left = anchorPx - tooltipWidth / 2
    left = Math.max(margin, Math.min(left, containerRect.width - tooltipWidth - margin))
    setTooltipLeft(left)
  }, [hoverIdx])

  return (
    <div className="mbar-wrap">
      <div className="mbar-bars" ref={barsRef}>
        {months.map((_, i) => (
          <div
            key={i}
            className="mbar-col"
            onMouseEnter={() => setHoverIdx(i)}
            onMouseLeave={() => setHoverIdx(null)}
          >
            <div className={`mbar-track${grouped ? ' mbar-track-grouped' : ''}`}>
              {seriesList.map((s, si) => (
                <div
                  key={si}
                  className={`mbar-bar${hoverIdx === i ? ' hover' : ''}`}
                  style={{
                    height: mounted ? `${s.values[i] > 0 ? Math.max((s.values[i] / max) * 100, 4) : 0}%` : '0%',
                    background: s.color,
                    transitionDelay: `${i * 0.04}s`,
                  }}
                ></div>
              ))}
            </div>
          </div>
        ))}

        {hoverIdx !== null && (
          <div
            ref={tooltipRef}
            className="mbar-tooltip"
            style={{
              left: `${tooltipLeft}px`,
              background: `color-mix(in srgb, ${seriesList[0].color} 60%, transparent)`,
            }}
          >
            <div className="tt-month">{months[hoverIdx]}</div>
            {seriesList.map((s, si) => (
              <div className="tt-val-row" key={si}>
                {s.label && <span className="tt-dot" style={{ background: s.color }}></span>}
                {s.label && <span className="tt-label">{s.label}</span>}
                <span className="tt-val">{s.format ? s.format(s.values[hoverIdx]) : s.values[hoverIdx]}</span>
              </div>
            ))}
          </div>
        )}
      </div>
      <div className="mbar-axis">
        {months.map((m) => <span key={m}>{m}</span>)}
      </div>
      {grouped && (
        <div className="mbar-legend">
          {seriesList.map((s, si) => (
            <div className="mbar-legend-row" key={si}>
              <span className="mbar-legend-dot" style={{ background: s.color }}></span>{s.label}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
