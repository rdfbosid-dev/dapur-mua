// Aturan kata sandi -- HARUS sama dengan pengaturan Supabase Auth
// (Authentication -> Sign In / Providers -> Email):
//   Minimum password length : 8
//   Password requirements   : letters and digits (huruf apa saja + angka)
// Kalau pengaturan di Supabase diubah, ubah juga file ini, biar user dapat
// pesan berbahasa Indonesia SEBELUM ditolak server (bukan pesan Inggris dari
// Supabase). Dipakai di Register.jsx & ResetPassword.jsx.

export const PANJANG_MIN_PASSWORD = 8

// Teks petunjuk di bawah kolom kata sandi (Daftar & Buat Kata Sandi Baru).
export const PETUNJUK_PASSWORD = `Minimal ${PANJANG_MIN_PASSWORD} karakter, berisi huruf dan angka.`

// '' kalau kata sandi memenuhi aturan, kalau tidak: pesan kesalahannya.
export function cekPassword(password) {
  const pw = String(password || '')
  if (pw.length < PANJANG_MIN_PASSWORD) return `Kata sandi minimal ${PANJANG_MIN_PASSWORD} karakter, berisi huruf dan angka.`
  if (!/[A-Za-z]/.test(pw) || !/\d/.test(pw)) return 'Kata sandi harus berisi huruf dan angka (contoh: riasan2026).'
  return ''
}

// Terjemahkan penolakan "kata sandi lemah" dari Supabase (jaga-jaga kalau
// aturan di server lebih ketat dari cekPassword di atas). Pesan lain apa adanya.
export function pesanErrorPassword(error) {
  if (!error) return ''
  const pesan = String(error.message || '')
  if (error.code === 'weak_password' || /password should|weak password/i.test(pesan)) {
    return `Kata sandi terlalu lemah. Gunakan minimal ${PANJANG_MIN_PASSWORD} karakter yang berisi huruf dan angka.`
  }
  return pesan
}
