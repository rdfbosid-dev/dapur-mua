import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import Sidebar from '../components/Sidebar'
import LayananModal from '../components/LayananModal'
import { KOLOM_LAYANAN, namaLayanan } from '../lib/layanan'
import './Layanan.css'

function formatRupiah(n) {
  return 'Rp' + (Number(n) || 0).toLocaleString('id-ID')
}

// Label baris "Kategori - Jenis Makeup", misal "Wedding - Premium".
function labelPaket(l) {
  return `${l.kategori_makeup} - ${namaLayanan(l)}`
}

// Halaman PAKET LAYANAN -- daftar paket layanan makeup milik user ini.
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

  // Urut ABJAD berdasarkan label lengkapnya (Kategori dulu, lalu Jenis),
  // misal Regular - Standard, Regular - VIP, Special Occasion - VIP,
  // Wedding - Premium, Wedding - Ultimate. Paket nonaktif tetap di posisi
  // abjadnya (cuma diredupkan + label Nonaktif).
  const urut = useMemo(
    () => [...daftar].sort((a, b) => labelPaket(a).localeCompare(labelPaket(b), 'id', { sensitivity: 'base', numeric: true })),
    [daftar],
  )
  const jumlahAktif = daftar.filter((l) => l.aktif).length

  return (
    <div className="app-shell">
      <Sidebar />
      <div className="main">
        <div className="topbar">
          <div>
            <div className="greeting">Paket Layanan</div>
            <div className="greeting-date">{jumlahAktif} paket aktif dari {daftar.length} paket</div>
          </div>
          <div className="topbar-actions">
            <button className="btn-booking-primary" onClick={() => setForm(null)} type="button">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M12 5v14M5 12h14" /></svg>
              Paket Layanan
            </button>
          </div>
        </div>

        <div className="lyn-opsional">Fitur ini opsional, silakan digunakan jika dibutuhkan.</div>
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
      </div>

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
