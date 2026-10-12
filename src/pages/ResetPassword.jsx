import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import ThemeToggleButton from '../components/ThemeToggleButton'
import { useTheme } from '../context/ThemeContext'
import './Auth.css'
import { cekPassword, pesanErrorPassword, PETUNJUK_PASSWORD } from '../lib/aturanPassword'

export default function ResetPassword() {
  const { theme } = useTheme()
  const logoSrc = theme === 'dark' ? '/icon-512-dark.png' : '/icon-512-light.png'
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)
  const navigate = useNavigate()

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')

    const masalahPassword = cekPassword(password)
    if (masalahPassword) {
      setError(masalahPassword)
      return
    }
    if (password !== confirmPassword) {
      setError('Kata sandi dan konfirmasinya nggak sama.')
      return
    }

    setLoading(true)
    const { error } = await supabase.auth.updateUser({ password })
    setLoading(false)

    if (error) {
      setError(
        error.message.includes('session')
          ? 'Link reset udah nggak berlaku atau kadaluarsa. Coba minta link baru lagi.'
          : pesanErrorPassword(error)
      )
      return
    }
    setDone(true)
  }

  if (done) {
    return (
      <div className="auth-page">
      <div className="auth-page-toggle"><ThemeToggleButton /></div>
        <div className="auth-card">
          <div className="auth-brand">
            <div className="auth-brand-mark"><img src={logoSrc} alt="Dapur MUA" /></div>
            <div className="auth-brand-name">Dapur MUA</div>
          </div>
          <div className="auth-title">Kata sandi berhasil diubah ✅</div>
          <div className="auth-subtitle">Kamu sekarang bisa masuk pakai kata sandi barumu.</div>
          <button className="auth-btn" onClick={() => navigate('/dashboard')}>Lanjut ke Dashboard</button>
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

        <div className="auth-title">Bikin kata sandi baru</div>
        <div className="auth-subtitle">Pastiin kata sandi barumu aman dan gampang diinget.</div>

        {error && <div className="auth-error">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="auth-field">
            <div className="auth-field-control auth-field-control--pw">
              <input
                id="reset-password"
                aria-describedby="reset-password-petunjuk"
                name="new-password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder=" "
                autoComplete="new-password"
                required
              />
              <label htmlFor="reset-password">Kata sandi baru</label>
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
            <div className="auth-hint" id="reset-password-petunjuk">{PETUNJUK_PASSWORD}</div>
          </div>
          <div className="auth-field">
            <div className="auth-field-control auth-field-control--pw">
              <input
                id="reset-confirm-password"
                name="confirm-password"
                type={showConfirmPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder=" "
                autoComplete="new-password"
                required
              />
              <label htmlFor="reset-confirm-password">Konfirmasi kata sandi</label>
              <button
                type="button"
                className="auth-toggle-pw"
                onClick={() => setShowConfirmPassword((v) => !v)}
                aria-label={showConfirmPassword ? 'Sembunyikan kata sandi' : 'Tampilkan kata sandi'}
              >
                {showConfirmPassword ? (
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17.94 17.94A10.94 10.94 0 0 1 12 20c-7 0-11-8-11-8a18.5 18.5 0 0 1 5.06-5.94M9.9 4.24A10.94 10.94 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19M14.12 14.12a3 3 0 1 1-4.24-4.24" /><path d="M1 1l22 22" /></svg>
                ) : (
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>
                )}
              </button>
            </div>
          </div>
          <button className="auth-btn" type="submit" disabled={loading}>
            {loading ? 'Menyimpan...' : 'Simpan Kata Sandi Baru'}
          </button>
        </form>

        <div className="auth-switch">
          <Link to="/login">← Kembali ke halaman masuk</Link>
        </div>
      </div>
    </div>
  )
}
