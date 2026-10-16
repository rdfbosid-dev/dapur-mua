import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import Sidebar from '../components/Sidebar'
import BookingModal from '../components/BookingModal'
import Toast from '../components/Toast'
import { useToast } from '../lib/useToast'
import { kodeZona, ZONA_WAKTU, ZONA_DEFAULT } from '../lib/zonaWaktu'
import { formatRupiah, nomorWaInternasional, tanggalPanjang, linkBooking, muatPengaturanBooking } from '../lib/bookingOnline'
import { usePantauPermintaan } from '../lib/pantauPermintaan'
import './PermintaanBooking.css'

// Daftar PERMINTAAN BOOKING dari link booking online (tabel
// permintaan_booking, RLS: cuma milik user ini). Permintaan BUKAN booking:
// angka Keuangan/Laporan baru ikut berubah setelah MUA menekan "Terima" dan
// menyimpan form Booking Baru yang sudah terisi otomatis.

const TAB = [
  { kunci: 'baru', label: 'Baru' },
  { kunci: 'diterima', label: 'Diterima' },
  { kunci: 'ditolak', label: 'Ditolak' },
]

// Ikon WhatsApp tombol Chat WhatsApp -- SAMA dengan ikon tombol WhatsApp di
// halaman sukses link booking (BookingOnline.jsx).
function IkonWa() {
  return (
    <svg className="pb-btn-ikon" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm5.4 14.2c-.2.6-1.3 1.2-1.8 1.2-.5.1-1 .1-3.3-.8-2.8-1.1-4.5-3.9-4.7-4.1-.1-.2-1.1-1.5-1.1-2.9s.7-2 1-2.3c.2-.3.6-.4.8-.4h.6c.2 0 .4 0 .6.5l.9 2.1c.1.2.1.4 0 .6l-.4.6-.4.4c-.1.2-.3.3-.1.6.2.3.8 1.3 1.7 2.1 1.2 1 2.1 1.3 2.4 1.5.3.1.5.1.6-.1l.9-1.1c.2-.3.4-.2.7-.1l2 1c.3.1.5.2.6.3.1.2.1.7-.1 1.3Z" /></svg>
  )
}

// Waktu permintaan masuk -> "15 Okt 2026, 14:55 WIB". Dihitung di zona waktu
// MUA (Pengaturan), bukan zona perangkat, jadi jam & label zonanya selalu cocok.
// Jam pakai titik dua (14:55), bukan titik (14.55) bawaan format Indonesia.
function waktuMasuk(iso, zona) {
  const kode = zona || ZONA_DEFAULT
  const timeZone = ZONA_WAKTU.find((z) => z.kode === kode)?.iana || 'Asia/Jakarta'
  const d = new Date(iso)
  const tanggal = d.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric', timeZone })
  const jam = d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone }).replace('.', ':')
  return `${tanggal} | ${jam} ${kode}`
}
// Label detail kartu + tanda ":" di ujung kanannya (sejajar lurus ke bawah,
// lihat .pb-detail span di PermintaanBooking.css).
function Label({ children }) {
  return <span>{children}<i className="pb-titik-dua">:</i></span>
}
// Sumber tersimpan -> teks di kartu. Referral = pilihan "Teman/Keluarga"
// calon klien di link booking.
function labelSumber(s) {
  return s === 'Referral' ? 'Teman/Keluarga (Referral)' : s
}
function labelPaket(o) {
  if (!o.kategori) return 'Belum pilih paket'
  const inti = o.jenis ? `${o.kategori} · ${o.jenis}` : o.kategori
  return o.keterangan ? `${inti} · ${o.keterangan}` : inti
}
// Permintaan -> isi awal form Booking Baru (lihat prop `awal` BookingModal).
function keAwalBooking(p) {
  return {
    namaKlien: p.nama_klien,
    nomorWhatsApp: p.nomor_whatsapp,
    tanggalAcara: p.tanggal_acara,
    jamStartMakeup: p.jam_mulai || '',
    lokasi: p.lokasi,
    event: p.event,
    catatan: p.catatan,
    sumber: p.sumber || '',
    peserta: (p.peserta || []).map((o) => ({
      nama: o.nama,
      peran: o.peran,
      layananId: o.layanan_id || null,
      kategoriMakeup: o.kategori || '',
      jenisPaket: o.jenis || '',
      biayaMakeup: o.biaya,
      rambut: o.rambut || 'Tidak Ada',
    })),
  }
}

