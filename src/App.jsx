import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import { ThemeProvider } from './context/ThemeContext'
import Login from './pages/Login'
import Register from './pages/Register'
import Landing from './pages/Landing'
import LupaPassword from './pages/LupaPassword'
import ResetPassword from './pages/ResetPassword'
import Dashboard from './pages/Dashboard'
import BookingList from './pages/BookingList'
import Kalender from './pages/Kalender'
import Klien from './pages/Klien'
import Keuangan from './pages/Keuangan'
import Laporan from './pages/Laporan'
import Pengaturan from './pages/Pengaturan'
import TrialHabis from './pages/TrialHabis'
import Panduan from './pages/Panduan'
import AdminDashboard from './pages/AdminDashboard'
import AdminUsers from './pages/AdminUsers'

function ProtectedRoute({ children }) {
  const { user, loading, isLocked, isAdmin } = useAuth()

  if (loading) {
    return (
      <div style={{
        minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontFamily: "'Plus Jakarta Sans', sans-serif", color: '#8B8299'
      }}>
        Memuat...
      </div>
    )
  }

  if (!user) return <Navigate to="/login" replace />
  // Trial abis & belum berlangganan -- SEMUA halaman di dalem ProtectedRoute
  // (termasuk Pengaturan) kekunci, kecuali /trial-habis sendiri (itu route
  // terpisah, nggak lewat ProtectedRoute -- lihat di bawah).
  if (isLocked) return <Navigate to="/trial-habis" replace />
  // Akun admin nggak boleh liat halaman MUA sama sekali -- termasuk kalau
  // nyoba akses langsung lewat URL manual (misal /booking). Semua
  // ProtectedRoute otomatis lempar balik ke /admin.
  if (isAdmin) return <Navigate to="/admin" replace />
  return children
}

// Khusus buat halaman /trial-habis -- butuh login (biar tau siapa yang
// mau di-lock), tapi SENGAJA nggak lewat ProtectedRoute (yang otomatis
// nge-redirect ke /trial-habis kalau isLocked) -- kalau ikut lewat situ,
// muter-muter redirect ke diri sendiri terus (infinite loop).
function TrialGateRoute({ children }) {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div style={{
        minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontFamily: "'Plus Jakarta Sans', sans-serif", color: '#8B8299'
      }}>
        Memuat...
      </div>
    )
  }

  if (!user) return <Navigate to="/login" replace />
  return children
}

// Kebalikan dari ProtectedRoute -- buat halaman publik (Landing, Login,
// Register) yang seharusnya nggak perlu dibuka lagi kalau user udah login.
// Kalau ternyata masih ada sesi aktif, langsung lempar ke Dashboard.
function GuestRoute({ children }) {
  const { user, loading, isAdmin } = useAuth()

  if (loading) {
    return (
      <div style={{
        minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontFamily: "'Plus Jakarta Sans', sans-serif", color: '#8B8299'
      }}>
        Memuat...
      </div>
    )
  }

  if (user) return <Navigate to={isAdmin ? '/admin' : '/dashboard'} replace />
  return children
}

// Guard KHUSUS /admin -- 2 lapis: pertama numpang syarat yang SAMA
// kayak ProtectedRoute (harus login, nggak lagi kekunci trial), KEDUA
// (yang baru) harus isAdmin juga. User biasa yang somehow nyasar ke
// /admin (nyoba ketik manual URL-nya) dilempar diem-diem ke /dashboard
// -- BUKAN ditampilin pesan error "akses ditolak" segala, biar nggak
// malah "ngajarin" ada halaman rahasia di situ.
function AdminRoute({ children }) {
  const { user, loading, isLocked, isAdmin } = useAuth()

  if (loading) {
    return (
      <div style={{
        minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontFamily: "'Plus Jakarta Sans', sans-serif", color: '#8B8299'
      }}>
        Memuat...
      </div>
    )
  }

  if (!user) return <Navigate to="/login" replace />
  if (isLocked) return <Navigate to="/trial-habis" replace />
  if (!isAdmin) return <Navigate to="/dashboard" replace />
  return children
}

export default function App() {
  return (
    <ThemeProvider>
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/" element={<GuestRoute><Landing /></GuestRoute>} />
            <Route path="/login" element={<GuestRoute><Login /></GuestRoute>} />
            <Route path="/register" element={<GuestRoute><Register /></GuestRoute>} />
            <Route path="/lupa-password" element={<LupaPassword />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route
              path="/trial-habis"
              element={
                <TrialGateRoute>
                  <TrialHabis />
                </TrialGateRoute>
              }
            />
            <Route
              path="/dashboard"
              element={
                <ProtectedRoute>
                  <Dashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/booking"
              element={
                <ProtectedRoute>
                  <BookingList />
                </ProtectedRoute>
              }
            />
            <Route
              path="/kalender"
              element={
                <ProtectedRoute>
                  <Kalender />
                </ProtectedRoute>
              }
            />
            <Route
              path="/klien"
              element={
                <ProtectedRoute>
                  <Klien />
                </ProtectedRoute>
              }
            />
            <Route
              path="/keuangan"
              element={
                <ProtectedRoute>
                  <Keuangan />
                </ProtectedRoute>
              }
            />
            <Route
              path="/laporan"
              element={
                <ProtectedRoute>
                  <Laporan />
                </ProtectedRoute>
              }
            />
            <Route
              path="/pengaturan"
              element={
                <ProtectedRoute>
                  <Pengaturan />
                </ProtectedRoute>
              }
            />
            <Route
              path="/panduan"
              element={
                <ProtectedRoute>
                  <Panduan />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin"
              element={
                <AdminRoute>
                  <AdminDashboard />
                </AdminRoute>
              }
            />
            <Route
              path="/admin/users"
              element={
                <AdminRoute>
                  <AdminUsers />
                </AdminRoute>
              }
            />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </ThemeProvider>
  )
}
