import { Component } from 'react'
import { resetLaluMuatUlang } from '../lib/pulihkanAplikasi'

// Pelindung error -- kalau SATU halaman error saat digambar, React biasanya
// membuang SELURUH tampilan dan hasilnya layar kosong tanpa petunjuk apa pun.
// Komponen ini menangkap error itu dan menampilkan layar darurat: pesan yang
// jelas + tombol "Muat ulang", "Ke Dashboard", dan "Reset aplikasi".
//
// SENGAJA nggak numpang CSS/tema aplikasi (semua gaya inline, latar penuh
// layar sendiri) -- karena errornya bisa aja justru dari CSS/tema, dan layar
// darurat ini harus tetap kebaca apa pun yang rusak.
//
// Cuma menangkap error saat MENGGAMBAR (render). Kasus aplikasi gagal dimuat
// sama sekali (React belum sempat jalan) ditangani penjaga startup di
// index.html.
const gaya = {
  layar: {
    position: 'fixed', inset: 0, zIndex: 100000, background: '#1f2433', overflowY: 'auto',
    display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
    fontFamily: "'Plus Jakarta Sans', system-ui, -apple-system, sans-serif",
  },
  kartu: {
    background: '#ffffff', color: '#24203a', borderRadius: 18, padding: '26px 22px',
    maxWidth: 420, width: '100%', boxShadow: '0 20px 50px -12px rgba(0,0,0,0.5)', boxSizing: 'border-box',
  },
  judul: { fontSize: 18, fontWeight: 700, margin: '0 0 8px' },
  teks: { fontSize: 14, lineHeight: 1.55, margin: '0 0 18px', color: '#4a4560' },
  baris: { display: 'flex', flexDirection: 'column', gap: 10 },
  tombolUtama: {
    background: '#5b68bb', color: '#fff', border: 'none', borderRadius: 12, padding: '12px 16px',
    fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
  },
  tombolSekunder: {
    background: '#eceaf6', color: '#3b3670', border: 'none', borderRadius: 12, padding: '12px 16px',
    fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
  },
  tautan: {
    background: 'none', border: 'none', color: '#6a6485', fontSize: 12.5, textDecoration: 'underline',
    cursor: 'pointer', marginTop: 14, padding: 0, fontFamily: 'inherit',
  },
  detail: { marginTop: 14, fontSize: 12, color: '#6a6485' },
  pre: {
    background: '#f3f2f9', borderRadius: 8, padding: 10, marginTop: 8, whiteSpace: 'pre-wrap',
    wordBreak: 'break-word', fontSize: 11.5, color: '#3b3670', maxHeight: 140, overflowY: 'auto',
  },
}

export default class ErrorBoundary extends Component {
  state = { error: null, sibuk: false }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    // Tetap dicatat di console -- berguna kalau dibuka lewat Web Inspector.
    console.error('[Dapur MUA] Halaman gagal ditampilkan:', error, info?.componentStack)
  }

  jalankanReset = async (lengkap) => {
    this.setState({ sibuk: true })
    await resetLaluMuatUlang({ lengkap })
    this.setState({ sibuk: false }) // cuma kejadian kalau user membatalkan konfirmasi
  }

  render() {
    if (!this.state.error) return this.props.children
    const { error, sibuk } = this.state
    const pesan = String(error?.message || error || 'Error tidak diketahui')
    return (
      <div style={gaya.layar} role="alert" data-pemulih="error-boundary">
        <div style={gaya.kartu}>
          <h1 style={gaya.judul}>Halaman ini gagal ditampilkan</h1>
          <p style={gaya.teks}>
            Maaf, ada kendala saat membuka halaman. Coba muat ulang dulu. Kalau masih bermasalah, tekan
            {' '}<b>Reset aplikasi</b>. Data kamu tetap aman di server.
          </p>
          <div style={gaya.baris}>
            <button type="button" style={gaya.tombolUtama} disabled={sibuk} onClick={() => window.location.reload()}>
              Muat ulang
            </button>
            <button type="button" style={gaya.tombolSekunder} disabled={sibuk} onClick={() => { window.location.href = '/dashboard' }}>
              Ke Dashboard
            </button>
            <button type="button" style={gaya.tombolSekunder} disabled={sibuk} onClick={() => this.jalankanReset(false)}>
              {sibuk ? 'Mereset...' : 'Reset aplikasi'}
            </button>
          </div>
          <details style={gaya.detail}>
            <summary>Detail teknis (untuk dikirim ke admin)</summary>
            <pre style={gaya.pre}>{pesan}</pre>
          </details>
          <button type="button" style={gaya.tautan} disabled={sibuk} onClick={() => this.jalankanReset(true)}>
            Masih bermasalah? Reset lengkap (perlu login ulang)
          </button>
        </div>
      </div>
    )
  }
}
