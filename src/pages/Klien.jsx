import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import ExcelJS from 'exceljs'
import Sidebar from '../components/Sidebar'
import BookingDetailModal from '../components/BookingDetailModal'
import CustomSelect from '../components/CustomSelect'
import './Klien.css'

function formatRupiah(n) {
  return 'Rp' + (Number(n) || 0).toLocaleString('id-ID')
}
// Ambil ANGKA di ekor kode_booking doang (misal "MBS-0007" -> 7),
// bukan asal banding teks -- biar tetep bener walau prefix-nya beda-beda
// atau kosong (kayak kejadian bug "-0060" kemarin). Kode tanpa angka
// sama sekali (atau kosong) dilempar ke paling belakang (Infinity).
function kodeBookingNum(kode) {
  const match = String(kode || '').match(/(\d+)\s*$/)
  return match ? parseInt(match[1], 10) : Infinity
}
function formatTanggal(dateStr) {
  if (!dateStr) return '-'
  return new Date(dateStr).toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' })
}
function initialsOf(name) {
  return (name || '?').split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase()
}

// Nama studio dipakai buat awalan nama file export -- spasi dibuang total
// (misal "Dapur MUA" jadi "DapurMUA"), biar nama filenya bersih & valid.
function studioFilePrefix(name) {
  return (name || 'DapurMUA').replace(/\s+/g, '')
}

// Sama persis rumus "Selesai" yang udah dipakai di Dashboard & BookingList --
// booking dianggap Selesai kalau tanggalnya udah lewat, atau kalau hari ini
// tapi udah lebih dari 3 jam dari jam mulai makeup.
function isBookingSelesai(tanggalAcara, jamStartMakeup) {
  if (!tanggalAcara) return false
  const now = new Date()
  const todayStr = now.toISOString().slice(0, 10)
  if (tanggalAcara < todayStr) return true
  if (tanggalAcara > todayStr) return false
  if (!jamStartMakeup) return false
  const [h, m] = jamStartMakeup.slice(0, 5).split(':').map(Number)
  const start = new Date(now)
  start.setHours(h, m, 0, 0)
  const cutoff = new Date(start.getTime() + 3 * 60 * 60 * 1000)
  return now >= cutoff
}

const PAGE_SIZE = 10

