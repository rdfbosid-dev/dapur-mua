import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'

const AuthContext = createContext(null)

// UUID akun "RodifMUA" -- SATU-SATUNYA akun admin, di-hardcode SENGAJA
// (bukan kolom "is_admin" di profiles) biar nggak ada cara buat "jadi
// admin" lewat data yang bisa diubah-ubah dari mana pun -- harus
// diubah manual di kode ini + api/admin/users.js kalau suatu hari
// beneran perlu ganti/nambah admin. DUA tempat ini WAJIB selalu sama
// persis, itu 2 lapis pengecekan independen (frontend cuma nentuin
// tampilan menu, api/admin/users.js yang beneran nge-gate akses data).
const ADMIN_USER_ID = '5a6ae3db-228c-464a-9b1e-f94e3071fdc9'

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [profile, setProfile] = useState(null)

  const refreshProfile = useCallback(async (userId) => {
    if (!userId) return
    const { data, error } = await supabase
      .from('profiles')
      .select('studio_name, kode_prefix, instagram, whatsapp, logo_url, kode_kalender, trial_ends_at, subscription_status, subscription_ends_at, kalender_synced_at')
      .eq('id', userId)
      .maybeSingle() // beda dari .single() -- nggak error kalau 0 baris, cuma balikin null

    if (data) {
      setProfile(data)
      return
    }

    if (error) {
      // Query-nya GAGAL (network/timeout/dll) -- ini BUKAN berarti
      // profilnya beneran kosong. JANGAN lanjut ke bikin fallback &
      // nimpa data asli yang mungkin masih ada di database -- itu bug
      // yang pernah beneran kejadian & ngilangin data user. Diem aja,
      // biarin state profile apa adanya, coba lagi nanti (auth state
      // change / window focus bakal manggil refreshProfile lagi).
      console.error('Gagal memuat profil:', error.message)
      return
    }

    // Di titik ini dipastikan: data null DAN nggak ada error sama sekali
    // -- artinya BENERAN nggak ada baris profil (akun lama sebelum
    // trigger auto-create dipasang). Baru sekarang aman bikin baru.
    const fallback = {
      studio_name: '', kode_prefix: '', instagram: '', whatsapp: '', logo_url: null, kode_kalender: null,
      trial_ends_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), subscription_status: 'trial', kalender_synced_at: null,
    }
    const { data: created } = await supabase
      .from('profiles')
      .upsert({ id: userId, ...fallback })
      .select('studio_name, kode_prefix, instagram, whatsapp, logo_url, kode_kalender, trial_ends_at, subscription_status, subscription_ends_at, kalender_synced_at')
      .single()

    setProfile(created || fallback) // tetap kasih nilai walau upsert-nya somehow gagal juga
  }, [])

  useEffect(() => {
    let active = true

    async function init() {
      // getSession() CUMA baca token yang tersimpan di localStorage --
      // dia nggak nanya ke server sama sekali, jadi tetep "keliatan
      // valid" walau usernya udah dihapus dari Supabase. getUser() beda,
      // itu BENERAN request ke server buat verifikasi -- kalau usernya
      // udah nggak ada, ini yang bakal ke-tangkep errornya.
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user) {
        if (active) setLoading(false)
        return
      }

      const { data: { user: verifiedUser }, error } = await supabase.auth.getUser()
      if (error || !verifiedUser) {
        // Akun ini udah nggak valid lagi di server (misal: dihapus manual
        // dari Supabase Dashboard) -- bersihin sesi lokal yang "nyangkut"
        // itu, biar route guard di App.jsx otomatis lempar ke /login.
        await supabase.auth.signOut()
        if (active) { setUser(null); setProfile(null); setLoading(false) }
        return
      }

      if (active) {
        setUser(verifiedUser)
        setLoading(false)
        refreshProfile(verifiedUser.id)
      }
    }
    init()

    // dengerin perubahan status login (login, logout, token refresh)
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      if (session?.user) refreshProfile(session.user.id)
      else setProfile(null)
    })

    // Tambahan: verifikasi ulang ke server tiap kali tab ini balik
    // ke-fokus (kejadian nyata yang kita tes: buka Dashboard di 1 tab,
    // user-nya dihapus dari Supabase Dashboard, terus balik ke tab
    // Dashboard tadi -- ini yang nangkep situasi itu tanpa nunggu token
    // lokal expired sendiri, ~1 jam).
    async function revalidateOnFocus() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user) return
      const { error } = await supabase.auth.getUser()
      if (error) await supabase.auth.signOut()
    }
    window.addEventListener('focus', revalidateOnFocus)

    return () => {
      active = false
      listener.subscription.unsubscribe()
      window.removeEventListener('focus', revalidateOnFocus)
    }
  }, [refreshProfile])

  const signOut = () => supabase.auth.signOut()

  // Kekunci kalau: status langganan BUKAN 'active' DAN tanggal
  // trial_ends_at udah lewat. Selama profile belum kebaca (null), anggap
  // BELUM terkunci -- biar nggak "kedip" nge-redirect duluan sebelum
  // data profil sempet kebaca.
  const isLocked = !!(
    profile &&
    profile.subscription_status !== 'active' &&
    profile.trial_ends_at &&
    new Date(profile.trial_ends_at) < new Date()
  )

  const isAdmin = user?.id === ADMIN_USER_ID

  return (
    <AuthContext.Provider value={{ user, loading, signOut, profile, refreshProfile, isLocked, isAdmin }}>
      {children}
    </AuthContext.Provider>
  )
}

// Fast Refresh idealnya cuma jalan mulus kalau 1 file isinya komponen
// doang -- file ini juga export `useAuth` (bukan komponen). Efeknya
// CUMA soal Developer Experience (edit file ini pas lagi `npm run dev`
// bakal full-reload, bukan hot-swap sehalus biasanya) -- BUKAN bug,
// BUKAN ngaruh ke hasil build production sama sekali. Pola "context +
// hook custom-nya di 1 file yang sama" ini standar & umum dipakai --
// misahin ke 2 file beda cuma buat nyenengin linter berarti harus
// update import di SEMUA halaman yang pake useAuth, nggak sepadan buat
// warning yang efeknya cuma kosmetik.
// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth harus dipakai di dalam <AuthProvider>')
  return ctx
}