export default function PermintaanBooking() {
  const { user, profile } = useAuth()
  const zona = kodeZona(profile)
  // Status link (aktif/slug) -- dimuat terpisah, lihat muatPengaturanBooking.
  const [pengaturan, setPengaturan] = useState(null)
  useEffect(() => {
    let batal = false
    muatPengaturanBooking(user?.id).then((p) => { if (!batal) setPengaturan(p) })
    return () => { batal = true }
  }, [user])
  const [tab, setTab] = useState('baru')
  const [daftar, setDaftar] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [diterima, setDiterima] = useState(null) // permintaan yang lagi dibuatkan booking
  const [konfirmasiTolak, setKonfirmasiTolak] = useState(null)
  const [konfirmasiHapus, setKonfirmasiHapus] = useState(null)
  const [toast, tampilkanToast] = useToast()

  // ID permintaan yang sudah tampil -- buat tahu mana yang BARU masuk waktu
  // daftar dimuat ulang otomatis (null = belum pernah dimuat).
  const idTampil = useRef(null)
  // `diam` = muat ulang otomatis di latar (permintaan baru masuk, aplikasi
  // dibuka lagi): tanpa tulisan "Memuat data", & kalau gagal daftar lama
  // tetap tampil (nggak muncul pesan galat).
  async function muat({ diam = false } = {}) {
    if (!diam) { setLoading(true); setError('') }
    const { data, error: err } = await supabase
      .from('permintaan_booking')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(300)
    if (err) {
      if (!diam) setError(err.message)
    } else {
      const baris = data || []
      const sebelumnya = idTampil.current
      const masuk = sebelumnya ? baris.filter((p) => p.status === 'baru' && !sebelumnya.has(p.id)).length : 0
      idTampil.current = new Set(baris.map((p) => p.id))
      setDaftar(baris)
      if (masuk > 0) tampilkanToast(masuk > 1 ? `${masuk} permintaan booking baru masuk 🔔` : 'Ada permintaan booking baru masuk 🔔')
    }
    if (!diam) setLoading(false)
  }
  // Muat sekali pas halaman dibuka (pola load-on-mount).
  // eslint-disable-next-line react-hooks/set-state-in-effect, react-hooks/exhaustive-deps
  useEffect(() => { muat() }, [])
  // Kartu permintaan baru langsung muncul tanpa refresh (lib/pantauPermintaan.js).
  usePantauPermintaan(user?.id || null, () => muat({ diam: true }))

  async function ubahStatus(p, status, tambahan = {}) {
    const { error: err } = await supabase
      .from('permintaan_booking')
      .update({ status, diproses_at: status === 'baru' ? null : new Date().toISOString(), ...tambahan })
      .eq('id', p.id)
    if (err) { setError(err.message); return false }
    await muat()
    return true
  }

  async function handleBookingTersimpan(kode, bookingId) {
    const p = diterima
    setDiterima(null)
    if (p) await ubahStatus(p, 'diterima', { booking_id: bookingId || null })
    tampilkanToast(`Booking ${kode} berhasil dibuat dari permintaan ✅`)
  }

  async function tolak(p) {
    setKonfirmasiTolak(null)
    if (await ubahStatus(p, 'ditolak')) tampilkanToast('Permintaan ditandai ditolak.')
  }

  async function hapus(p) {
    setKonfirmasiHapus(null)
    const { error: err } = await supabase.from('permintaan_booking').delete().eq('id', p.id)
    if (err) { setError(err.message); return }
    await muat()
    tampilkanToast('Permintaan dihapus.')
  }

  const terfilter = daftar.filter((p) => p.status === tab)
  const jumlah = (k) => daftar.filter((p) => p.status === k).length

  return (
    <div className="app-shell">
      <Sidebar />
      <div className="main">
        <div className="topbar">
          <div>
            <div className="greeting">Permintaan Booking</div>
            <div className="greeting-date">Masuk dari link booking online-mu</div>
          </div>
        </div>

        {pengaturan && !pengaturan.gagal && !pengaturan.booking_online_aktif && (
          <div className="pb-info">
            Link booking online belum aktif. Aktifkan & atur alamat link-nya di <Link to="/pengaturan">Pengaturan</Link>.
          </div>
        )}
        {pengaturan?.booking_online_aktif && pengaturan?.slug && (
          <div className="pb-info">
            Link booking-mu: <a href={linkBooking(pengaturan.slug)} target="_blank" rel="noreferrer">{linkBooking(pengaturan.slug).replace(/^https?:\/\//, '')}</a>
          </div>
        )}

        {/* Saklar geser Baru | Diterima | Ditolak -- "thumb" (latar yang
            menandai pilihan aktif) bergeser ke posisi tab yang dipilih lewat
            variabel CSS --pb-tab-i (0, 1, 2). */}
        <div className="pb-tabs" role="tablist" style={{ '--pb-tab-i': Math.max(0, TAB.findIndex((t) => t.kunci === tab)) }}>
          <span className="pb-tabs-thumb" aria-hidden="true" />
          {TAB.map((t) => (
            <button key={t.kunci} type="button" role="tab" aria-selected={tab === t.kunci} className={`pb-tab${tab === t.kunci ? ' aktif' : ''}`} onClick={() => setTab(t.kunci)}>
              {t.label}{jumlah(t.kunci) > 0 && <span className="pb-tab-jumlah">{jumlah(t.kunci)}</span>}
            </button>
          ))}
        </div>

        {error && <div className="pb-galat">Terjadi kendala: {error}</div>}
        {loading ? (
          <div className="loading-state">Memuat data ....</div>
        ) : terfilter.length === 0 ? (
          <div className="pb-kosong">
            {tab === 'baru' ? 'Belum ada permintaan booking baru.' : tab === 'diterima' ? 'Belum ada permintaan yang diterima.' : 'Belum ada permintaan yang ditolak.'}
          </div>
        ) : (
          <div className="pb-list">
            {terfilter.map((p) => {
              const wa = nomorWaInternasional(p.nomor_whatsapp)
              const namaMua = profile?.studio_name || 'kami'
              const pesanWa = [
                `Halo, Kak ${p.nama_klien}. Terima kasih udah ngirim permintaan booking ke *${namaMua}*.`,
                '',
                'Detail informasi booking',
                `Hari, tanggal acara : ${tanggalPanjang(p.tanggal_acara)}`,
                `Acara : ${p.event}`,
              ].join('\n')
              return (
                <div className="pb-card" key={p.id}>
                  <div className="pb-card-head">
                    <div>
                      <div className="pb-nama">{p.nama_klien}</div>
                      <div className="pb-masuk">Masuk {waktuMasuk(p.created_at, zona)}</div>
                    </div>
                    <span className={`pb-status ${p.status}`}>{TAB.find((t) => t.kunci === p.status)?.label}</span>
                  </div>
                  {/* Isi kartu (detail, klien, catatan) -- bagian yang bisa
                      di-scroll kalau datanya panjang, biar semua kartu SAMA
                      tinggi & tombol aksi selalu kelihatan di bawah. */}
                  <div className="pb-isi">
                  <div className="pb-detail">
                    <div><Label>Hari, Tanggal</Label><b>{tanggalPanjang(p.tanggal_acara)}</b></div>
                    {/* Jam dipisah ke baris sendiri. Calon klien boleh nggak
                        isi jam (opsional di link booking) -> "Belum ditentukan". */}
                    <div><Label>Jam Mulai Makeup</Label>{p.jam_mulai ? <b>{String(p.jam_mulai).slice(0, 5)} {zona}</b> : <b className="pb-belum">Belum ditentukan</b>}</div>
                    <div><Label>Acara</Label><b>{p.event}</b></div>
                    <div><Label>Lokasi</Label><b>{p.lokasi}</b></div>
                    <div><Label>WhatsApp</Label><b>{p.nomor_whatsapp}</b></div>
                    {/* Permintaan lama (sebelum ada pertanyaan ini) nggak punya sumber. */}
                    {p.sumber && <div><Label>Tahu dari</Label><b>{labelSumber(p.sumber)}</b></div>}
                  </div>
                  <div className="pb-orang">
                    {(p.peserta || []).map((o, i) => (
                      <div className="pb-orang-baris" key={i}>
                        <span>{o.nama}{o.peran ? ` (${o.peran})` : ''}</span>
                        <span className={o.kategori ? '' : 'pb-belum'}>
                          {labelPaket(o)}{o.biaya !== null && o.biaya !== undefined ? ` | ${formatRupiah(o.biaya)}` : ''}
                          {o.rambut && o.rambut !== 'Tidak Ada' && <span className="pb-rambut">• {o.rambut}</span>}
                        </span>
                      </div>
                    ))}
                    {p.estimasi_total !== null && (
                      <div className="pb-orang-baris pb-estimasi"><span>Estimasi Biaya{(p.peserta || []).some((o) => o.rambut && o.rambut !== 'Tidak Ada') ? ' (belum termasuk Add On Layanan Rambut)' : ''}</span><span>{formatRupiah(p.estimasi_total)}</span></div>
                    )}
                  </div>
                  {p.catatan && (
                    <>
                      <div className="pb-catatan-label">Catatan</div>
                      <div className="pb-catatan">{p.catatan}</div>
                    </>
                  )}
                  </div>

                  {konfirmasiTolak === p.id && (
                    <div className="pb-konfirmasi">
                      <span>Tandai permintaan ini <b>ditolak</b>? Calon klien nggak dapat pemberitahuan otomatis, jadi kabari lewat WhatsApp.</span>
                      <div><button type="button" className="pb-btn-batal" onClick={() => setKonfirmasiTolak(null)}>Batal</button><button type="button" className="pb-btn bahaya" onClick={() => tolak(p)}>Ya, tolak</button></div>
                    </div>
                  )}
                  {konfirmasiHapus === p.id && (
                    <div className="pb-konfirmasi">
                      <span>Hapus permintaan ini permanen? Booking yang sudah dibuat darinya tetap aman.</span>
                      <div><button type="button" className="pb-btn" onClick={() => setKonfirmasiHapus(null)}>Batal</button><button type="button" className="pb-btn bahaya" onClick={() => hapus(p)}>Ya, hapus</button></div>
                    </div>
                  )}

                  <div className="pb-aksi">
                    {p.status === 'baru' && (
                      <>
                        <button type="button" className="pb-btn" onClick={() => { setKonfirmasiHapus(null); setKonfirmasiTolak(p.id) }}>Tolak</button>
                        <button type="button" className="pb-btn utama" onClick={() => setDiterima(p)}>Terima &amp; Buat Booking</button>
                      </>
                    )}
                    {p.status !== 'baru' && (
                      <>
                        {p.status === 'ditolak' && <button type="button" className="pb-btn" onClick={() => ubahStatus(p, 'baru')}>Kembalikan ke Baru</button>}
                        <button type="button" className="pb-btn" onClick={() => { setKonfirmasiTolak(null); setKonfirmasiHapus(p.id) }}>Hapus</button>
                      </>
                    )}
                    {/* Chat WhatsApp: desktop di PALING KANAN, HP turun ke
                        baris sendiri selebar kartu (lihat PermintaanBooking.css). */}
                    {wa && <a className="pb-btn wa" href={`https://wa.me/${wa}?text=${encodeURIComponent(pesanWa)}`} target="_blank" rel="noreferrer"><IkonWa />Chat WhatsApp</a>}
                  </div>
                  {p.status === 'diterima' && <div className="pb-catatan-kecil">{p.booking_id ? 'Sudah dibuat jadi booking. Cek di halaman Booking.' : 'Ditandai diterima.'}</div>}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {diterima && (
        <BookingModal
          awal={keAwalBooking(diterima)}
          onClose={() => setDiterima(null)}
          onSaved={handleBookingTersimpan}
        />
      )}

      {/* Toast bersama -- posisi & gaya di components/Toast.css. */}
      <Toast teks={toast} />
    </div>
  )
}
