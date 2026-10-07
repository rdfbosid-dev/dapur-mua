import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import Sidebar from '../components/Sidebar'
import CustomSelect from '../components/CustomSelect'
import PengeluaranModal from '../components/PengeluaranModal'
import PengeluaranDetailModal from '../components/PengeluaranDetailModal'
import { useInViewAnimate } from '../hooks/useInViewAnimate'
import './Pengeluaran.css'

const BULAN_SINGKAT = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des']
const BULAN_PENUH = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember']

function formatRupiah(n) {
  return 'Rp' + (Number(n) || 0).toLocaleString('id-ID')
}

// Tanggal "YYYY-MM-DD" dari kolom `date` di-parse MANUAL jadi tanggal
// lokal -- `new Date('2026-10-01')` dibaca sebagai UTC tengah malam, yang
// bisa geser jadi tanggal sebelumnya di zona waktu tertentu.
function parseTanggal(str) {
  const [y, m, d] = String(str || '').split('-').map(Number)
  return new Date(y, (m || 1) - 1, d || 1)
}

// Halaman PENGELUARAN USAHA (non-booking) -- tempat INPUT & KELOLA
// pengeluaran: tombol "+ Pengeluaran", ringkasan per kategori, daftar
// transaksi per bulan, klik transaksi -> Detail (Nota / Edit / Hapus).
// Pengeluaran BOOKING (bayar tim/vendor/modal produk) TIDAK di sini --
// itu otomatis dari data booking & ditampilin di halaman Keuangan.
//
// Isi halaman ini DIPINDAH UTUH dari tab "Pengeluaran Usaha" yang dulu
// ada di Keuangan.jsx (logika & alur Detail -> Edit -> balik ke Detail
// sama persis), ditambah tombol tambah + filter ala halaman Booking.
export default function Pengeluaran() {
  // 1 baris per transaksi dari VIEW pengeluaran_summary (udah ada kolom
  // total & jumlah_item). RLS-nya nempel dari tabel asli
  // (security_invoker), jadi otomatis cuma punya user ini.
  const [pengeluaranList, setPengeluaranList] = useState([])
  // Animasi bar per kategori -- polanya SAMA kayak bar "Top 10 Lokasi" di Laporan:
  // bar tumbuh dari 0 begitu kartu ringkasan masuk layar (dan tumbuh lagi tiap
  // masuk layar lagi), tiap baris jalan bergantian (jeda 0,08 detik).
  const [refRingkasan, inViewRingkasan] = useInViewAnimate()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [search, setSearch] = useState('')
  const [filterTahun, setFilterTahun] = useState('Semua Tahun')
  const [filterBulan, setFilterBulan] = useState('Semua Bulan')

  const [showPengeluaranModal, setShowPengeluaranModal] = useState(false)
  // null = mode tambah; diisi = mode edit (transaksi yang lagi diedit).
  const [editPengeluaran, setEditPengeluaran] = useState(null)
  // Transaksi yang lagi dibuka di Detail Pengeluaran (klik baris).
  const [detailPengeluaran, setDetailPengeluaran] = useState(null)

  // Ngembaliin daftar terbaru (null kalau gagal) -- dipakai buat nyegerin
  // Detail Pengeluaran abis diedit.
  async function reloadPengeluaran() {
    const { data, error: err } = await supabase
      .from('pengeluaran_summary').select('*')
      .order('tanggal', { ascending: false }).order('created_at', { ascending: false })
    if (err) { setError(err.message); return null }
    setError('')
    setPengeluaranList(data || [])
    return data || []
  }

  // Fetch sekali pas halaman dibuka. State-nya baru diisi di dalam
  // .then() (abis data dateng), BUKAN langsung di badan effect -- pola
  // yang sama kayak PengeluaranDetailModal.jsx, jadi lolos aturan lint
  // react-hooks/set-state-in-effect tanpa perlu komentar pengecualian.
  useEffect(() => {
    supabase
      .from('pengeluaran_summary').select('*')
      .order('tanggal', { ascending: false }).order('created_at', { ascending: false })
      .then(({ data, error: err }) => {
        if (err) setError(err.message)
        else setPengeluaranList(data || [])
        setLoading(false)
      })
  }, [])

  function bukaTambah() {
    setEditPengeluaran(null)
    setShowPengeluaranModal(true)
  }
  // Alur: klik baris -> Detail Pengeluaran -> (Edit Pengeluaran) -> form
  // edit. Detail ditutup pas form edit kebuka (biar nggak numpuk 2 modal).
  function bukaEditDariDetail() {
    setEditPengeluaran(detailPengeluaran)
    setDetailPengeluaran(null)
    setShowPengeluaranModal(true)
  }
  // Abis disimpan:
  // - mode EDIT -> balik ke Detail transaksi yang sama pakai data TERBARU.
  // - mode TAMBAH -> cukup muat ulang daftar (transaksi baru langsung
  //   nongol di daftar).
  async function handlePengeluaranSaved() {
    const idDiedit = editPengeluaran?.id
    setShowPengeluaranModal(false)
    setEditPengeluaran(null)
    const terbaru = await reloadPengeluaran()
    const baris = terbaru && idDiedit ? terbaru.find((p) => p.id === idDiedit) : null
    if (baris) setDetailPengeluaran(baris)
  }
  // Batal: mode edit -> balik ke Detail yang tadi dibuka; mode tambah ->
  // cukup tutup form.
  function handleBatalForm() {
    if (editPengeluaran) setDetailPengeluaran(editPengeluaran)
    setShowPengeluaranModal(false)
    setEditPengeluaran(null)
  }

  const tahunOptions = useMemo(() => {
    const years = new Set(pengeluaranList.map((p) => parseTanggal(p.tanggal).getFullYear()))
    years.add(new Date().getFullYear())
    return ['Semua Tahun', ...Array.from(years).sort((a, b) => b - a).map(String)]
  }, [pengeluaranList])

  // Filter: cari di judul/kategori/tempat/penyelenggara + tahun + bulan
  // (pola sama kayak filter di halaman Booking).
  const filtered = useMemo(() => pengeluaranList.filter((p) => {
    const q = search.trim().toLowerCase()
    if (q) {
      const cocok = [p.judul, p.kategori, p.tempat, p.penyelenggara]
        .some((field) => field?.toLowerCase().includes(q))
      if (!cocok) return false
    }
    const d = parseTanggal(p.tanggal)
    if (filterTahun !== 'Semua Tahun' && String(d.getFullYear()) !== filterTahun) return false
    if (filterBulan !== 'Semua Bulan' && BULAN_PENUH[d.getMonth()] !== filterBulan) return false
    return true
  }), [pengeluaranList, search, filterTahun, filterBulan])

  // Dikelompokin per BULAN+TAHUN (soalnya filter "Semua Tahun" bisa
  // nampilin beberapa tahun sekaligus) -- terbaru di atas, transaksi
  // terbaru di atas (urutan dari query).
  const perBulan = useMemo(() => {
    const groups = []
    filtered.forEach((p) => {
      const d = parseTanggal(p.tanggal)
      const kunci = d.getFullYear() * 12 + d.getMonth()
      let g = groups.find((x) => x.kunci === kunci)
      if (!g) { g = { kunci, bulan: d.getMonth(), tahun: d.getFullYear(), items: [], total: 0 }; groups.push(g) }
      g.items.push(p)
      g.total += Number(p.total) || 0
    })
    return groups.sort((a, b) => b.kunci - a.kunci)
  }, [filtered])
  const totalFiltered = filtered.reduce((s, p) => s + (Number(p.total) || 0), 0)
  const perKategori = useMemo(() => {
    const map = {}
    filtered.forEach((p) => { map[p.kategori] = (map[p.kategori] || 0) + (Number(p.total) || 0) })
    return Object.entries(map).sort((a, b) => b[1] - a[1])
  }, [filtered])

  // Keterangan periode di kartu ringkasan, ngikut filter yang dipilih.
  const labelPeriode = filterTahun === 'Semua Tahun'
    ? (filterBulan === 'Semua Bulan' ? 'Semua Waktu' : `${filterBulan}, semua tahun`)
    : (filterBulan === 'Semua Bulan' ? `Tahun ${filterTahun}` : `${filterBulan} ${filterTahun}`)

  return (
    <div className="app-shell">
      <Sidebar />
      <div className="main">
        <div className="topbar">
          <div>
            <div className="greeting">Pengeluaran</div>
            <div className="greeting-date">{filtered.length} dari {pengeluaranList.length} transaksi</div>
          </div>
          <div className="topbar-actions">
            <button className="btn-booking-primary" onClick={bukaTambah} type="button">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M12 5v14M5 12h14" /></svg>
              Pengeluaran
            </button>
          </div>
        </div>

        {/* Keterangan halaman -- penjelasan buat user tentang halaman
            Pengeluaran ini. Ditaruh DI ATAS filter (setelah topbar),
            selebar halaman, & tampil terus (nggak ikut disembunyiin pas
            loading/error). */}
        <div className="pgl-hint"><a>PETUNJUK:</a> Catat semua data pengeluaran bisnismu di sini. Seperti belanja produk rutin, alat, portofolio, iklan di media sosial, dan lainnya. Biaya pengeluaran untuk bayar ke tim/vendor, produk Add On (Sewa), dan Add On (Beli) yang ada di booking klien nggak usah dicatat di sini, karena udah otomatis terhitung di grafik <b>Pengeluaran dalam Booking</b> di halaman <b>Keuangan</b>.</div>

        <div className="pgl-filter-bar">
          <div className="pgl-search">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="7" /><path d="M21 21l-4.3-4.3" /></svg>
            <input
              type="text"
              placeholder="Cari judul, kategori, tempat, atau penyelenggara ...."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="pgl-filter-select"><CustomSelect options={tahunOptions} value={filterTahun} onChange={setFilterTahun} /></div>
          <div className="pgl-filter-select"><CustomSelect options={['Semua Bulan', ...BULAN_PENUH]} value={filterBulan} onChange={setFilterBulan} /></div>
        </div>

        {loading && <div className="loading-state">Memuat data...</div>}
        {!loading && error && <div className="pgl-card pgl-kosong">Gagal memuat pengeluaran: {error}</div>}

        {!loading && !error && (
          <>
            <div className="pgl-card pgl-ringkasan" ref={refRingkasan}>
              {/* Judul + badge periode SEBARIS -- badge nempel di ujung kanan
                  teks judul (bukan di bawahnya). */}
              <div className="pgl-ringkasan-judul">
                <h3>Total Pengeluaran Bisnis</h3>
                <div className="pgl-periode">{labelPeriode}</div>
              </div>
              <div className="pgl-total">{formatRupiah(totalFiltered)}</div>

              {perKategori.length > 0 && (
                <div className="pgl-kategori-list">
                  {perKategori.map(([nama, jumlah], i) => (
                    <div className="pgl-kategori-row" key={nama}>
                      <div className="pgl-kategori-info">
                        <span>{nama}</span>
                        <b>{formatRupiah(jumlah)}</b>
                      </div>
                      <div className="pgl-kategori-track">
                        <div
                          className="pgl-kategori-fill"
                          style={{
                            width: inViewRingkasan ? `${totalFiltered > 0 ? Math.max(2, (jumlah / totalFiltered) * 100) : 0}%` : '0%',
                            transitionDelay: `${i * 0.08}s`,
                          }}
                        ></div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {perBulan.length === 0 && (
              <div className="pgl-card pgl-kosong">
                {pengeluaranList.length === 0
                  ? <>Belum ada pengeluaran bisnis tercatat. Catat belanja alat, portofolio, promosi, atau biaya bisnis lainnya lewat tombol <b>+ Pengeluaran</b> di atas.</>
                  : 'Tidak ada pengeluaran yang cocok dengan pencarian/filter.'}
              </div>
            )}

            {perBulan.map((g) => (
              <div className="pgl-card pgl-bulan" key={g.kunci}>
                <div className="pgl-bulan-head">
                  <h3>{BULAN_PENUH[g.bulan]} {g.tahun}</h3>
                  <b>{formatRupiah(g.total)}</b>
                </div>
                {g.items.map((p) => {
                  const tgl = parseTanggal(p.tanggal)
                  return (
                    <button type="button" className="pgl-row" key={p.id} onClick={() => setDetailPengeluaran(p)}>
                      <div className="pgl-tgl">
                        <span className="pgl-tgl-hari">{tgl.getDate()}</span>
                        <span className="pgl-tgl-bulan">{BULAN_SINGKAT[tgl.getMonth()]}</span>
                      </div>
                      <div className="pgl-info">
                        {/* Baris 1: "Kategori | Judul" -- Kategori SELALU tampil
                            (syarat simpan: kategori wajib dipilih), Judul
                            opsional: kalau kosong cukup nama kategorinya.
                            Baris 2: "N item · Lokasi/Toko/Tempat" -- jumlah
                            item selalu ada, tempat cuma kalau diisi. */}
                        <div className="pgl-judul">{p.judul ? `${p.kategori} | ${p.judul}` : p.kategori}</div>
                        <div className="pgl-meta">
                          {[`${p.jumlah_item} item`, p.tempat].filter(Boolean).join(' · ')}
                        </div>
                      </div>
                      <div className="pgl-nominal">{formatRupiah(p.total)}</div>
                    </button>
                  )
                })}
              </div>
            ))}
          </>
        )}
      </div>

      {showPengeluaranModal && (
        <PengeluaranModal
          editData={editPengeluaran}
          onClose={handleBatalForm}
          onSaved={handlePengeluaranSaved}
        />
      )}

      {detailPengeluaran && (
        <PengeluaranDetailModal
          key={detailPengeluaran.id}
          data={detailPengeluaran}
          onClose={() => setDetailPengeluaran(null)}
          onEdit={bukaEditDariDetail}
          onDeleted={() => { setDetailPengeluaran(null); reloadPengeluaran() }}
        />
      )}
    </div>
  )
}
