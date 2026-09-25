import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import Sidebar from '../components/Sidebar'
import CustomSelect from '../components/CustomSelect'
import DonutChart from '../components/DonutChart'
import { useInViewAnimate } from '../hooks/useInViewAnimate'
import './Laporan.css'

function formatRupiah(n) {
  return 'Rp' + (Number(n) || 0).toLocaleString('id-ID')
}

const CHART_COLORS = ['#C4A4F0', '#F0A0C0', '#E7B655', '#6FC79A', '#2868d7ff', '#f4e226ff', '#E8776C']

// "Lainnya" (hasil gabungan sisa kategori dari topNWithOthers) sengaja
// dikasih warna NETRAL sendiri, dipisah dari rotasi CHART_COLORS -- soalnya
// kalau ikut rotasi, dia gampang "numbuk" balik ke warna kategori pertama
// begitu jumlah kategori pas kelipatan panjang array warnanya.
const OTHERS_COLOR = '#978ba8ff'
function chartColor(label, i) {
  if (label === 'Lainnya') return OTHERS_COLOR
  return CHART_COLORS[i % CHART_COLORS.length]
}

// Sama persis konsepnya kayak di Dashboard.jsx -- chart "Sumber Kanal" pakai
// warna brand asli tiap platform (bukan warna generik), biar user langsung
// ngenalin sekilas mata. Platform yang nggak ada di daftar ini fallback ke
// CHART_COLORS biasa.
const SUMBER_BRAND_COLORS = {
  Instagram: '#C13584',
  WhatsApp: '#25D366',
  Facebook: '#1877F2',
  TikTok: '#000000',
  Referral: '#E7B655',
}
function sumberColor(label, i) {
  return SUMBER_BRAND_COLORS[label] || CHART_COLORS[i % CHART_COLORS.length]
}

function countBy(arr, key) {
  const counts = {}
  arr.forEach((item) => {
    const k = item[key] || '(Tidak diisi)'
    counts[k] = (counts[k] || 0) + 1
  })
  return Object.entries(counts).sort((a, b) => b[1] - a[1])
}

// Field "lokasi" biasanya diisi format "Venue, Kecamatan, Kota" (koma-
// pisah) -- buat chart Top Lokasi, kita CUMA mau 2 segmen TERAKHIR (biar
// venue yang beda-beda tapi masih 1 daerah bisa "nyatu" jadi 1 bar, bukan
// kepecah-pecah). Kalau lokasinya cuma 1 kata/frasa doang (nggak ada
// koma sama sekali, misal "Studio"), apa adanya -- nggak ada yang
// dipotong soalnya emang cuma 1 segmen.
function shortLokasi(lokasi) {
  if (!lokasi) return lokasi
  const parts = lokasi.split(',').map((s) => s.trim()).filter(Boolean)
  if (parts.length <= 2) return parts.join(', ')
  return parts.slice(-2).join(', ')
}
function topNWithOthers(countsArr, n = 5) {
  if (countsArr.length <= n) return countsArr
  const top = countsArr.slice(0, n)
  const othersTotal = countsArr.slice(n).reduce((sum, [, c]) => sum + c, 0)
  return [...top, ['Lainnya', othersTotal]]
}

