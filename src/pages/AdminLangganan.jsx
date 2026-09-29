import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import Sidebar from '../components/Sidebar'
import './AdminLangganan.css'

const PAKET_LABEL = { '1bulan': '1 Bulan', '6bulan': '6 Bulan', '1tahun': '1 Tahun' }

function formatRupiah(n) {
  return 'Rp' + (Number(n) || 0).toLocaleString('id-ID')
}
function formatTanggal(dateStr) {
  if (!dateStr) return '-'
  return new Date(dateStr).toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' })
}

// Sama persis pola-nya kayak openWhatsAppKe di AdminUsers.jsx.
function openWhatsAppKe(nomor, pesan) {
  const bersih = String(nomor || '').replace(/[^0-9]/g, '').replace(/^0/, '62')
  const encoded = encodeURIComponent(pesan)
  const waUrl = `https://wa.me/${bersih}?text=${encoded}`
  const isAndroid = /Android/i.test(navigator.userAgent)
  if (isAndroid) {
    const intentUrl = `intent://wa.me/${bersih}?text=${encoded}#Intent;scheme=https;package=com.whatsapp.w4b;S.browser_fallback_url=${encodeURIComponent(waUrl)};end`
    window.location.href = intentUrl
  } else {
    window.open(waUrl, '_blank')
  }
}

