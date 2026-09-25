import { useCallback, useRef, useState } from 'react'

// Hook buat animasi chart yang jalan tiap elemen masuk viewport (scroll
// down -> kelihatan -> animasi jalan; scroll ke tempat lain -> keluar
// viewport -> scroll balik lagi -> animasi jalan LAGI). BEDA dari pola
// lama (animasi cuma jalan SEKALI pas data kelar dimuat) -- itu
// masalahnya chart yang posisinya di bawah (belum kelihatan pas
// halaman baru dibuka) animasinya udah "keburu abis" duluan sebelum
// sempet di-scroll ke situ.
//
// Pakai IntersectionObserver bawaan browser -- nggak perlu library
// tambahan. `threshold: 0.3` artinya animasi baru dianggap "masuk
// viewport" begitu minimal 30% tinggi elemennya kelihatan (bukan
// begitu ujungnya doang nongol dikit), biar animasinya kerasa pas
// user beneran udah mau lihat chart itu.
//
// BUG YANG BARU DIBENERIN: versi awal pakai `useRef` + `useEffect`
// biasa -- itu meleset di Keuangan.jsx, soalnya kartu chart baru
// nempel ke DOM SETELAH `loading` jadi false, sementara useEffect-nya
// cuma jalan SEKALI pas render pertama (waktu itu `loading` masih
// true, elemennya belum ada, ref.current masih null, observer nggak
// pernah kebentuk). Sekarang pakai CALLBACK REF (`useCallback`,
// bukan `useRef` + `useEffect`) -- React manggil fungsi ini OTOMATIS
// PERSIS pas elemennya beneran nempel ke DOM, kapanpun itu kejadian
// (nggak peduli didelay loading state atau apapun), jadi nggak perlu
// nebak/nge-poll pakai setTimeout buat nunggu elemennya siap.
//
// Return [ref, mounted] -- `ref` ditempelin ke elemen pembungkus
// chart-nya, `mounted` dioper ke prop `mounted` di TrendChart/
// MonthlyBarChart persis kayak sebelumnya.
export function useInViewAnimate(threshold = 0.3) {
  const [mounted, setMounted] = useState(false)
  const observerRef = useRef(null)

  const ref = useCallback((el) => {
    // Bersihin observer lama dulu tiap kali callback ini kepanggil
    // ulang (misal elemennya sempet ke-unmount terus nempel lagi).
    if (observerRef.current) {
      observerRef.current.disconnect()
      observerRef.current = null
    }
    if (!el) return

    // Cek posisi elemen LANGSUNG pas dia baru nempel -- kalau
    // kebetulan udah kelihatan di layar SAAT ITU JUGA (bukan nunggu
    // di-scroll), animasinya langsung mulai, nggak nunggu callback
    // pertama observer yang baru jalan di frame berikutnya.
    const rect = el.getBoundingClientRect()
    const sudahKelihatan = rect.top < window.innerHeight && rect.bottom > 0 && rect.height > 0
    if (sudahKelihatan) setMounted(true)

    const observer = new IntersectionObserver(
      ([entry]) => setMounted(entry.isIntersecting),
      { threshold }
    )
    observer.observe(el)
    observerRef.current = observer
  }, [threshold])

  return [ref, mounted]
}
