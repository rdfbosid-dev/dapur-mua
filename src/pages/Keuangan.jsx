import { useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import ExcelJS from 'exceljs'
import { supabase } from '../lib/supabase'
import Sidebar from '../components/Sidebar'
import CustomSelect from '../components/CustomSelect'
import TrendChart from '../components/TrendChart'
import MonthlyBarChart from '../components/MonthlyBarChart'
import { useAuth } from '../context/AuthContext'
import './Keuangan.css'

const BULAN_SINGKAT = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des']
const BULAN_PENUH = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember']

function formatRupiah(n) {
  return 'Rp' + (Number(n) || 0).toLocaleString('id-ID')
}

// Nama studio dipakai buat awalan nama file export -- spasi dibuang total
// (misal "Dapur MUA" jadi "DapurMUA"), biar nama filenya bersih & valid.
function studioFilePrefix(name) {
  return (name || 'DapurMUA').replace(/\s+/g, '')
}

function TrendArrow({ curr, prev, isFirst }) {
  // Bulan pertama nggak punya pembanding -- default dianggap "naik"
  // (sesuai instruksi), kecuali datanya emang 0.
  let dir = 'flat'
  if (isFirst) dir = curr > 0 ? 'up' : 'flat'
  else if (curr > prev) dir = 'up'
  else if (curr < prev) dir = 'down'

  const paths = {
    up: <path d="M4 14l5-6 4 4 7-8M15 4h5v5" />,
    down: <path d="M4 6l5 6 4-4 7 8M15 20h5v-5" />,
    flat: <path d="M4 12h16" />,
  }
  const cls = { up: 'trend-up', down: 'trend-down', flat: 'trend-flat' }[dir]
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" className={`trend-arrow ${cls}`}>
      {paths[dir]}
    </svg>
  )
}

