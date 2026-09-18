import { createClient } from '@supabase/supabase-js'

// UUID akun admin -- WAJIB SAMA PERSIS kayak ADMIN_USER_ID di
// src/context/AuthContext.jsx. Dua tempat ini independen sengaja: yang
// di AuthContext.jsx cuma nentuin tampilan menu di frontend, INI yang
// beneran nge-gate akses data -- walau menu-nya somehow dipaksa nongol
// buat user lain, endpoint ini tetep nolak siapapun yang bukan UUID ini.
const ADMIN_USER_ID = '5a6ae3db-228c-464a-9b1e-f94e3071fdc9'

// Durasi perpanjangan yang diizinin -- SENGAJA dikunci ke 3 pilihan ini
// doang (ngikut 3 paket harga di landing page), BUKAN nerima angka bulan
// bebas dari body request -- biar nggak ada celah orang iseng ngirim
// angka aneh (misal 9999 bulan) walau toh request-nya bakal ketolak duluan
// di pengecekan admin.
const DURASI_BULAN = { '1bulan': 1, '6bulan': 6, '1tahun': 12 }

export default async function handler(req, res) {
  const supabaseUrl = process.env.VITE_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceRoleKey) {
    res.status(500).json({ error: 'Konfigurasi server belum lengkap (SUPABASE_SERVICE_ROLE_KEY belum di-set di Vercel).' })
    return
  }

  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey)

  // ---- Verifikasi admin -- WAJIB lolos ini dulu sebelum kode di bawah
  // manapun boleh jalan, apapun method-nya (GET/PATCH). Token diambil
  // dari header Authorization yang dikirim frontend (lihat
  // AdminDashboard.jsx), diverifikasi ke server Supabase (BUKAN cuma
  // dipercaya mentah dari klaim klien) -- baru ID hasil verifikasi itu
  // dicocokin ke ADMIN_USER_ID. ----
  const authHeader = req.headers.authorization || ''
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null

  if (!token) {
    res.status(401).json({ error: 'Belum login.' })
    return
  }

  const { data: { user: verifiedUser }, error: authError } = await supabaseAdmin.auth.getUser(token)

  if (authError || !verifiedUser || verifiedUser.id !== ADMIN_USER_ID) {
    res.status(403).json({ error: 'Akses ditolak.' })
    return
  }

  if (req.method === 'GET') {
    await handleList(req, res, supabaseAdmin)
  } else if (req.method === 'PATCH') {
    await handleExtend(req, res, supabaseAdmin)
  } else {
    res.status(405).json({ error: 'Method tidak didukung.' })
  }
}

async function handleList(req, res, supabaseAdmin) {
  const { data: profiles, error: profilesError } = await supabaseAdmin
    .from('profiles')
    .select('id, studio_name, kode_prefix, instagram, whatsapp, trial_ends_at, subscription_status, subscription_ends_at, created_at')
    .order('created_at', { ascending: true })

  if (profilesError) {
    res.status(500).json({ error: profilesError.message })
    return
  }

  // Email nggak kesimpen di tabel profiles -- itu punya sistem Auth
  // internal Supabase sendiri (auth.users), jadi perlu API terpisah
  // (masih pake Service Role Key yang sama), digabung manual per id.
  // perPage dinaikin dari default (biasanya 50) -- aman-aman aja buat
  // jumlah user sekarang, tinggal dinaikin lagi kalau suatu hari
  // user-nya beneran udah ratusan.
  const { data: authData, error: authListError } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 })

  if (authListError) {
    res.status(500).json({ error: authListError.message })
    return
  }

  const emailById = {}
  authData.users.forEach((u) => { emailById[u.id] = u.email })

  const merged = profiles.map((p) => ({ ...p, email: emailById[p.id] || null }))

  res.status(200).json({ users: merged })
}

async function handleExtend(req, res, supabaseAdmin) {
  const { userId, durasi } = req.body || {}
  const tambahBulan = DURASI_BULAN[durasi]

  if (!userId || !tambahBulan) {
    res.status(400).json({ error: 'userId atau durasi tidak valid.' })
    return
  }

  const { data: profile, error: getError } = await supabaseAdmin
    .from('profiles')
    .select('subscription_ends_at')
    .eq('id', userId)
    .maybeSingle()

  if (getError || !profile) {
    res.status(404).json({ error: 'User tidak ditemukan.' })
    return
  }

  // Kalau langganannya MASIH aktif (belum lewat), perpanjangan NAMBAH
  // dari tanggal habis yang lama (nge-stack) -- bukan nimpa dari hari
  // ini. Kalau udah lewat/belum pernah ada, mulai itung dari sekarang.
  const skrg = new Date()
  const basis = profile.subscription_ends_at && new Date(profile.subscription_ends_at) > skrg
    ? new Date(profile.subscription_ends_at)
    : skrg
  basis.setMonth(basis.getMonth() + tambahBulan)

  const { error: updateError } = await supabaseAdmin
    .from('profiles')
    .update({ subscription_status: 'active', subscription_ends_at: basis.toISOString() })
    .eq('id', userId)

  if (updateError) {
    res.status(500).json({ error: updateError.message })
    return
  }

  res.status(200).json({ subscription_ends_at: basis.toISOString() })
}
