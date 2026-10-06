import { useState } from 'react'
import Sidebar from '../components/Sidebar'
import './Panduan.css'

const LANGKAH = [
  {
    title: 'Daftar & Masuk',
    ringkas: 'Bikin akun gratis, langsung dapet dashboard sendiri.',
    isi: [
      'Buka halaman daftar, isi email & kata sandi (minimal 6 karakter). Nama Brand MUA boleh dikosongin dulu, bisa diisi belakangan di Pengaturan.',
      'Cek email kamu, ada link konfirmasi yang WAJIB diklik dulu sebelum bisa login.',
      'Setelah email dikonfirmasi, login pakai email & kata sandi yang sama.',
      'Akun baru otomatis dapat masa coba gratis 7 hari, akses penuh ke semua fitur.',
    ],
  },
  {
    title: 'Lengkapi Profil',
    ringkas: 'Logo, nama brand, kode prefix booking, kontak.',
    isi: [
      'Buka menu Pengaturan di sidebar kiri.',
      'Upload logo brand (klik kotak logo atau tombol "Ganti Logo") dengan file format JPG/PNG, maksimal 2MB.',
      'Isi Nama Brand MUA (ini yang bakal muncul di invoice & sidebar), Kode Prefix Booking (buat kode otomatis kayak "Book-0001"), Instagram, dan Nomor WhatsApp.',
      'Klik "Simpan Perubahan". Data ini otomatis kepake di semua invoice yang kamu kirim ke klien.',
    ],
  },
  {
    title: 'Tambah Booking Pertama',
    ringkas: 'Isi data klien, tanggal acara, dan layanan.',
    isi: [
      'Buka menu Booking, klik tombol "Booking Baru".',
      'Isi data klien (bisa lebih dari 1 klien dalam 1 booking, misal buat bridesmaid), tanggal & jam acara, event, lokasi, dan layanan makeup per klien.',
      'Isi juga biaya transport (kalau ada) dan catatan pembayaran (DP/pelunasan).',
      'Simpan. Data booking otomatis muncul di Dashboard, Kalender, dan Laporan.',
    ],
  },
  {
    title: 'Baca Dashboard & Laporan',
    ringkas: 'Pantau omzet, penghasilan, dan progres bisnis.',
    isi: [
      'Dashboard nunjukkin ringkasan cepat: booking mendatang, penghasilan bulan ini, dan tren omzet.',
      'Menu Keuangan nunjukkin rekap bulanan sepanjang tahun mulai dari omzet, transport, dan komisi.',
      'Menu Laporan nunjukkin insight lebih dalam: jenis event makeup, sumber booking (Instagram/WhatsApp/dll), dan jenis paket favorit.',
      'Semua angka di halaman-halaman ini terhitung OTOMATIS dari data booking yang udah kamu input, jadi nggak perlu catat manual di tempat lain.',
    ],
  },
  {
    title: 'Catat Pengeluaran Bisnis',
    ringkas: 'Belanja alat, kosmetik, iklan, dan biaya bisnis lainnya.',
    isi: [
      'Buka menu Pengeluaran, klik tombol "+ Pengeluaran". Pilih kategori (misalnya Belanja Alat & Kosmetik), isi tanggal, lalu rincian item yang dibeli.',
      'Bayar ke tim/vendor untuk sebuah booking tidak perlu dicatat di sini, karena sudah otomatis dihitung dari data booking.',
      'Di menu Keuangan, Pengeluaran Booking dan Pengeluaran Bisnis ditampilkan terpisah dan tidak dijumlahkan. Dapur MUA tidak menghitung Laba Bersih untukmu. Untuk perkiraan kasar, Laba Bersih ≈ Penghasilan − Pengeluaran Bisnis.',
      'Hati-hati dengan barang yang kamu jual lagi ke klien lewat Add On (Beli): modalnya sudah terpotong dari Penghasilan. Kalau pembelian barang yang sama juga kamu catat di Pengeluaran Bisnis, modalnya terhitung dua kali.',
    ],
  },
  {
    title: 'Sinkronisasi Kalender ke HP',
    ringkas: 'Jadwal booking otomatis muncul di kalender HP-mu.',
    isi: [
      'Buka menu Kalender, klik banner "Hubungkan Kalender HP" di bagian atas.',
      'Klik "Salin Link", terus tempel link itu di app Kalender HP kamu (Google Calendar lewat web, atau Kalender iPhone) lewat menu "Subscribe from URL"/"Tambah kalender lain".',
      'Semua jadwal booking otomatis muncul di kalender HP kamu, dan terupdate sendiri tiap ada booking baru, jadi nggak perlu subscribe ulang.',
    ],
  },
  {
    title: 'Kirim Invoice ke Klien',
    ringkas: 'Invoice rapi, langsung kekirim ke WhatsApp klien.',
    isi: [
      'Buka detail booking (klik booking-nya di menu Booking atau Kalender), cari tombol "Lihat Invoice".',
      'Invoice otomatis berdasarkan data booking, lengkap dengan rincian layanan, total tagihan, sudah dibayar, dan sisa tagihan.',
      'Klik "Kirim ke WhatsApp" buat langsung ngirim ke nomor klien, atau "Cetak/Simpan PDF" buat diarsipin.',
    ],
  },
]

export default function Panduan() {
  const [openIndex, setOpenIndex] = useState(0)

  function toggle(i) {
    setOpenIndex((cur) => (cur === i ? -1 : i))
  }

  return (
    <div className="app-shell">
      <Sidebar />
      <div className="main">
        <div className="topbar">
          <div>
            <div className="greeting">Panduan Penggunaan</div>
            <div className="greeting-date">Dari daftar akun sampai kirim invoice, langkah demi langkah</div>
          </div>
        </div>

        <div className="panduan-card">
          {LANGKAH.map((l, i) => {
            const open = openIndex === i
            return (
              <div className={`panduan-step${open ? ' open' : ''}`} key={l.title}>
                <button type="button" className="panduan-step-head" onClick={() => toggle(i)}>
                  <span className="panduan-step-num">{i + 1}</span>
                  <span className="panduan-step-head-text">
                    <span className="panduan-step-title">{l.title}</span>
                    <span className="panduan-step-ringkas">{l.ringkas}</span>
                  </span>
                  <svg className="panduan-step-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 9l6 6 6-6" /></svg>
                </button>
                {open && (
                  <div className="panduan-step-body">
                    <ol>
                      {l.isi.map((paragraf, j) => <li key={j}>{paragraf}</li>)}
                    </ol>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
