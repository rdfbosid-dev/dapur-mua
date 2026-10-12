import { useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import ThemeToggleButton from '../components/ThemeToggleButton'
import { useTheme } from '../context/ThemeContext'
import './Auth.css'
import { cekPassword, pesanErrorPassword, PETUNJUK_PASSWORD } from '../lib/aturanPassword'

export default function Register() {
  const { theme } = useTheme()
  const logoSrc = theme === 'dark' ? '/icon-512-dark.png' : '/icon-512-light.png'
  const [studioName, setStudioName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)

    const masalahPassword = cekPassword(password)
    if (masalahPassword) {
      setError(masalahPassword)
      setLoading(false)
      return
    }

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { studio_name: studioName.trim() } },
    })

    if (error) {
      setLoading(false)
      setError(pesanErrorPassword(error))
      return
    }

    // Supabase SENGAJA nggak ngasih error kalau signUp() dipanggil pakai
    // email yang udah kedaftar & udah konfirmasi -- ini demi keamanan
    // (biar orang nggak bisa "nebak" email mana aja yang udah kedaftar
    // di sistem). Tapi ada sinyal buat bedainnya: kalau `identities`
    // kosong ([]), itu tandanya BUKAN akun baru -- email-nya emang
    // udah ada, dan nggak ada email konfirmasi apapun yang beneran
    // terkirim barusan.
    if (data.user && data.user.identities && data.user.identities.length === 0) {
      setLoading(false)
      setError('Email ini udah terdaftar. Coba masuk, atau pakai "Lupa kata sandi?" kalau lupa kata sandinya.')
      return
    }

    // Nama brand udah dititipin lewat `options.data` pas signUp() di atas
    // (lihat metadata studio_name), diambil sama trigger `handle_new_user`
    // pas baris profiles-nya dibikin. SENGAJA nggak nulis ulang ke tabel
    // profiles di sini kayak sebelumnya -- soalnya di titik ini user
    // BELUM PUNYA SESI LOGIN AKTIF (emailnya belum dikonfirmasi), jadi
    // tulisan langsung ke `profiles` bakal ke-block RLS (gagal diam-diam,
    // itu kenapa dulu nama brand keliatan nggak kesimpen).

    setLoading(false)
    setSuccess(true)
  }

  if (success) {
    return (
      <div className="auth-page">
      <div className="auth-page-toggle"><ThemeToggleButton /></div>
        <div className="auth-card">
          <div className="auth-brand">
            <div className="auth-brand-mark"><img src={logoSrc} alt="Dapur MUA" /></div>
            <div className="auth-brand-name">Dapur MUA</div>
          </div>
          <div className="auth-title">Cek email kamu 📩</div>
          <div className="auth-subtitle">
            Kami udah kirim link konfirmasi ke <b>{email}</b>. Klik link itu dulu,
            baru kamu bisa login.
          </div>
          <div className="auth-switch">
            <Link to="/login">Kembali ke halaman masuk</Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="auth-page">
      <div className="auth-page-toggle"><ThemeToggleButton /></div>
      <div className="auth-card">
        <div className="auth-brand">
          <div className="auth-brand-mark"><img src={logoSrc} alt="Dapur MUA" /></div>
          <div className="auth-brand-name">Dapur MUA</div>
        </div>

        <div className="auth-title">Buat Akun Baru</div>
        <div className="auth-subtitle">Mulai kelola dashboard MUA cukup dalam 1 menit</div>

        {error && <div className="auth-error">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="auth-field">
            <div className="auth-field-control">
              <input
                id="register-studio"
                name="organization"
                type="text"
                value={studioName}
                onChange={(e) => setStudioName(e.target.value)}
                placeholder=" "
                autoComplete="organization"
              />
              <label htmlFor="register-studio">Nama Brand MUA</label>
            </div>
          </div>
          <div className="auth-field">
            <div className="auth-field-control">
              <input
                id="register-email"
                name="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder=" "
                autoComplete="email"
                required
              />
              <label htmlFor="register-email">Email</label>
            </div>
          </div>
          <div className="auth-field">
            <div className="auth-field-control auth-field-control--pw">
              <input
                id="register-password"
                aria-describedby="register-password-petunjuk"
                name="password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder=" "
                autoComplete="new-password"
                required
              />
              <label htmlFor="register-password">Kata sandi</label>
              <button
                type="button"
                className="auth-toggle-pw"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? 'Sembunyikan kata sandi' : 'Tampilkan kata sandi'}
              >
                {showPassword ? (
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17.94 17.94A10.94 10.94 0 0 1 12 20c-7 0-11-8-11-8a18.5 18.5 0 0 1 5.06-5.94M9.9 4.24A10.94 10.94 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19M14.12 14.12a3 3 0 1 1-4.24-4.24" /><path d="M1 1l22 22" /></svg>
                ) : (
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>
                )}
              </button>
            </div>
            <div className="auth-hint" id="register-password-petunjuk">{PETUNJUK_PASSWORD}</div>
          </div>
          <button className="auth-btn" type="submit" disabled={loading}>
            {loading ? 'Memproses...' : 'Daftar'}
          </button>
        </form>

        <div className="auth-switch">
          Udah punya akun? <Link to="/login">Masuk di sini</Link>
        </div>
      </div>
    </div>
  )
}
