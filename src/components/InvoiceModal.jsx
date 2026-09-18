import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useAuth } from '../context/AuthContext'
import './InvoiceModal.css'

function formatRupiah(n) {
  return 'Rp' + (Number(n) || 0).toLocaleString('id-ID')
}
function formatTanggal(dateStr) {
  if (!dateStr) return '-'
  return new Date(dateStr).toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' })
}

// Konten lembar invoice-nya sendiri, dipisah jadi komponen sendiri biar
// bisa dipakai 2x: (1) buat preview di dalam modal seperti biasa, dan
// (2) buat versi cetak yang di-portal langsung ke document.body (lihat
// InvoiceModal di bawah) -- biar pas print, konten ini BENERAN berdiri
// sendiri, nggak numpang di dalam DOM tree modal/sidebar/halaman lain
// yang bisa nyisain tinggi kosong pas dicetak.
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

// `variant` bedain 2 mode render: 'screen' (default, tampilan di dalam
// modal/app -- TETEP presis kayak sebelumnya, teks "WA:"/"IG:" polos)
// vs 'print' (khusus di dalam .invoice-print-portal -- pake ikon,
// bukan cuma soal warna/ukuran CSS doang). Sengaja dibedain di sini
// (bukan di CSS) soalnya beda ikon vs teks itu beda STRUKTUR markup,
// bukan cuma beda style.
function InvoicePaper({ profile, booking, peserta, payments, totalDibayar, sisa }) {
  return (
    <div className="invoice-paper">
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
          <div className="inv-title">INVOICE</div>
          <div className="inv-kode">{booking.kode_booking}</div>
        </div>
      </div>

      <div className="inv-divider"></div>

      <div className="inv-grid">
        <div>
          <div className="inv-label">Ditagihkan kepada</div>
          <div className="inv-name">{booking.nama_klien}</div>
          {booking.nomor_whatsapp && <div className="inv-sub">{booking.nomor_whatsapp}</div>}
        </div>
        <div>
          <div className="inv-label">Detail Acara</div>
          <div className="inv-sub-event">{booking.event}</div>
          <div className="inv-sub-date">{formatTanggal(booking.tanggal_acara)}{booking.jam_start_makeup ? ` · ${booking.jam_start_makeup.slice(0, 5)} WIB` : ''}</div>
          {booking.lokasi && <div className="inv-sub-loc">{booking.lokasi}</div>}
        </div>
      </div>

      <table className="inv-table">
        <thead>
          <tr>
            <th>Peserta</th>
            <th>Layanan</th>
            <th className="right">Biaya</th>
          </tr>
        </thead>
        <tbody>
          {peserta.flatMap((p) => {
            const rows = [
              <tr key={p.id + '-mkp'}>
                <td>{p.nama_anggota}{p.peran ? ` (${p.peran})` : ''}</td>
                <td>Makeup {p.jenis_paket || p.kategori_makeup}</td>
                <td className="right">{formatRupiah(p.biaya_makeup)}</td>
              </tr>,
            ]
            if (p.layanan_tambahan !== 'Tidak Ada') {
              rows.push(
                <tr key={p.id + '-tmb'}>
                  <td></td>
                  <td>{p.layanan_tambahan}</td>
                  <td className="right">{formatRupiah(p.biaya_tambahan)}</td>
                </tr>
              )
            }
            if (p.layanan_lainnya) {
              rows.push(
                <tr key={p.id + '-lain'}>
                  <td></td>
                  <td>{p.layanan_lainnya}</td>
                  <td className="right">{formatRupiah(p.biaya_lainnya)}</td>
                </tr>
              )
            }
            for (let n = 2; n <= 5; n++) {
              const nama = p[`layanan_lainnya_${n}`]
              if (nama) {
                rows.push(
                  <tr key={p.id + '-lain' + n}>
                    <td></td>
                    <td>{nama}</td>
                    <td className="right">{formatRupiah(p[`biaya_lainnya_${n}`])}</td>
                  </tr>
                )
              }
            }
            return rows
          })}
          {Number(booking.biaya_transport) > 0 && (
            <tr>
              <td></td>
              <td>Transport</td>
              <td className="right">{formatRupiah(booking.biaya_transport)}</td>
            </tr>
          )}
        </tbody>
      </table>

      <div className="inv-summary">
        <div className="inv-summary-row"><span>Total Tagihan</span><b>{formatRupiah(booking.belanja_klien)}</b></div>
        <div className="inv-summary-row"><span>Sudah Dibayar</span><b>{formatRupiah(totalDibayar)}</b></div>
        <div className="inv-summary-row inv-summary-final"><span>Sisa Tagihan</span><b>{formatRupiah(sisa)}</b></div>
      </div>

      {payments.length > 0 && (
        <>
          <div className="inv-label" style={{ marginTop: 20, marginBottom: 8 }}>Riwayat Pembayaran</div>
          {payments.map((p) => (
            <div className="inv-pay-row" key={p.id}>
              <span>{formatTanggal(p.tanggal)}</span>
              <span>{p.metode}</span>
              <span>{formatRupiah(p.jumlah)}</span>
            </div>
          ))}
        </>
      )}

      <div className="inv-note">
        <div className="inv-label">Catatan</div>
        <div className="inv-sub" style={{ whiteSpace: 'pre-line' }}>{booking.catatan || '—'}</div>
      </div>

      <div className="inv-footer">Terima kasih atas kepercayaan Anda karena telah menggunakan jasa kami.</div>
    </div>
  )
}

