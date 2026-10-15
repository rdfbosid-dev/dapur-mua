import './Toast.css'

// Notifikasi singkat (toast) yang SAMA di semua halaman: Dashboard, Booking,
// Kalender, Permintaan Booking. Posisi & warnanya diatur di Toast.css -- ubah
// di sana sekali, semua halaman ikut. Teks kosong = toast nggak tampil.
// Pasangannya: useToast() di lib/useToast.js (ngatur munculkan & hilang
// otomatis setelah beberapa detik).
export default function Toast({ teks }) {
  if (!teks) return null
  return <div className="toast-app" role="status" aria-live="polite">{teks}</div>
}