export default function Keuangan() {
  const location = useLocation()
  const navigate = useNavigate()
  const { profile } = useAuth()

  const [bookings, setBookings] = useState([])
  // Dua tabel BARU yang perlu ditarik khusus buat chart Tren Pengeluaran
  // (bukan dari booking_summary, soalnya "Belanja Produk"/"Pembayaran ke
  // Vendor" itu turunan dari data Add On & Paket Bundling per peserta,
  // BUKAN kolom yang udah dijumlahin di VIEW). Cuma kolom yang kepake
  // doang yang ditarik, biar query-nya ringan.
  const [pesertaAll, setPesertaAll] = useState([])
  const [bundlingAll, setBundlingAll] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [filterTahun, setFilterTahun] = useState(String(new Date().getFullYear()))
  const [chartsIn, setChartsIn] = useState(false)
  const [highlightBulan, setHighlightBulan] = useState(null)
  // Baris yang diklik-tandain user (BEDA sama highlightBulan di atas --
  // itu highlight OTOMATIS yang muncul-lalu-fade dari notifikasi/link,
  // ini TETEP nempel sampai user klik lagi buat batalin atau klik baris
  // lain). Murni penanda visual, nggak ngefek ke data/kalkulasi apapun.
  const [selectedBulan, setSelectedBulan] = useState(null)

  // Kalau halaman ini dibuka dari klik notif "Laporan Akhir Bulan" di
  // Dashboard, ada state { highlightBulan, highlightTahun } yang dikirim
  // lewat navigate(). Disimpen di ref (bukan langsung dipakai), soalnya
  // baru bisa dieksekusi SETELAH data booking-nya kelar dimuat.
  const pendingHighlightRef = useRef(
    location.state?.highlightBulan != null
      ? { bulan: location.state.highlightBulan, tahun: location.state.highlightTahun }
      : null
  )

  useEffect(() => {
    if (pendingHighlightRef.current) {
      setFilterTahun(String(pendingHighlightRef.current.tahun))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    async function load() {
      setLoading(true)
      setError('')
      const [bookingRes, pesertaRes, bundlingRes] = await Promise.all([
        supabase.from('booking_summary').select('*'),
        supabase.from('peserta').select('booking_id, dikerjakan_oleh_makeup, biaya_makeup, komisi_makeup_tim, dikerjakan_oleh_tambahan, biaya_tambahan, komisi_tambahan, layanan_lainnya, biaya_lainnya, keuntungan_lainnya, layanan_lainnya_2, biaya_lainnya_2, keuntungan_lainnya_2, layanan_lainnya_3, biaya_lainnya_3, keuntungan_lainnya_3, layanan_lainnya_4, biaya_lainnya_4, keuntungan_lainnya_4, layanan_lainnya_5, biaya_lainnya_5, keuntungan_lainnya_5'),
        supabase.from('bundling_items').select('booking_id, biaya, keuntungan'),
      ])
      if (bookingRes.error) setError(bookingRes.error.message)
      else setBookings(bookingRes.data || [])
      if (!pesertaRes.error) setPesertaAll(pesertaRes.data || [])
      if (!bundlingRes.error) setBundlingAll(bundlingRes.data || [])
      setLoading(false)
      setChartsIn(false)
      requestAnimationFrame(() => requestAnimationFrame(() => setChartsIn(true)))
    }
    load()
  }, [])

  useEffect(() => {
    setChartsIn(false)
    requestAnimationFrame(() => requestAnimationFrame(() => setChartsIn(true)))
  }, [filterTahun])

  const tahunOptions = useMemo(() => {
    const years = new Set(bookings.map((b) => new Date(b.tanggal_acara).getFullYear()))
    years.add(new Date().getFullYear())
    return Array.from(years).sort((a, b) => b - a).map(String)
  }, [bookings])

  const monthlyStats = useMemo(() => {
    return BULAN_SINGKAT.map((label, i) => {
      const bulanBookings = bookings.filter((b) => {
        const d = new Date(b.tanggal_acara)
        return d.getMonth() === i && String(d.getFullYear()) === filterTahun
      })
      return {
        label,
        booking: bulanBookings.length,
        klien: bulanBookings.reduce((s, b) => s + (Number(b.total_klien) || 0), 0),
        belanja: bulanBookings.reduce((s, b) => s + (Number(b.belanja_klien) || 0), 0),
        transport: bulanBookings.reduce((s, b) => s + (Number(b.biaya_transport) || 0), 0),
        omzet: bulanBookings.reduce((s, b) => s + (Number(b.omzet) || 0), 0),
        // SEBELUMNYA rumusnya `omzet - penghasilan` -- keliatannya masuk akal,
        // tapi ternyata itu SELALU balik jadi biaya_transport doang (buka
        // definisi VIEW booking_summary: bedanya omzet & penghasilan CUMA di
        // biaya_transport). Itu penyebab chart "Komisi dari Tim" identik
        // sama chart "Biaya Transport". Fix-nya: VIEW-nya udah nyiapin kolom
        // komisi ASLI (komisi_makeup_tim & komisi_tambahan_tim, udah
        // difilter cuma yang dikerjain Tim, bukan dikerjain sendiri) --
        // tinggal jumlahin langsung, nggak perlu diitung ulang manual.
        komisi: bulanBookings.reduce((s, b) => s + (Number(b.komisi_makeup_tim) || 0) + (Number(b.komisi_tambahan_tim) || 0), 0),
        // Komisi dari Vendor & Untung Produk -- DUA-DUANYA udah ada
        // langsung sebagai kolom jadi di VIEW booking_summary
        // (bundling_keuntungan_total & keuntungan_lainnya_total),
        // nggak perlu diitung ulang manual dari tabel lain kayak
        // "Bayar ke Tim/Vendor/Belanja Produk" di monthlyPengeluaranStats.
        komisiVendor: bulanBookings.reduce((s, b) => s + (Number(b.bundling_keuntungan_total) || 0), 0),
        untungProduk: bulanBookings.reduce((s, b) => s + (Number(b.keuntungan_lainnya_total) || 0), 0),
        penghasilan: bulanBookings.reduce((s, b) => s + (Number(b.penghasilan) || 0), 0),
      }
    })
  }, [bookings, filterTahun])

  // Data buat chart "Tren Pengeluaran" & 3 kartu bar baru di bawah --
  // 3 variabel: Pembayaran ke Tim (Makeup/Hairdo/Hijabdo+ yang
  // dikerjain Tim, biaya dikurangi komisi buat Me), Pembayaran ke
  // Vendor (dari Paket Bundling, biaya dikurangi keuntungan), Belanja
  // Produk (dari Add On, biaya dikurangi untung/modal barang). Rumusnya
  // SAMA PERSIS kayak kartu Pengeluaran di Rincian Keuangan per
  // booking -- ini cuma versi dijumlahin per bulan buat 1 tahun penuh.
  const monthlyPengeluaranStats = useMemo(() => {
    // Peta booking_id -> bulan (0-11), CUMA buat booking yang
    // tanggal_acara-nya di tahun filterTahun yang lagi difilter.
    const bulanByBookingId = {}
    bookings.forEach((b) => {
      const d = new Date(b.tanggal_acara)
      if (String(d.getFullYear()) === filterTahun) bulanByBookingId[b.id] = d.getMonth()
    })

    const pembayaranTim = Array(12).fill(0)
    const belanjaProduk = Array(12).fill(0)
    pesertaAll.forEach((p) => {
      const bulan = bulanByBookingId[p.booking_id]
      if (bulan === undefined) return

      // Pembayaran ke Tim -- Makeup & Layanan Tambahan (Hairdo/
      // Hijabdo+) yang dikerjain Tim doang, biaya penuh dikurangi
      // komisi yang di-set buat Me. Kalau komisi nggak diisi, dianggap
      // 0 (jadi Math.max jaga-jaga nilai nggak minus).
      if (p.dikerjakan_oleh_makeup === 'Tim') {
        pembayaranTim[bulan] += Math.max(0, (Number(p.biaya_makeup) || 0) - (Number(p.komisi_makeup_tim) || 0))
      }
      if (p.dikerjakan_oleh_tambahan === 'Tim') {
        pembayaranTim[bulan] += Math.max(0, (Number(p.biaya_tambahan) || 0) - (Number(p.komisi_tambahan) || 0))
      }

      for (let n = 1; n <= 5; n++) {
        const suffix = n === 1 ? '' : `_${n}`
        const nama = (p[`layanan_lainnya${suffix}`] || '').trim()
        if (!nama) continue
        const biaya = Number(p[`biaya_lainnya${suffix}`]) || 0
        const untung = Number(p[`keuntungan_lainnya${suffix}`]) || 0
        belanjaProduk[bulan] += Math.max(0, biaya - untung)
      }
    })

    const pembayaranVendor = Array(12).fill(0)
    bundlingAll.forEach((item) => {
      const bulan = bulanByBookingId[item.booking_id]
      if (bulan === undefined) return
      pembayaranVendor[bulan] += Math.max(0, (Number(item.biaya) || 0) - (Number(item.keuntungan) || 0))
    })

    return BULAN_SINGKAT.map((label, i) => ({
      label,
      pembayaranTim: pembayaranTim[i],
      belanjaProduk: belanjaProduk[i],
      pembayaranVendor: pembayaranVendor[i],
    }))
  }, [bookings, pesertaAll, bundlingAll, filterTahun])
  const adaDataPengeluaran = monthlyPengeluaranStats.some((m) => m.pembayaranTim > 0 || m.belanjaProduk > 0 || m.pembayaranVendor > 0)
  const totalPengeluaranTahun = monthlyPengeluaranStats.reduce((acc, m) => ({
    pembayaranTim: acc.pembayaranTim + m.pembayaranTim,
    belanjaProduk: acc.belanjaProduk + m.belanjaProduk,
    pembayaranVendor: acc.pembayaranVendor + m.pembayaranVendor,
  }), { pembayaranTim: 0, belanjaProduk: 0, pembayaranVendor: 0 })

  // Begitu data kelar dimuat DAN tahunnya udah sesuai target dari notif,
  // baru scroll ke baris bulan yang dimaksud + nyalain highlight sebentar
  // (2.5 detik, terus fade balik normal). State router-nya dibersihin
  // abis dipakai, biar nggak ke-trigger ulang kalau halaman ini di-refresh.
  useEffect(() => {
    const pending = pendingHighlightRef.current
    if (!pending || loading) return
    if (String(pending.tahun) !== filterTahun) return

    const el = document.getElementById(`bulan-row-${pending.bulan}`)
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' })
      setHighlightBulan(pending.bulan)
      setTimeout(() => setHighlightBulan(null), 2500)
    }
    pendingHighlightRef.current = null
    navigate(location.pathname, { replace: true, state: {} })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, filterTahun])

  const totalTahun = monthlyStats.reduce((acc, m) => ({
    booking: acc.booking + m.booking,
    klien: acc.klien + m.klien,
    belanja: acc.belanja + m.belanja,
    transport: acc.transport + m.transport,
    omzet: acc.omzet + m.omzet,
    komisi: acc.komisi + m.komisi,
    komisiVendor: acc.komisiVendor + m.komisiVendor,
    untungProduk: acc.untungProduk + m.untungProduk,
    penghasilan: acc.penghasilan + m.penghasilan,
  }), { booking: 0, klien: 0, belanja: 0, transport: 0, omzet: 0, komisi: 0, komisiVendor: 0, untungProduk: 0, penghasilan: 0 })

  const adaData = monthlyStats.some((m) => m.booking > 0)

  // Export tabel keuangan (bulanan + total) ke file .xlsx -- pakai data
  // yang UDAH keitung (monthlyStats/totalTahun), nggak query ulang ke
  // Supabase, jadi isinya dijamin sama persis kayak yang keliatan di tabel.
  // SENGAJA async -- ExcelJS nge-generate file-nya lewat Promise
  // (writeBuffer), beda sama SheetJS yang sinkron.
  async function handleExportExcel() {
    const wb = new ExcelJS.Workbook()
    const ws = wb.addWorksheet(`Keuangan ${filterTahun}`)

    ws.columns = [
      { header: 'Bulan', key: 'bulan', width: 12 },
      { header: 'Booking', key: 'booking', width: 10 },
      { header: 'Klien', key: 'klien', width: 8 },
      { header: 'Pembayaran', key: 'belanja', width: 15 },
      { header: 'Transport', key: 'transport', width: 13 },
      { header: 'Omzet', key: 'omzet', width: 15 },
      { header: 'Bayar ke Tim', key: 'bayarTim', width: 15 },
      { header: 'Komisi dari Tim', key: 'komisi', width: 15 },
      { header: 'Bayar ke Vendor', key: 'bayarVendor', width: 15 },
      { header: 'Komisi dari Vendor', key: 'komisiVendor', width: 17 },
      { header: 'Belanja Produk', key: 'belanjaProduk', width: 15 },
      { header: 'Untung Produk', key: 'untungProduk', width: 15 },
      { header: 'Penghasilan', key: 'penghasilan', width: 15 },
    ]

    // Style baris header -- bold, teks putih, background biru
    ws.getRow(1).eachCell((cell) => {
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' } }
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4472C4' } }
      cell.alignment = { horizontal: 'center' }
    })

    monthlyStats.forEach((m, i) => {
      ws.addRow({
        bulan: BULAN_PENUH[i], booking: m.booking, klien: m.klien,
        belanja: m.belanja, transport: m.transport, omzet: m.omzet,
        bayarTim: monthlyPengeluaranStats[i].pembayaranTim, komisi: m.komisi,
        bayarVendor: monthlyPengeluaranStats[i].pembayaranVendor, komisiVendor: m.komisiVendor,
        belanjaProduk: monthlyPengeluaranStats[i].belanjaProduk, untungProduk: m.untungProduk,
        penghasilan: m.penghasilan,
      })
    })

    // Baris Total -- bold, background abu-abu, biar beda dari baris bulanan
    const totalRow = ws.addRow({
      bulan: 'Total', booking: totalTahun.booking, klien: totalTahun.klien,
      belanja: totalTahun.belanja, transport: totalTahun.transport, omzet: totalTahun.omzet,
      bayarTim: totalPengeluaranTahun.pembayaranTim, komisi: totalTahun.komisi,
      bayarVendor: totalPengeluaranTahun.pembayaranVendor, komisiVendor: totalTahun.komisiVendor,
      belanjaProduk: totalPengeluaranTahun.belanjaProduk, untungProduk: totalTahun.untungProduk,
      penghasilan: totalTahun.penghasilan,
    })
    totalRow.eachCell((cell) => {
      cell.font = { bold: true }
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE7E6E6' } }
    })

    // Kolom duit diformat jadi angka Rupiah (pemisah ribuan), buat SEMUA
    // baris (termasuk baris Total, soalnya numFmt di-set per kolom).
    ;['belanja', 'transport', 'omzet', 'bayarTim', 'komisi', 'bayarVendor', 'komisiVendor', 'belanjaProduk', 'untungProduk', 'penghasilan'].forEach((key) => {
      ws.getColumn(key).numFmt = '#,##0'
    })

    // ExcelJS nggak punya "writeFile" langsung buat browser (itu cuma
    // jalan di Node.js lewat fs) -- jadi file-nya di-generate sebagai
    // buffer dulu, dibungkus jadi Blob, baru download-nya dipicu manual
    // lewat trik <a download> yang di-klik via JS.
    const buffer = await wb.xlsx.writeBuffer()
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${studioFilePrefix(profile?.studio_name)}_Rekap-Keuangan-${filterTahun}.xlsx`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="app-shell">
      <Sidebar />
      <div className="main">
        <div className="topbar">
          <div>
            <div className="greeting">Keuangan</div>
            <div className="greeting-date">Rekap bulanan sepanjang tahun</div>
          </div>
          <div className="topbar-actions topbar-actions-keuangan">
            <div className="filter-select"><CustomSelect options={tahunOptions} value={filterTahun} onChange={setFilterTahun} /></div>
            <button type="button" className="btn-booking-primary btn-export-desktop" onClick={handleExportExcel} disabled={!adaData}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 3v12m0 0l-4-4m4 4l4-4M4 21h16" /></svg>
              Export Excel
            </button>
          </div>
        </div>

        {/* Versi mobile tombol Export Excel -- elemen TERPISAH (bukan cuma
            digeser lewat CSS), sengaja ditaruh di sini (di luar .topbar,
            di atas semua konten) biar di layar sempit dia jadi baris
            sendiri di bawah subjudul "Rekap bulanan sepanjang tahun",
            di atas kartu Tren Omzet & Penghasilan. Disembunyiin di
            desktop lewat CSS (lihat .btn-export-mobile di Keuangan.css),
            munculnya gantian sama .btn-export-desktop di atas. */}
        <button type="button" className="btn-booking-primary btn-export-mobile" onClick={handleExportExcel} disabled={!adaData}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 3v12m0 0l-4-4m4 4l4-4M4 21h16" /></svg>
          Export Excel
        </button>

        {error && <div className="empty-state" style={{ color: 'var(--coral-tx)' }}>Gagal memuat data: {error}</div>}
        {loading && <div className="loading-state">Memuat data...</div>}

        {!loading && !error && (
          <>
            <div className="tren-grid">
              <div className="card-keuangan">
                <div className="card-head-keuangan"><h3>Tren Penghasilan {filterTahun}</h3></div>
                {!adaData ? (
                  <div className="empty-state">Belum ada data di tahun ini.</div>
                ) : (
                  <TrendChart
                    months={BULAN_SINGKAT}
                    mounted={chartsIn}
                    area="all"
                    series={[
                      { label: 'Penghasilan', values: monthlyStats.map((m) => m.penghasilan), color: '#6eb4ce', format: formatRupiah },
                    ]}
                  />
                )}
              </div>

              {/* Tren Pengeluaran -- 1 variabel "Pengeluaran" = total
                  Belanja Produk (dari Add On) + Pembayaran ke Vendor
                  (dari Paket Bundling) dijumlahin per bulan. Sengaja
                  pakai kartu terpisah dari Tren Penghasilan (bukan
                  ditumpuk jadi 1 chart yang sama), biar skala angkanya
                  nggak nyampur -- Penghasilan biasanya jauh lebih gede
                  dari Pengeluaran, kalau digabung 1 chart garis
                  Pengeluaran bakal keliatan rata/nempel ke bawah,
                  susah dibaca. */}
              <div className="card-keuangan">
                <div className="card-head-keuangan"><h3>Tren Pengeluaran {filterTahun}</h3></div>
                {!adaDataPengeluaran ? (
                  <div className="empty-state">Belum ada data pengeluaran di tahun ini.</div>
                ) : (
                  <TrendChart
                    months={BULAN_SINGKAT}
                    mounted={chartsIn}
                    area="all"
                    series={[
                      { label: 'Pengeluaran', values: monthlyPengeluaranStats.map((m) => m.belanjaProduk + m.pembayaranVendor), color: '#b79ae0', format: formatRupiah },
                    ]}
                  />
                )}
              </div>
            </div>

            {/* Baris 1 -- 3 kartu: Pembayaran Klien & Transport TETAP utuh
                kayak sebelumnya. Kartu ke-3 GABUNGAN (Bayar ke Tim +
                Komisi dari Tim jadi 1 chart, 2 bar sejajar per bulan)
                -- pakai prop `series` yang baru di MonthlyBarChart. */}
            <div className="bar-grid">
              <div className="card-keuangan">
                <div className="card-head-keuangan">
                  <h3>Total Pembayaran Klien {filterTahun}</h3>
                  <span className="chart-total-belanja">{formatRupiah(totalTahun.belanja)}</span>
                </div>
                <MonthlyBarChart
                  months={BULAN_SINGKAT}
                  values={monthlyStats.map((m) => m.belanja)}
                  color="var(--bar-belanja)"
                  format={formatRupiah}
                  mounted={chartsIn}
                />
              </div>

              <div className="card-keuangan">
                <div className="card-head-keuangan">
                  <h3>Total Biaya Transport dari Klien {filterTahun}</h3>
                  <span className="chart-total-transport">{formatRupiah(totalTahun.transport)}</span>
                </div>
                <MonthlyBarChart
                  months={BULAN_SINGKAT}
                  values={monthlyStats.map((m) => m.transport)}
                  color="var(--bar-transport)"
                  format={formatRupiah}
                  mounted={chartsIn}
                />
              </div>

              <div className="card-keuangan">
                <div className="card-head-keuangan">
                  <h3>Pembayaran ke Tim &amp; Komisi dari Tim {filterTahun}</h3>
                  <span className="chart-total-pair">
                    <span className="chart-total-tim">{formatRupiah(totalPengeluaranTahun.pembayaranTim)}</span>
                    {' / '}
                    <span className="chart-total-komisi">{formatRupiah(totalTahun.komisi)}</span>
                  </span>
                </div>
                <MonthlyBarChart
                  months={BULAN_SINGKAT}
                  mounted={chartsIn}
                  series={[
                    { label: 'Bayar ke Tim', values: monthlyPengeluaranStats.map((m) => m.pembayaranTim), color: 'var(--bar-tim)', format: formatRupiah },
                    { label: 'Komisi dari Tim', values: monthlyStats.map((m) => m.komisi), color: 'var(--bar-komisi)', format: formatRupiah },
                  ]}
                />
              </div>
            </div>

            {/* Baris 2 -- 2 kartu, DUA-DUANYA gabungan (Vendor, Produk).
                Potensi nambah kartu Pengeluaran lain ke depan (misal
                Portofolio) -- taruh di sini juga, di baris 2 atau baris
                baru menyusul, ngikut grid yang sama. */}
            <div className="bar-grid-2">
              <div className="card-keuangan">
                <div className="card-head-keuangan">
                  <h3>Pembayaran ke Vendor &amp; Komisi dari Vendor {filterTahun}</h3>
                  <span className="chart-total-pair">
                    <span className="chart-total-vendor">{formatRupiah(totalPengeluaranTahun.pembayaranVendor)}</span>
                    {' / '}
                    <span className="chart-total-komisi-vendor">{formatRupiah(totalTahun.komisiVendor)}</span>
                  </span>
                </div>
                <MonthlyBarChart
                  months={BULAN_SINGKAT}
                  mounted={chartsIn}
                  series={[
                    { label: 'Bayar ke Vendor', values: monthlyPengeluaranStats.map((m) => m.pembayaranVendor), color: 'var(--bar-vendor)', format: formatRupiah },
                    { label: 'Komisi dari Vendor', values: monthlyStats.map((m) => m.komisiVendor), color: 'var(--bar-komisi-vendor)', format: formatRupiah },
                  ]}
                />
              </div>

              <div className="card-keuangan">
                <div className="card-head-keuangan">
                  <h3>Belanja Produk &amp; Untung dari Produk {filterTahun}</h3>
                  <span className="chart-total-pair">
                    <span className="chart-total-produk">{formatRupiah(totalPengeluaranTahun.belanjaProduk)}</span>
                    {' / '}
                    <span className="chart-total-untung-produk">{formatRupiah(totalTahun.untungProduk)}</span>
                  </span>
                </div>
                <MonthlyBarChart
                  months={BULAN_SINGKAT}
                  mounted={chartsIn}
                  series={[
                    { label: 'Belanja Produk', values: monthlyPengeluaranStats.map((m) => m.belanjaProduk), color: 'var(--bar-produk)', format: formatRupiah },
                    { label: 'Untung Produk', values: monthlyStats.map((m) => m.untungProduk), color: 'var(--bar-untung-produk)', format: formatRupiah },
                  ]}
                />
              </div>
            </div>

            <div className="table-card-finance">
              <table className="keuangan-table">
                <colgroup>
                  <col style={{ width: '9%' }} />
                  <col style={{ width: '6%' }} />
                  <col style={{ width: '6%' }} />
                  <col style={{ width: '8%' }} />
                  <col style={{ width: '7%' }} />
                  <col style={{ width: '7%' }} />
                  <col style={{ width: '7%' }} />
                  <col style={{ width: '7%' }} />
                  <col style={{ width: '7%' }} />
                  <col style={{ width: '7%' }} />
                  <col style={{ width: '7%' }} />
                  <col style={{ width: '7%' }} />
                  <col style={{ width: '8%' }} />
                  <col style={{ width: '6%' }} />
                </colgroup>
                <thead>
                  <tr>
                    <th>Bulan</th>
                    <th className="right">Booking</th>
                    <th className="right">Klien</th>
                    <th className="right">Pembayaran Klien</th>
                    <th className="right">Transport</th>
                    <th className="right">Omzet</th>
                    <th className="right">Bayar ke Tim</th>
                    <th className="right">Komisi dari Tim</th>
                    <th className="right">Bayar ke Vendor</th>
                    <th className="right">Komisi dari Vendor</th>
                    <th className="right">Belanja Produk</th>
                    <th className="right">Untung Produk</th>
                    <th className="right">Penghasilan</th>
                    <th className="center">Tren</th>
                  </tr>
                </thead>
                <tbody>
                  {monthlyStats.map((m, i) => (
                    <tr
                      key={m.label}
                      id={`bulan-row-${i}`}
                      className={`${m.booking === 0 ? 'row-empty' : ''}${highlightBulan === i ? ' row-highlight' : ''}${selectedBulan === i ? ' row-selected' : ''}`}
                      onClick={() => setSelectedBulan((prev) => (prev === i ? null : i))}
                    >
                      <td className="bulan-cell">{BULAN_PENUH[i]}</td>
                      <td className="right mono">{m.booking}</td>
                      <td className="right mono">{m.klien}</td>
                      <td className="right mono">{formatRupiah(m.belanja)}</td>
                      <td className="right mono">{formatRupiah(m.transport)}</td>
                      <td className="right mono">{formatRupiah(m.omzet)}</td>
                      <td className="right mono">{formatRupiah(monthlyPengeluaranStats[i].pembayaranTim)}</td>
                      <td className="right mono">{formatRupiah(m.komisi)}</td>
                      <td className="right mono">{formatRupiah(monthlyPengeluaranStats[i].pembayaranVendor)}</td>
                      <td className="right mono">{formatRupiah(m.komisiVendor)}</td>
                      <td className="right mono">{formatRupiah(monthlyPengeluaranStats[i].belanjaProduk)}</td>
                      <td className="right mono">{formatRupiah(m.untungProduk)}</td>
                      <td className="right mono strong">{formatRupiah(m.penghasilan)}</td>
                      <td className="center">
                        <TrendArrow curr={m.penghasilan} prev={monthlyStats[i - 1]?.penghasilan} isFirst={i === 0} />
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td className="bulan-cell">Total</td>
                    <td className="right mono">{totalTahun.booking}</td>
                    <td className="right mono">{totalTahun.klien}</td>
                    <td className="right mono">{formatRupiah(totalTahun.belanja)}</td>
                    <td className="right mono">{formatRupiah(totalTahun.transport)}</td>
                    <td className="right mono">{formatRupiah(totalTahun.omzet)}</td>
                    <td className="right mono">{formatRupiah(totalPengeluaranTahun.pembayaranTim)}</td>
                    <td className="right mono">{formatRupiah(totalTahun.komisi)}</td>
                    <td className="right mono">{formatRupiah(totalPengeluaranTahun.pembayaranVendor)}</td>
                    <td className="right mono">{formatRupiah(totalTahun.komisiVendor)}</td>
                    <td className="right mono">{formatRupiah(totalPengeluaranTahun.belanjaProduk)}</td>
                    <td className="right mono">{formatRupiah(totalTahun.untungProduk)}</td>
                    <td className="right mono strong">{formatRupiah(totalTahun.penghasilan)}</td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
