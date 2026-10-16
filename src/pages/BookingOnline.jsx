import { useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { useTheme } from '../context/ThemeContext'
import CustomSelect from '../components/CustomSelect'
import CustomTimePicker from '../components/CustomTimePicker'
import { EVENT_OPTIONS, EVENT_CUSTOM_SENTINEL, KATEGORI_MAKEUP_OPTIONS } from '../lib/constants'
import { kategoriUntukEvent } from '../lib/layanan'
import {
  MAKS_ORANG, muatProfilPublik, muatJadwalPublik, kirimPermintaan, nomorWaInternasional,
  labelPaketPublik, formatRupiah, keTanggal, dariTanggal, tanggalPanjang, jamBentrok, pesanWaPermintaan,
  PILIHAN_RAMBUT, catatanKategoriPublik,
} from '../lib/bookingOnline'
import { rapikanKetikanWa, pesanNomorWaTidakValid } from '../lib/nomorWa'
import { muatLinkPublik } from '../lib/linkTambahan'
import { dataIkonMedsos, ikonDipakai } from '../lib/ikonMedsos'
import './BookingOnline.css'

// Halaman PUBLIK link booking online (/b/:slug) -- dibuka calon klien tanpa
// login. Isinya jadi "permintaan booking" yang menunggu persetujuan MUA (bukan
// langsung jadi booking). Semua data diambil lewat fungsi publik di database
// (lib/bookingOnline.js): nama klien lain, event, lokasi, dan angka keuangan
// MUA nggak pernah dikirim ke halaman ini.

const BULAN = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember']
const HARI = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab']
const BELUM_PILIH_PAKET = 'Belum tahu, tanya dulu'
// "Tahu MUA dari mana?" -- label yang dilihat calon klien -> nilai yang
// disimpan (SAMA dengan pilihan Sumber Kanal Booking di form booking;
// Teman/Keluarga = Referral). Daftar nilainya juga dicek di server
// (booking_publik_kirim) & constraint tabel permintaan_booking.
const PILIHAN_SUMBER = [
  { label: 'Instagram', nilai: 'Instagram' },
  { label: 'TikTok', nilai: 'TikTok' },
  { label: 'Facebook', nilai: 'Facebook' },
  { label: 'Threads', nilai: 'Threads' },
  { label: 'Teman/Keluarga', nilai: 'Referral' },
]

function inisial(nama) {
  return (nama || '?').split(' ').map((w) => w[0]).filter(Boolean).slice(0, 2).join('').toUpperCase()
}
// Huruf pertama tiap kata jadi kapital -- SAMA PERSIS dengan capitalizeWords
// di form booking (BookingModal.jsx): cuma nyentuh huruf PERTAMA, sisanya
// dibiarkan (singkatan kayak "UMS" nggak berubah jadi "Ums"). Dijalankan
// waktu kolom ditinggal (onBlur) & sekali lagi waktu dikirim.
function capitalizeWords(str) {
  return (str || '').replace(/(^|[\s,])([a-z])/g, (_, sep, ch) => sep + ch.toUpperCase())
}
function orangKosong() {
  return { nama: '', peran: '', paketId: null, rambut: 'Tidak Ada' }
}
// Kepadatan sama persis kayak Kalender Dapur MUA: dihitung per KLIEN.
function tingkatPadat(klien) {
  return klien <= 0 ? 0 : klien >= 4 ? 4 : klien
}

function KalenderPublik({ hariIni, jadwal, bulan, onGantiBulan, terpilih, onPilih }) {
  const awal = new Date(bulan.getFullYear(), bulan.getMonth(), 1)
  const mulaiGrid = new Date(awal)
  mulaiGrid.setDate(1 - awal.getDay())
  // Cuma minggu yang memuat tanggal bulan ini (5 atau 6 baris, kadang 4).
  const jumlahHari = new Date(bulan.getFullYear(), bulan.getMonth() + 1, 0).getDate()
  const jumlahSel = Math.ceil((awal.getDay() + jumlahHari) / 7) * 7
  const sel = Array.from({ length: jumlahSel }, (_, i) => {
    const d = new Date(mulaiGrid)
    d.setDate(mulaiGrid.getDate() + i)
    return d
  })
  const bulanIni = keTanggal(hariIni)
  const bisaMundur = bulan.getFullYear() > bulanIni.getFullYear() || bulan.getMonth() > bulanIni.getMonth()
  const peta = useMemo(() => new Map(jadwal.map((h) => [h.t, h])), [jadwal])

  return (
    <div className="bo-cal">
      <div className="bo-cal-nav">
        <button type="button" className="bo-cal-btn" onClick={() => onGantiBulan(-1)} disabled={!bisaMundur} aria-label="Bulan sebelumnya">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 18l-6-6 6-6" /></svg>
        </button>
        <div className="bo-cal-judul">{BULAN[bulan.getMonth()]} {bulan.getFullYear()}</div>
        <button type="button" className="bo-cal-btn" onClick={() => onGantiBulan(1)} aria-label="Bulan berikutnya">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 6l6 6-6 6" /></svg>
        </button>
      </div>
      <div className="bo-cal-grid bo-cal-head">
        {HARI.map((h) => <div key={h}>{h}</div>)}
      </div>
      <div className="bo-cal-grid">
        {sel.map((d) => {
          const t = dariTanggal(d)
          const diBulan = d.getMonth() === bulan.getMonth()
          const lewat = t < hariIni
          const info = peta.get(t)
          const padat = diBulan && !lewat ? tingkatPadat(info?.klien || 0) : 0
          return (
            <button
              type="button"
              key={t}
              className={`bo-cal-cell d${padat}${diBulan ? '' : ' luar'}${lewat ? ' lewat' : ''}${terpilih === t ? ' pilih' : ''}${t === hariIni ? ' hari-ini' : ''}${info?.agenda && diBulan && !lewat ? ' agenda' : ''}`}
              disabled={lewat || !diBulan}
              onClick={() => onPilih(t)}
              aria-label={`${d.getDate()} ${BULAN[d.getMonth()]}`}
              aria-pressed={terpilih === t}
            >
              <span className="bo-cal-bulat">{d.getDate()}</span>
            </button>
          )
        })}
      </div>
      <div className="bo-cal-legend">
        <span><i className="bo-dot d0"></i>Kosong</span>
        <span><i className="bo-dot d1"></i>Ada Jadwal</span>
        <span><i className="bo-dot d3"></i>Ramai</span>
        <span><i className="bo-dot d4"></i>Padat</span>
      </div>
    </div>
  )
}

// Kelompok paket per Kategori -- SAMA dengan dropdown Paket Layanan Makeup di
// form booking (lib/layanan.js kelompokOpsiLayanan): kategori yang biasa
// dipakai acara yang dipilih naik ke paling atas, Jenis Makeup jadi "anak"
// yang menjorok di bawah judul Kategori.
function kelompokPaket(paket, ev) {
  const cocok = kategoriUntukEvent(ev)
  const urutan = [...KATEGORI_MAKEUP_OPTIONS]
  if (cocok) urutan.sort((a, b) => (a === cocok ? -1 : b === cocok ? 1 : 0))
  const normal = (k) => String(k || '').trim().toLowerCase().replace('regular', 'reguler')
  const kelompok = urutan.map((k) => ({
    judul: k === cocok ? `${k} · sesuai acara ${String(ev).trim()}` : k,
    cocok: k === cocok,
    paket: paket.filter((p) => normal(p.kategori) === normal(k)),
  }))
  kelompok.push({ judul: 'Lainnya', cocok: false, paket: paket.filter((p) => !KATEGORI_MAKEUP_OPTIONS.some((k) => normal(k) === normal(p.kategori))) })
  return kelompok.filter((k) => k.paket.length > 0)
}
// Label anak di menu: "Premium", "Standard · Jogja", "Wedding (paket dasar)".
function labelAnakPaket(p) {
  const inti = p.jenis || `${p.kategori} (paket dasar)`
  return p.keterangan ? `${inti} · ${p.keterangan}` : inti
}

// Dropdown paket -- numpang tampilan CustomSelect (.cselect-*), tapi pilihan
// boleh turun baris (nama paket + harga) & disimpan pakai id.
// Harga SENGAJA nggak ditampilkan di daftar -- baru muncul di bawah dropdown
// setelah calon klien memilih paket (kalau MUA mengizinkan harga tampil).
function PilihPaket({ paket, nilai, onPilih, tampilHarga, eventAktif = '' }) {
  const [buka, setBuka] = useState(false)
  const ref = useRef(null)
  useEffect(() => {
    function luar(e) { if (ref.current && !ref.current.contains(e.target)) setBuka(false) }
    document.addEventListener('mousedown', luar)
    return () => document.removeEventListener('mousedown', luar)
  }, [])
  const terpilih = paket.find((p) => p.id === nilai) || null
  const pilih = (id) => { onPilih(id); setBuka(false) }
  return (
    <>
    <div className="cselect bo-paket" ref={ref}>
      <button type="button" className={`cselect-trigger cselect-trigger--modal${buka ? ' open' : ''}`} onClick={() => setBuka((b) => !b)} aria-haspopup="listbox" aria-expanded={buka}>
        <span>{terpilih ? labelPaketPublik(terpilih) : 'Pilih Paket'}</span>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 9l6 6 6-6" /></svg>
      </button>
      {buka && (
        <div className="cselect-menu" role="listbox">
          {/* "Belum tahu" paling atas -- posisinya sama dengan "Pilih Manual"
              di form booking. */}
          <div role="option" aria-selected={!nilai} className={`cselect-option${!nilai ? ' sel' : ''}`} onClick={() => pilih(null)}>
            <span className="bo-paket-nama">{BELUM_PILIH_PAKET}</span>
          </div>
          {kelompokPaket(paket, eventAktif).map((k) => (
            <div className="bo-paket-kelompok" key={k.judul}>
              <div className={`bo-paket-judul${k.cocok ? ' cocok' : ''}`}>{k.judul}</div>
              {k.paket.map((p) => (
                <div key={p.id} role="option" aria-selected={p.id === nilai} className={`cselect-option bo-paket-anak${p.id === nilai ? ' sel' : ''}`} onClick={() => pilih(p.id)}>
                  <span className="bo-paket-nama">{labelAnakPaket(p)}</span>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
    {tampilHarga && terpilih && terpilih.biaya !== null && terpilih.biaya !== undefined && (
      <div className="bo-harga-paket">Harga paket: <b>{formatRupiah(terpilih.biaya)}</b></div>
    )}
    </>
  )
}

// Ikon tombol link di landing page.
const IKON_PAKET = <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0L3 13V3h10l7.6 7.6a2 2 0 0 1 0 2.8Z" /><circle cx="7.5" cy="7.5" r="1.5" /></svg>
const IKON_LINK = <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M10 13a5 5 0 0 0 7.07 0l3-3a5 5 0 0 0-7.07-7.07l-1.5 1.5" /><path d="M14 11a5 5 0 0 0-7.07 0l-3 3a5 5 0 0 0 7.07 7.07l1.5-1.5" /></svg>
const IKON_KALENDER = <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><rect x="3" y="4" width="18" height="17" rx="2" /><path d="M3 9h18M8 3v3M16 3v3" /></svg>

// Ikon tombol link tambahan: ikon medsos kalau linknya medsos (dipilih MUA
// atau ditebak dari alamat), selain itu ikon rantai.
function IkonLinkTambahan({ ikon, url }) {
  const m = dataIkonMedsos(ikonDipakai(ikon, url))
  if (!m) return IKON_LINK
  return <svg viewBox="0 0 24 24" fill={m.warna || 'currentColor'} aria-hidden="true"><path d={m.path} /></svg>
}

// Info jadwal tanggal yang dipilih di kalender (dipakai di landing page &
// form booking). Nama klien lain, acara, & lokasi NGGAK pernah tampil --
// cuma jam yang terisi (kalau MUA mengizinkan) & tanda ada agenda.
function InfoHari({ tanggal, infoTanggal, profil }) {
  if (!tanggal) {
    return <div className="bo-hari bo-hari-petunjuk">Pilih tanggal acaramu di kalender. Warna tanggal menunjukkan seberapa ramai jadwal MUA di hari itu.</div>
  }
  return (
    <div className="bo-hari" aria-live="polite">
      <div className="bo-hari-judul">{tanggalPanjang(tanggal)}</div>
      {!infoTanggal || (infoTanggal.klien === 0 && !infoTanggal.agenda) ? (
        <div className="bo-hari-kosong">Belum ada jadwal di tanggal ini.</div>
      ) : (
        <ul className="bo-slot">
          {infoTanggal.agenda && <li className="agenda">MUA ada agenda lain di hari ini</li>}
          {infoTanggal.slot.map((s) => (
            <li key={`${s.m}-${s.s}`}>{s.m} – {s.s} {profil.zona_waktu}<em>Terisi</em></li>
          ))}
          {infoTanggal.tanpa_jam > 0 && <li>{infoTanggal.tanpa_jam > 1 ? `${infoTanggal.tanpa_jam} jadwal` : 'Ada jadwal'}, jam belum ditentukan<em>Terisi</em></li>}
          {!profil.tampil_jam && infoTanggal.klien > 0 && <li>Sudah ada jadwal di hari ini<em>Terisi</em></li>}
        </ul>
      )}
    </div>
  )
}

// Daftar paket (pricelist) di landing page -- dikelompokkan per Kategori,
// SAMA dengan dropdown paket di form. Harga cuma tampil kalau MUA
// mengizinkan (Pengaturan > Tampilkan harga); kalau nggak, server memang
// nggak mengirim angkanya (biaya = null).
function DaftarPaket({ paket, tampilHarga }) {
  const kelompok = kelompokPaket(paket, '')
  return (
    <section className="bo-card">
      <h2><span className="bo-num bo-num-ikon">{IKON_PAKET}</span>Paket Makeup</h2>
      {kelompok.map((k) => (
        <div className="bo-pl-kelompok" key={k.judul}>
          <div className="bo-pl-judul">{k.judul}</div>
          <ul className="bo-pl-list">
            {k.paket.map((p) => (
              <li key={p.id}>
                <span>{labelAnakPaket(p)}</span>
                {tampilHarga && p.biaya !== null && p.biaya !== undefined && <b>{formatRupiah(p.biaya)}</b>}
              </li>
            ))}
          </ul>
        </div>
      ))}
      <small className="bo-hint bo-pl-catatan">{tampilHarga ? 'Harga belum termasuk transport & add on. Harga final dikonfirmasi MUA.' : 'Harga paket dikonfirmasi MUA lewat WhatsApp.'}</small>
    </section>
  )
}

// Footer "Dibuat dengan Dapur MUA" + logo Dapur MUA di atasnya (logo ikut
// tema terang/gelap, file yang sama dengan logo di Sidebar).
function FooterDapurMua() {
  const { theme } = useTheme()
  return (
    <a className="bo-footer" href="/">
      <img className="bo-footer-logo" src={theme === 'dark' ? '/icon-512-dark.png' : '/icon-512-light.png'} alt="Logo Dapur MUA" />
      <span>Dibuat dengan <b>Dapur MUA</b></span>
    </a>
  )
}

// Tombol Beranda (ikon rumah) -- pojok KIRI atas, sejajar tombol tema di
// kanan. Muncul di form booking & halaman sukses: balik ke landing page MUA.
function TombolBeranda({ namaMua, onKlik }) {
  return (
    <button type="button" className="bo-beranda" onClick={onKlik} aria-label={`Kembali ke halaman ${namaMua}`} title="Beranda">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 10.5 12 3l9 7.5" /><path d="M5 9.5V20a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1V9.5" /></svg>
    </button>
  )
}

// Tombol tema terang/gelap (pakai ThemeContext yang sama dengan aplikasi).
function TombolTema() {
  const { theme, toggleTheme } = useTheme()
  const gelap = theme === 'dark'
  return (
    <button type="button" className="bo-tema" onClick={toggleTheme} aria-label={gelap ? 'Pakai mode terang' : 'Pakai mode gelap'} title={gelap ? 'Mode terang' : 'Mode gelap'}>
      {gelap ? (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></svg>
      ) : (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12.8A9 9 0 1 1 11.2 3 7 7 0 0 0 21 12.8Z" /></svg>
      )}
    </button>
  )
}

export default function BookingOnline() {
  const { slug } = useParams()
  // Halaman ini punya 2 tampilan: LANDING PAGE (/b/slug -- buat dipasang di
  // bio medsos, kayak Linktree) & FORM BOOKING (/b/slug#booking). Pakai hash
  // biar tombol Kembali di HP balik ke landing, & link #booking bisa dikirim
  // langsung ke klien yang sudah siap booking.
  const lokasiHalaman = useLocation()
  const navigate = useNavigate()
  const diForm = lokasiHalaman.hash === '#booking'
  function bukaForm() { navigate({ hash: 'booking' }) }
  function keLanding() { navigate({ hash: '' }) }
  useEffect(() => { window.scrollTo({ top: 0 }) }, [diForm])
  const [status, setStatus] = useState('memuat') // memuat | tidak-ada | gagal | siap | terkirim
  const [profil, setProfil] = useState(null)
  const [jadwal, setJadwal] = useState([])
  const [bulan, setBulan] = useState(() => new Date())

  const [nama, setNama] = useState('')
  const [wa, setWa] = useState('')
  const [sumber, setSumber] = useState('') // label PILIHAN_SUMBER yang dipilih
  const [tanggal, setTanggal] = useState('')
  const [jam, setJam] = useState('')
  const [event, setEvent] = useState('')
  const [eventLain, setEventLain] = useState('')
  const [lokasi, setLokasi] = useState('')
  const [catatan, setCatatan] = useState('')
  const [orang, setOrang] = useState([orangKosong()])
  const [situs, setSitus] = useState('') // honeypot -- tersembunyi, cuma diisi bot
  const [mengirim, setMengirim] = useState(false)
  const [galat, setGalat] = useState('')
  const [terkirim, setTerkirim] = useState(null)
  const galatRef = useRef(null)

  useEffect(() => {
    let batal = false
    muatProfilPublik(slug)
      .then((p) => {
        if (batal) return
        if (!p) { setStatus('tidak-ada'); return }
        setProfil(p)
        setBulan(keTanggal(p.hari_ini))
        setStatus('siap')
      })
      .catch(() => { if (!batal) setStatus('gagal') })
    return () => { batal = true }
  }, [slug])

  // Jadwal bulan yang lagi dilihat (server membatasi: nggak bisa lihat
  // tanggal yang sudah lewat, maks 62 hari sekali ambil).
  useEffect(() => {
    if (!profil) return undefined
    let batal = false
    const dari = dariTanggal(new Date(bulan.getFullYear(), bulan.getMonth(), 1))
    const sampai = dariTanggal(new Date(bulan.getFullYear(), bulan.getMonth() + 1, 0))
    muatJadwalPublik(slug, dari, sampai).then((j) => { if (!batal) setJadwal(j) }).catch(() => { if (!batal) setJadwal([]) })
    return () => { batal = true }
  }, [profil, slug, bulan])

  // Isi tambahan halaman link: link buatan MUA & opsi tampil daftar paket
  // (lib/linkTambahan.js). Gagal / SQL belum dijalankan -> null: halaman
  // tetap jalan seperti biasa (tanpa link tambahan, paket tetap tampil).
  const [ekstra, setEkstra] = useState(null)
  useEffect(() => {
    if (!profil) return undefined
    let batal = false
    muatLinkPublik(slug).then((d) => { if (!batal) setEkstra(d) })
    return () => { batal = true }
  }, [profil, slug])

  useEffect(() => {
    if (profil) document.title = `Booking ${profil.nama}`
  }, [profil])

  const infoTanggal = jadwal.find((h) => h.t === tanggal) || null
  const bentrok = !!(tanggal && jam && infoTanggal && jamBentrok(jam, infoTanggal.slot))
  const paket = profil?.paket || []
  const totalEstimasi = orang.reduce((s, o) => s + (Number(paket.find((p) => p.id === o.paketId)?.biaya) || 0), 0)
  const adaEstimasi = profil?.tampil_harga && orang.some((o) => paket.some((p) => p.id === o.paketId && p.biaya !== null))
  const adaRambut = orang.some((o) => o.rambut !== 'Tidak Ada')
  const eventSekarang = event === EVENT_CUSTOM_SENTINEL ? eventLain.trim() : event
  // Catatan halus kategori paket vs acara (bukan larangan) -- per orang.
  const catatanKategori = catatanKategoriPublik(orang.map((o) => paket.find((p) => p.id === o.paketId)?.kategori || ''), eventSekarang)

  function ubahOrang(i, kolom, nilai) {
    setOrang((daftar) => daftar.map((o, idx) => (idx === i ? { ...o, [kolom]: nilai } : o)))
  }
  function tolak(pesan) {
    setGalat(pesan)
    requestAnimationFrame(() => galatRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }))
  }

  async function kirim(e) {
    e.preventDefault()
    setGalat('')
    const eventFinal = event === EVENT_CUSTOM_SENTINEL ? eventLain.trim() : event
    if (nama.trim().length < 2) return tolak('Nama wajib diisi.')
    // Batas 15 angka SAMA dengan pengecekan di server (booking_publik_kirim).
    if (pesanNomorWaTidakValid(wa, { maksAngka: 15 })) return tolak(pesanNomorWaTidakValid(wa, { maksAngka: 15 }))
    const nilaiSumber = PILIHAN_SUMBER.find((s) => s.label === sumber)?.nilai
    if (!nilaiSumber) return tolak(`Pilih dari mana kamu tahu ${profil.nama}.`)
    if (!tanggal) return tolak('Pilih tanggal acara di kalender dulu.')
    if (!eventFinal) return tolak(event === EVENT_CUSTOM_SENTINEL ? 'Tulis nama acaranya dulu.' : 'Pilih acaranya dulu.')
    if (lokasi.trim().length < 3) return tolak('Lokasi wajib diisi.')
    const iKosong = orang.findIndex((o) => !o.nama.trim())
    if (iKosong !== -1) return tolak(orang.length > 1 ? `Nama klien ${iKosong + 1} wajib diisi.` : 'Nama klien wajib diisi.')

    const isian = {
      nama_klien: capitalizeWords(nama.trim()),
      nomor_whatsapp: wa.trim(),
      tanggal_acara: tanggal,
      jam_mulai: jam || '',
      event: eventFinal,
      lokasi: capitalizeWords(lokasi.trim()),
      catatan: catatan.trim(),
      sumber: nilaiSumber,
      peserta: orang.map((o) => ({ nama: capitalizeWords(o.nama.trim()), peran: o.peran.trim(), layanan_id: o.paketId, rambut: o.rambut })),
      situs,
    }
    setMengirim(true)
    const hasil = await kirimPermintaan(slug, isian)
    setMengirim(false)
    if (!hasil.ok) return tolak(hasil.pesan)
    setTerkirim(isian)
    setStatus('terkirim')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function kirimLagi() {
    setTanggal(''); setJam(''); setEvent(''); setEventLain(''); setLokasi(''); setCatatan('')
    setOrang([orangKosong()]); setTerkirim(null); setStatus('siap')
  }
  // Dari halaman sukses: isian dikosongkan (sama kayak Kirim permintaan lain)
  // lalu balik ke landing page.
  function berandaSetelahKirim() {
    kirimLagi()
    keLanding()
  }

  if (status === 'memuat') return <div className="bo-page"><TombolTema /><div className="bo-info">Memuat ....</div></div>
  if (status === 'tidak-ada' || status === 'gagal') {
    return (
      <div className="bo-page">
        <TombolTema />
        <div className="bo-wrap">
          <div className="bo-card bo-kosong">
            <h1>{status === 'gagal' ? 'Halaman belum bisa dimuat' : 'Link booking tidak tersedia'}</h1>
            <p>{status === 'gagal' ? 'Periksa koneksi internet, lalu muat ulang halaman ini.' : 'Link ini salah ketik, atau MUA sedang tidak menerima booking lewat link. Silakan hubungi MUA-nya langsung.'}</p>
          </div>
          <FooterDapurMua />
        </div>
      </div>
    )
  }

  const kepala = (
    <header className="bo-head">
      <div className="bo-logo">{profil.logo_url ? <img src={profil.logo_url} alt="" /> : <span>{inisial(profil.nama)}</span>}</div>
      <h1>{profil.nama}</h1>
      {profil.instagram && (
        <a className="bo-ig" href={`https://instagram.com/${profil.instagram.replace(/^@/, '')}`} target="_blank" rel="noreferrer">@{profil.instagram.replace(/^@/, '')}</a>
      )}
    </header>
  )

  if (status === 'terkirim') {
    const waMua = nomorWaInternasional(profil.whatsapp)
    const pesan = pesanWaPermintaan({ namaMua: profil.nama, isian: terkirim, zona: profil.zona_waktu })
    return (
      <div className="bo-page">
        <TombolBeranda namaMua={profil.nama} onKlik={berandaSetelahKirim} />
        <TombolTema />
        <div className="bo-wrap">
          {kepala}
          <div className="bo-card bo-sukses">
            <div className="bo-sukses-ikon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4"><path d="M20 6 9 17l-5-5" /></svg></div>
            <h2>Permintaan booking terkirim!</h2>
            <p><b>{profil.nama}</b> akan mengecek jadwal dan mengonfirmasi lewat WhatsApp ke nomor <b>{terkirim.nomor_whatsapp}</b>. Jadwal belum terkunci sampai dikonfirmasi MUA.</p>
            <div className="bo-ringkas">
              <div><span>Hari, Tanggal</span><b>{tanggalPanjang(terkirim.tanggal_acara)}</b></div>
              {/* Jam dipisah ke baris sendiri (jam opsional -> "Belum ditentukan"). */}
              <div><span>Jam Mulai Makeup</span><b>{terkirim.jam_mulai ? `${terkirim.jam_mulai} ${profil.zona_waktu}` : 'Belum ditentukan'}</b></div>
              <div><span>Acara</span><b>{terkirim.event}</b></div>
              <div><span>Lokasi</span><b>{terkirim.lokasi}</b></div>
              <div><span>Jumlah klien</span><b>{terkirim.peserta.length}</b></div>
            </div>
            {waMua && (
              <a className="bo-btn bo-btn-wa" href={`https://wa.me/${waMua}?text=${encodeURIComponent(pesan)}`} target="_blank" rel="noreferrer">
                <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm5.4 14.2c-.2.6-1.3 1.2-1.8 1.2-.5.1-1 .1-3.3-.8-2.8-1.1-4.5-3.9-4.7-4.1-.1-.2-1.1-1.5-1.1-2.9s.7-2 1-2.3c.2-.3.6-.4.8-.4h.6c.2 0 .4 0 .6.5l.9 2.1c.1.2.1.4 0 .6l-.4.6-.4.4c-.1.2-.3.3-.1.6.2.3.8 1.3 1.7 2.1 1.2 1 2.1 1.3 2.4 1.5.3.1.5.1.6-.1l.9-1.1c.2-.3.4-.2.7-.1l2 1c.3.1.5.2.6.3.1.2.1.7-.1 1.3Z" /></svg>
                Kabari {profil.nama} lewat WhatsApp
              </a>
            )}
            <button type="button" className="bo-btn bo-btn-ghost" onClick={kirimLagi}>Kirim permintaan lain</button>
          </div>
          <FooterDapurMua />
        </div>
      </div>
    )
  }

  // ---------- LANDING PAGE (/b/slug) ----------
  if (!diForm) {
    return (
      <div className="bo-page">
        <TombolTema />
        <div className="bo-wrap">
          {kepala}
          {profil.pesan && <div className="bo-pesan">{profil.pesan}</div>}

          <div className="bo-link-list">
            <button type="button" className="bo-btn bo-btn-utama bo-btn-besar" onClick={bukaForm}>Booking Sekarang</button>
            {/* Selain Booking Sekarang, SEMUA tombol (WhatsApp, Instagram, TikTok,
                Drive, dll) dibuat MUA sendiri di Pengaturan > Isi Halaman Link --
                urutan & judulnya bebas, nggak ada tombol dobel. Alamatnya sudah
                dicek https:// di database & dicek ulang di sini. */}
            {(ekstra?.links || []).map((l, i) => (
              <a key={`${i}-${l.url}`} className="bo-btn bo-link-btn ekstra" href={l.url} target="_blank" rel="noopener noreferrer nofollow"><IkonLinkTambahan ikon={l.ikon} url={l.url} /><span className="bo-link-judul">{l.judul}</span></a>
            ))}
          </div>

          <section className="bo-card">
            <h2><span className="bo-num bo-num-ikon">{IKON_KALENDER}</span>Cek Jadwal</h2>
            <KalenderPublik
              hariIni={profil.hari_ini}
              jadwal={jadwal}
              bulan={bulan}
              onGantiBulan={(arah) => setBulan((b) => new Date(b.getFullYear(), b.getMonth() + arah, 1))}
              terpilih={tanggal}
              onPilih={setTanggal}
            />
            <InfoHari tanggal={tanggal} infoTanggal={infoTanggal} profil={profil} />
            {/* Tanggal yang dipilih di sini ikut terbawa ke form booking. */}
            {tanggal && <button type="button" className="bo-btn bo-btn-utama" onClick={bukaForm}>Booking tanggal {tanggalPanjang(tanggal)}</button>}
          </section>

          {paket.length > 0 && ekstra?.tampil_paket !== false && <DaftarPaket paket={paket} tampilHarga={profil.tampil_harga} />}

          <FooterDapurMua />
        </div>
      </div>
    )
  }

  // ---------- FORM BOOKING (/b/slug#booking) ----------
  return (
    <div className="bo-page">
      <TombolBeranda namaMua={profil.nama} onKlik={keLanding} />
      <TombolTema />
      <div className="bo-wrap">
        {kepala}
        <div className="bo-sub">Form Permintaan Booking</div>
        {profil.pesan && <div className="bo-pesan">{profil.pesan}</div>}

        <form onSubmit={kirim} noValidate>
          <section className="bo-card">
            <h2><span className="bo-num">1</span>Data Kamu</h2>
            <div className="bo-grid-2">
              <label className="bo-field">
                <span>Nama Lengkap</span>
                <input type="text" value={nama} onChange={(e) => setNama(e.target.value)} onBlur={(e) => setNama(capitalizeWords(e.target.value))} placeholder="contoh: Jenny Black Pink" maxLength={80} autoComplete="name" autoCapitalize="words" />
              </label>
              <label className="bo-field">
                <span>Nomor WhatsApp</span>
                <input type="tel" inputMode="tel" value={wa} onChange={(e) => setWa(rapikanKetikanWa(e.target.value))} placeholder="0812xxxxxxx" maxLength={25} autoComplete="tel" />
              </label>
            </div>
            {/* Tahu MUA dari mana -> jadi Sumber Kanal Booking waktu MUA
                menerima permintaan (Teman/Keluarga = Referral). */}
            <div className="bo-field bo-field-sumber">
              <span>Tahu {profil.nama} dari mana?</span>
              <CustomSelect options={PILIHAN_SUMBER.map((s) => s.label)} value={sumber} onChange={setSumber} placeholder="Pilih" variant="modal" />
            </div>
          </section>

          <section className="bo-card">
            <h2><span className="bo-num">2</span>Tanggal &amp; Acara</h2>
            <KalenderPublik
              hariIni={profil.hari_ini}
              jadwal={jadwal}
              bulan={bulan}
              onGantiBulan={(arah) => setBulan((b) => new Date(b.getFullYear(), b.getMonth() + arah, 1))}
              terpilih={tanggal}
              onPilih={setTanggal}
            />
            <InfoHari tanggal={tanggal} infoTanggal={infoTanggal} profil={profil} />

            <div className="bo-grid-2">
              <div className="bo-field">
                <span>Acara</span>
                <CustomSelect options={EVENT_OPTIONS} value={event} onChange={setEvent} placeholder="Pilih Acara" variant="modal" />
                {event === EVENT_CUSTOM_SENTINEL && (
                  <input type="text" value={eventLain} onChange={(e) => setEventLain(e.target.value)} placeholder="Tulis nama acara" maxLength={60} />
                )}
              </div>
              <div className="bo-field">
                <span>Jam Mulai Makeup <small>(opsional)</small></span>
                <CustomTimePicker value={jam} onChange={setJam} variant="modal" />
                {jam && <button type="button" className="bo-link-kecil" onClick={() => setJam('')}>Kosongkan jam</button>}
              </div>
            </div>
            {bentrok && <div className="bo-peringatan" role="note">Jam {jam} sudah terisi di tanggal ini. Kamu tetap bisa mengirim permintaan, nanti MUA yang mengonfirmasi bisa atau tidaknya.</div>}

            <label className="bo-field">
              <span>Lokasi</span>
              <input type="text" value={lokasi} onChange={(e) => setLokasi(e.target.value)} onBlur={(e) => setLokasi(capitalizeWords(e.target.value))} placeholder="Kecamatan, Kota/Kabupaten" maxLength={200} autoCapitalize="words" />
              <small className="bo-hint">Contoh: Antapani, Bandung. Kalau ada link Google Maps, tempel di Catatan.</small>
            </label>
          </section>

          <section className="bo-card">
            <h2><span className="bo-num">3</span>Siapa yang Dimakeup</h2>
            {orang.map((o, i) => (
              <div className="bo-orang" key={i}>
                {/* Judul "Klien N" + tombol Hapus baru muncul kalau kliennya
                    lebih dari 1 -- kalau cuma 1, kartunya langsung isian. */}
                {orang.length > 1 && (
                  <div className="bo-orang-head">
                    <span className="bo-orang-label">Klien {i + 1}</span>
                    {/* Klien 1 nggak bisa dihapus -- Hapus cuma di Klien 2 dst. */}
                    {i > 0 && <button type="button" className="bo-hapus" onClick={() => setOrang((d) => d.filter((_, idx) => idx !== i))}>Hapus</button>}
                  </div>
                )}
                <div className="bo-grid-2">
                  <label className="bo-field">
                    <span>Nama</span>
                    <input type="text" value={o.nama} onChange={(e) => ubahOrang(i, 'nama', e.target.value)} onBlur={(e) => ubahOrang(i, 'nama', capitalizeWords(e.target.value))} autoCapitalize="words" placeholder={i === 0 ? 'contoh: Jenny Black Pink' : 'contoh: Ibu Jenny'} maxLength={80} />
                    {i === 0 && !o.nama && nama.trim() && (
                      <button type="button" className="bo-chip" onClick={() => ubahOrang(0, 'nama', nama.trim())}>Pakai nama saya</button>
                    )}
                  </label>
                  <label className="bo-field">
                    <span>Peran <small>(opsional)</small></span>
                    <input type="text" value={o.peran} onChange={(e) => ubahOrang(i, 'peran', e.target.value)} placeholder="contoh: Wisudawati, Bridesmaid" maxLength={60} />
                  </label>
                </div>
                {paket.length > 0 && (
                  <div className="bo-field">
                    <span>Paket Makeup</span>
                    <PilihPaket paket={paket} nilai={o.paketId} onPilih={(id) => ubahOrang(i, 'paketId', id)} tampilHarga={profil.tampil_harga} eventAktif={eventSekarang} />
                    <small className="bo-hint">Pilih paket sesuai kebutuhan event-mu.</small>
                    {catatanKategori[i] && <div className="bo-peringatan bo-peringatan-kecil" role="note">{catatanKategori[i]}</div>}
                  </div>
                )}
                {/* Add On Layanan Rambut -- cuma pilihan, tanpa paket & harga.
                    Detail & harganya dikonfirmasi MUA lewat WhatsApp. */}
                <div className="bo-field">
                  <span id={`label-rambut-${i}`}>Add On Layanan Rambut</span>
                  <div className="bo-toggle" role="radiogroup" aria-labelledby={`label-rambut-${i}`}>
                    {PILIHAN_RAMBUT.map((r) => (
                      <button type="button" key={r.nilai} role="radio" aria-checked={o.rambut === r.nilai} className={`bo-toggle-opt${o.rambut === r.nilai ? ' sel' : ''}`} onClick={() => ubahOrang(i, 'rambut', r.nilai)}>{r.label}</button>
                    ))}
                  </div>
                  {profil.clean_hijabdo_termasuk && <small className="bo-hint">Clean hijabdo sudah termasuk dalam layanan makeup. Hijabdo+ adalah layanan hijab khusus.</small>}
                  {o.rambut !== 'Tidak Ada' && <small className="bo-hint">Detail dan harga {o.rambut} dikonfirmasi MUA lewat WhatsApp. Kalau ada request khusus, tulis di Catatan.</small>}
                </div>
              </div>
            ))}
            {orang.length < MAKS_ORANG && (
              <button type="button" className="bo-btn bo-btn-tambah" onClick={() => setOrang((d) => [...d, orangKosong()])}>+ Tambah Klien</button>
            )}
            {adaEstimasi && (
              <div className="bo-estimasi">
                <div><span>Estimasi biaya makeup</span><b>{formatRupiah(totalEstimasi)}</b></div>
                <small>Belum termasuk transport{adaRambut ? ', add on layanan rambut,' : ''} &amp; tambahan lain. Harga final dikonfirmasi MUA.</small>
              </div>
            )}
          </section>

          <section className="bo-card">
            <label className="bo-field">
              <span>Catatan <small>(opsional)</small></span>
              <textarea value={catatan} onChange={(e) => setCatatan(e.target.value)} placeholder="contoh: Request look, model rambut/hijab, link Google Maps lokasi" maxLength={1000} rows={3} />
            </label>
            {/* Honeypot anti-bot: disembunyikan dari manusia. */}
            <div className="bo-hp" aria-hidden="true">
              <label>Situs<input type="text" tabIndex={-1} autoComplete="off" value={situs} onChange={(e) => setSitus(e.target.value)} /></label>
            </div>
            {galat && <div className="bo-galat" ref={galatRef} role="alert">{galat}</div>}
            <button type="submit" className="bo-btn bo-btn-utama" disabled={mengirim}>{mengirim ? 'Mengirim ....' : 'Kirim Permintaan Booking'}</button>
            <p className="bo-catatan-kirim">Permintaan ini belum mengunci jadwal. {profil.nama} akan mengonfirmasi lewat WhatsApp.</p>
          </section>
        </form>

        <FooterDapurMua />
      </div>
    </div>
  )
}
