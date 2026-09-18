import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import Sidebar from '../components/Sidebar'
import './AdminUsers.css'

function formatTanggal(dateStr) {
  if (!dateStr) return '-'
  return new Date(dateStr).toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' })
}

// Sisa hari sampai tanggal habis -- dibulatin ke ATAS (Math.ceil), biar
// "kurang dari 1 hari lagi" tetep kehitung 1, bukan 0 (yang keliatannya
// kayak "udah habis" padahal belum).
function sisaHari(dateStr) {
  if (!dateStr) return null
  const target = new Date(dateStr)
  const now = new Date()
  return Math.ceil((target - now) / (1000 * 60 * 60 * 24))
}

// Buka WA ke NOMOR USER TERTENTU (beda dari openAdminWhatsApp di
// lib/whatsapp.js yang tujuannya SELALU ke admin) -- dipakai admin buat
// follow-up user yang mau/udah habis langganannya. Pola Android
// intent-nya SENGAJA disamain kayak yang lain, biar konsisten.
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

export default function AdminUsers() {
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [busyId, setBusyId] = useState(null)

  async function loadUsers() {
    setLoading(true)
    setError('')

    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      setError('Sesi login nggak ketemu.')
      setLoading(false)
      return
    }

    const res = await fetch('/api/admin/users', {
      headers: { Authorization: `Bearer ${session.access_token}` },
    })
    const body = await res.json()

    if (!res.ok) {
      setError(body.error || 'Gagal memuat data.')
      setLoading(false)
      return
    }

    setUsers(body.users)
    setLoading(false)
  }

  // Fetch sekali pas komponen pertama kali dipasang, pola standar
  // "load data on mount" -- bukan cascading render yang dikhawatirin.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { loadUsers() }, [])

  async function handlePerpanjang(userId, durasi) {
    setBusyId(userId)
    const { data: { session } } = await supabase.auth.getSession()

    const res = await fetch('/api/admin/users', {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, durasi }),
    })

    if (res.ok) await loadUsers()
    else alert('Gagal memperpanjang langganan.')

    setBusyId(null)
  }

  return (
    <div className="app-shell">
      <Sidebar />
      <div className="main">
        <div className="topbar">
          <div>
            <div className="greeting">Kelola User</div>
            <div className="greeting-date">Pantau & atur langganan seluruh user Dapur MUA</div>
          </div>
        </div>

        {error && <div className="empty-state-bookinglist" style={{ color: 'var(--ink-soft)' }}>Gagal memuat data: {error}</div>}

        {loading ? (
          <div className="loading-state">Memuat...</div>
        ) : (
          <div className="table-card">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Studio</th>
                  <th>Kontak</th>
                  <th>Status</th>
                  <th>Berlaku Sampai</th>
                  <th className="center">Perpanjang</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => {
                  const tanggalRelevan = u.subscription_status === 'active' ? u.subscription_ends_at : u.trial_ends_at
                  const sisa = sisaHari(tanggalRelevan)
                  // Merah kalau udah lewat/mau habis (<=3 hari), kuning
                  // kalau masih agak longgar (<=7 hari) -- di luar itu netral.
                  const urgensi = sisa === null ? '' : sisa <= 3 ? 'urgent' : sisa <= 7 ? 'waspada' : ''

                  return (
                    <tr key={u.id}>
                      <td>
                        <div className="admin-studio-name">{u.studio_name || '(belum diisi)'}</div>
                        <div className="admin-studio-sub">{u.kode_prefix || '-'}</div>
                      </td>
                      <td>
                        <div className="admin-kontak-email">{u.email || '-'}</div>
                        {u.whatsapp && (
                          <button
                            type="button"
                            className="admin-wa-btn"
                            onClick={() => openWhatsAppKe(u.whatsapp, `Halo Kak ${u.studio_name || ''}!\n\nMau info soal langganan Dapur MUA kamu nih.`)}
                          >
                            {u.whatsapp} ↗
                          </button>
                        )}
                      </td>
                      <td>
                        <span className={`status-pill ${u.subscription_status === 'active' ? 'lunas' : 'belum'}`}>
                          {u.subscription_status === 'active' ? 'Aktif' : 'Trial'}
                        </span>
                      </td>
                      <td>
                        <div className={`admin-tanggal ${urgensi}`}>{formatTanggal(tanggalRelevan)}</div>
                        {sisa !== null && (
                          <div className={`admin-sisa ${urgensi}`}>
                            {sisa < 0 ? `Lewat ${Math.abs(sisa)} hari` : `${sisa} hari lagi`}
                          </div>
                        )}
                      </td>
                      <td>
                        <div className="admin-perpanjang-row">
                          <button type="button" disabled={busyId === u.id} onClick={() => handlePerpanjang(u.id, '1bulan')}>+1 Bulan</button>
                          <button type="button" disabled={busyId === u.id} onClick={() => handlePerpanjang(u.id, '6bulan')}>+6 Bulan</button>
                          <button type="button" disabled={busyId === u.id} onClick={() => handlePerpanjang(u.id, '1tahun')}>+1 Tahun</button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
