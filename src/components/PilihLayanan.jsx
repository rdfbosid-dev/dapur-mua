import { useEffect, useRef, useState } from 'react'
import { kelompokOpsiLayanan, labelLayanan, labelLengkapLayanan, layananDipakai, namaLayanan, tampilkanPilihanLayanan, kategoriLebihTinggi, PILIHAN_ISI_MANUAL } from '../lib/layanan'
import './CustomSelect.css'
import './PilihLayanan.css'

function formatRupiah(n) {
  return 'Rp' + (Math.round(Number(n) || 0)).toLocaleString('id-ID')
}

// Dropdown "Paket Layanan Makeup" di kartu Klien -- dipakai BookingModal (form
// Booking Baru) & BookingDetailModal (mode Edit), biar tampilan & aturannya
// pasti sama di dua tempat. Nggak tampil sama sekali kalau user belum punya
// layanan aktif (form booking-nya sama persis kayak sebelum ada fitur ini).
// - eventAktif: Event booking yang lagi dipilih -- layanan berkategori yang
//   biasa dipakai acara itu ditaruh paling atas (bukan disaring).
// - tersimpan: { kategori, jenis } yang tersimpan di booking (mode Edit) --
//   kalau beda dari layanan, dikasih tahu bakal ikut disamakan.
// - peringatan: hasil peringatanKategoriEvent (lihat lib/layanan.js).
// - onPilih(id | null): null = "Pilih Manual".
// Tampilan menu SENGAJA numpang class CustomSelect (.cselect-*), cuma
// ditambah judul kelompok (Kategori) & Jenis Makeup di bawahnya dibuat
// menjorok sebagai anaknya -- CustomSelect bawaan nggak punya pengelompokan.
export default function PilihLayanan({ daftar, idTerpilih, eventAktif = '', tersimpan = null, peringatan = null, onPilih }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    function handleClickOutside(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  if (!tampilkanPilihanLayanan(daftar, idTerpilih)) return null
  const kelompok = kelompokOpsiLayanan(daftar, idTerpilih, eventAktif)
  const l = layananDipakai(daftar, idTerpilih)
  const nilai = labelLayanan(daftar, idTerpilih)
  const kategoriBeda = l && tersimpan && tersimpan.kategori && tersimpan.kategori !== l.kategori_makeup
  const jenisBeda = l && tersimpan && String(tersimpan.jenis || '').trim() !== namaLayanan(l)

  function pilih(id) {
    setOpen(false)
    onPilih(id)
  }
  const opsi = (id, label, anak = false) => (
    <div
      key={id || 'manual'}
      role="option"
      aria-selected={(id || null) === (idTerpilih || null)}
      className={`cselect-option${anak ? ' pilih-layanan-anak' : ''}${(id || null) === (idTerpilih || null) ? ' sel' : ''}`}
      onClick={() => pilih(id)}
    >
      {label}
      {(id || null) === (idTerpilih || null) && (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M20 6 9 17l-5-5" /></svg>
      )}
    </div>
  )

  return (
    <div className="field pilih-layanan">
      <label>Paket Layanan Makeup</label>
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
            {opsi(null, PILIHAN_ISI_MANUAL)}
            {kelompok.map((k) => (
              <div className="pilih-layanan-kelompok" key={k.judul}>
                <div className={`pilih-layanan-judul${k.cocok ? ' cocok' : ''}`}>{k.judul}</div>
                {k.opsi.map((o) => opsi(o.id, o.label, true))}
              </div>
            ))}
          </div>
        )}
      </div>
      {l && (
        <div className="pilih-layanan-catatan">Kategori &amp; Jenis Makeup mengikuti layanan ini.</div>
      )}
      {/* Catatan kuning Event vs kategori, langsung di bawah layanan yang
          jadi sumber kategorinya (klien manual: di bawah field Kategori). */}
      {l && <CatatanKategoriKartu peringatan={peringatan} kategori={l.kategori_makeup} />}
      {(kategoriBeda || jenisBeda) && (
        <div className="pilih-layanan-catatan">
          Data tersimpan sebelumnya: {tersimpan.kategori || '-'}{tersimpan.jenis ? ` · ${tersimpan.jenis}` : ''}. Akan disamakan dengan layanan ini waktu disimpan.
        </div>
      )}
    </div>
  )
}

// Petunjuk netral di bawah field Event -- cuma tampil kalau user punya
// layanan aktif (buat yang nggak pakai fitur ini, form tetap kayak dulu).
export function PetunjukEventLayanan({ daftar }) {
  if (!daftar.some((l) => l.aktif)) return null
  return <div className="pilih-layanan-catatan">Layanan yang cocok untuk acara ini akan muncul paling atas di pilihan Paket Layanan Makeup.</div>
}

// Catatan di kartu klien (warna kuning lembut = "cek lagi", BUKAN error).
// Nggak ngeblok apa pun -- konfirmasinya ada waktu Simpan. Muncul kalau:
// - kategori klien ini LEBIH TINGGI dari kategori acara (misal Wedding di
//   Wisuda) -- cuma di kartu klien itu; atau
// - NGGAK SATU PUN klien cocok sama acara -- di semua kartu yang udah
//   punya kategori.
export function CatatanKategoriKartu({ peringatan, kategori }) {
  const k = String(kategori || '').trim()
  if (!peringatan || !k) return null
  if (kategoriLebihTinggi(k, peringatan.kategori)) {
    return (
      <div className="pilih-layanan-peringatan" role="note">
        Kategori klien ini <b>{k}</b>, lebih tinggi dari kategori yang biasa dipakai acara <b>{peringatan.event}</b> (<b>{peringatan.kategori}</b>). Pastikan sudah benar.
      </div>
    )
  }
  if (!peringatan.tidakAdaYangCocok) return null
  return (
    <div className="pilih-layanan-peringatan" role="note">
      Kategori klien ini <b>{k}</b>, sedangkan acara <b>{peringatan.event}</b> biasanya pakai kategori <b>{peringatan.kategori}</b>. Pastikan sudah benar.
    </div>
  )
}

// Teks konfirmasi waktu Simpan (dipakai BookingModal & BookingDetailModal).
export function pesanKonfirmasiKategori(peringatan, namaTombol) {
  const kalimat = []
  if (peringatan.lebihTinggi && peringatan.lebihTinggi.length > 0) {
    const daftar = peringatan.lebihTinggi.map((x) => `Klien ${x.nomor} (${x.kategori})`).join(', ')
    kalimat.push(`${daftar} memakai kategori yang lebih tinggi dari kategori yang biasa dipakai acara ${peringatan.event} (${peringatan.kategori}).`)
  } else {
    kalimat.push(`Acara ${peringatan.event} biasanya pakai kategori ${peringatan.kategori}, tapi kategori klien di booking ini ${peringatan.kategoriKlien.join(', ')}.`)
  }
  kalimat.push(`Kalau sudah benar, tekan ${namaTombol} sekali lagi.`)
  return kalimat.join(' ')
}

// Keterangan di bawah field Biaya Makeup: muncul kalau biaya yang diisi beda
// dari harga layanan (diskon/harga khusus), biar kelihatan itu disengaja.
export function CatatanHargaLayanan({ layanan, biaya }) {
  if (!layanan) return null
  const hargaLayanan = Math.round(Number(layanan.biaya_makeup) || 0)
  if (Math.round(Number(biaya) || 0) === hargaLayanan) return null
  return <div className="pilih-layanan-catatan">Harga layanan {labelLengkapLayanan(layanan)}: <b>{formatRupiah(hargaLayanan)}</b></div>
}
