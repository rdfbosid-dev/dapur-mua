import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import Sidebar from '../components/Sidebar'
import './AdminDashboard.css'

// Sisa hari sampai tanggal habis -- dibulatin ke ATAS, sama persis
// logikanya kayak di AdminUsers.jsx, biar angka "Segera Habis" di sini
// konsisten sama highlight warna di tabel Kelola User.
function sisaHari(dateStr) {
  if (!dateStr) return null
  const target = new Date(dateStr)
  const now = new Date()
  return Math.ceil((target - now) / (1000 * 60 * 60 * 24))
}

export default function AdminDashboard() {
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

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

  const totalUser = users.length
  const jumlahTrial = users.filter((u) => u.subscription_status !== 'active').length
  const jumlahAktif = users.filter((u) => u.subscription_status === 'active').length
  // "Segera Habis" -- user AKTIF (bukan trial) yang sisa harinya <= 7,
  // termasuk yang udah kelewat (sisa negatif) -- dua-duanya sama-sama
  // butuh ditindaklanjuti, bukan cuma yang belum lewat doang.
  const segeraHabis = users.filter((u) => {
    if (u.subscription_status !== 'active') return false
    const sisa = sisaHari(u.subscription_ends_at)
    return sisa !== null && sisa <= 7
  }).length

  const cards = [
    { label: 'Total User', value: totalUser, tone: '' },
    { label: 'Trial', value: jumlahTrial, tone: '' },
    { label: 'Aktif/Berlangganan', value: jumlahAktif, tone: 'aktif' },
    { label: 'Segera Habis (≤7 hari)', value: segeraHabis, tone: segeraHabis > 0 ? 'urgent' : '' },
  ]

  return (
    <div className="app-shell">
      <Sidebar />
      <div className="main">
        <div className="topbar">
          <div>
            <div className="greeting">Dashboard Admin</div>
            <div className="greeting-date">Ringkasan seluruh user Dapur MUA</div>
          </div>
        </div>

        {error && <div className="empty-state-bookinglist" style={{ color: 'var(--ink-soft)' }}>Gagal memuat data: {error}</div>}

        {loading ? (
          <div className="loading-state">Memuat...</div>
        ) : (
          <div className="admin-card-grid">
            {cards.map((c) => (
              <div className={`admin-summary-card ${c.tone}`} key={c.label}>
                <div className="admin-summary-value">{c.value}</div>
                <div className="admin-summary-label">{c.label}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
