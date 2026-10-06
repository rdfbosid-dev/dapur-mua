import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useAuth } from '../context/AuthContext'
import IconClose from './IconClose'
import { LABEL_TEMPAT_DEFAULT, infoKategoriTersimpan, kelompokkanItem } from '../lib/pengeluaran'
// SENGAJA numpang InvoiceModal.css (BUKAN bikin ulang) -- pola yang SAMA
// PERSIS kayak RemittanceAdviceModal.jsx: class invoice-overlay,
// invoice-paper, inv-header, inv-table, inv-summary, dst udah lengkap di
// situ, TERMASUK mekanisme @media print (nyembunyiin seluruh #root pas
// nyetak, cuma nyisain .invoice-print-portal) & versi warna fiks buat
// kertas putih. NotaPengeluaranModal.css cuma nambahin yang khusus Nota.
import './InvoiceModal.css'
import './NotaPengeluaranModal.css'

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
function IconWA() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" width="15" height="15">
      <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.39 1.26 4.81L2 22l5.41-1.42a9.87 9.87 0 0 0 4.63 1.18h.01c5.46 0 9.9-4.45 9.9-9.91 0-2.65-1.03-5.14-2.9-7.01A9.82 9.82 0 0 0 12.04 2Zm0 1.67c2.19 0 4.25.85 5.8 2.4a8.19 8.19 0 0 1 2.41 5.84c0 4.55-3.7 8.24-8.25 8.24a8.2 8.2 0 0 1-4.19-1.15l-.3-.18-3.12.82.83-3.04-.2-.31a8.15 8.15 0 0 1-1.26-4.38c0-4.55 3.7-8.24 8.28-8.24Zm-4.42 4.53c-.16 0-.43.06-.65.31-.22.25-.86.84-.86 2.05 0 1.21.88 2.38 1 2.54.13.17 1.72 2.7 4.22 3.68 2.08.82 2.51.66 2.96.62.45-.04 1.45-.59 1.65-1.16.2-.57.2-1.06.14-1.16-.06-.1-.23-.16-.48-.28-.25-.13-1.45-.72-1.68-.8-.22-.08-.39-.13-.55.13-.16.25-.63.8-.78.96-.14.17-.28.19-.53.06-.25-.13-1.05-.39-2-1.24-.74-.66-1.24-1.48-1.39-1.73-.14-.25-.02-.38.11-.51.11-.11.25-.28.37-.42.12-.14.16-.25.24-.41.08-.17.04-.31-.02-.44-.06-.13-.55-1.35-.76-1.85-.2-.48-.4-.42-.55-.43h-.47Z" />
    </svg>
  )
}
function IconIG() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" width="15" height="15">
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.2" cy="6.8" r="1" fill="currentColor" stroke="none" />
    </svg>
  )
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

