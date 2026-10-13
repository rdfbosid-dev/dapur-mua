import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import IconClose from './IconClose'
import { KATEGORI_MAKEUP_OPTIONS } from '../lib/constants'
import { formatAngkaInput, parseAngkaInput } from '../lib/format'
import { biayaKeForm, saranKategoriDariNama } from '../lib/layanan'
import './LayananModal.css'

const PANJANG_MAKS_NAMA = 80

function capitalizeWords(str) {
  return str.replace(/\b\w/g, (c) => c.toUpperCase())
}

// Form Tambah / Edit layanan (halaman Layanan Saya). Layanan = DAFTAR HARGA
// (nggak terikat ke Event -- lihat lib/layanan.js). Alurnya kayak form
// Pengeluaran: yang tampil pertama cuma KATEGORI & NAMA LAYANAN; field lain
// baru kebuka setelah Kategori dipilih.
// Identitas layanan = KATEGORI + JENIS MAKEUP (nggak ada field Nama terpisah;
// kolom `nama` di database diisi otomatis = Jenis Makeup). Contoh:
// Wedding · Premium, Wedding · Ultimate, Regular · Ibu Pengantin.
// - editData null  -> mode tambah.
// - editData diisi -> mode edit (semua field langsung kebuka), plus Hapus.
export default function LayananModal({ editData = null, onClose, onSaved }) {
  const { user } = useAuth()
  const isEdit = !!editData

  const [kategori, setKategori] = useState(
    editData && KATEGORI_MAKEUP_OPTIONS.includes(editData.kategori_makeup) ? editData.kategori_makeup : '',
  )
  // Layanan lama yang Jenis-nya kosong -> pakai Nama-nya sebagai Jenis.
  const [jenis, setJenis] = useState(editData ? (String(editData.jenis_makeup || '').trim() || editData.nama || '') : '')
  const [biaya, setBiaya] = useState(isEdit ? biayaKeForm(editData.biaya_makeup) : '')
  const [aktif, setAktif] = useState(isEdit ? editData.aktif !== false : true)

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [konfirmasiHapus, setKonfirmasiHapus] = useState(false)

  const saranKategori = saranKategoriDariNama(jenis)

  async function handleSubmit(e) {
    e.preventDefault()
    if (saving) return
    setError('')

    const jenisBersih = jenis.trim()
    const biayaAngka = Math.round(Number(biaya) || 0)

    if (!kategori) { setError('Kategori wajib dipilih.'); return }
    if (!jenisBersih) { setError('Jenis Makeup wajib diisi.'); return }
    if (biayaAngka <= 0) { setError('Biaya makeup per sesi wajib diisi.'); return }

    const payload = {
      nama: jenisBersih,
      kategori_makeup: kategori,
      jenis_makeup: jenisBersih,
      biaya_makeup: biayaAngka,
      aktif,
    }

    setSaving(true)
    const { error: err } = isEdit
      ? await supabase.from('layanan').update(payload).eq('id', editData.id)
      : await supabase.from('layanan').insert({ ...payload, user_id: user.id })
    setSaving(false)

    if (err) {
      setError(err.code === '23505' ? `Layanan ${kategori} · ${jenisBersih} sudah ada. Pakai Jenis Makeup lain.` : err.message)
      return
    }
    onSaved()
  }

  async function handleHapus() {
    if (saving) return
    setSaving(true)
    setError('')
    const { error: err } = await supabase.from('layanan').delete().eq('id', editData.id)
    setSaving(false)
    if (err) { setError(err.message); return }
    onSaved()
  }

  return (
    <div className="layanan-modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="modal">
        <div className="modal-head">
          <h2>{isEdit ? 'Edit Paket Layanan' : 'Paket Layanan'}</h2>
          <button className="modal-close" onClick={onClose} type="button" aria-label="Tutup"><IconClose /></button>
        </div>

        <form onSubmit={handleSubmit} className="layanan-form" noValidate>
          <div className="modal-body">
            <div className="layanan-info">
              Paket layanan ini bisa dipilih di kartu Klien untuk acara apa pun. <b>Kategori</b> dan <b>Jenis Makeup</b> otomatis mengikuti layanan, dan <b>Biaya Makeup</b> langsung terisi (masih bisa diubah secara manual untuk diskon atau harga khusus).
            </div>

            {/* 1. Kategori -- 3 tombol, dipilih PERTAMA. Saran dari Jenis
                Makeup ditandai "Disarankan" (nggak dipilih otomatis). */}
            <div className="field">
              <label>Kategori</label>
              <div className="layanan-kategori-row" role="radiogroup" aria-label="Kategori">
                {KATEGORI_MAKEUP_OPTIONS.map((k) => (
                  <button
                    type="button"
                    key={k}
                    role="radio"
                    aria-checked={kategori === k}
                    className={`layanan-kategori-opt${kategori === k ? ' sel' : ''}`}
                    onClick={() => setKategori(k)}
                  >
                    {k}
                    {saranKategori === k && kategori !== k && <span className="layanan-badge-saran">Disarankan</span>}
                  </button>
                ))}
              </div>
            </div>

            <div className="field">
              <label>Jenis Makeup</label>
              <input
                type="text"
                placeholder="contoh: Premium, Ultimate, Standard, VIP, atau lainnya"
                maxLength={PANJANG_MAKS_NAMA}
                value={jenis}
                onChange={(e) => setJenis(e.target.value)}
                onBlur={(e) => setJenis(capitalizeWords(e.target.value.trim()))}
              />
              <div className="layanan-catatan">Nama ini yang akan tampil di invoice, misal "Makeup Wedding Premium".</div>
            </div>

            {!kategori && (
              <div className="layanan-catatan">Pilih Kategori dulu untuk melanjutkan.</div>
            )}

            {kategori && (
              <>
                <div className="field-grid-layanan cols-2">
                  <div className="field">
                    <label>Biaya Makeup per Sesi</label>
                    <input type="text" inputMode="numeric" placeholder="Rp0" value={biaya ? `Rp${formatAngkaInput(biaya)}` : ''} onChange={(e) => setBiaya(parseAngkaInput(e.target.value))} />
                  </div>
                </div>

                <div className="field">
                  <label>Status</label>
                  <div className="layanan-toggle-row">
                    <div className={`layanan-toggle-opt${aktif ? ' sel' : ''}`} onClick={() => setAktif(true)}>Aktif</div>
                    <div className={`layanan-toggle-opt${!aktif ? ' sel' : ''}`} onClick={() => setAktif(false)}>Nonaktif</div>
                  </div>
                  <div className="layanan-catatan">
                    Layanan nonaktif nggak muncul di pilihan form booking, tapi booking lama yang pakai layanan ini tetap aman.
                  </div>
                </div>
              </>
            )}

            {error && <div className="layanan-error">{error}</div>}
          </div>

          {/* Konfirmasi hapus -- tampilan & tombol SAMA PERSIS kayak konfirmasi
              Hapus Booking di BookingDetailModal: banner selebar modal di atas
              footer, tombol footer berganti jadi Batal + Ya, hapus permanen. */}
          {isEdit && konfirmasiHapus && (
            <div className="delete-confirm-banner">
              <div className="delete-confirm-text">
                <b>Yakin menghapus paket {editData.kategori_makeup} - {String(editData.jenis_makeup || '').trim() || editData.nama}?</b>
                <span>Booking yang pernah memakai paket ini tidak berubah sama sekali (angka & isinya tetap).<br />
                Paket yang sudah dihapus tidak bisa dikembalikan.</span>
              </div>
            </div>
          )}

          <div className="modal-foot">
            {isEdit && konfirmasiHapus ? (
              <div className="foot-right">
                <button type="button" className="btn-danger batal" onClick={() => setKonfirmasiHapus(false)} disabled={saving}>Batal</button>
                <button type="button" className="btn-danger" onClick={handleHapus} disabled={saving}>
                  {saving ? 'Menghapus...' : 'Ya, hapus permanen'}
                </button>
              </div>
            ) : (
              <>
                {isEdit && (
                  <button type="button" className="btn-danger-ghost" onClick={() => { setError(''); setKonfirmasiHapus(true) }}>Hapus Paket</button>
                )}
                <div className="foot-right">
                  <button type="button" className="btn-ghost" onClick={onClose}>Batal</button>
                  <button type="submit" className="btn-primary-layanan" disabled={saving}>
                    {saving ? 'Menyimpan...' : 'Simpan Layanan'}
                  </button>
                </div>
              </>
            )}
          </div>
        </form>
      </div>
    </div>
  )
}