export default function Klien() {
  const { profile } = useAuth()
  const [bookings, setBookings] = useState([])
  const [klienRows, setKlienRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('Semua Status') // Semua Status | Selesai | Akan Datang
  const [sortBy, setSortBy] = useState('Terbaru') // Terbaru | Nama A-Z | Total Belanja
  const [page, setPage] = useState(1)
  const [selectedClient, setSelectedClient] = useState(null)
  const [selectedBooking, setSelectedBooking] = useState(null)

  async function loadData() {
    setLoading(true)
    setError('')
    const [bookingRes, klienRes, klienIdRes] = await Promise.all([
      supabase.from('booking_summary').select('*').order('tanggal_acara', { ascending: false }),
      supabase.from('klien').select('id, nama, nomor_whatsapp, created_at'),
      // `booking_summary` (VIEW) ternyata nggak nyertain kolom `klien_id` di
      // definisinya -- jadi diambil terpisah langsung dari tabel `bookings`
      // asli, terus "ditempel" manual ke data booking_summary di bawah.
      supabase.from('bookings').select('id, klien_id'),
    ])
    if (bookingRes.error) setError(bookingRes.error.message)
    else if (klienRes.error) setError(klienRes.error.message)
    else if (klienIdRes.error) setError(klienIdRes.error.message)
    else {
      const klienIdMap = new Map((klienIdRes.data || []).map((r) => [r.id, r.klien_id]))
      const mergedBookings = (bookingRes.data || []).map((b) => ({ ...b, klien_id: klienIdMap.get(b.id) }))
      setBookings(mergedBookings)
      setKlienRows(klienRes.data || [])
    }
    setLoading(false)
  }
  useEffect(() => { loadData() }, [])

  // Kelompokkan booking berdasarkan klien_id (ID unik asli dari tabel klien)
  // -- bukan lagi nebak dari kesamaan nama. Jadi 2 klien beda orang yang
  // kebetulan namanya sama (nomor WA beda) bakal tetap muncul sebagai
  // 2 kartu terpisah.
  const clients = useMemo(() => {
    const map = new Map()
    klienRows.forEach((k) => {
      map.set(String(k.id).trim().toLowerCase(), {
        id: k.id,
        nama: k.nama,
        whatsapp: k.nomor_whatsapp,
        createdAt: k.created_at,
        bookingList: [],
        totalBelanja: 0,
        totalSisa: 0,
        lastTanggal: null,
      })
    })

    // Fallback buat booking lama yang belum ke-link klien_id-nya (mestinya
    // sudah dibackfill lewat migrasi, tapi dijaga di sini biar nggak ada
    // booking yang "hilang" dari halaman ini kalau ada yang kelewat).
    let fallbackKlienCounter = 0
    const fallbackMap = new Map()

    bookings.forEach((b) => {
      let clientKey = b.klien_id ? String(b.klien_id).trim().toLowerCase() : null
      if (!clientKey || !map.has(clientKey)) {
        const nameKey = (b.nama_klien || '').trim().toLowerCase()
        if (!nameKey) return
        if (!fallbackMap.has(nameKey)) {
          fallbackKlienCounter += 1
          fallbackMap.set(nameKey, `fallback-${fallbackKlienCounter}`)
          map.set(fallbackMap.get(nameKey), {
            id: fallbackMap.get(nameKey),
            nama: b.nama_klien,
            whatsapp: b.nomor_whatsapp,
            createdAt: null,
            bookingList: [],
            totalBelanja: 0,
            totalSisa: 0,
            lastTanggal: null,
          })
        }
        clientKey = fallbackMap.get(nameKey)
      }

      const c = map.get(clientKey)
      c.bookingList.push(b)
      c.totalBelanja += Number(b.belanja_klien) || 0
      c.totalSisa += Number(b.sisa_kekurangan) || 0
      if (!c.lastTanggal || new Date(b.tanggal_acara) > new Date(c.lastTanggal)) c.lastTanggal = b.tanggal_acara
    })

    return Array.from(map.values())
      .filter((c) => c.bookingList.length > 0)
      .map((c) => {
        const selesaiCount = c.bookingList.filter((b) => isBookingSelesai(b.tanggal_acara, b.jam_start_makeup)).length
        const totalCount = c.bookingList.length
        const latest = c.bookingList.reduce((a, b) => (new Date(b.tanggal_acara) > new Date(a.tanggal_acara) ? b : a))
        const latestSelesai = isBookingSelesai(latest.tanggal_acara, latest.jam_start_makeup)
        return {
          ...c,
          selesaiCount,
          totalCount,
          isFullySelesai: selesaiCount === totalCount,
          hasUpcoming: selesaiCount < totalCount,
          statusTerakhir: latestSelesai ? 'Selesai' : 'Akan Datang',
        }
      })
  }, [bookings, klienRows])

  // Ringkasan buat 4 kartu statistik di atas
  const summary = useMemo(() => ({
    totalKlien: clients.length,
    klienAktif: clients.filter((c) => c.hasUpcoming).length,
    klienSelesai: clients.filter((c) => c.isFullySelesai).length,
    totalBelanja: clients.reduce((s, c) => s + c.totalBelanja, 0),
  }), [clients])

  // Backup lengkap data Klien + Booking ke Excel -- SENGAJA pakai `clients`
  // (bukan `filtered`/`paged`), biar backup-nya nyertain SEMUA klien,
  // nggak kepotong sama pencarian/filter/halaman yang lagi aktif di layar.
  // 2 sheet terpisah: Ringkasan Klien (1 baris = 1 klien) & Detail Booking
  // (1 baris = 1 booking) -- soalnya 1 klien bisa punya banyak booking,
  // dua level data ini nggak bisa dipaksa jadi 1 baris tanpa ada yang
  // kepotong.
  async function handleExportExcel() {
    const wb = new ExcelJS.Workbook()

    const wsRingkasan = wb.addWorksheet('Ringkasan Klien')
    wsRingkasan.columns = [
      { header: 'ID Klien', key: 'id', width: 14 },
      { header: 'Nama Klien', key: 'nama', width: 24 },
      { header: 'Nomor WhatsApp', key: 'whatsapp', width: 18 },
      { header: 'Total Booking', key: 'totalCount', width: 14 },
      { header: 'Total Selesai', key: 'selesaiCount', width: 14 },
      { header: 'Total Pembayaran', key: 'totalBelanja', width: 16 },
    ]
    clients.forEach((c) => {
      wsRingkasan.addRow({
        id: c.id, nama: c.nama, whatsapp: c.whatsapp || '-',
        totalCount: c.totalCount, selesaiCount: c.selesaiCount, totalBelanja: c.totalBelanja,
      })
    })
    wsRingkasan.getColumn('totalBelanja').numFmt = '#,##0'

    const wsDetail = wb.addWorksheet('Detail Booking')
    wsDetail.columns = [
      { header: 'ID Klien', key: 'idKlien', width: 14 },
      { header: 'Nama Klien', key: 'nama', width: 24 },
      { header: 'Tanggal Acara', key: 'tanggal', width: 18 },
      { header: 'Event', key: 'event', width: 18 },
      { header: 'Lokasi', key: 'lokasi', width: 26 },
    ]
    clients.forEach((c) => {
      c.bookingList.forEach((b) => {
        wsDetail.addRow({
          idKlien: c.id, nama: c.nama, tanggal: formatTanggal(b.tanggal_acara),
          event: b.event || '-', lokasi: b.lokasi || '-',
        })
      })
    })

    // Style header -- sama persis konsepnya kayak export Keuangan, biar
    // konsisten satu tema. Diterapin ke kedua sheet.
    ;[wsRingkasan, wsDetail].forEach((ws) => {
      ws.getRow(1).eachCell((cell) => {
        cell.font = { bold: true, color: { argb: 'FFFFFFFF' } }
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4472C4' } }
        cell.alignment = { horizontal: 'center' }
      })
    })

    const buffer = await wb.xlsx.writeBuffer()
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${studioFilePrefix(profile?.studio_name)}_Rekap-Klien-dan-Booking.xlsx`
    a.click()
    URL.revokeObjectURL(url)
  }

  const filtered = useMemo(() => {
    let list = clients.filter((c) =>
      !search.trim() || c.nama?.toLowerCase().includes(search.trim().toLowerCase())
    )
    if (statusFilter === 'Selesai') list = list.filter((c) => c.statusTerakhir === 'Selesai')
    if (statusFilter === 'Akan Datang') list = list.filter((c) => c.statusTerakhir === 'Akan Datang')

    const sorted = [...list]
    if (sortBy === 'Nama A-Z') sorted.sort((a, b) => (a.nama || '').localeCompare(b.nama || ''))
    else if (sortBy === 'Total Pembayaran') sorted.sort((a, b) => b.totalBelanja - a.totalBelanja)
    else if (sortBy === 'Kode Booking') {
      const minKode = (c) => Math.min(...c.bookingList.map((b) => kodeBookingNum(b.kode_booking)))
      sorted.sort((a, b) => minKode(a) - minKode(b))
    }
    else sorted.sort((a, b) => new Date(b.lastTanggal) - new Date(a.lastTanggal))

    return sorted
  }, [clients, search, statusFilter, sortBy])

  // Reset ke halaman 1 tiap kali filter/pencarian/urutan berubah, biar nggak
  // nyangkut di halaman yang udah nggak ada datanya.
  useEffect(() => { setPage(1) }, [search, statusFilter, sortBy])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const pageSafe = Math.min(page, totalPages)
  const paged = filtered.slice((pageSafe - 1) * PAGE_SIZE, pageSafe * PAGE_SIZE)
  const rangeStart = filtered.length === 0 ? 0 : (pageSafe - 1) * PAGE_SIZE + 1
  const rangeEnd = Math.min(pageSafe * PAGE_SIZE, filtered.length)

  return (
    <div className="app-shell">
      <Sidebar />
      <div className="main">
        <div className="topbar">
          <div>
            <div className="greeting">Klien</div>
            <div className="greeting-date">Kelola semua data klien Anda</div>
          </div>
          <div className="topbar-actions">
            <button type="button" className="btn-booking-primary btn-export-desktop" onClick={handleExportExcel} disabled={clients.length === 0}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 3v12m0 0l-4-4m4 4l4-4M4 21h16" /></svg>
              Export Excel
            </button>
          </div>
        </div>

        {/* Versi mobile tombol Export Excel -- elemen TERPISAH, ditaruh
            di sini (di luar .topbar) biar di layar sempit jadi baris
            sendiri di bawah subjudul "Kelola semua data klien Anda",
            di atas KPI grid (Total Klien dkk). Disembunyiin di desktop
            lewat CSS (lihat .btn-export-mobile di Klien.css), munculnya
            gantian sama .btn-export-desktop di atas. */}
        <button type="button" className="btn-booking-primary btn-export-mobile" onClick={handleExportExcel} disabled={clients.length === 0}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 3v12m0 0l-4-4m4 4l4-4M4 21h16" /></svg>
          Export Excel
        </button>

        <div className="klien-stat-row">
          <div className="klien-stat-card-totalklien">
            <div className="klien-stat-top">
              <div className="klien-stat-label1">Total Klien</div>
              <div className="klien-stat-icon violet">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>
              </div>
            </div>
            <div className="klien-stat-num1">{summary.totalKlien}</div>
            <div className="klien-stat-sub1">Klien terdaftar</div>
          </div>
          <div className="klien-stat-card-klienaktif">
            <div className="klien-stat-top">
              <div className="klien-stat-label2">Klien Aktif</div>
              <div className="klien-stat-icon gold">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /></svg>
              </div>
            </div>
            <div className="klien-stat-num2">{summary.klienAktif}</div>
            <div className="klien-stat-sub2">Punya booking mendatang</div>
          </div>
          <div className="klien-stat-card-klienselesai">
            <div className="klien-stat-top">
              <div className="klien-stat-label3">Klien Selesai</div>
              <div className="klien-stat-icon mint">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><path d="M22 4L12 14.01l-3-3" /></svg>
              </div>
            </div>
            <div className="klien-stat-num3">{summary.klienSelesai}</div>
            <div className="klien-stat-sub3">Selesai semua booking</div>
          </div>
          <div className="klien-stat-card-totalbelanja">
            <div className="klien-stat-top">
              <div className="klien-stat-label4">Total Pembayaran</div>
              <div className="klien-stat-icon coral">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><path d="M12 6v12M15 9.5c0-1.38-1.34-2.5-3-2.5s-3 1.12-3 2.5 1.34 2.5 3 2.5 3 1.12 3 2.5-1.34 2.5-3 2.5-3-1.12-3-2.5" /></svg>
              </div>
            </div>
            <div className="klien-stat-num4">{formatRupiah(summary.totalBelanja)}</div>
            <div className="klien-stat-sub4">Dari semua klien</div>
          </div>
        </div>

        <div className="klien-toolbar">
          <div className="search-box-klien">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="7" /><path d="M21 21l-4.3-4.3" /></svg>
            <input type="text" placeholder="Cari nama klien ...." value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <div className="filter-select">
              <CustomSelect
                options={['Semua Status', 'Selesai', 'Akan Datang']}
                value={statusFilter}
                onChange={setStatusFilter}
              />
          </div>
          <div className="filter-select filter-select-sort">
              <CustomSelect
                options={['Terbaru', 'Nama A-Z', 'Total Pembayaran', 'Kode Booking']}
                value={sortBy}
                onChange={setSortBy}
                icon={
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3 8l4-4 4 4" /><path d="M7 4v16" />
                    <path d="M21 16l-4 4-4-4" /><path d="M17 20V4" />
                  </svg>
                }
              />
          </div>
        </div>

        {error && <div className="empty-state-klien" style={{ color: 'var(--ink-soft)' }}>Gagal memuat data: {error}</div>}
        {loading && <div className="loading-state">Memuat data...</div>}

        {!loading && !error && (
          filtered.length === 0 ? (
            <div className="empty-state-klien">
              {clients.length === 0 ? 'Belum ada klien tercatat.' : 'Tidak ada klien yang cocok dengan pencarian/filter.'}
            </div>
          ) : (
            <>
            <div className="klien-table-card">
              <table className="klien-table">
                <colgroup>
                  <col style={{ width: '30%' }} />
                  <col style={{ width: '15%' }} />
                  <col style={{ width: '15%' }} />
                  <col style={{ width: '15%' }} />
                  <col style={{ width: '15%' }} />
                  <col style={{ width: '10%' }} />
                </colgroup>
                <thead>
                  <tr>
                    <th>Nama Klien</th>
                    <th>Kontak</th>
                    <th>Statistik</th>
                    <th className="right">Total Pembayaran</th>
                    <th className="center">Status Terakhir</th>
                    <th className="center">Lihat Data</th>
                  </tr>
                </thead>
                <tbody>
                  {paged.map((c) => (
                    <tr key={c.id}>
                      <td>
                        <div className="klien-table-name-cell">
                          <div className={`klien-avatar-big klien-avatar-sm${c.isFullySelesai ? ' selesai' : ''}`}>{initialsOf(c.nama)}</div>
                          <div>
                            <div className="klien-table-name">{c.nama}</div>
                            <div className="klien-table-sub">{c.createdAt ? `Klien sejak ${formatTanggal(c.createdAt)}` : '-'}</div>
                          </div>
                        </div>
                      </td>
                      <td className="klien-table-whatsapp">{c.whatsapp || '-'}</td>
                      <td className="klien-table-stats">
                        <div className="klien-stat-dot"><span className="dot orange" />{c.totalCount} Booking</div>
                        <div className="klien-stat-dot"><span className="dot green" />{c.selesaiCount} Selesai</div>
                      </td>
                      <td className="klien-table-belanja">{formatRupiah(c.totalBelanja)}</td>
                      <td className="klien-table-status">
                        <span className={`status-pill ${c.statusTerakhir === 'Selesai' ? 'lunas' : 'akan-datang'}`}>{c.statusTerakhir}</span>
                      </td>
                      <td>
                        <div className="klien-table-actions">
                          <button type="button" title="Lihat detail" onClick={() => setSelectedClient(c)}>
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

                <div className="klien-pagination">
                  <div className="klien-pagination-info">Menampilkan {rangeStart}–{rangeEnd} dari {filtered.length} klien</div>
                  <div className="klien-pagination-buttons">
                    <button type="button" disabled={pageSafe <= 1} onClick={() => setPage(pageSafe - 1)}>
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 18l-6-6 6-6" /></svg>
                    </button>
                    {Array.from({ length: totalPages }, (_, i) => i + 1).map((n) => (
                      <button type="button" key={n} className={n === pageSafe ? 'sel' : ''} onClick={() => setPage(n)}>{n}</button>
                    ))}
                    <button type="button" disabled={pageSafe >= totalPages} onClick={() => setPage(pageSafe + 1)}>
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 18l6-6-6-6" /></svg>
                    </button>
                  </div>
                </div>
              
            </>
          )
        )}
      </div>

      {selectedClient && (
        <div className="modal-overlay klien-modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) setSelectedClient(null) }}>
          <div className="modal">
            <div className="modal-head">
              <h2>{selectedClient.nama}</h2>
              <button className="modal-close" onClick={() => setSelectedClient(null)} type="button">&times;</button>
            </div>
            <div className="modal-body">
              <div className="detail-grid" style={{ marginBottom: 18 }}>
                <div><span className="detail-label">ID Klien</span><div>{selectedClient.id.slice(0, 8)}</div></div>
                <div><span className="detail-label">No. WhatsApp</span><div>{selectedClient.whatsapp || '-'}</div></div>
                <div><span className="detail-label">Total Booking</span><div>{selectedClient.bookingList.length}</div></div>
                <div><span className="detail-label">Total Pembayaran</span><div>{formatRupiah(selectedClient.totalBelanja)}</div></div>
              </div>
              <div className="section-label">Riwayat Booking</div>
              <div className="riwayat-list">
                {selectedClient.bookingList.map((b) => (
                  <div className="riwayat-row" key={b.id} onClick={() => setSelectedBooking(b)}>
                    <span className="riwayat-event">{b.event || 'Booking'}</span>
                    <span className="riwayat-tanggal">{formatTanggal(b.tanggal_acara)}</span>
                    <span className={`status-pill ${b.status_pembayaran === 'Lunas' ? 'lunas' : 'belum'}`}>
                      {b.status_pembayaran}
                    </span>
                  </div>
                ))}
              </div>
            </div>
            <div className="modal-foot">
              <button className="btn-ghost" onClick={() => setSelectedClient(null)}>Tutup</button>
            </div>
          </div>
        </div>
      )}

      {selectedBooking && (
        <BookingDetailModal
          booking={selectedBooking}
          onClose={() => setSelectedBooking(null)}
          onChanged={loadData}
        />
      )}
    </div>
  )
}
