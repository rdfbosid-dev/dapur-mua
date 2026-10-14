import { useEffect, useRef, useState } from 'react'
import { opsiPaketRambut, tampilkanPilihanPaketRambut, labelPilihanPaketRambut, paketRambutDipakai, PANJANG_MAKS_DETAIL_RAMBUT } from '../lib/layananRambut'
import { PILIHAN_ISI_MANUAL } from '../lib/layanan'
import './CustomSelect.css'
import './PilihLayanan.css'
import './PilihPaketRambut.css'

function formatRupiah(n) {
  return 'Rp' + (Math.round(Number(n) || 0)).toLocaleString('id-ID')
}

const PLACEHOLDER_DETAIL = {
  Hairdo: 'contoh: Sanggul Modern',
  'Hijabdo+': "contoh: Syar'i",
}

// Baris "Paket Hairdo/Hijabdo+" + "Detail Layanan Rambut" di kartu Klien --
// dipakai BookingModal (Booking Baru) & BookingDetailModal (mode Edit), biar
// tampilan & aturannya pasti sama. Muncul setelah tombol Hairdo/Hijabdo+
// dipilih. Dropdown paket cuma tampil kalau user punya paket rambut aktif
// berjenis itu (lihat lib/layananRambut.js); field Detail SELALU tampil
// (opsional) -- jadi sanggul/request khusus tetap bisa dicatat tanpa paket.
// - onPilih(id | null): null = "Pilih Manual" (isian dibiarkan apa adanya).
// - onDetail(teks): isi field Detail.
export default function PilihPaketRambut({ daftar, jenis, idTerpilih, detail, onPilih, onDetail }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    function handleClickOutside(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const tampilDropdown = tampilkanPilihanPaketRambut(daftar, jenis, idTerpilih)
  const opsi = opsiPaketRambut(daftar, jenis, idTerpilih)
  const terpilih = paketRambutDipakai(daftar, idTerpilih)
  const nilai = labelPilihanPaketRambut(daftar, idTerpilih) || PILIHAN_ISI_MANUAL

  function pilih(id) {
    setOpen(false)
    onPilih(id)
  }
  const baris = (id, label) => {
    const sel = (id || null) === (terpilih ? terpilih.id : null)
    return (
      <div key={id || 'manual'} role="option" aria-selected={sel} className={`cselect-option${sel ? ' sel' : ''}`} onClick={() => pilih(id)}>
        {label}
        {sel && <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M20 6 9 17l-5-5" /></svg>}
      </div>
    )
  }

  return (
    <div className="field-grid-peserta cols-2 pilih-rambut">
      {tampilDropdown && (
        <div className="field pilih-layanan">
          <label>Paket {jenis}</label>
          <div className="cselect" ref={ref}>
            <button
              type="button"
              className={`cselect-trigger cselect-trigger--modal${open ? ' open' : ''}`}
              onClick={() => setOpen((o) => !o)}
              aria-haspopup="listbox"
              aria-expanded={open}
            >
              <span>{nilai}</span>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 9l6 6 6-6" /></svg>
            </button>
            {open && (
              <div className="cselect-menu" role="listbox">
                {baris(null, PILIHAN_ISI_MANUAL)}
                {opsi.map((o) => baris(o.id, o.label))}
              </div>
            )}
          </div>
        </div>
      )}
      <div className="field">
        <label>Detail Layanan Rambut (opsional)</label>
        <input
          type="text"
          placeholder={PLACEHOLDER_DETAIL[jenis] || 'contoh: Sanggul Modern'}
          maxLength={PANJANG_MAKS_DETAIL_RAMBUT}
          value={detail || ''}
          onChange={(e) => onDetail(e.target.value)}
        />
      </div>
    </div>
  )
}

// Keterangan di bawah field Biaya Layanan Tambahan: muncul kalau biaya yang
// diisi beda dari harga paket rambut (diskon/harga khusus).
export function CatatanHargaRambut({ paket, biaya }) {
  if (!paket) return null
  const harga = Math.round(Number(paket.biaya) || 0)
  if (Math.round(Number(biaya) || 0) === harga) return null
  return <div className="pilih-layanan-catatan">Harga paket {paket.jenis}{paket.nama ? ` ${paket.nama}` : ''}: <b>{formatRupiah(harga)}</b></div>
}