export default function InvoiceModal({ booking, peserta, payments, onClose }) {
  const { profile } = useAuth()

  const totalDibayar = payments.reduce((s, p) => s + Number(p.jumlah), 0)
  const sisa = (booking.belanja_klien || 0) - totalDibayar

  const printPaperRef = useRef(null)
  const [exportOpen, setExportOpen] = useState(false)
  const [exporting, setExporting] = useState(false)
  const exportMenuRef = useRef(null)

  // Nutup dropdown kalau user klik di luar area-nya.
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

  // "Nangkep" versi CETAK (.invoice-print-portal, yang udah branded --
  // logo warna, ikon WA/IG) jadi canvas gambar, dipakai bareng buat PNG
  // maupun PDF (PDF cuma nge-bungkus gambar yang sama ke dalam 1 halaman
  // A4). Elemen sumbernya (printPaperRef) NORMALNYA display:none di
  // layar (cuma nongol pas @media print) -- html2canvas nggak bisa
  // nangkep elemen yang display:none (dianggap nggak render, tinggi 0).
  // Makanya sementara dipaksa "nyala" tapi digeser jauh ke luar layar
  // (position:fixed, left:-99999px) SEBELUM di-capture, abis itu
  // langsung dibalikin kayak semula -- user nggak pernah lihat kedipan
  // apapun, prosesnya instan & invisible buat mata.
  //
  // `html2canvas` di-import DINAMIS (bukan di paling atas file) --
  // library ini + jsPDF lumayan berat (~600KB gzip gabungan), dan cuma
  // kepake kalau user BENERAN klik Unduh PDF/PNG. Kalau di-import statis
  // di atas, semua orang yang buka app bakal ikut download 600KB itu di
  // awal (bahkan yang nggak pernah export invoice), dan sempet bikin
  // build gagal soalnya lewat batas ukuran precache PWA (2MB). Dynamic
  // import bikin Vite motong ini jadi chunk terpisah, baru di-fetch
  // browser pas fungsi ini beneran dipanggil.
  async function captureInvoiceCanvas() {
    const node = printPaperRef.current
    if (!node) return null
    const { default: html2canvas } = await import('html2canvas')
    // Nunggu web font (Poppins/Plus Jakarta Sans) BENERAN kemuat dulu
    // sebelum capture -- kalau nggak, html2canvas bisa keburu nge-capture
    // pas browser masih numpang font fallback sementara (ukuran/lebar
    // huruf beda), bikin komposisi/jarak teks keliatan "geser" dikit
    // dari versi cetak beneran (yang nunggu font selesai kemuat dulu
    // sebelum browser ngerender halaman print).
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
      const canvas = await captureInvoiceCanvas()
      if (!canvas) return
      // SENGAJA pake Blob + URL.createObjectURL, BUKAN canvas.toDataURL()
      // ditempel langsung ke href kayak sebelumnya. toDataURL() ngehasilin
      // teks base64 yang bisa beberapa MB panjangnya buat gambar resolusi
      // tinggi kayak ini -- beberapa browser HP kadang "nyerah diam-diam"
      // (nggak error, cuma nggak jalan) kalau ukurannya udah gede & dipicu
      // berkali-kali dalam 1 sesi. Blob URL jauh lebih ringan & reliable
      // buat kasus ini.
      const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'))
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.download = `Invoice-${booking.kode_booking || 'DapurMUA'}.png`
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
      const [canvas, { default: jsPDF }] = await Promise.all([captureInvoiceCanvas(), import('jspdf')])
      if (!canvas) return
      const imgData = canvas.toDataURL('image/png')
      const pdf = new jsPDF({ unit: 'mm', format: 'a4' })
      const pageWidth = pdf.internal.pageSize.getWidth()
      const imgHeight = (canvas.height * pageWidth) / canvas.width
      pdf.addImage(imgData, 'PNG', 0, 0, pageWidth, imgHeight)
      pdf.save(`Invoice-${booking.kode_booking || 'DapurMUA'}.pdf`)
    } finally {
      setExporting(false)
    }
  }

  function handleWhatsApp() {
  const nomor = (booking.nomor_whatsapp || '').replace(/[^0-9]/g, '').replace(/^0/, '62')
  const namaStudio = profile?.studio_name || 'Studio Saya'
  const pesan = `Halo, Kak!\n\nBerikut kami kirimkan ringkasan invoice makeup untuk *Kak ${booking.nama_klien}*.\n\n*Kode Booking*: ${booking.kode_booking}\n*Tanggal Makeup*: ${formatTanggal(booking.tanggal_acara)}\n*Event*: ${booking.event}\n\n*Total Biaya*: ${formatRupiah(booking.belanja_klien)}\n\n*Sudah Dibayar*: ${formatRupiah(totalDibayar)}\n*Kekurangan*: ${formatRupiah(sisa)}\n\nTerima kasih!\n\nSalam hangat,\n*${namaStudio}*.`
  const pesanEncoded = encodeURIComponent(pesan)
  const waUrl = `https://wa.me/${nomor}?text=${pesanEncoded}`

  // Link wa.me biasa itu "universal" -- OS yang mutusin app mana yang
  // kebuka kalau WhatsApp reguler & Business dua-duanya keinstall.
  // Di iPhone, iOS otomatis nawarin pilihan "Message" vs "Open in
  // WhatsApp Business" duluan, jadi link biasa aja udah cukup di sana.
  // Di Android, TIDAK ada pilihan itu -- langsung ke WhatsApp reguler.
  // Satu-satunya cara maksa app spesifik di Android: Intent URI yang
  // nunjuk LANGSUNG ke package WhatsApp Business (com.whatsapp.w4b).
  // `S.browser_fallback_url` jaga-jaga andaikan WhatsApp Business
  // TERNYATA nggak keinstall di HP klien yang buka link ini -- otomatis
  // balik ke link wa.me biasa, bukan macet/dead-end.
  const isAndroid = /Android/i.test(navigator.userAgent)

  if (isAndroid) {
    const intentUrl = `intent://wa.me/${nomor}?text=${pesanEncoded}#Intent;scheme=https;package=com.whatsapp.w4b;S.browser_fallback_url=${encodeURIComponent(waUrl)};end`
    window.location.href = intentUrl
  } else {
    window.open(waUrl, '_blank')
  }
}

  return (
    <>
      <div className="modal-overlay invoice-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
        <div className="modal invoice-modal">
          <div className="modal-head invoice-no-print">
            <h2>Invoice</h2>
            <button className="modal-close" onClick={onClose} type="button">&times;</button>
          </div>

          <div className="modal-body">
            <InvoicePaper profile={profile} booking={booking} peserta={peserta} payments={payments} totalDibayar={totalDibayar} sisa={sisa} />
          </div>

          <div className="modal-foot invoice-no-print">
            <button className="btn-ghost" onClick={onClose}>Tutup</button>
            <button className="btn-ghost" onClick={handleWhatsApp} type="button">Kirim ke WhatsApp</button>
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

      {/* Portal ke document.body -- SENGAJA di luar #root sepenuhnya.
          Pas @media print aktif, #root langsung di-display:none-in TOTAL
          (lihat InvoiceModal.css), jadi satu-satunya yang dicetak cuma
          elemen ini. Nggak ada lagi elemen lain (sidebar, tabel halaman
          di belakang modal, BookingDetailModal, dll) yang nyisain tinggi
          kosong pas print -- itu penyebab kenapa dulu bisa keluar >4
          halaman kosong & beda-beda tergantung halaman/HP asal invoice
          ini dibuka. `printPaperRef` nempel di elemen yang sama ini --
          dipakai ulang buat capture PNG/PDF (lihat captureInvoiceCanvas
          di atas), biar 3-3nya (cetak fisik, PDF, PNG) selalu ngehasilin
          tampilan branded yang identik. */}
      {createPortal(
        <div className="invoice-print-portal" ref={printPaperRef}>
          <InvoicePaper profile={profile} booking={booking} peserta={peserta} payments={payments} totalDibayar={totalDibayar} sisa={sisa} />
        </div>,
        document.body
      )}
    </>
  )
}
