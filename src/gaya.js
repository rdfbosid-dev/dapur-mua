// SEMUA file CSS aplikasi, dimuat SEKALI di awal dengan URUTAN TETAP.
//
// Kenapa: JavaScript tiap halaman sekarang dimuat terpisah (lihat
// lib/muatHalaman.js), tapi CSS-nya SENGAJA tetap jadi 1 file (vite.config.js:
// cssCodeSplit false). Banyak class CSS dipakai lintas halaman/komponen, dan
// kalau dua aturan sama kuat, yang menang adalah yang ditulis BELAKANGAN --
// jadi urutannya harus sama persis seperti sebelum dipecah. Daftar di bawah
// diambil dari urutan build sebelum code splitting.
//
// Nambah halaman/komponen baru yang punya file CSS sendiri? Tetap import CSS-nya
// di file komponennya seperti biasa (tetap jalan). Tambahkan juga di sini kalau
// mau posisinya pasti; kalau nggak, CSS-nya otomatis ditaruh paling akhir.
import './components/ThemeToggleButton.css'
import './pages/Auth.css'
import './pages/Landing.css'
import './components/Sidebar.css'
import './components/Permintaan.css'
import './components/CustomSelect.css'
import './components/CustomDatePicker.css'
import './components/PeringatanKewajaran.css'
import './components/BookingModal.css'
import './lib/statusPembayaran.css'
import './components/PilihLayanan.css'
import './components/DiskonBooking.css'
import './components/PilihPaketRambut.css'
import './components/Toast.css'
import './components/BookingDetailModal.css'
import './components/InvoiceModal.css'
import './components/RemittanceAdviceModal.css'
import './components/RincianKeuanganModal.css'
import './components/OnboardingModal.css'
import './components/PembaruanModal.css'
import './components/DonutChart.css'
import './components/TrendChart.css'
import './pages/Dashboard.css'
import './pages/BookingList.css'
import './components/PengeluaranModal.css'
import './components/NotaPengeluaranModal.css'
import './components/PengeluaranDetailModal.css'
import './pages/Kalender.css'
import './pages/Klien.css'
import './pages/Pengeluaran.css'
import './components/LayananModal.css'
import './pages/Layanan.css'
import './components/MonthlyBarChart.css'
import './pages/Keuangan.css'
import './pages/Laporan.css'
import './pages/Pengaturan.css'
import './pages/Langganan.css'
import './pages/Panduan.css'
import './pages/AdminDashboard.css'
import './pages/AdminUsers.css'
import './pages/AdminLangganan.css'
import './components/PasangAplikasi.css'
import './pages/BookingOnline.css'
import './pages/PermintaanBooking.css'
