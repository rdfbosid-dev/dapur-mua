import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import IconClose from './IconClose'
import { formatAngkaInput, parseAngkaInput } from '../lib/format'
import { JENIS_RAMBUT, PANJANG_MAKS_NAMA_RAMBUT, PANJANG_MAKS_KETERANGAN_RAMBUT, biayaRambutKeForm, namaPaketRambut, keteranganPaketRambut, labelHalamanPaketRambut, labelLayananRambut } from '../lib/layananRambut'
import './LayananModal.css'

const PLACEHOLDER_NAMA = {
  Hairdo: 'contoh: Sanggul Modern, Curly, Half Up',
  'Hijabdo+': "contoh: Syar'i, Pashmina, Modern",
}
const CONTOH_NAMA = { Hairdo: 'Sanggul Modern', 'Hijabdo+': "Syar'i" }

function capitalizeWords(str) {
  return str.replace(/\b\w/g, (c) => c.toUpperCase())
}

// Form Tambah / Edit PAKET LAYANAN RAMBUT (halaman Paket Layanan, tab
// Rambut). Tampilan & ukuran SENGAJA numpang LayananModal.css (scope
// .layanan-modal-overlay), biar satu keluarga sama form paket makeup.
// Identitas paket = JENIS (Hairdo/Hijabdo+) + NAMA PAKET (opsional) +
// KETERANGAN (opsional) -- lihat lib/layananRambut.js.
// - editData null  -> mode tambah.
// - editData diisi -> mode edit, plus Hapus.
export default function LayananRambutModal({ editData = null, onClose, onSaved }) {
  const { user } = useAuth()
  const isEdit = !!editData

  const [jenis, setJenis] = useState(editData && JENIS_RAMBUT.includes(editData.jenis) ? editData.jenis : '')
  const [nama, setNama] = useState(editData ? namaPaketRambut(editData) : '')
  const [keterangan, setKeterangan] = useState(editData ? keteranganPaketRambut(editData) : '')
  const [biaya, setBiaya] = useState(isEdit ? biayaRambutKeForm(editData.biaya) : '')
  const [aktif, setAktif] = useState(isEdit ? editData.aktif !== false : true)

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [konfirmasiHapus, setKonfirmasiHapus] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    if (saving) return
    setError('')

    const namaBersih = capitalizeWords(nama.trim())
    const keteranganBersih = capitalizeWords(keterangan.trim())
    const biayaAngka = Math.round(Number(biaya) || 0)

    if (!jenis) { setError('Jenis layanan rambut wajib dipilih.'); return }
    if (biayaAngka <= 0) { setError('Biaya per sesi wajib diisi.'); return }

    const payload = { jenis, nama: namaBersih, keterangan: keteranganBersih, biaya: biayaAngka, aktif }

    setSaving(true)
    const { error: err } = isEdit
      ? await supabase.from('layanan_rambut').update(payload).eq('id', editData.id)
      : await supabase.from('layanan_rambut').insert({ ...payload, user_id: user.id })
    setSaving(false)

    if (err) {
      setError(err.code === '23505'
        ? `Paket ${labelHalamanPaketRambut(payload)}${namaBersih ? '' : ' (paket dasar)'} sudah ada. Bedakan lewat Nama Paket atau Keterangan.`
        : err.message)
      return
    }
    onSaved()
  }

  async function handleHapus() {
    if (saving) return
    setSaving(true)
    setError('')
    const { error: err } = await supabase.from('layanan_rambut').delete().eq('id', editData.id)
    setSaving(false)
    if (err) { setError(err.message); return }
    onSaved()
  }

  return (
    <div className="layanan-modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="modal">
        <div className="modal-head">
          <h2>{isEdit ? 'Edit Paket Rambut' : 'Paket Rambut'}</h2>
          <button className="modal-close" onClick={onClose} type="button" aria-label="Tutup"><IconClose /></button>
        </div>

        <form onSubmit={handleSubmit} className="layanan-form" noValidate>
          <div className="modal-body">
            <div className="layanan-info">
              Paket ini muncul di kartu Klien setelah kamu memilih <b>Hairdo</b> atau <b>Hijabdo+</b>. <b>Detail Layanan Rambut</b> dan <b>Biaya Layanan Tambahan</b> langsung terisi (masih bisa diubah secara manual). Dikerjakan oleh, komisi, dan nama tim tetap diisi manual di form booking.
            </div>

            <div className="field">
              <label>Jenis Layanan Rambut</label>
              <div className="layanan-kategori-row jenis-rambut" role="radiogroup" aria-label="Jenis Layanan Rambut">
                {JENIS_RAMBUT.map((j) => (
                  <button
                    type="button"
                    key={j}
                    role="radio"
                    aria-checked={jenis === j}
                    className={`layanan-kategori-opt${jenis === j ? ' sel' : ''}`}
                    onClick={() => setJenis(j)}
                  >
                    {j}
                  </button>
                ))}
              </div>
            </div>

            {!jenis && (
              <div className="layanan-catatan">Pilih Jenis Layanan Rambut dulu untuk melanjutkan.</div>
            )}

            {jenis && (
              <>
                <div className="field">
                  <label>Nama Paket (opsional)</label>
                  <input
                    type="text"
                    placeholder={PLACEHOLDER_NAMA[jenis]}
                    maxLength={PANJANG_MAKS_NAMA_RAMBUT}
                    value={nama}
                    onChange={(e) => setNama(e.target.value)}
                    onBlur={(e) => setNama(capitalizeWords(e.target.value.trim()))}
                  />
                  <div className="layanan-catatan">Nama ini yang akan tampil di invoice, misal "{labelLayananRambut(jenis, CONTOH_NAMA[jenis])}". Boleh dikosongkan kalau kamu cuma punya satu harga {jenis}, di invoice jadi "{jenis}".</div>
                </div>

                <div className="field">
                  <label>Keterangan (opsional)</label>
                  <input
                    type="text"
                    placeholder="contoh: Solo, Jogja, Dalam Kota, Luar Kota, Weekdays, Weekend"
                    maxLength={PANJANG_MAKS_KETERANGAN_RAMBUT}
                    value={keterangan}
                    onChange={(e) => setKeterangan(e.target.value)}
                    onBlur={(e) => setKeterangan(capitalizeWords(e.target.value.trim()))}
                  />
                  <div className="layanan-catatan">Untuk membedakan harga paket dengan jenis dan nama yang sama, misalnya per wilayah atau waktu. Keterangan cuma tampil di pilihan paket saat membuat booking, nggak tampil di invoice.</div>
                </div>

                <div className="field-grid-layanan cols-2">
                  <div className="field">
                    <label>Biaya per Sesi</label>
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
                    Paket nonaktif nggak muncul di pilihan form booking, tapi booking lama yang pakai paket ini tetap aman.
                  </div>
                </div>
              </>
            )}

            {error && <div className="layanan-error">{error}</div>}
          </div>

          {isEdit && konfirmasiHapus && (
            <div className="delete-confirm-banner">
              <div className="delete-confirm-text">
                <b>Yakin menghapus paket {labelHalamanPaketRambut(editData)}?</b>
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
                  {saving ? 'Menghapus ....' : 'Ya, hapus permanen'}
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
                    {saving ? 'Menyimpan ....' : 'Simpan Paket'}
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
