import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { LABEL_TEMPAT_DEFAULT, infoKategoriTersimpan, kelompokkanItem } from '../lib/pengeluaran'
import NotaPengeluaranModal from './NotaPengeluaranModal'
import IconClose from './IconClose'
import './PengeluaranDetailModal.css'

function formatRupiah(n) {
  return 'Rp' + (Number(n) || 0).toLocaleString('id-ID')
}
// Tanggal "YYYY-MM-DD" di-parse MANUAL jadi tanggal lokal (bukan
// new Date(str) yang dibaca UTC & bisa geser 1 hari).
function formatTanggal(dateStr) {
  if (!dateStr) return '-'
  const [y, m, d] = String(dateStr).split('-').map(Number)
  return new Date(y, (m || 1) - 1, d || 1).toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' })
}

// Ikon panah belok (↳) buat baris anak di grup item -- lihat
// kelompokkanItem di bawah.
function IconPanahAnak() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="18" height="18">
      <path d="M4 3v8a5 5 0 0 0 5 5h11" />
      <path d="M16 12l4 4-4 4" />
    </svg>
  )
}

// Tampilan DETAIL 1 transaksi Pengeluaran Usaha (cuma baca, bukan form)
// -- "kembaran" BookingDetailModal versi pengeluaran. Tombol di atas:
// Nota (lembar rincian yang bisa dicetak/diunduh) & Edit Pengeluaran
// (buka PengeluaranModal mode edit -- lewat onEdit, diatur halaman induk).
//
// `data` = 1 baris dari VIEW pengeluaran_summary. Item-item-nya di-fetch
// sendiri di sini, terus dioper ke Nota (biar nggak fetch 2x).
export default function PengeluaranDetailModal({ data, onClose, onEdit, onDeleted }) {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showNota, setShowNota] = useState(false)
  // Hapus -- 2 langkah, SAMA polanya kayak Hapus Booking di Detail
  // Booking: tombol merah di footer -> banner konfirmasi + "Ya, hapus
  // permanen".
  const [confirmHapus, setConfirmHapus] = useState(false)
  const [menghapus, setMenghapus] = useState(false)

  async function handleHapus() {
    setMenghapus(true)
    setError('')
    // Item-item-nya ikut kehapus otomatis (ON DELETE CASCADE di database).
    const { error: err } = await supabase.from('pengeluaran').delete().eq('id', data.id)
    setMenghapus(false)
    if (err) { setError(err.message); setConfirmHapus(false); return }
    onDeleted()
  }

  useEffect(() => {
    supabase
      .from('pengeluaran_items')
      .select('nama_item, keterangan, keterangan_tambahan, jumlah, harga_satuan')
      .eq('pengeluaran_id', data.id)
      .order('urutan')
      .then(({ data: rows, error: err }) => {
        if (err) setError(err.message)
        else setItems(rows || [])
        setLoading(false)
      })
  }, [data.id])

  // Label field (Judul/Tempat/Penyelenggara & field tambahan item) diambil
  // dari pengaturan kategori di lib/pengeluaran.js -- SAMA kayak label pas
  // ngisi form, biar user nggak bingung.
  const info = infoKategoriTersimpan(data.kategori)

  return (
    <div className="pengeluaran-detail-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="modal">
        <div className="modal-head">
          <h2>Pengeluaran</h2>
          <button className="modal-close" onClick={onClose} type="button" aria-label="Tutup"><IconClose /></button>
        </div>

        <div className="modal-body">
          {error && <div className="modal-error">{error}</div>}

          {/* Baris atas: nilai kategori (pill, TANPA label) di kiri,
              tombol Nota & Edit Pengeluaran di kanan. */}
          <div className="detail-header">
            <span className="kategori-pill">{data.kategori}</span>
            <div className="detail-actions">
              <button className="btn-ghost" onClick={() => setShowNota(true)} disabled={loading}>Nota</button>
              <button className="btn-ghost" onClick={onEdit}>Edit Pengeluaran</button>
            </div>
          </div>

          {/* Info utama -- daftar "Label : Nilai" (titik dua sejajar).
              Urutan: Judul, (Penyelenggara), Tanggal, (Tempat/Lokasi).
              Label ngikut pengaturan kategori di lib/pengeluaran.js
              (misal "Nama Pelatihan/Kelas", "Lokasi"). */}
          <div className="info-list">
            <span className="info-label">{info?.labelJudul || 'Judul'}</span><span className="info-titik">:</span><span className="info-nilai">{data.judul || '-'}</span>
            {info?.penyelenggara && (
              <><span className="info-label">{info.penyelenggara.label}</span><span className="info-titik">:</span><span className="info-nilai">{data.penyelenggara || '-'}</span></>
            )}
            <span className="info-label">Tanggal</span><span className="info-titik">:</span><span className="info-nilai">{formatTanggal(data.tanggal)}</span>
            {!info?.tanpaTempat && (
              <><span className="info-label">{info?.labelTempat || LABEL_TEMPAT_DEFAULT}</span><span className="info-titik">:</span><span className="info-nilai">{data.tempat || '-'}</span></>
            )}
          </div>

          <div className="section-label">Rincian Item</div>
          {loading ? (
            <div className="empty-state">Memuat item...</div>
          ) : (
            <div className="item-list">
              {kelompokkanItem(items).map((g, gi) => (
                g.baris.length === 1 ? (
                  <div className="item-row" key={gi}>
                    <div className="item-nama">{g.nama}{g.baris[0].tambahan ? ` | ${g.baris[0].tambahan}` : ''}</div>
                    <div className="item-jumlah">{g.baris[0].jumlah}</div>
                    <div className="item-nominal">{formatRupiah(g.baris[0].subtotal)}</div>
                  </div>
                ) : (
                  <div className="item-grup" key={gi}>
                    <div className="item-grup-judul">{g.nama}</div>
                    {g.baris.map((b, bi) => (
                      <div className="item-row anak" key={bi}>
                        <div className="item-nama">
                          <span className="item-panah">{bi === 0 && <IconPanahAnak />}</span>
                          <span>{b.tambahan || g.nama}</span>
                        </div>
                        <div className="item-jumlah">{b.jumlah}</div>
                        <div className="item-nominal">{formatRupiah(b.subtotal)}</div>
                      </div>
                    ))}
                  </div>
                )
              ))}
            </div>
          )}

          <div className="total-view-row">
            <span>Total Pengeluaran</span>
            <b>{formatRupiah(data.total)}</b>
          </div>

          <div className="section-label">Catatan</div>
          <div className="catatan-view">{data.keterangan || '-'}</div>
        </div>

        {confirmHapus && (
          <div className="delete-confirm-banner">
            <div className="delete-confirm-text">
              <b>Yakin menghapus data pengeluaran {data.judul || data.kategori}?</b>
              <span>{data.jumlah_item} item di dalamnya juga akan ikut terhapus. Data yang sudah dihapus tidak bisa dikembalikan.</span>
            </div>
          </div>
        )}

        <div className="modal-foot">
          {confirmHapus ? (
            <>
              <button className="btn-danger batal" onClick={() => setConfirmHapus(false)} type="button" disabled={menghapus}>Batal</button>
              <button className="btn-danger" onClick={handleHapus} type="button" disabled={menghapus}>
                {menghapus ? 'Menghapus...' : 'Ya, hapus permanen'}
              </button>
            </>
          ) : (
            <>
              <button className="btn-danger-ghost" onClick={() => setConfirmHapus(true)} type="button">Hapus Pengeluaran</button>
              <button className="btn-ghost" onClick={onClose} type="button">Tutup</button>
            </>
          )}
        </div>
      </div>

      {showNota && <NotaPengeluaranModal data={data} items={items} onClose={() => setShowNota(false)} />}
    </div>
  )
}