// Lembar Nota-nya -- dipakai 2x (preview di modal + versi cetak yang di-
// portal), pola SAMA kayak InvoicePaper/RemittanceAdvicePaper.
// BEDA dari Invoice/Remittance Advice:
// - Judul "NOTA", subjudul "PENGELUARAN USAHA" -- dokumen catatan internal
//   MUA sendiri (bukan tagihan ke klien / bukti bayar ke tim), jadi
//   SENGAJA nggak nampilin nomor rekening.
// - Tabel 4 kolom (Item, Jumlah, Harga Satuan, Subtotal). Isi field
//   tambahan item ditulis LANGSUNG sebaris "Nama | isi" (tanpa label kayak
//   "Nama/Akun Medsos:"), & item dengan nama sama dikelompokin jadi 1
//   judul + baris anak (↳) -- SAMA PERSIS kayak tampilan Detail
//   Pengeluaran (pakai kelompokkanItem() yang sama dari lib/pengeluaran.js).
// - Bagian atas kiri: nilai kategori, judul, & penyelenggara LANGSUNG
//   (tanpa label "Kategori"/"Penyelenggara").
function NotaPaper({ profile, data, items }) {
  const info = infoKategoriTersimpan(data.kategori)
  return (
    <div className="invoice-paper nota-paper">
      <div className="inv-header">
        <div>
          <div className="inv-studio">{profile?.studio_name || 'Studio Saya'}</div>
          {profile?.whatsapp && <div className="inv-studio-meta"><IconWA />{profile.whatsapp}</div>}
          {profile?.instagram && <div className="inv-studio-meta"><IconIG />{profile.instagram}</div>}
        </div>
        <div className="inv-title-block">
          <div className="inv-title">NOTA</div>
          <div className="inv-kode">PENGELUARAN BISNIS</div>
        </div>
      </div>

      <div className="inv-divider"></div>

      <div className="inv-grid">
        <div>
          <div className="inv-name">{data.kategori}</div>
          {data.judul && <div className="inv-sub-event">{data.judul}</div>}
          {data.penyelenggara && <div className="inv-sub-event">{data.penyelenggara}</div>}
        </div>
        <div>
          <div className="inv-label">Tanggal</div>
          <div className="inv-sub-date">{formatTanggal(data.tanggal)}</div>
          {/* Lokasi/Tempat -- konsepnya SAMA kayak Tanggal di atasnya:
              label (judul kecil) di baris sendiri, nilainya di bawah. Label
              ngikut kategori (labelTempat: "Lokasi" / "Tempat/Toko"). */}
          {data.tempat && (
            <>
              <div className="inv-label nota-label-lanjutan">{info?.labelTempat || LABEL_TEMPAT_DEFAULT}</div>
              <div className="inv-sub-date">{data.tempat}</div>
            </>
          )}
        </div>
      </div>

      <table className="inv-table nota-table">
        <thead>
          <tr>
            <th>Item</th>
            <th className="right">Jumlah</th>
            <th className="right">Harga Satuan</th>
            <th className="right">Subtotal</th>
          </tr>
        </thead>
        <tbody>
          {kelompokkanItem(items).map((g, gi) => (
            g.baris.length === 1 ? (
              <tr key={gi}>
                <td>{g.nama}{g.baris[0].tambahan ? ` | ${g.baris[0].tambahan}` : ''}</td>
                <td className="right">{g.baris[0].jumlah}</td>
                <td className="right">{formatRupiah(g.baris[0].harga)}</td>
                <td className="right">{formatRupiah(g.baris[0].subtotal)}</td>
              </tr>
            ) : (
              // Grup: baris judul (nama item) + baris anak (↳). Garis
              // pemisah cuma di bawah anak TERAKHIR (lihat NotaPengeluaranModal.css).
              [
                <tr key={`${gi}-judul`} className="nota-grup-judul">
                  <td colSpan={4}>{g.nama}</td>
                </tr>,
                ...g.baris.map((b, bi) => (
                  <tr key={`${gi}-${bi}`} className={`nota-grup-anak${bi === g.baris.length - 1 ? ' terakhir' : ''}`}>
                    <td>
                      <span className="nota-anak">
                        <span className="nota-panah">{bi === 0 && <IconPanahAnak />}</span>
                        <span>{b.tambahan || g.nama}</span>
                      </span>
                    </td>
                    <td className="right">{b.jumlah}</td>
                    <td className="right">{formatRupiah(b.harga)}</td>
                    <td className="right">{formatRupiah(b.subtotal)}</td>
                  </tr>
                )),
              ]
            )
          ))}
        </tbody>
      </table>

      <div className="inv-summary">
        <div className="inv-summary-row inv-summary-final"><span>Total Pengeluaran</span><b>{formatRupiah(data.total)}</b></div>
      </div>

      <div className="inv-note-row">
        <div className="inv-note">
          <div className="inv-label">Catatan</div>
          <div className="inv-sub" style={{ whiteSpace: 'pre-line' }}>{data.keterangan || '—'}</div>
        </div>
      </div>

      {/* Nama pembuat = nama akun (studio_name), SAMA kayak nama yang
          tampil di Sidebar. */}
      <div className="inv-footer">Catatan pengeluaran bisnis — dibuat oleh {profile?.studio_name || 'Dapur MUA'}</div>
    </div>
  )
}

