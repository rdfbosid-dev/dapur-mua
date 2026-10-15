import { useEffect, useRef } from 'react'
import { supabase } from './supabase'

// PANTAU PERMINTAAN BOOKING TANPA REFRESH -- dipakai Sidebar (angka di menu),
// halaman Permintaan Booking (kartu), & Dashboard (lonceng).
//
// 2 jalur (gabungan):
// 1. Supabase Realtime: begitu ada permintaan MASUK (INSERT) atau BERUBAH
//    (UPDATE, misal diterima dari HP lain), semua yang mendengarkan dikabari.
//    Butuh SQL migrasi-realtime-permintaan.sql (tabel masuk publikasi
//    supabase_realtime). Realtime ikut RLS "Lihat permintaan sendiri", jadi
//    tiap MUA cuma dikabari permintaan MILIKNYA; filter user_id di bawah
//    pengaman lapis kedua. Isi kabarnya SENGAJA nggak dipakai -- pendengar
//    cuma memuat ulang datanya lewat query biasa (yang juga lewat RLS).
//    DELETE SENGAJA nggak didengarkan (event hapus nggak bisa difilter RLS).
// 2. Cadangan: cek ulang waktu aplikasi/tab dibuka lagi (balik dari WhatsApp,
//    HP bangun dari tidur), waktu internet nyambung lagi, & tiap 60 detik
//    SELAMA koneksi realtime lagi putus / SQL-nya belum dijalankan.
//
// Cuma 1 koneksi untuk seluruh aplikasi, berapapun komponen yang mendengarkan.
// Waktu pindah halaman (Sidebar dilepas lalu dipasang lagi) koneksinya nggak
// diputus-sambung: baru ditutup kalau 5 detik nggak ada pendengar sama sekali.

const JEDA_KABAR = 400 // ms -- beberapa kabar beruntun digabung jadi 1 muat ulang
const JEDA_POLLING = 60000 // ms -- cuma jalan selama realtime nggak tersambung
const JEDA_TUTUP = 5000 // ms

const pendengar = new Set()
let uidAktif = null
let saluran = null
let tersambung = false
let pernahTersambung = false
let timerKabar = null
let timerPolling = null
let timerTutup = null

function kabari() {
  clearTimeout(timerKabar)
  timerKabar = setTimeout(() => { pendengar.forEach((fn) => { try { fn() } catch { /* satu pendengar error, yang lain tetap jalan */ } }) }, JEDA_KABAR)
}

function saatTerlihat() {
  if (document.visibilityState === 'visible') kabari()
}

function aturPolling() {
  clearInterval(timerPolling)
  timerPolling = null
  if (!tersambung && uidAktif) {
    timerPolling = setInterval(() => { if (document.visibilityState === 'visible') kabari() }, JEDA_POLLING)
  }
}

function buka(uid) {
  uidAktif = uid
  tersambung = false
  pernahTersambung = false
  try {
    saluran = supabase
      .channel(`permintaan-${uid}-${Date.now()}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'permintaan_booking', filter: `user_id=eq.${uid}` }, kabari)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'permintaan_booking', filter: `user_id=eq.${uid}` }, kabari)
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          // Sambung ULANG setelah putus: mungkin ada yang kelewat, cek sekali.
          if (pernahTersambung) kabari()
          tersambung = true
          pernahTersambung = true
        } else {
          tersambung = false
        }
        aturPolling()
      })
  } catch {
    saluran = null
  }
  aturPolling()
  document.addEventListener('visibilitychange', saatTerlihat)
  window.addEventListener('focus', saatTerlihat)
  window.addEventListener('online', kabari)
}

function tutup() {
  clearTimeout(timerKabar)
  clearInterval(timerPolling)
  timerPolling = null
  document.removeEventListener('visibilitychange', saatTerlihat)
  window.removeEventListener('focus', saatTerlihat)
  window.removeEventListener('online', kabari)
  if (saluran) { try { supabase.removeChannel(saluran) } catch { /* sudah tertutup */ } }
  saluran = null
  uidAktif = null
  tersambung = false
}

// Daftar pendengar. Mengembalikan fungsi untuk berhenti mendengarkan.
export function dengarkanPermintaan(uid, fn) {
  if (!uid) return () => {}
  clearTimeout(timerTutup)
  // Ganti akun (keluar lalu masuk akun lain): koneksi lama ditutup dulu,
  // pendengar milik akun lama dibuang.
  if (uidAktif && uidAktif !== uid) { tutup(); pendengar.clear() }
  if (!uidAktif) buka(uid)
  pendengar.add(fn)
  return () => {
    pendengar.delete(fn)
    if (pendengar.size === 0) {
      clearTimeout(timerTutup)
      timerTutup = setTimeout(() => { if (pendengar.size === 0) tutup() }, JEDA_TUTUP)
    }
  }
}

// Hook: panggil `onBerubah` tiap ada permintaan masuk/berubah (atau waktu
// aplikasi dibuka lagi). uid kosong (belum login / admin) -> nggak ngapa-ngapain.
export function usePantauPermintaan(uid, onBerubah) {
  const ref = useRef(onBerubah)
  useEffect(() => { ref.current = onBerubah })
  useEffect(() => {
    if (!uid) return undefined
    return dengarkanPermintaan(uid, () => ref.current?.())
  }, [uid])
}
