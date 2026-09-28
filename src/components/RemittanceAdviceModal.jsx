import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useAuth } from '../context/AuthContext'
import CustomDatePicker from './CustomDatePicker'
import CustomSelect from './CustomSelect'
// SENGAJA numpang InvoiceModal.css, BUKAN bikin file CSS baru -- semua
// class yang dipake di sini (invoice-overlay, invoice-modal, inv-header,
// inv-title, inv-grid, inv-table, inv-summary, dst) itu udah didefinisiin
// lengkap di situ, TERMASUK mekanisme @media print (yang nyembunyiin
// SELURUH #root pas nyetak, cuma nyisain .invoice-print-portal yang
// keliatan). Pola reuse-class-lintas-file kayak gini udah lazim di
// project ini (.form-divider, .app-shell, .bar-fill, dll). Kalau
// InvoiceModal.jsx suatu saat dihapus dari app, import ini masih tetep
// jalan (CSS global, bukan scoped), tapi worth diinget dependensinya.
import './InvoiceModal.css'
import './RemittanceAdviceModal.css'

function formatRupiah(n) {
  return 'Rp' + (Number(n) || 0).toLocaleString('id-ID')
}
function formatTanggal(dateStr) {
  if (!dateStr) return '-'
  return new Date(dateStr).toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' })
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

const METODE_OPTIONS = ['Transfer Bank', 'E-wallet', 'QRIS', 'Cash']

// Lembar Remittance Advice-nya sendiri -- "kembaran" InvoicePaper di
// InvoiceModal.jsx, dipake 2x (preview di dalam modal + versi cetak
// yang di-portal), pola & alasannya SAMA PERSIS kayak di situ.
//
// BEDA dari Invoice:
// - Judulnya "REMITTANCE ADVICE", subjudulnya teks statis "PEMBERITAHUAN
//   PEMBAYARAN" (bukan kode booking ATAU tanggal lagi -- tanggal & metode
//   pembayaran sekarang ditaruh di BAWAH kotak Total Dibayar, lihat 2
//   baris inv-summary-row paling akhir).
// - "Kepada" (bukan "Ditagihkan kepada") -- nama Tim/Vendor, BUKAN klien.
//   Sengaja NGGAK ada nomor kontak (Tim/Vendor emang nggak nyimpen nomor
//   WA, sesuai keputusan -- ini dokumen buat dikirim manual).
// - Tabel Jasa/Produk + Jumlah + Dibayar -- "Dibayar" itu nominal yang
//   BENERAN diterima Tim/Vendor (biaya dikurangi komisi/untung MUA),
//   BUKAN biaya penuh yang ditagih ke klien.
// - Ringkasan "Total Dibayar" (masih space-between kayak Invoice) +
//   Tanggal & Metode Pembayaran (tanggalKirim/metodePembayaran, dari
//   state di komponen induk, DIPILIH user -- bukan otomatis dari data
//   booking manapun, soalnya nggak ada kolom itu yang kesimpen di DB)
//   -- BEDA formatnya, teks polos "Label: Nilai" nempel, BUKAN
//   space-between -- nggak ada status Sudah/Sisa Dibayar (dokumen ini
//   nggak punya status, murni bukti).
function RemittanceAdvicePaper({ profile, booking, payee, tanggalKirim, metodePembayaran }) {
  return (
    <div className="invoice-paper ra-paper">
      <div className="inv-header">
        <div>
          <div className="inv-studio">{profile?.studio_name || 'Studio Saya'}</div>
          {profile?.whatsapp && (
            <div className="inv-studio-meta"><IconWA />{profile.whatsapp}</div>
          )}
          {profile?.instagram && (
            <div className="inv-studio-meta"><IconIG />{profile.instagram}</div>
          )}
        </div>
        <div className="inv-title-block">
          <div className="inv-title">REMITTANCE ADVICE</div>
          <div className="inv-kode">PEMBERITAHUAN PEMBAYARAN</div>
        </div>
      </div>

      <div className="inv-divider"></div>

      <div className="inv-grid">
        <div>
          <div className="inv-label">Kepada</div>
          <div className="inv-name">{payee.display}</div>
        </div>
        <div>
          <div className="inv-label">Detail Acara</div>
          <div className="inv-sub-event">{booking.event}</div>
          <div className="inv-sub-date">{formatTanggal(booking.tanggal_acara)}</div>
          {booking.lokasi && <div className="inv-sub-loc">{booking.lokasi}</div>}
        </div>
      </div>

      <table className="inv-table">
        <thead>
          <tr>
            <th>Jasa/Produk</th>
            <th className="right">Jumlah</th>
            <th className="right">Dibayar</th>
          </tr>
        </thead>
        <tbody>
          {payee.items.map((it, idx) => (
            <tr key={idx}>
              <td>{it.jasa}</td>
              <td className="right">{it.jumlah}</td>
              <td className="right">{formatRupiah(it.dibayar)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="inv-summary">
        <div className="inv-summary-row inv-summary-final"><span>Total Dibayar</span><b>{formatRupiah(payee.total)}</b></div>
      </div>

      {/* Tanggal & Metode Pembayaran -- SENGAJA bukan .inv-summary-row
          (space-between kayak Total Dibayar di atas), tapi teks polos
          nempel "Label: Nilai" biasa, sesuai keputusan. Ukuran font
          (13px), warna, & bold-nya nilai SENGAJA inline di sini (bukan
          nambah rule baru di InvoiceModal.css) -- biar khusus tampilan
          Remittance Advice doang, nggak ikut ngubah Invoice yang
          numpang file CSS yang sama. */}
      {/* Tanggal & Metode Pembayaran -- SENGAJA bukan .inv-summary-row
          (space-between kayak Total Dibayar di atas), tapi teks polos
          nempel "Label: Nilai" biasa. Class ra-payment-line/-value ada
          di RemittanceAdviceModal.css (BUKAN InvoiceModal.css) --
          warnanya beda antara versi layar (ngikut tema app) vs versi
          cetak (fiks, biar kebaca di kertas putih apapun temanya, lihat
          komentar di file CSS itu). */}
      <div className="inv-sub ra-payment-line" style={{ marginTop: 12 }}>Tanggal Pembayaran: <b className="ra-payment-value">{formatTanggal(tanggalKirim)}</b></div>
      <div className="inv-sub ra-payment-line">Metode Pembayaran: <b className="ra-payment-value">{metodePembayaran}</b></div>

      <div className="inv-footer">Terima kasih atas kerja sama Anda.</div>
    </div>
  )
}

// `payee` -- 1 pihak (Tim/Vendor) yang UDAH DIGABUNG dari RincianKeuanganModal
// (lihat groupPengeluaranByPayee di situ): { key, display, items: [{jasa,
// jumlah, dibayar}], total }.
export default function RemittanceAdviceModal({ booking, payee, onClose }) {
  const { profile } = useAuth()

  // Tanggal uang dikirim -- SENGAJA nggak diambil dari data manapun
  // (nggak ada kolom itu di DB, sesuai keputusan dokumen ini nggak
  // punya status/persist apapun). Defaultnya HARI INI, user bisa geser
  // manual kalau transfernya beda hari sama pas dia nge-generate
  // dokumen ini.
  const [tanggalKirim, setTanggalKirim] = useState(() => new Date().toISOString().slice(0, 10))
  // Metode Pembayaran -- sama kayak Tanggal, murni buat TAMPILAN di
  // dokumen ini doang, nggak kesimpen ke DB. Default ke pilihan
  // pertama ("Transfer Bank") biar dokumennya nggak pernah kosong.
  const [metodePembayaran, setMetodePembayaran] = useState(METODE_OPTIONS[0])

  const printPaperRef = useRef(null)
  const [exportOpen, setExportOpen] = useState(false)
  const [exporting, setExporting] = useState(false)
  const exportMenuRef = useRef(null)

  useEffect(() => {
    function handleClickOutside(e) {
      if (exportMenuRef.current && !exportMenuRef.current.contains(e.target)) {
        setExportOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  function handlePrint() {
    setExportOpen(false)
    window.print()
  }

  // Sama persis mekanismenya kayak captureInvoiceCanvas di InvoiceModal.jsx
  // -- lihat komentar di situ buat penjelasan lengkap kenapa html2canvas/
  // jsPDF di-import dinamis, kenapa node digeser ke luar layar sementara,
  // dst. Nggak diulang di sini biar nggak dobel, logikanya identik.
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
      const canvas = await html2canvas(node, { scale: 2, backgroundColor: '#ffffff', useCORS: true })
      return canvas
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
      link.download = `RemittanceAdvice-${payee.display}-${booking.kode_booking || 'DapurMUA'}.png`
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
      pdf.save(`RemittanceAdvice-${payee.display}-${booking.kode_booking || 'DapurMUA'}.pdf`)
    } finally {
      setExporting(false)
    }
  }

  return (
    <>
      <div className="modal-overlay invoice-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
        <div className="modal invoice-modal">
          <div className="modal-head invoice-no-print">
            <h2>Remittance Advice</h2>
            <button className="modal-close" onClick={onClose} type="button">&times;</button>
          </div>

          <div className="modal-body">
            {/* Kontrol tanggal -- SENGAJA di LUAR .invoice-paper (bukan
                bagian dari lembar yang di-capture/print), biar bisa
                dipakai sebagai <input> interaktif tanpa bikin ribet pas
                capture PNG/PDF. Nilainya cuma "dititipin" ke lembar
                preview di bawah sebagai teks statis. */}
            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
              <div style={{ maxWidth: 220 }}>
                <div className="inv-label" style={{ marginBottom: 6 }}>Pilih Tanggal Pembayaran</div>
                <CustomDatePicker value={tanggalKirim} onChange={setTanggalKirim} variant="modal" />
              </div>
              <div style={{ maxWidth: 220 }}>
                <div className="inv-label" style={{ marginBottom: 6 }}>Pilih Metode Pembayaran</div>
                <CustomSelect options={METODE_OPTIONS} value={metodePembayaran} onChange={setMetodePembayaran} variant="modal" />
              </div>
            </div>
            <div className="inv-sub-note" style={{ marginTop: 8 }}>*digunakan untuk mengisi data Remittance Advice</div>

            <div className="inv-divider"></div>

            <RemittanceAdvicePaper profile={profile} booking={booking} payee={payee} tanggalKirim={tanggalKirim} metodePembayaran={metodePembayaran} />
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
          <RemittanceAdvicePaper profile={profile} booking={booking} payee={payee} tanggalKirim={tanggalKirim} metodePembayaran={metodePembayaran} />
        </div>,
        document.body
      )}
    </>
  )
}
