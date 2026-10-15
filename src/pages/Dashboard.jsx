import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'
import Sidebar from '../components/Sidebar'
import BookingModal from '../components/BookingModal'
import Toast from '../components/Toast'
import { useToast } from '../lib/useToast'
import BookingDetailModal from '../components/BookingDetailModal'
import OnboardingModal from '../components/OnboardingModal'
import PembaruanModal from '../components/PembaruanModal'
import DonutChart from '../components/DonutChart'
import TrendChart from '../components/TrendChart'
import { useInViewAnimate } from '../hooks/useInViewAnimate'
import { bookingSelesai } from '../lib/durasiBooking'
import { kelasStatusPembayaran, STATUS_BELUM_ADA_TAGIHAN } from '../lib/statusPembayaran'
import { jamZona, kodeZona } from '../lib/zonaWaktu'
import { VERSI_PEMBARUAN, bacaPembaruan, tandaiPembaruan, pembaruanDiLonceng } from '../lib/pembaruan'
import { muatPermintaanBaru } from '../lib/bookingOnline'
import { usePantauPermintaan } from '../lib/pantauPermintaan'
import './Dashboard.css'
import '../components/Permintaan.css'

function formatRupiah(n) {
  return 'Rp' + (Number(n) || 0).toLocaleString('id-ID')
}

function initialsOf(name) {
  return (name || '?')
    .split(' ')
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()
}

function dayLabel(b) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const target = new Date(b.tanggal_acara)
  target.setHours(0, 0, 0, 0)
  const diffDays = Math.round((target - today) / 86400000)

  if (diffDays === 0) {
    // Booking hari ini -- badge diganti "Selesai" (netral) begitu lewat jam
    // selesai: jam selesai yang diisi, atau 2 jam per klien dari jam mulai
    // kalau kosong (aturan di lib/durasiBooking.js, sama di semua halaman).
    if (bookingSelesai(b)) return { text: 'Selesai', cls: 'selesai' }
    return { text: 'Hari ini', cls: 'today' }
  }
  if (diffDays === 1) return { text: 'H-1', cls: 'today' }
  if (diffDays > 1 && diffDays <= 6) return { text: `H-${diffDays}`, cls: 'soon' }
  if (diffDays > 6) return { text: 'Minggu depan', cls: 'later' }
  return { text: 'Lewat', cls: 'later' }
}

function formatTanggal(dateStr) {
  return new Date(dateStr).toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' })
}

