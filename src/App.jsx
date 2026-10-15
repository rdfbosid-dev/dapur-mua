import { Suspense } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import { ThemeProvider } from './context/ThemeContext'
import PasangAplikasi from './components/PasangAplikasi'
import { muatHalaman } from './lib/muatHalaman'

// Tiap halaman dimuat TERPISAH, baru diunduh waktu dibuka (lihat
// lib/muatHalaman.js) -- pembukaan pertama aplikasi & link booking online
// jauh lebih ringan.
const Login = muatHalaman(() => import('./pages/Login'))
const Register = muatHalaman(() => import('./pages/Register'))
const Landing = muatHalaman(() => import('./pages/Landing'))
const LupaPassword = muatHalaman(() => import('./pages/LupaPassword'))
const ResetPassword = muatHalaman(() => import('./pages/ResetPassword'))
const Dashboard = muatHalaman(() => import('./pages/Dashboard'))
const BookingList = muatHalaman(() => import('./pages/BookingList'))
const Kalender = muatHalaman(() => import('./pages/Kalender'))
const Klien = muatHalaman(() => import('./pages/Klien'))
const Pengeluaran = muatHalaman(() => import('./pages/Pengeluaran'))
const Layanan = muatHalaman(() => import('./pages/Layanan'))
const Keuangan = muatHalaman(() => import('./pages/Keuangan'))
const Laporan = muatHalaman(() => import('./pages/Laporan'))
const Pengaturan = muatHalaman(() => import('./pages/Pengaturan'))
const Langganan = muatHalaman(() => import('./pages/Langganan'))
const TrialHabis = muatHalaman(() => import('./pages/TrialHabis'))
const Panduan = muatHalaman(() => import('./pages/Panduan'))
const AdminDashboard = muatHalaman(() => import('./pages/AdminDashboard'))
const AdminUsers = muatHalaman(() => import('./pages/AdminUsers'))
const AdminLangganan = muatHalaman(() => import('./pages/AdminLangganan'))
const BookingOnline = muatHalaman(() => import('./pages/BookingOnline'))
const PermintaanBooking = muatHalaman(() => import('./pages/PermintaanBooking'))

// Tampilan sementara selama file halaman diunduh -- SAMA dengan tampilan
// "Memuat ...." di penjaga rute di bawah.
function MemuatHalaman() {
  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: "'Plus Jakarta Sans', sans-serif", color: '#8B8299'
    }}>
      Memuat ....
    </div>
  )
}

function ProtectedRoute({ children }) {
  const { user, loading, isLocked, isAdmin } = useAuth()

  if (loading) {
    return (
      <div style={{
        minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontFamily: "'Plus Jakarta Sans', sans-serif", color: '#8B8299'
      }}>
        Memuat ....
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
        Memuat ....
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
        Memuat ....
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
        Memuat ....
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
          <Suspense fallback={<MemuatHalaman />}>
          <Routes>
            <Route path="/" element={<GuestRoute><Landing /></GuestRoute>} />
            <Route path="/login" element={<GuestRoute><Login /></GuestRoute>} />
            <Route path="/register" element={<GuestRoute><Register /></GuestRoute>} />
            <Route path="/lupa-password" element={<LupaPassword />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            {/* Link booking online -- PUBLIK (tanpa login, tanpa guard apa pun):
                dibuka calon klien. Data yang tampil diatur fungsi database. */}
            <Route path="/b/:slug" element={<BookingOnline />} />
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
              path="/pengeluaran"
              element={
                <ProtectedRoute>
                  <Pengeluaran />
                </ProtectedRoute>
              }
            />
            <Route
              path="/layanan"
              element={
                <ProtectedRoute>
                  <Layanan />
                </ProtectedRoute>
              }
            />
            <Route
              path="/permintaan"
              element={
                <ProtectedRoute>
                  <PermintaanBooking />
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
            {/* SENGAJA numpang TrialGateRoute (bukan ProtectedRoute) --
                halaman ini justru paling dibutuhin sama user yang LAGI
                isLocked (trial/langganan abis, mau bayar buat buka
                kunci). ProtectedRoute otomatis nolak/ngelempar user
                isLocked ke /trial-habis buat SEMUA rute lain -- kalau
                dipasang di sini juga, orangnya nggak akan PERNAH bisa
                nyampe halaman ini pas paling butuh. */}
            <Route
              path="/langganan"
              element={
                <TrialGateRoute>
                  <Langganan />
                </TrialGateRoute>
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
            <Route
              path="/admin/langganan"
              element={
                <AdminRoute>
                  <AdminLangganan />
                </AdminRoute>
              }
            />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
          </Suspense>
          {/* Banner ajakan pasang aplikasi -- di dalam AuthProvider karena
              cuma muncul buat user yang sudah login. */}
          <PasangAplikasi />
        </AuthProvider>
      </BrowserRouter>
    </ThemeProvider>
  )
}