// `data` = 1 baris dari VIEW pengeluaran_summary, `items` = item-item-nya
// (udah di-fetch sama PengeluaranDetailModal, nggak di-fetch ulang di sini).
export default function NotaPengeluaranModal({ data, items, onClose }) {
  const { profile } = useAuth()
  const printPaperRef = useRef(null)
  const [exportOpen, setExportOpen] = useState(false)
  const [exporting, setExporting] = useState(false)
  const exportMenuRef = useRef(null)

  useEffect(() => {
    function handleClickOutside(e) {
      if (exportMenuRef.current && !exportMenuRef.current.contains(e.target)) setExportOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Nama file: Nota-Pengeluaran-<tanggal>-<judul/kategori>, karakter yang
  // nggak aman buat nama file (/ \ : * ? " < > |) diganti strip.
  const namaFile = `Nota-Pengeluaran-${data.tanggal}-${data.judul || data.kategori}`.replace(/[\\/:*?"<>|]+/g, '-')

  function handlePrint() {
    setExportOpen(false)
    window.print()
  }

  // Mekanisme capture SAMA PERSIS kayak RemittanceAdviceModal.jsx /
  // captureInvoiceCanvas di InvoiceModal.jsx (lihat komentar di situ).
  async function captureCanvas() {
    const node = printPaperRef.current
    if (!node) return null
    const { default: html2canvas } = await import('html2canvas')
    if (document.fonts?.ready) await document.fonts.ready
    const prevStyle = { display: node.style.display, position: node.style.position, left: node.style.left, top: node.style.top }
    node.style.display = 'block'
    node.style.position = 'fixed'
    node.style.left = '-99999px'
    node.style.top = '0'
    try {
      return await html2canvas(node, { scale: 2, backgroundColor: '#ffffff', useCORS: true })
    } finally {
      node.style.display = prevStyle.display
      node.style.position = prevStyle.position
      node.style.left = prevStyle.left
      node.style.top = prevStyle.top
    }
  }

  async function handleDownloadPNG() {
    setExportOpen(false)
    setExporting(true)
    try {
      const canvas = await captureCanvas()
      if (!canvas) return
      const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'))
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.download = `${namaFile}.png`
      link.href = url
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      setTimeout(() => URL.revokeObjectURL(url), 3000)
    } finally {
      setExporting(false)
    }
  }

  async function handleDownloadPDF() {
    setExportOpen(false)
    setExporting(true)
    try {
      const [canvas, { default: jsPDF }] = await Promise.all([captureCanvas(), import('jspdf')])
      if (!canvas) return
      const imgData = canvas.toDataURL('image/png')
      const pdf = new jsPDF({ unit: 'mm', format: 'a4' })
      const pageWidth = pdf.internal.pageSize.getWidth()
      const imgHeight = (canvas.height * pageWidth) / canvas.width
      pdf.addImage(imgData, 'PNG', 0, 0, pageWidth, imgHeight)
      pdf.save(`${namaFile}.pdf`)
    } finally {
      setExporting(false)
    }
  }

  return (
    <>
      <div className="modal-overlay invoice-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
        <div className="modal invoice-modal">
          <div className="modal-head invoice-no-print">
            <h2>Nota</h2>
            <button className="modal-close" onClick={onClose} type="button" aria-label="Tutup"><IconClose /></button>
          </div>

          <div className="modal-body">
            <NotaPaper profile={profile} data={data} items={items} />
          </div>

          <div className="modal-foot invoice-no-print">
            <button className="btn-ghost" onClick={onClose}>Tutup</button>
            <div className="inv-export" ref={exportMenuRef}>
              <button className="btn-ghost" onClick={() => setExportOpen((v) => !v)} type="button" disabled={exporting}>
                {exporting ? 'Memproses...' : 'Cetak / Unduh'} <span className="inv-export-caret">▾</span>
              </button>
              {exportOpen && (
                <div className="inv-export-menu">
                  <button type="button" onClick={handlePrint}>Cetak</button>
                  <button type="button" onClick={handleDownloadPDF}>Unduh PDF</button>
                  <button type="button" onClick={handleDownloadPNG}>Unduh PNG</button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {createPortal(
        <div className="invoice-print-portal" ref={printPaperRef}>
          <NotaPaper profile={profile} data={data} items={items} />
        </div>,
        document.body
      )}
    </>
  )
}