export default function Dashboard() {
  const { user, profile } = useAuth()
  // Zona waktu MUA (WIB/WITA/WIT, dari Pengaturan) -- lihat lib/zonaWaktu.js.
  const zona = kodeZona(profile)
  const { theme } = useTheme()
  const isDark = theme === 'dark'
  const [bookings, setBookings] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [showOnboarding, setShowOnboarding] = useState(false)
  // Info pembaruan ("Update 1.1") -- lihat lib/pembaruan.js.
  const [showPembaruan, setShowPembaruan] = useState(false)
  const [pembaruanDilihat, setPembaruanDilihat] = useState(null)
  const [selectedBooking, setSelectedBooking] = useState(null)
  const [notifOpen, setNotifOpen] = useState(false)
  const [notifReadKey, setNotifReadKey] = useState('')
  const navigate = useNavigate()
  const [toast, tampilkanToast] = useToast()
  // Permintaan booking BARU dari link booking online (lib/bookingOnline.js).
  // Gagal dimuat (misal SQL-nya belum dijalankan) -> kosong, Dashboard normal.
  // Dimuat ulang otomatis begitu ada permintaan masuk/berubah (tanpa refresh,
  // lib/pantauPermintaan.js) -> titik merah lonceng langsung nyala.
  const uid = user?.id || null
  const [permintaanBaru, setPermintaanBaru] = useState([])
  const [versiPermintaan, setVersiPermintaan] = useState(0)
  usePantauPermintaan(uid, () => setVersiPermintaan((v) => v + 1))
  useEffect(() => {
    let batal = false
    if (uid) muatPermintaanBaru().then((d) => { if (!batal) setPermintaanBaru(d) })
    return () => { batal = true }
  }, [uid, versiPermintaan])

  async function loadBookings() {
    setLoading(true)
    setError('')
    const { data, error } = await supabase
      .from('booking_summary')
      .select('*')
      .order('tanggal_acara', { ascending: true })
      .order('jam_start_makeup', { ascending: true })

    if (error) {
      setError(error.message)
    } else {
      setBookings(data || [])
      // Munculin sambutan cuma buat akun yang beneran baru (belum ada
      // booking sama sekali) DAN belum pernah nutup sambutan ini sebelumnya.
      let sambutan = false
      if (user && (data || []).length === 0) {
        const key = `dapurmua-onboarded-${user.id}`
        if (!localStorage.getItem(key)) {
          setShowOnboarding(true)
          sambutan = true
        }
      }
      // Info pembaruan cuma buat user LAMA yang belum pernah lihat. Akun
      // baru (lagi dapat sambutan di atas) nggak dikasih -- dua modal nggak
      // pernah numpuk, & pas sambutannya ditutup, pembaruan ditandai beres.
      if (user && !sambutan && !bacaPembaruan(user.id)) {
        setShowPembaruan(true)
      }
    }
    setLoading(false)
  }

  function dismissOnboarding() {
    setShowOnboarding(false)
    if (user) localStorage.setItem(`dapurmua-onboarded-${user.id}`, '1')
    // Akun baru: semuanya memang baru, info pembaruan nggak perlu muncul.
    if (user) tandaiPembaruan(user.id, 'baru')
  }

  // Tutup info pembaruan. Waktu tutupnya dicatat SEKALI (pertama kali), jadi
  // buka-tutup lagi lewat lonceng nggak memperpanjang masa tampil di lonceng.
  function tutupPembaruan() {
    setShowPembaruan(false)
    if (!user) return
    tandaiPembaruan(user.id, Date.now())
    setPembaruanDilihat(bacaPembaruan(user.id))
  }

  // Fetch sekali pas komponen pertama kali dipasang, pola standar
  // "load data on mount" -- bukan cascading render yang dikhawatirin.
  /* eslint-disable react-hooks/set-state-in-effect, react-hooks/exhaustive-deps */
  useEffect(() => {
    loadBookings()
  }, [])
  /* eslint-enable react-hooks/set-state-in-effect, react-hooks/exhaustive-deps */

  // Baca status "notifikasi udah dibaca" dari localStorage sekali pas
  // user-nya kebaca (bukan setiap render) -- sama persis alasannya
  // kayak effect di atas.
  useEffect(() => {
    if (!user) return
    const stored = localStorage.getItem(`dapurmua-notif-read-${user.id}`)
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (stored) setNotifReadKey(stored)
    setPembaruanDilihat(bacaPembaruan(user.id))
  }, [user])

  function handleBookingSaved(kodeBooking) {
    setShowModal(false)
    tampilkanToast(`Booking ${kodeBooking} berhasil disimpan ✅`)
    loadBookings()
  }

  const today = new Date()
  const curMonth = today.getMonth()
  const curYear = today.getFullYear()

  const isThisMonth = (b) => {
    const d = new Date(b.tanggal_acara)
    return d.getMonth() === curMonth && d.getFullYear() === curYear
  }
  const isToday = (b) => {
    const d = new Date(b.tanggal_acara)
    return d.toDateString() === today.toDateString()
  }

  const bookingBulanIni = bookings.filter(isThisMonth)
  const pesertaBulanIni = bookingBulanIni.reduce((sum, b) => sum + (Number(b.total_klien) || 0), 0)

  // ---- Notifikasi: booking dalam 3 hari ke depan (sampai PERSIS jam
  // mulai makeup-nya, bukan cuma tanggalnya doang) + pengingat laporan
  // bulanan kalau hari ini kebetulan hari terakhir di bulan ini, +
  // pengingat "siapkan invoice" buat booking yang jam mulainya udah
  // lewat tapi invoice-nya belum pernah dikirim WA/didownload. ----
  const in3Days = new Date(today)
  in3Days.setDate(in3Days.getDate() + 3)

  // Gabungin tanggal_acara + jam_start_makeup jadi 1 Date persis. Kalau
  // jam_start_makeup kosong, fallback-nya "akhir hari itu" -- konsisten
  // sama pola bookingSelesai() yang dipakai di Kalender.jsx/
  // BookingDetailModal.jsx (booking tanpa jam dianggap belum lewat
  // selama masih di tanggal yang sama).
  function waktuMulai(b) {
    const d = new Date(b.tanggal_acara)
    if (b.jam_start_makeup) {
      const [jam, menit] = b.jam_start_makeup.split(':').map(Number)
      d.setHours(jam, menit || 0, 0, 0)
    } else {
      d.setHours(23, 59, 59, 999)
    }
    return d
  }

  const now = new Date()
  const bookingSegera = bookings
    .filter((b) => {
      const mulai = waktuMulai(b)
      return mulai > now && mulai <= in3Days
    })
    .sort((a, b) => new Date(a.tanggal_acara) - new Date(b.tanggal_acara))

  // Booking yang lagi di jendela H-1 s/d H+1 (highlight khusus, TERPISAH
  // dari bookingSegera di atas -- dua-duanya SENGAJA boleh muncul
  // bareng buat booking yang sama, ini cuma reminder tambahan yang lebih
  // "nempel" ke urusan invoice, bukan gantiin reminder booking biasa).
  // Jendelanya: H-1 jam 00:00 sampai H+1 jam 23:59:59 -- misal acara
  // 20 September, notif ini nongol 19-21 September, ilang mulai 22
  // September (H+2).
  const perluInvoice = bookings
    .filter((b) => {
      const acara = new Date(b.tanggal_acara)
      acara.setHours(0, 0, 0, 0)
      const mulaiWindow = new Date(acara)
      mulaiWindow.setDate(mulaiWindow.getDate() - 1)
      const akhirWindow = new Date(acara)
      akhirWindow.setDate(akhirWindow.getDate() + 2)
      return now >= mulaiWindow && now < akhirWindow
    })
    .sort((a, b) => new Date(a.tanggal_acara) - new Date(b.tanggal_acara))

  const isAkhirBulan = new Date(curYear, curMonth + 1, 0).getDate() === today.getDate()
  // Notif laporan muncul 2 hari: tanggal TERAKHIR bulan (laporan bulan
  // ini) DAN tanggal 1 bulan baru (laporan bulan KEMARIN) -- biar nggak
  // kelewat kalau user nggak buka app pas tanggal terakhir.
  const isTanggalSatu = today.getDate() === 1
  const laporanBulan = isTanggalSatu ? (curMonth === 0 ? 11 : curMonth - 1) : curMonth
  const laporanTahun = isTanggalSatu && curMonth === 0 ? curYear - 1 : curYear
  const namaLaporanBulan = new Date(laporanTahun, laporanBulan, 1).toLocaleDateString('id-ID', { month: 'long' })

  const notifications = [
    // Permintaan booking dari link online -- paling atas, karena calon klien
    // nunggu dikonfirmasi. Klik = buka halaman Permintaan Booking.
    ...permintaanBaru.map((p) => ({
      type: 'permintaan',
      id: `permintaan-${p.id}`,
      title: `Permintaan booking dari ${p.nama_klien}`,
      desc: [formatTanggal(p.tanggal_acara), p.event].filter(Boolean).join(' · '),
      lokasi: null,
    })),
    ...perluInvoice.map((b) => ({
      type: 'invoice',
      // Prefix "invoice-" WAJIB ada -- booking yang sama bisa punya 2
      // notifikasi sekaligus (invoice + booking reminder) di jendela
      // H-1/H/H+1. Tanpa prefix ini, id-nya bentrok sama notifikasi
      // booking (dua-duanya numpang b.id polos), bikin React `key`
      // dobel & salah render salah satu notifikasinya.
      id: `invoice-${b.id}`,
      title: `Invoice untuk ${b.nama_klien}`,
      desc: [
        formatTanggal(b.tanggal_acara),
        b.jam_start_makeup ? jamZona(b.jam_start_makeup, zona) : null,
      ].filter(Boolean).join(' · '),
      lokasi: b.lokasi || null,
      booking: b,
    })),
    ...bookingSegera.map((b) => ({
      type: 'booking',
      id: b.id,
      title: `${b.nama_klien} — ${b.event || 'Booking'}`,
      desc: [
        formatTanggal(b.tanggal_acara),
        b.jam_start_makeup ? jamZona(b.jam_start_makeup, zona) : null,
      ].filter(Boolean).join(' · '),
      lokasi: b.lokasi || null,
      booking: b,
    })),
    ...((isAkhirBulan || isTanggalSatu) ? [{
      type: 'laporan',
      // ID WAJIB nyertain bulan & tahun laporannya. SEBELUMNYA statis
      // 'laporan-bulan' -- bulan lalu udah dibaca, bulan ini ID-nya sama
      // persis, jadi titik merah lonceng nggak nyala. Tanggal terakhir &
      // tanggal 1 SENGAJA berbagi ID yang sama (laporannya sama), jadi
      // kalau udah dibaca pas tanggal terakhir, nggak nyala lagi besoknya.
      id: `laporan-bulan-${laporanTahun}-${laporanBulan + 1}`,
      bulan: laporanBulan,
      tahun: laporanTahun,
      title: `Laporan bulan ${namaLaporanBulan} ${laporanTahun} udah lengkap`,
      desc: 'Cek rekap Keuangan & Laporan sekarang.',
    }] : []),
    // Item "Yang baru" -- cuma buat user lama yang udah nutup modalnya,
    // selama beberapa hari (lib/pembaruan.js). Klik = buka modalnya lagi.
    ...(pembaruanDiLonceng(pembaruanDilihat) ? [{
      type: 'pembaruan',
      id: `pembaruan-${VERSI_PEMBARUAN}`,
      title: `Yang baru di Update ${VERSI_PEMBARUAN}`,
      desc: 'Link booking online, permintaan booking, dan lainnya.',
    }] : []),
  ]
  // Item pembaruan SENGAJA nggak ikut nyalain titik merah -- user udah
  // lihat modalnya, item ini cuma buat dibuka lagi kalau perlu.
  const notifKey = notifications.filter((n) => n.type !== 'pembaruan').map((n) => n.id).join(',')
  const hasUnreadNotif = notifKey !== '' && notifReadKey !== notifKey

  // Titik merah di lonceng HANYA hilang lewat tombol "Tandai sudah dibaca" di
  // panel (membuka panel / mengetuk satu notifikasi nggak menghilangkannya).
  // Yang disimpan = daftar ID notifikasi saat ini, jadi begitu ada notifikasi
  // BARU (ID-nya beda), titiknya otomatis muncul lagi.
  function tandaiSudahDibaca() {
    setNotifReadKey(notifKey)
    if (!user) return
    try { localStorage.setItem(`dapurmua-notif-read-${user.id}`, notifKey) } catch { /* penyimpanan diblokir: tetap hilang selama sesi ini */ }
  }
  const omzetBulanIni = bookingBulanIni.reduce((sum, b) => sum + (Number(b.omzet) || 0), 0)
  const penghasilanBulanIni = bookingBulanIni.reduce((sum, b) => sum + (Number(b.penghasilan) || 0), 0)
  const belanjaKlienBulanIni = bookingBulanIni.reduce((sum, b) => sum + (Number(b.belanja_klien) || 0), 0)
  const transportBulanIni = bookingBulanIni.reduce((sum, b) => sum + (Number(b.biaya_transport) || 0), 0)
  // SEBELUMNYA "omzetBulanIni - penghasilanBulanIni" -- itu SALAH.
  // komisi_makeup_tim & komisi_tambahan_tim itu ada di rumus omzet MAUPUN
  // penghasilan (VIEW booking_summary) dengan koefisien yang SAMA, jadi
  // kalau dikurangin, dua-duanya JUSTRU SALING CORET (bukan kehitung).
  // Hasil pengurangan yang lama itu sebenarnya Transport + Belanja Produk
  // + Bayar ke Vendor Bundling -- bukan Komisi dari Tim sama sekali.
  // Sekarang dijumlahin LANGSUNG dari kolom yang emang udah ada di VIEW.
  const komisiTimBulanIni = bookingBulanIni.reduce((sum, b) => sum + (Number(b.komisi_makeup_tim) || 0) + (Number(b.komisi_tambahan_tim) || 0), 0)
  // Booking bertagihan Rp0 ('Belum Ada Tagihan') SENGAJA nggak masuk hitungan
  // Belum Lunas -- nggak ada uang yang perlu ditagih. Dihitung terpisah buat
  // pengingat di strip insight bawah.
  const belumLunas = bookingBulanIni.filter((b) => b.status_pembayaran === 'Belum Lunas')
  const belumAdaTagihan = bookingBulanIni.filter((b) => b.status_pembayaran === STATUS_BELUM_ADA_TAGIHAN)
  const bookingHariIni = bookings.filter(isToday)

  function countBy(arr, key) {
    const counts = {}
    arr.forEach((item) => {
      const k = item[key] || '(Tidak diisi)'
      counts[k] = (counts[k] || 0) + 1
    })
    return Object.entries(counts).sort((a, b) => b[1] - a[1])
  }

  // Gabungin sisanya jadi "Lainnya" kalau kategorinya lebih dari N,
  // biar donut Event nggak "pecah" jadi kebanyakan potongan kecil.
  function topNWithOthers(countsArr, n = 5) {
    if (countsArr.length <= n) return countsArr
    const top = countsArr.slice(0, n)
    const othersTotal = countsArr.slice(n).reduce((sum, [, c]) => sum + c, 0)
    return [...top, ['Lainnya', othersTotal]]
  }

  // Field "lokasi" biasanya diisi format "Venue, Kecamatan, Kota" (koma-
  // pisah) -- buat chart Top Lokasi, kita CUMA mau 2 segmen TERAKHIR (biar
  // venue yang beda-beda tapi masih 1 daerah bisa "nyatu" jadi 1 bar,
  // bukan kepecah-pecah). Kalau lokasinya cuma 1 kata/frasa doang (nggak
  // ada koma sama sekali, misal "Studio"), apa adanya.
  function shortLokasi(lokasi) {
    if (!lokasi) return lokasi
    const parts = lokasi.split(',').map((s) => s.trim()).filter(Boolean)
    if (parts.length <= 2) return parts.join(', ')
    return parts.slice(-2).join(', ')
  }

  const eventCounts = topNWithOthers(countBy(bookingBulanIni, 'event'), 7)
  const sumberCounts = countBy(bookingBulanIni, 'sumber')
  const lokasiCounts = countBy(bookingBulanIni.map((b) => ({ ...b, lokasi: shortLokasi(b.lokasi) })), 'lokasi').slice(0, 5)
  const CHART_COLORS = ['#C4A4F0', '#F0A0C0', '#E7B655', '#6FC79A', '#2868d7ff', '#f4e226ff', '#E8776C']
  // "Lainnya" sengaja dikasih warna netral sendiri (bukan ikut rotasi
  // CHART_COLORS) -- biar nggak numbuk balik ke warna kategori pertama kalau
  // jumlah kategorinya pas kelipatan panjang array warnanya.
  const OTHERS_COLOR = '#978ba8ff'
  function chartColor(label, i) {
    if (label === 'Lainnya') return OTHERS_COLOR
    return CHART_COLORS[i % CHART_COLORS.length]
  }
  // Warna garis tren dibedain per tema -- versi terang butuh warna gelap
  // biar kebaca di atas kartu putih, versi dark butuh warna cerah biar
  // nggak "ilang" ketelen background gelap.
  const trendColorA = isDark ? '#6eb4ce' : '#6eb4ce'
  const trendColorB = isDark ? '#b79ae0' : '#b79ae0'

  // 1 hook per kartu chart -- masing-masing punya ref & status "lagi
  // kelihatan di layar apa nggak" SENDIRI-SENDIRI (IntersectionObserver),
  // pola yang sama kayak di halaman Keuangan. Animasi jalan tiap kartu
  // di-scroll masuk viewport, jalan ULANG tiap keluar-masuk lagi.
  const [refTrenBookingKlien, inViewTrenBookingKlien] = useInViewAnimate()
  const [refTrenOmzetPenghasilan, inViewTrenOmzetPenghasilan] = useInViewAnimate()
  const [refDonutEvent, inViewDonutEvent] = useInViewAnimate()
  const [refDonutSumber, inViewDonutSumber] = useInViewAnimate()
  const [refTop5Lokasi, inViewTop5Lokasi] = useInViewAnimate()

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

  const BULAN_SINGKAT = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des']
  const BULAN_PENUH = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember']
  const namaBulanIni = BULAN_PENUH[curMonth]

  const prevMonthIdx = curMonth === 0 ? 11 : curMonth - 1
  const prevMonthYear = curMonth === 0 ? curYear - 1 : curYear
  const namaBulanLalu = BULAN_PENUH[prevMonthIdx]
  const bookingBulanLalu = bookings.filter((b) => {
    const d = new Date(b.tanggal_acara)
    return d.getMonth() === prevMonthIdx && d.getFullYear() === prevMonthYear
  })
  const penghasilanBulanLalu = bookingBulanLalu.reduce((sum, b) => sum + (Number(b.penghasilan) || 0), 0)
  const hasNoGrowthData = penghasilanBulanIni === 0 && penghasilanBulanLalu === 0
  const growthPct = hasNoGrowthData
    ? 0
    : penghasilanBulanLalu > 0
      ? Math.round(((penghasilanBulanIni - penghasilanBulanLalu) / penghasilanBulanLalu) * 100)
      : (penghasilanBulanIni > 0 ? 100 : 0)
  const growthStatus = hasNoGrowthData ? 'none' : (penghasilanBulanIni >= penghasilanBulanLalu ? 'up' : 'down')
  const monthlyStats = BULAN_SINGKAT.map((label, i) => {
    const bulanBookings = bookings.filter((b) => {
      const d = new Date(b.tanggal_acara)
      return d.getMonth() === i && d.getFullYear() === curYear
    })
    return {
      label,
      booking: bulanBookings.length,
      klien: bulanBookings.reduce((sum, b) => sum + (Number(b.total_klien) || 0), 0),
      omzet: bulanBookings.reduce((sum, b) => sum + (Number(b.omzet) || 0), 0),
      penghasilan: bulanBookings.reduce((sum, b) => sum + (Number(b.penghasilan) || 0), 0),
    }
  })
  const adaDataTahunIni = monthlyStats.some((m) => m.booking > 0)

  const bookingTerdekat = bookings
    .filter((b) => new Date(b.tanggal_acara) >= new Date(today.toDateString()))
    .slice(0, 5)

  // Dijadiin variable (bukan langsung ditulis di JSX) soalnya dipakai 2x:
  // 1x buat desktop (di dalam .topbar-actions), 1x lagi dikirim ke Sidebar
  // buat header mobile (lewat prop headerAction). Dua-duanya nyambung ke
  // state notifOpen yang SAMA, jadi tetep sinkron -- yang keliatan cuma
  // salah satu doang tergantung lebar layar (diatur lewat CSS).
  const notifButton = (
    <div className="notif-wrap">
      <button
        type="button"
        className={`icon-btn${hasUnreadNotif ? ' has-dot' : ''}`}
        onClick={() => setNotifOpen((v) => !v)}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.7 21a2 2 0 0 1-3.4 0"/></svg>
      </button>

      {notifOpen && (
        <>
          <div className="notif-backdrop" onClick={() => setNotifOpen(false)}></div>
          <div className="notif-panel">
            <div className="notif-drag-handle"></div>
            <div className="notif-panel-head">
              <span>Notifikasi</span>
              {/* Selalu tampil selama ada notifikasi: kalau semuanya sudah dibaca,
                  tombolnya redup & nonaktif (bukan hilang), biar user tahu
                  fiturnya ada dan statusnya jelas. */}
              {notifKey !== '' && (
                <button type="button" className="notif-tandai-baca" onClick={tandaiSudahDibaca} disabled={!hasUnreadNotif}>
                  {hasUnreadNotif ? 'Tandai sudah dibaca' : 'Sudah dibaca'}
                </button>
              )}
              <div
                className="notif-close-btn"
                onClick={() => setNotifOpen(false)}
                aria-label="Tutup notifikasi"
              >
              </div>
            </div>
            {notifications.length === 0 ? (
              <div className="notif-empty">Nggak ada notifikasi baru saat ini.</div>
            ) : (
              notifications.map((n) => (
                <div
                  className="notif-item"
                  key={n.id}
                  onClick={() => {
                    setNotifOpen(false)
                    if (n.type === 'booking' || n.type === 'invoice') setSelectedBooking(n.booking)
                    else if (n.type === 'pembaruan') setShowPembaruan(true)
                    else if (n.type === 'permintaan') navigate('/permintaan')
                    else navigate('/keuangan', { state: { highlightBulan: n.bulan, highlightTahun: n.tahun } })
                  }}
                >
                  <div className={`notif-icon ${n.type}`}>
                    {n.type === 'booking' ? (
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="17" rx="2"/><path d="M3 9h18M8 3v3M16 3v3"/></svg>
                    ) : n.type === 'invoice' ? (
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M7 3h8l4 4v14H7z"/><path d="M15 3v4h4M9 12h6M9 16h6"/></svg>
                    ) : n.type === 'permintaan' ? (
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 4h16v12H5.2L4 17.2z"/><path d="M8 9h8M8 12h5"/></svg>
                    ) : n.type === 'pembaruan' ? (
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z"/><path d="M19 17l.7 1.8 1.8.7-1.8.7-.7 1.8-.7-1.8-1.8-.7 1.8-.7z"/></svg>
                    ) : (
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 3v18h18"/><path d="M7 14l4-5 3 3 5-7"/></svg>
                    )}
                  </div>
                  <div>
                    <div className="notif-item-title">{n.title}</div>
                    <div className="notif-item-desc">{n.desc}</div>
                    {n.lokasi && <div className="notif-item-loc">{n.lokasi}</div>}
                  </div>
                </div>
              ))
            )}
          </div>
        </>
      )}
    </div>
  )

  return (
    <div className="app-shell">
      <Sidebar headerAction={notifButton} />
      <div className="main">
        <div className="topbar topbar-dashboard">
          <div>
            <div className="greeting">Halo, {profile?.studio_name || 'Pengguna Baru'}!</div>
            <div className="greeting-date">
              {today.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
            </div>
          </div>
          <div className="topbar-actions">
            {notifButton}
            <button className="btn-booking-primary" onClick={() => setShowModal(true)} type="button">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M12 5v14M5 12h14"/></svg>
              Booking Baru
            </button>
          </div>
        </div>

        {error && <div className="empty-state" style={{ color: 'var(--coral-tx)' }}>Gagal memuat data: {error}</div>}
        {loading && <div className="loading-state">Memuat data...</div>}

        {!loading && !error && (
          <>
            <div className="kpi-grid">
              <div className="kpi-card-today">
                <div className="kpi-top">
                  <span className="kpi-label-today">Hari Ini</span>
                  <div className="kpi-icon" style={{ background: '#3e77b4' }}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="var(--h7)" strokeWidth="2"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/></svg>
                  </div>
                </div>
                <div className="kpi-value-today">{bookingHariIni.length}</div>
                <div className="kpi-sub-today">Booking terjadwal</div>
              </div>

              <div className="kpi-card-month">
                <div className="kpi-top">
                  <span className="kpi-label-month">Booking Bulan Ini</span>
                  <div className="kpi-icon" style={{ background: '#9057bc' }}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="var(--h7)" strokeWidth="2"><rect x="3" y="4" width="18" height="17" rx="2"/><path d="M3 9h18M8 3v3M16 3v3"/></svg>
                  </div>
                </div>
                <div className="kpi-value-month">{bookingBulanIni.length} <span className="kpi-unit">booking</span></div>
                <div className="kpi-sub-month">{pesertaBulanIni} klien</div>
              </div>

              <div className="kpi-card-hasil">
                <div className="kpi-top">
                  <span className="kpi-label-hasil">Penghasilan</span>
                  <div className="kpi-icon" style={{ background: '#2b8d76' }}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="var(--h7)" strokeWidth="2"><path d="M3 3v18h18"/><path d="M7 14l4-5 3 3 5-7"/></svg>
                  </div>
                </div>
                <div className="kpi-value-hasil">{formatRupiah(penghasilanBulanIni)}</div>
                <div className="kpi-sub-hasil">Total bulan ini</div>
              </div>

              <div className="kpi-card-status">
                <div className="kpi-top">
                  <span className="kpi-label-status">Belum Lunas</span>
                  <div className="kpi-icon" style={{ background: '#c54c61' }}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="var(--h7)" strokeWidth="2"><path d="M12 2 2 21h20L12 2Z"/><path d="M12 9v6M12 18v.01"/></svg>
                  </div>
                </div>
                <div className="kpi-value-status">{belumLunas.length}</div>
                <div className="kpi-sub-status">Klien perlu ditagih bulan ini</div>
              </div>
            </div>

            <div className="content-grid">
              <div className="card-dashboard">
                <div className="card-dashboard-head">
                  <h3>Booking Terdekat</h3>
                  <a href="/booking">Lihat semua →</a>
                </div>

                {bookingTerdekat.length === 0 ? (
                  <div className="empty-state-dashboard-grid">Belum ada booking mendatang.</div>
                ) : (
                  bookingTerdekat.map((b) => {
                    const day = dayLabel(b)
                    return (
                      <div className="dash-booking-row" key={b.id} onClick={() => setSelectedBooking(b)} style={{ cursor: 'pointer' }}>
                        <div className={`dash-b-avatar${day.cls === 'selesai' ? ' selesai' : ''}`}>{initialsOf(b.nama_klien)}</div>
                        <div className="b-info">
                          <div className="b-name">{b.nama_klien}</div>
                          <div className="b-meta">
                            {b.event || 'Booking'} · {formatTanggal(b.tanggal_acara)}
                            {b.jam_start_makeup ? ` · ${jamZona(b.jam_start_makeup, zona)}` : ''}
                          </div>
                        </div>
                        <div className="dash-booking-row-right">
                          <span className={`dashboard-day-pill ${day.cls}`}>{day.text}</span>
                          <span className={`dashboard-status-pill ${kelasStatusPembayaran(b.status_pembayaran)}`}>
                            {b.status_pembayaran}
                          </span>
                        </div>
                      </div>
                    )
                  })
                )}
              </div>

              <div className="card-dashboard">
                <div className="card-dashboard-head"><h3>Ringkasan Keuangan</h3></div>
                <div className="fin-row">
                  <span className="fin-label">Total Pembayaran Klien Bulan {namaBulanIni}</span>
                  <span className="fin-value">{formatRupiah(belanjaKlienBulanIni)}</span>
                </div>
                <div className="fin-row">
                  <span className="fin-label">Total Biaya Transport yang Diterima Bulan {namaBulanIni}</span>
                  <span className="fin-value">{formatRupiah(transportBulanIni)}</span>
                </div>
                <div className="fin-row">
                  <span className="fin-label">Total Komisi dari Tim Bulan {namaBulanIni}</span>
                  <span className="fin-value">{formatRupiah(komisiTimBulanIni)}</span>
                </div>
                <div className="fin-row">
                  <span className="fin-label">Omzet Bulan {namaBulanIni}</span>
                  <span className="fin-value">{formatRupiah(omzetBulanIni)}</span>
                </div>
                <div className="fin-divider"></div>
                <div className="fin-net">
                  <span className="fin-label">Penghasilan Bulan {namaBulanIni}</span>
                  <span className="fin-value">{formatRupiah(penghasilanBulanIni)}</span>
                </div>

                <div className={`fin-growth ${growthStatus}`}>
                  <div className="fin-growth-icon">
                    {growthStatus === 'none' ? (
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                        <path d="M6 12h12" />
                      </svg>
                    ) : (
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                        {growthStatus === 'up'
                          ? <path d="M3 17l6-6 4 4 8-8M15 7h6v6" />
                          : <path d="M3 7l6 6 4-4 8 8M15 17h6v-6" />}
                      </svg>
                    )}
                  </div>
                  <div className="fin-growth-text">
                    <div className="fin-growth-pct">{growthStatus === 'up' ? '+' : ''}{growthPct}%</div>
                    <div className="fin-growth-desc">
                      {growthStatus === 'none' ? (
                        'Belum ada data masuk'
                      ) : (
                        <>
                          {growthStatus === 'up' ? 'Meningkat' : 'Menurun'} dari {namaBulanLalu}
                          <span className="fin-growth-sub"> ({formatRupiah(penghasilanBulanLalu)})</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid-2">
              <div className="card-dashboard" ref={refTrenBookingKlien}>
                <div className="card-dashboard-head">
                  <h3>Tren Booking &amp; Klien</h3>
                  <span className="chart-tag">{curYear}</span>
                </div>
                {!adaDataTahunIni ? (
                  <div className="empty-state">Belum ada data tahun ini</div>
                ) : (
                  <TrendChart
                    months={BULAN_SINGKAT}
                    mounted={inViewTrenBookingKlien}
                    area="all"
                    series={[
                      { label: 'Booking', values: monthlyStats.map((m) => m.booking), color: trendColorA },
                      { label: 'Klien', values: monthlyStats.map((m) => m.klien), color: trendColorB },
                    ]}
                  />
                )}
              </div>

              <div className="card-dashboard" ref={refTrenOmzetPenghasilan}>
                <div className="card-dashboard-head">
                  <h3>Tren Omzet &amp; Penghasilan</h3>
                  <span className="chart-tag">{curYear}</span>
                </div>
                {!adaDataTahunIni ? (
                  <div className="empty-state">Belum ada data tahun ini</div>
                ) : (
                  <TrendChart
                    months={BULAN_SINGKAT}
                    mounted={inViewTrenOmzetPenghasilan}
                    area="all"
                    series={[
                      { label: 'Omzet', values: monthlyStats.map((m) => m.omzet), color: trendColorA, format: formatRupiah },
                      { label: 'Penghasilan', values: monthlyStats.map((m) => m.penghasilan), color: trendColorB, format: formatRupiah },
                    ]}
                  />
                )}
              </div>
            </div>

            <div className="grid-3">
              <div className="card-dashboard" ref={refDonutEvent}>
                <div className="card-dashboard-head"><h3>Event</h3><span className="chart-tag">{namaBulanIni}</span></div>
                {eventCounts.length === 0 ? (
                  <div className="empty-state">Belum ada data</div>
                ) : (
                  <>
                    <DonutChart
                      data={eventCounts}
                      colors={eventCounts.map(([label], i) => chartColor(label, i))}
                      centerValue={bookingBulanIni.length}
                      centerLabel="BOOKING"
                      mounted={inViewDonutEvent}
                    />
                    <div className="legend">
                      {eventCounts.map(([label, count], i) => (
                        <div className="legend-row" key={label}>
                          <span className="legend-dot" style={{ background: chartColor(label, i) }}></span>
                          {label}<b>{Math.round((count / bookingBulanIni.length) * 100)}%</b>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>

              <div className="card-dashboard" ref={refDonutSumber}>
                <div className="card-dashboard-head"><h3>Sumber Booking</h3><span className="chart-tag">{namaBulanIni}</span></div>
                {sumberCounts.length === 0 ? (
                  <div className="empty-state">Belum ada data</div>
                ) : (
                  <>
                    <DonutChart
                      data={sumberCounts}
                      colors={sumberCounts.map(([label], i) => sumberColor(label, i))}
                      centerValue={`${Math.round((sumberCounts[0][1] / bookingBulanIni.length) * 100)}%`}
                      centerLabel={sumberCounts[0][0].slice(0, 10).toUpperCase()}
                      mounted={inViewDonutSumber}
                    />
                    <div className="legend">
                      {sumberCounts.map(([label, count], i) => (
                        <div className="legend-row" key={label}>
                          <span className="legend-dot" style={{ background: sumberColor(label, i) }}></span>
                          {label}<b>{Math.round((count / bookingBulanIni.length) * 100)}%</b>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>

              <div className="card-dashboard" ref={refTop5Lokasi}>
                <div className="card-dashboard-head"><h3>Top 5 Lokasi</h3><span className="chart-tag">{namaBulanIni}</span></div>
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
                            width: inViewTop5Lokasi ? `${(count / lokasiCounts[0][1]) * 100}%` : '0%',
                            transitionDelay: `${i * 0.08}s`,
                          }}
                        ></div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {bookingBulanIni.length > 0 && (
              <div className="dashboard-insight-strip">
                <svg viewBox="0 0 24 24" fill="none" stroke="var(--h5)" strokeWidth="2"><path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.6.4.9 1.1.9 1.9v.2h5.2v-.2c0-.8.3-1.5.9-1.9A6 6 0 0 0 12 3Z"/></svg>
                <span>
                  Booking terbanyak dari <b>{sumberCounts[0]?.[0]} ({Math.round((sumberCounts[0]?.[1] / bookingBulanIni.length) * 100)}%)</b>
                  {' · '}Event <b>{eventCounts[0]?.[0]}</b> mendominasi <b>({Math.round((eventCounts[0]?.[1] / bookingBulanIni.length) * 100)}%)</b>
                  {belumLunas.length > 0
                    ? <> · Ingatkan <b>{belumLunas.length} klien</b> yang belum lunas bulan ini, ya!</>
                    : belumAdaTagihan.length > 0
                      ? <> · Ada <b>{belumAdaTagihan.length} booking</b> yang tagihannya masih Rp0, lengkapi biayanya, ya!</>
                      : ' · Semua booking bulan ini sudah lunas 🎉'}
                </span>
              </div>
            )}
          </>
        )}
      </div>

      {showModal && (
        <BookingModal
          onClose={() => setShowModal(false)}
          onSaved={handleBookingSaved}
        />
      )}

      {selectedBooking && (
        <BookingDetailModal
          booking={selectedBooking}
          onClose={() => setSelectedBooking(null)}
          onChanged={loadBookings}
        />
      )}

      {/* Toast bersama -- posisi & gaya di components/Toast.css. */}
      <Toast teks={toast} />

      {showPembaruan && !showOnboarding && <PembaruanModal onClose={tutupPembaruan} />}

      {showOnboarding && (
        <OnboardingModal
          onClose={dismissOnboarding}
          onBookingBaru={() => setShowModal(true)}
        />
      )}
    </div>
  )
}
