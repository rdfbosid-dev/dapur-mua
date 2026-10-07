import { useEffect, useRef, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import Sidebar from '../components/Sidebar'
import './Langganan.css'

// SAMA PERSIS 3 paket & harganya kayak di Landing.jsx (section #harga)
// -- SENGAJA nggak diimpor langsung dari situ (Landing.jsx nggak
// nge-export PLANS-nya), tapi nilainya harus selalu disinkronin manual
// kalau harga di landing page berubah.
const PAKET = [
  { id: '1bulan', label: '1 Bulan', harga: 35000, period: 'semua fitur aktif' },
  { id: '6bulan', label: '6 Bulan', harga: 200000, period: 'semua fitur aktif' },
  { id: '1tahun', label: '1 Tahun', harga: 380000, period: 'semua fitur aktif' },
]

function formatRupiah(n) {
  return 'Rp' + (Number(n) || 0).toLocaleString('id-ID')
}
function formatTanggal(dateStr) {
  if (!dateStr) return '-'
  return new Date(dateStr).toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' })
}
// Sama persis pola & pembulatan (Math.ceil) kayak di Sidebar.jsx/
// AdminUsers.jsx, biar angka yang keliatan konsisten di semua tempat.
function sisaHari(dateStr) {
  if (!dateStr) return null
  const target = new Date(dateStr)
  const now = new Date()
  return Math.ceil((target - now) / (1000 * 60 * 60 * 24))
}

export default function Langganan() {
  const { user, profile, isAdmin } = useAuth()

  const [platformSettings, setPlatformSettings] = useState(null)
  const [pendingRequest, setPendingRequest] = useState(null)
  const [loading, setLoading] = useState(true)

  const [selectedPaket, setSelectedPaket] = useState(null)
  const [metode, setMetode] = useState(null) // 'transfer_bank' | 'qris'
  const [selectedRekening, setSelectedRekening] = useState(null)
  const [buktiFile, setBuktiFile] = useState(null)
  const [buktiPreview, setBuktiPreview] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const buktiInputRef = useRef(null)

  async function loadData() {
    setLoading(true)
    const [settingsRes, pendingRes] = await Promise.all([
      supabase.from('platform_settings').select('rekening, qris_url').eq('id', true).maybeSingle(),
      supabase.from('subscription_requests').select('id, durasi, harga, metode_pembayaran, status, created_at').eq('user_id', user.id).eq('status', 'pending').maybeSingle(),
    ])
    if (settingsRes.data) setPlatformSettings(settingsRes.data)
    if (pendingRes.data) setPendingRequest(pendingRes.data)
    setLoading(false)
  }

  // Fetch sekali pas komponen pertama kali dipasang, pola standar
  // "load data on mount" -- bukan cascading render yang dikhawatirin.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { if (user) loadData() }, [user])

  function handlePilihBukti(e) {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) {
      setError('File harus berupa gambar (JPG/PNG).')
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      setError('Ukuran file maksimal 5MB.')
      return
    }
    setError('')
    setBuktiFile(file)
    setBuktiPreview(URL.createObjectURL(file))
  }

  function handleHapusBukti() {
    if (buktiPreview) URL.revokeObjectURL(buktiPreview)
    setBuktiFile(null)
    setBuktiPreview(null)
    setError('')
    // Reset input aslinya, biar file yang sama bisa dipilih lagi setelah dihapus
    if (buktiInputRef.current) buktiInputRef.current.value = ''
  }

  async function handleSubmit() {
    if (!selectedPaket || !metode || !buktiFile) return
    if (metode === 'transfer_bank' && !selectedRekening) {
      setError('Pilih salah satu rekening tujuan transfer dulu.')
      return
    }
    setSubmitting(true)
    setError('')

    const paket = PAKET.find((p) => p.id === selectedPaket)
    const ext = buktiFile.name.split('.').pop()
    const path = `${user.id}/${Date.now()}.${ext}`

    const { error: uploadError } = await supabase.storage.from('bukti-transfer').upload(path, buktiFile)
    if (uploadError) {
      setError(uploadError.message)
      setSubmitting(false)
      return
    }

    const { error: insertError } = await supabase.from('subscription_requests').insert({
      user_id: user.id,
      durasi: paket.id,
      harga: paket.harga,
      metode_pembayaran: metode,
      rekening_tujuan: metode === 'transfer_bank' ? selectedRekening : null,
      bukti_url: path,
    })

    setSubmitting(false)

    if (insertError) {
      setError(insertError.message)
      return
    }

    await loadData()
    setSelectedPaket(null)
    setMetode(null)
    setSelectedRekening(null)
    setBuktiFile(null)
    setBuktiPreview(null)
  }

  const tanggalLangganan = profile?.subscription_status === 'active' ? profile?.subscription_ends_at : profile?.trial_ends_at
  const sisa = sisaHari(tanggalLangganan)

  // Halaman ini SENGAJA numpang TrialGateRoute (bukan ProtectedRoute) di
  // App.jsx, biar user isLocked tetep bisa masuk -- tapi itu berarti
  // guard isAdmin dari ProtectedRoute juga ikut kelewat. Dijaga manual
  // di sini -- akun admin nggak punya konsep langganan buat dirinya
  // sendiri, jadi kalau somehow nyasar ke sini, lempar ke /admin.
  // Ditaruh SETELAH semua hooks (bukan di atas fungsi), biar nggak
  // ngelanggar Rules of Hooks React (hooks harus selalu kepanggil
  // dalam urutan yang sama, nggak boleh ke-skip kondisional).
  if (isAdmin) return <Navigate to="/admin" replace />

  return (
    <div className="app-shell">
      <Sidebar />
      <div className="main">
        <div className="topbar">
          <div>
            <div className="greeting">Langganan</div>
            <div className="greeting-date">Kelola & perpanjang langganan Dapur MUA kamu</div>
          </div>
        </div>

        {loading ? (
          <div className="loading-state">Memuat data...</div>
        ) : (
          <div className="langganan-layout">
            <div className="card-langganan">
              <div className="card-head-langganan"><h3>Status Langganan Saat Ini</h3></div>
              <div className="langganan-status-row">
                <span className={`status-pill ${profile?.subscription_status === 'active' ? 'lunas' : 'belum'}`}>
                  {profile?.subscription_status === 'active' ? 'Aktif' : 'Trial'}
                </span>
                <span className="langganan-status-tanggal">
                  {profile?.subscription_status === 'active' ? 'Berlaku sampai' : 'Trial sampai'} {formatTanggal(tanggalLangganan)}
                  {sisa !== null && (sisa >= 0 ? ` (${sisa} hari lagi)` : ' (sudah berakhir)')}
                </span>
              </div>
            </div>

            {pendingRequest ? (
              // Ada pengajuan yang masih PENDING -- form baru diblokir dulu,
              // biar nggak numpuk beberapa pengajuan sekaligus buat 1 user
              // yang sama (bikin bingung pas admin review).
              <div className="card-langganan">
                <div className="card-head-langganan"><h3>Pengajuan Kamu Sedang Diproses</h3></div>
                <p className="langganan-pending-text">
                  Paket <b>{PAKET.find((p) => p.id === pendingRequest.durasi)?.label}</b> ({formatRupiah(pendingRequest.harga)}) --
                  diajukan {formatTanggal(pendingRequest.created_at)}. Menunggu konfirmasi admin, biasanya diproses dalam 1x24 jam.
                </p>
              </div>
            ) : (
              <>
                <div className="card-langganan">
                  <div className="card-head-langganan"><h3>1. Pilih Paket</h3></div>
                  <div className="paket-grid">
                    {PAKET.map((p) => (
                      <button
                        type="button"
                        key={p.id}
                        className={`paket-card${selectedPaket === p.id ? ' sel' : ''}`}
                        onClick={() => setSelectedPaket(p.id)}
                      >
                        <div className="paket-label">{p.label}</div>
                        <div className="paket-harga">{formatRupiah(p.harga)}</div>
                        <div className="paket-period">{p.period}</div>
                      </button>
                    ))}
                  </div>
                </div>

                {selectedPaket && (
                  <div className="card-langganan">
                    <div className="card-head-langganan"><h3>2. Pilih Metode Pembayaran</h3></div>
                    <div className="metode-toggle-row">
                      <button type="button" className={`metode-opt${metode === 'transfer_bank' ? ' sel' : ''}`} onClick={() => { setMetode('transfer_bank'); setSelectedRekening(null) }}>Transfer Bank</button>
                      <button type="button" className={`metode-opt${metode === 'qris' ? ' sel' : ''}`} onClick={() => setMetode('qris')}>QRIS</button>
                    </div>

                    {metode === 'transfer_bank' && (
                      <div className="rekening-pilih-list">
                        {(platformSettings?.rekening || []).length === 0 ? (
                          <div className="langganan-kosong">Belum ada rekening yang di-setting admin. Coba pilih QRIS, atau hubungi admin.</div>
                        ) : (
                          platformSettings.rekening.map((r, idx) => (
                            <button
                              type="button"
                              key={idx}
                              className={`rekening-pilih-item${selectedRekening === `${r.bank} ${r.nomor}` ? ' sel' : ''}`}
                              onClick={() => setSelectedRekening(`${r.bank} ${r.nomor}`)}
                            >
                              <span className="rekening-pilih-bank">{r.bank}</span>
                              <span className="rekening-pilih-nomor">{r.nomor}</span>
                            </button>
                          ))
                        )}
                      </div>
                    )}

                    {metode === 'qris' && (
                      platformSettings?.qris_url ? (
                        <div className="qris-preview-wrap">
                          <img src={platformSettings.qris_url} alt="QRIS Dapur MUA" className="qris-preview-img" />
                        </div>
                      ) : (
                        <div className="langganan-kosong">Belum ada QRIS yang di-setting admin. Coba pilih Transfer Bank, atau hubungi admin.</div>
                      )
                    )}
                  </div>
                )}

                {selectedPaket && metode && (metode === 'qris' || selectedRekening) && (
                  <div className="card-langganan">
                    <div className="card-head-langganan"><h3>3. Upload Bukti Transfer</h3></div>
                    <div className="upload-wrap">
                      <input id="bukti-input" ref={buktiInputRef} className="upload-input-hidden" type="file" accept="image/*" onChange={handlePilihBukti} />
                      <label className="upload-btn" htmlFor="bukti-input">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                          <polyline points="17 8 12 3 7 8" />
                          <line x1="12" y1="3" x2="12" y2="15" />
                        </svg>
                        <span>{buktiFile ? 'Ganti Foto' : 'Pilih Foto Bukti Transfer'}</span>
                      </label>
                      {buktiFile && <span className="upload-filename">{buktiFile.name}</span>}
                    </div>
                    {buktiPreview && (
                      <div className="bukti-preview-wrap">
                        <img src={buktiPreview} alt="Preview bukti transfer" className="bukti-preview-img" />
                        <button type="button" className="bukti-hapus-btn" onClick={handleHapusBukti} aria-label="Hapus foto">
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="18" y1="6" x2="6" y2="18" />
                            <line x1="6" y1="6" x2="18" y2="18" />
                          </svg>
                        </button>
                      </div>
                    )}
                    {error && <div className="msg-error" style={{ marginTop: 10 }}>{error}</div>}
                    <button className="btn-primary" type="button" disabled={!buktiFile || submitting} onClick={handleSubmit} style={{ marginTop: 14 }}>
                      {submitting ? 'Mengirim...' : 'Kirim Pengajuan'}
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