export default function AdminLangganan() {
  const [requests, setRequests] = useState([])
  const [rekening, setRekening] = useState([{ bank: '', nomor: '' }])
  const [qrisUrl, setQrisUrl] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [busyId, setBusyId] = useState(null)
  const [savingSettings, setSavingSettings] = useState(false)
  const [uploadingQris, setUploadingQris] = useState(false)
  const [settingsMessage, setSettingsMessage] = useState(null)
  const qrisInputRef = useRef(null)

  async function authedFetch(url, options = {}) {
    const { data: { session } } = await supabase.auth.getSession()
    return fetch(url, {
      ...options,
      headers: { ...(options.headers || {}), Authorization: `Bearer ${session.access_token}` },
    })
  }

  async function loadAll() {
    setLoading(true)
    setError('')

    const [reqRes, settingsRes] = await Promise.all([
      authedFetch('/api/admin/langganan'),
      authedFetch('/api/admin/langganan?type=settings'),
    ])
    const reqBody = await reqRes.json()
    const settingsBody = await settingsRes.json()

    if (!reqRes.ok) { setError(reqBody.error || 'Gagal memuat pengajuan.'); setLoading(false); return }
    if (!settingsRes.ok) { setError(settingsBody.error || 'Gagal memuat pengaturan.'); setLoading(false); return }

    setRequests(reqBody.requests)
    setRekening(settingsBody.settings.rekening?.length > 0 ? settingsBody.settings.rekening : [{ bank: '', nomor: '' }])
    setQrisUrl(settingsBody.settings.qris_url)
    setLoading(false)
  }

  // Fetch sekali pas komponen pertama kali dipasang, pola standar
  // "load data on mount" -- bukan cascading render yang dikhawatirin.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { loadAll() }, [])

  function updateRekening(idx, field, value) {
    setRekening((list) => list.map((r, i) => (i === idx ? { ...r, [field]: value } : r)))
  }
  function addRekening() {
    setRekening((list) => [...list, { bank: '', nomor: '' }])
  }
  function removeRekening(idx) {
    setRekening((list) => list.filter((_, i) => i !== idx))
  }

  async function handleQrisChange(e) {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''
    if (!file.type.startsWith('image/')) {
      setSettingsMessage({ type: 'error', text: 'File harus berupa gambar (JPG/PNG).' })
      return
    }

    setUploadingQris(true)
    setSettingsMessage(null)

    // Numpang bucket "logos" yang UDAH ADA -- RLS-nya udah ngizinin
    // user upload ke folder {user.id}/, dan akun admin ini PUNYA
    // uid-nya sendiri juga, jadi valid dipake tanpa bikin bucket/policy
    // baru. Path-nya dibedain dari logo brand biasa (qris-platform.ext),
    // biar nggak ketuker/ketimpa.
    const { data: { user } } = await supabase.auth.getUser()
    const ext = file.name.split('.').pop()
    const filePath = `${user.id}/qris-platform.${ext}`

    const { error: uploadError } = await supabase.storage.from('logos').upload(filePath, file, { upsert: true, cacheControl: '3600' })
    if (uploadError) {
      setUploadingQris(false)
      setSettingsMessage({ type: 'error', text: uploadError.message })
      return
    }

    const { data: urlData } = supabase.storage.from('logos').getPublicUrl(filePath)
    setQrisUrl(`${urlData.publicUrl}?t=${Date.now()}`)
    setUploadingQris(false)
  }

  async function handleSaveSettings() {
    setSavingSettings(true)
    setSettingsMessage(null)

    const cleanRekening = rekening.map((r) => ({ bank: r.bank.trim(), nomor: r.nomor.trim() })).filter((r) => r.bank && r.nomor)

    const res = await authedFetch('/api/admin/langganan', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'settings', rekening: cleanRekening, qris_url: qrisUrl }),
    })

    setSavingSettings(false)
    setRekening(cleanRekening.length > 0 ? cleanRekening : [{ bank: '', nomor: '' }])

    if (res.ok) setSettingsMessage({ type: 'success', text: 'Pengaturan pembayaran berhasil disimpan.' })
    else setSettingsMessage({ type: 'error', text: 'Gagal menyimpan pengaturan.' })
  }

  async function handleReview(requestId, action) {
    setBusyId(requestId)
    const res = await authedFetch('/api/admin/langganan', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ requestId, action }),
    })
    if (res.ok) await loadAll()
    else alert(action === 'approve' ? 'Gagal menyetujui pengajuan.' : 'Gagal menolak pengajuan.')
    setBusyId(null)
  }

  return (
    <div className="app-shell">
      <Sidebar />
      <div className="main">
        <div className="topbar">
          <div>
            <div className="greeting">Langganan</div>
            <div className="greeting-date">Kelola pengajuan langganan & pengaturan pembayaran</div>
          </div>
        </div>

        {error && <div className="empty-state-bookinglist" style={{ color: 'var(--ink-soft)' }}>Gagal memuat data: {error}</div>}

        {loading ? (
          <div className="loading-state">Memuat...</div>
        ) : (
          <div className="adminlangganan-layout">
            <div className="card-adminlangganan">
              <div className="card-head-adminlangganan"><h3>Pengaturan Pembayaran Platform</h3></div>
              <p className="adminlangganan-hint-text">Rekening & QRIS ini yang bakal ditampilin ke user di halaman Langganan mereka.</p>

              <div className="field">
                <label>Rekening Dapur MUA</label>
                {rekening.map((r, idx) => (
                  <div className="rekening-row" key={idx}>
                    <input type="text" value={r.bank} onChange={(e) => updateRekening(idx, 'bank', e.target.value)} placeholder="contoh: BCA" className="rekening-input-bank" />
                    <input type="text" inputMode="numeric" value={r.nomor} onChange={(e) => updateRekening(idx, 'nomor', e.target.value.replace(/[^0-9]/g, ''))} placeholder="Nomor rekening" className="rekening-input-nomor" />
                    {rekening.length > 1 && (
                      <button type="button" className="rekening-hapus" onClick={() => removeRekening(idx)} aria-label="Hapus rekening ini">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" width="14" height="14"><path d="M6 6l12 12M18 6L6 18" /></svg>
                      </button>
                    )}
                  </div>
                ))}
                <button type="button" className="btn-ghost-small" onClick={addRekening}>+ Tambah Rekening</button>
              </div>

              <div className="field" style={{ marginTop: 16 }}>
                <label>QRIS Dapur MUA</label>
                <div className="qris-upload-row">
                  {qrisUrl && <img src={qrisUrl} alt="QRIS" className="qris-admin-preview" />}
                  <button type="button" className="btn-ghost-small" onClick={() => qrisInputRef.current?.click()} disabled={uploadingQris}>
                    {uploadingQris ? 'Mengunggah...' : qrisUrl ? 'Ganti QRIS' : 'Upload QRIS'}
                  </button>
                  <input ref={qrisInputRef} type="file" accept="image/*" onChange={handleQrisChange} style={{ display: 'none' }} />
                </div>
              </div>

              {settingsMessage && (
                <div className={settingsMessage.type === 'success' ? 'msg-success' : 'msg-error'} style={{ marginTop: 12 }}>{settingsMessage.text}</div>
              )}
              <button className="btn-primary" type="button" disabled={savingSettings} onClick={handleSaveSettings} style={{ marginTop: 10 }}>
                {savingSettings ? 'Menyimpan...' : 'Simpan Pengaturan'}
              </button>
            </div>

            <div className="card-adminlangganan">
              <div className="card-head-adminlangganan"><h3>Pengajuan Masuk ({requests.length})</h3></div>
              {requests.length === 0 ? (
                <div className="adminlangganan-kosong">Belum ada pengajuan yang menunggu review.</div>
              ) : (
                <div className="pengajuan-list">
                  {requests.map((r) => (
                    <div className="pengajuan-item" key={r.id}>
                      <div className="pengajuan-info">
                        <div className="pengajuan-studio">{r.studio_name}</div>
                        <div className="pengajuan-meta">
                          {PAKET_LABEL[r.durasi]} · {formatRupiah(r.harga)} · {r.metode_pembayaran === 'qris' ? 'QRIS' : `Transfer ke ${r.rekening_tujuan}`}
                        </div>
                        <div className="pengajuan-meta">Diajukan {formatTanggal(r.created_at)}</div>
                        {r.whatsapp && (
                          <button type="button" className="admin-wa-btn" onClick={() => openWhatsAppKe(r.whatsapp, `Halo Kak ${r.studio_name}!\n\nMau konfirmasi soal pengajuan langganan kamu nih.`)}>
                            {r.whatsapp} ↗
                          </button>
                        )}
                      </div>
                      {r.bukti_signed_url && (
                        <a href={r.bukti_signed_url} target="_blank" rel="noreferrer">
                          <img src={r.bukti_signed_url} alt="Bukti transfer" className="pengajuan-bukti-thumb" />
                        </a>
                      )}
                      <div className="pengajuan-actions">
                        <button type="button" className="btn-approve" disabled={busyId === r.id} onClick={() => handleReview(r.id, 'approve')}>Approve</button>
                        <button type="button" className="btn-reject" disabled={busyId === r.id} onClick={() => handleReview(r.id, 'reject')}>Reject</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
