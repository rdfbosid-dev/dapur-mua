import { useCallback, useEffect, useRef, useState } from 'react'

// Pasangan components/Toast.jsx: `const [toast, tampilkanToast] = useToast()`
// lalu render `<Toast teks={toast} />`. Toast hilang sendiri setelah `durasi`
// ms. Kalau ada toast baru sebelum yang lama hilang, hitungannya diulang
// (toast baru nggak ikut ketutup timer toast lama), & timer dibersihkan
// waktu halaman ditinggal.
export function useToast(durasi = 4000) {
  const [teks, setTeks] = useState('')
  const timer = useRef(null)
  const tampilkan = useCallback((isi) => {
    clearTimeout(timer.current)
    setTeks(isi)
    timer.current = setTimeout(() => setTeks(''), durasi)
  }, [durasi])
  useEffect(() => () => clearTimeout(timer.current), [])
  return [teks, tampilkan]
}