export default function Laporan() {
  const [bookings, setBookings] = useState([])
  const [peserta, setPeserta] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [filterTahun, setFilterTahun] = useState(String(new Date().getFullYear()))

  // 1 hook per kartu chart -- pola sama kayak Keuangan.jsx & Dashboard.jsx.
  const [refDonutEvent, inViewDonutEvent] = useInViewAnimate()
  const [refDonutPaket, inViewDonutPaket] = useInViewAnimate()
  const [refDonutSumber, inViewDonutSumber] = useInViewAnimate()
  const [refTop10Lokasi, inViewTop10Lokasi] = useInViewAnimate()

  useEffect(() => {
    async function load() {
      setLoading(true)
      setError('')
      const [bookingRes, pesertaRes] = await Promise.all([
        supabase.from('booking_summary').select('*'),
        supabase.from('peserta').select('booking_id, jenis_paket'),
      ])
      if (bookingRes.error) setError(bookingRes.error.message)
      else setBookings(bookingRes.data || [])
      if (!pesertaRes.error) setPeserta(pesertaRes.data || [])
      setLoading(false)
    }
    load()
  }, [])

  const tahunOptions = useMemo(() => {
    const years = new Set(bookings.map((b) => new Date(b.tanggal_acara).getFullYear()))
    years.add(new Date().getFullYear())
    return Array.from(years).sort((a, b) => b - a).map(String)
  }, [bookings])

  const bookingTahunIni = bookings.filter((b) => String(new Date(b.tanggal_acara).getFullYear()) === filterTahun)
  const bookingIdsTahunIni = new Set(bookingTahunIni.map((b) => b.id))
  const pesertaTahunIni = peserta.filter((p) => bookingIdsTahunIni.has(p.booking_id))

  const totalBooking = bookingTahunIni.length
  const totalKlien = bookingTahunIni.reduce((s, b) => s + (Number(b.total_klien) || 0), 0)
  const totalOmzet = bookingTahunIni.reduce((s, b) => s + (Number(b.omzet) || 0), 0)
  const totalPenghasilan = bookingTahunIni.reduce((s, b) => s + (Number(b.penghasilan) || 0), 0)
  const totalBelumLunas = bookingTahunIni.filter((b) => b.status_pembayaran === 'Belum Lunas').length

  const eventCounts = topNWithOthers(countBy(bookingTahunIni, 'event'), 7)
  const sumberCounts = countBy(bookingTahunIni, 'sumber')
  const paketCounts = countBy(pesertaTahunIni, 'jenis_paket')
  const lokasiCounts = countBy(bookingTahunIni.map((b) => ({ ...b, lokasi: shortLokasi(b.lokasi) })), 'lokasi').slice(0, 10)

  return (
    <div className="app-shell">
      <Sidebar />
      <div className="main">
        <div className="topbar">
          <div>
            <div className="greeting">Laporan</div>
            <div className="greeting-date">Ringkasan performa 1 tahun penuh</div>
          </div>
          <div className="topbar-actions">
            <div className="filter-select"><CustomSelect options={tahunOptions} value={filterTahun} onChange={setFilterTahun} /></div>
          </div>
        </div>

        {error && <div className="empty-state" style={{ color: 'var(--ink-soft)' }}>Gagal memuat data: {error}</div>}
        {loading && <div className="loading-state">Memuat data...</div>}

        {!loading && !error && (
          <>
            <div className="kpi-grid">
              <div className="kpi-card-booking">
                <div className="kpi-label-booking">Total Booking {filterTahun}</div>
                <div className="kpi-value-booking">{totalBooking}</div>
              </div>
              <div className="kpi-card-klien">
                <div className="kpi-label-klien">Total Klien {filterTahun}</div>
                <div className="kpi-value-klien">{totalKlien}</div>
              </div>
              <div className="kpi-card-omzet">
                <div className="kpi-label-omzet">Total Omzet {filterTahun}</div>
                <div className="kpi-value-omzet">{formatRupiah(totalOmzet)}</div>
              </div>
              <div className="kpi-card-penghasilan">
                <div className="kpi-label-penghasilan">Total Penghasilan {filterTahun}</div>
                <div className="kpi-value-penghasilan">{formatRupiah(totalPenghasilan)}</div>
              </div>
            </div>

            {totalBooking === 0 ? (
              <div className="card"><div className="empty-state">Belum ada data booking di tahun {filterTahun}.</div></div>
            ) : (
              <>
                <div className="grid-4-laporan">
                  <div className="card" ref={refDonutEvent}>
                    <div className="card-head"><h3>Event</h3></div>
                    <DonutChart
                      data={eventCounts}
                      colors={eventCounts.map(([label], i) => chartColor(label, i))}
                      centerValue={totalBooking} centerLabel="ORDER"
                      mounted={inViewDonutEvent}
                    />
                    <div className="legend">
                      {eventCounts.map(([label, count], i) => (
                        <div className="legend-row" key={label}>
                          <span className="legend-dot" style={{ background: chartColor(label, i) }}></span>
                          {label}<b>{Math.round((count / totalBooking) * 100)}%</b>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="card" ref={refDonutPaket}>
                    <div className="card-head"><h3>Jenis Paket</h3></div>
                    {paketCounts.length === 0 ? <div className="empty-state">Belum ada data</div> : (
                      <>
                        <DonutChart
                          data={paketCounts} colors={paketCounts.map(([label], i) => chartColor(label, i))}
                          centerValue={pesertaTahunIni.length} centerLabel="PESERTA"
                          mounted={inViewDonutPaket}
                        />
                        <div className="legend">
                          {paketCounts.map(([label, count], i) => (
                            <div className="legend-row" key={label}>
                              <span className="legend-dot" style={{ background: chartColor(label, i) }}></span>
                              {label}<b>{Math.round((count / pesertaTahunIni.length) * 100)}%</b>
                            </div>
                          ))}
                        </div>
                      </>
                    )}
                  </div>

                  <div className="card" ref={refDonutSumber}>
                    <div className="card-head"><h3>Sumber Kanal</h3></div>
                    <DonutChart
                      data={sumberCounts}
                      colors={sumberCounts.map(([label], i) => sumberColor(label, i))}
                      centerValue={totalBooking} centerLabel="ORDER"
                      mounted={inViewDonutSumber}
                    />
                    <div className="legend">
                      {sumberCounts.map(([label, count], i) => (
                        <div className="legend-row" key={label}>
                          <span className="legend-dot" style={{ background: sumberColor(label, i) }}></span>
                          {label}<b>{Math.round((count / totalBooking) * 100)}%</b>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="card" ref={refTop10Lokasi}>
                    <div className="card-head"><h3>Top 10 Lokasi</h3></div>
                    {lokasiCounts.length === 0 ? (
                      <div className="empty-state">Belum ada data</div>
                    ) : (
                      lokasiCounts.map(([label, count], i) => (
                        <div className="bar-row" key={label}>
                          <div className="bar-row-top"><span>{label}</span><span className="mono">{count}</span></div>
                          <div className="bar-track">
                            <div
                              className="bar-fill"
                              style={{
                                width: inViewTop10Lokasi ? `${(count / lokasiCounts[0][1]) * 100}%` : '0%',
                                transitionDelay: `${i * 0.08}s`,
                              }}
                            ></div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                <div className="laporan-insight-strip">
                  <svg viewBox="0 0 24 24" fill="none" stroke="var(--h5)" strokeWidth="2"><path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.6.4.9 1.1.9 1.9v.2h5.2v-.2c0-.8.3-1.5.9-1.9A6 6 0 0 0 12 3Z" /></svg>
                  <span>
                    Sepanjang {filterTahun}, tercatat <b>{totalBooking} booking</b> dari <b>{totalKlien} klien</b>.
                    {totalBelumLunas > 0
                      ? <> Masih ada <b>{totalBelumLunas} booking</b> yang belum lunas.</>
                      : ' Semua booking sudah lunas 🎉'}
                  </span>
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  )
}
