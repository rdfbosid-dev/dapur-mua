import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import Sidebar from '../components/Sidebar'
import LayananModal from '../components/LayananModal'
import LayananRambutModal from '../components/LayananRambutModal'
import { KOLOM_LAYANAN, labelHalamanLayanan, bandingHalamanLayanan } from '../lib/layanan'
import { KOLOM_LAYANAN_RAMBUT, labelHalamanPaketRambut, bandingPaketRambut } from '../lib/layananRambut'
import './Layanan.css'

function formatRupiah(n) {
  return 'Rp' + (Number(n) || 0).toLocaleString('id-ID')
}

// Label baris, misal "Wedding - Premium", "Wedding" (paket dasar, Jenis
// kosong), "Regular - Standard (Jogja)" (Keterangan dalam kurung).
function labelPaket(l) {
  return labelHalamanLayanan(l)
}

// Halaman PAKET LAYANAN -- 2 tab: paket MAKEUP (tabel `layanan`) & paket
// RAMBUT / Hairdo-Hijabdo+ (tabel `layanan_rambut`, lib/layananRambut.js).
// (Nama tabel/file/route tetap `layanan` -- cuma teks tampilan yang
// "Paket Layanan", biar nanti bisa nambah paket rambut dst lewat kategori.)
// Layanan = DAFTAR HARGA, pengisi field Kategori/Jenis Makeup/Biaya
// Makeup di form booking (lihat lib/layanan.js) -- nggak ada rumus
// perhitungan yang baca tabel ini, jadi ubah/hapus layanan nggak pernah
// ngubah angka booking yang udah tersimpan.
export default function Layanan() {
  const [daftar, setDaftar] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // undefined = modal tertutup, null = mode tambah, objek = mode edit.
  const [form, setForm] = useState(undefined)

  // Tab aktif: 'makeup' | 'rambut'. Tombol "+ Paket Layanan" di atas
  // nambah paket buat tab yang lagi dibuka.
  const [tab, setTab] = useState('makeup')
  const [daftarRambut, setDaftarRambut] = useState([])
  const [loadingRambut, setLoadingRambut] = useState(true)
  const [errorRambut, setErrorRambut] = useState('')
  const [formRambut, setFormRambut] = useState(undefined)

  // RLS tabel layanan udah ngebatesin ke punya user ini sendiri.
  function ambilDaftar() {
    return supabase.from('layanan').select(KOLOM_LAYANAN).order('nama')
  }

  // State diisi di dalam .then() -- pola sama kayak Pengeluaran.jsx (lolos
  // aturan lint react-hooks/set-state-in-effect).
  useEffect(() => {
    ambilDaftar().then(({ data, error: err }) => {
      if (err) setError(err.message)
      else setDaftar(data || [])
      setLoading(false)
    })
  }, [])

  // Paket rambut -- RLS tabel layanan_rambut juga cuma punya user ini.
  function ambilDaftarRambut() {
    return supabase.from('layanan_rambut').select(KOLOM_LAYANAN_RAMBUT)
  }
  useEffect(() => {
    ambilDaftarRambut().then(({ data, error: err }) => {
      if (err) setErrorRambut(err.message)
      else setDaftarRambut(data || [])
      setLoadingRambut(false)
    })
  }, [])
  async function muatUlangRambut() {
    const { data, error: err } = await ambilDaftarRambut()
    if (err) { setErrorRambut(err.message); return }
    setErrorRambut('')
    setDaftarRambut(data || [])
  }
  function handleSavedRambut() {
    setFormRambut(undefined)
    muatUlangRambut()
  }

  async function muatUlang() {
    const { data, error: err } = await ambilDaftar()
    if (err) { setError(err.message); return }
    setError('')
    setDaftar(data || [])
  }

  function handleSaved() {
    setForm(undefined)
    muatUlang()
  }

  // Urut Kategori A-Z, lalu paket dasar (tanpa Jenis) dulu, Jenis A-Z, dan
  // varian Keterangan nempel di bawah Jenis yang sama, misal Regular - Standard,
  // Regular - Standard (Jogja), Regular - VIP, Wedding, Wedding (Jogja),
  // Wedding - Premium. Paket nonaktif tetap di posisinya (diredupkan + label).
  const urut = useMemo(() => [...daftar].sort(bandingHalamanLayanan), [daftar])
  const jumlahAktif = daftar.filter((l) => l.aktif).length
  const urutRambut = useMemo(() => [...daftarRambut].sort(bandingPaketRambut), [daftarRambut])
  const jumlahAktifRambut = daftarRambut.filter((l) => l.aktif).length
  const tabRambut = tab === 'rambut'

  return (
    <div className="app-shell">
      <Sidebar />
      <div className="main">
        <div className="topbar">
          <div>
            <div className="greeting">Paket Layanan</div>
            <div className="greeting-date">{tabRambut ? `${jumlahAktifRambut} paket layanan rambut aktif dari ${daftarRambut.length} paket layanan rambut` : `${jumlahAktif} paket layanan makeup aktif dari ${daftar.length} paket layanan makeup`}</div>
          </div>
          <div className="topbar-actions">
            <button className="btn-booking-primary" onClick={() => (tabRambut ? setFormRambut(null) : setForm(null))} type="button">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M12 5v14M5 12h14" /></svg>
              Paket Layanan
            </button>
          </div>
        </div>

        <div className="lyn-opsional">Fitur ini opsional, silakan digunakan jika dibutuhkan.</div>
        {/* Saklar geser Makeup | Rambut -- sama dengan tab di halaman Permintaan
            Booking: "thumb" bergeser ke tab aktif lewat variabel CSS --lyn-tab-i. */}
        <div className="lyn-tabs" role="tablist" aria-label="Jenis paket" style={{ '--lyn-tab-i': tabRambut ? 1 : 0 }}>
          <span className="lyn-tabs-thumb" aria-hidden="true" />
          <button type="button" role="tab" aria-selected={!tabRambut} className={`lyn-tab${!tabRambut ? ' sel' : ''}`} onClick={() => setTab('makeup')}>Makeup</button>
          <button type="button" role="tab" aria-selected={tabRambut} className={`lyn-tab${tabRambut ? ' sel' : ''}`} onClick={() => setTab('rambut')}>Rambut</button>
        </div>

        {tabRambut && (
          <>
            <div className="lyn-hint">
              <a>PETUNJUK:</a> Buat daftar paket <b>Hairdo</b> dan <b>Hijabdo+</b> beserta harganya di sini, misalnya Hairdo · Sanggul Modern atau Hijabdo+ · Syar'i. Pas bikin booking, pilih Hairdo atau Hijabdo+ di kartu Klien lalu pilih paketnya: <b>Detail Layanan Rambut</b> dan <b>Biaya Layanan Tambahan</b> langsung terisi (tetap bisa diubah manual). Dikerjakan oleh, komisi, dan nama tim tetap diisi manual. Mengubah atau menghapus paket <b>nggak mengubah</b> booking yang udah tersimpan.
            </div>

            {loadingRambut && <div className="loading-state">Memuat data...</div>}
            {!loadingRambut && errorRambut && <div className="lyn-card lyn-kosong">Gagal memuat paket rambut: {errorRambut}</div>}

            {!loadingRambut && !errorRambut && daftarRambut.length === 0 && (
              <div className="lyn-card lyn-kosong">
                Belum ada paket rambut. Tambahkan paket pertamamu lewat tombol <b>+ Paket Layanan</b> di atas, misalnya <b>Hairdo · Sanggul Modern</b> atau <b>Hijabdo+ · Syar'i</b>.
              </div>
            )}

            {!loadingRambut && !errorRambut && daftarRambut.length > 0 && (
              <div className="lyn-card lyn-daftar">
                {urutRambut.map((l) => (
                  <button type="button" className={`lyn-row${l.aktif ? '' : ' nonaktif'}`} key={l.id} onClick={() => setFormRambut(l)}>
                    <div className="lyn-nama">{labelHalamanPaketRambut(l)}</div>
                    <div className="lyn-kanan">
                      <span className="lyn-harga">{formatRupiah(l.biaya)} <small>/ sesi</small></span>
                      {!l.aktif && <span className="lyn-badge">Nonaktif</span>}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </>
        )}

        {!tabRambut && (
        <>
        <div className="lyn-hint">
          <a>PETUNJUK:</a> Buat daftar paket layanan makeup-mu dan harga di sini. Tentukan <b>Kategori</b>, <b>Jenis Makeup</b>, dan <b>Biaya Makeup per sesi</b>, misalnya Wedding · Premium, Wedding · Ultimate, Regular · VIP. Pas bikin booking, cukup pilih layanannya di kartu Klien: Kategori dan Jenis Makeup otomatis mengikuti layanan, dan Biaya Makeup langsung terisi (tetap bisa diubah manual). Mengubah atau menghapus layanan <b>nggak mengubah</b> booking yang udah tersimpan.
        </div>

        {loading && <div className="loading-state">Memuat data...</div>}
        {!loading && error && <div className="lyn-card lyn-kosong">Gagal memuat paket layanan: {error}</div>}

        {!loading && !error && daftar.length === 0 && (
          <div className="lyn-card lyn-kosong">
            Belum ada paket layanan. Tambahkan paket pertamamu lewat tombol <b>+ Paket Layanan</b> di atas, misalnya <b>Wedding · Premium</b> atau <b>Regular · VIP</b>.
          </div>
        )}

        {!loading && !error && daftar.length > 0 && (
          <div className="lyn-card lyn-daftar">
            {urut.map((l) => (
              // Desain baris disamain sama daftar transaksi di halaman
              // Pengeluaran (.pgl-row), tanpa kotak tanggal.
              <button type="button" className={`lyn-row${l.aktif ? '' : ' nonaktif'}`} key={l.id} onClick={() => setForm(l)}>
                <div className="lyn-nama">{labelPaket(l)}</div>
                <div className="lyn-kanan">
                  <span className="lyn-harga">{formatRupiah(l.biaya_makeup)} <small>/ sesi</small></span>
                  {!l.aktif && <span className="lyn-badge">Nonaktif</span>}
                </div>
              </button>
            ))}
          </div>
        )}
        </>
        )}
      </div>

      {formRambut !== undefined && (
        <LayananRambutModal
          key={formRambut ? formRambut.id : 'baru-rambut'}
          editData={formRambut}
          onClose={() => setFormRambut(undefined)}
          onSaved={handleSavedRambut}
        />
      )}

      {form !== undefined && (
        <LayananModal
          key={form ? form.id : 'baru'}
          editData={form}
          onClose={() => setForm(undefined)}
          onSaved={handleSaved}
        />
      )}
    </div>
  )
}
