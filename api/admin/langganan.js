import { createClient } from '@supabase/supabase-js'

// SAMA PERSIS kayak di api/admin/users.js -- 2 tempat ini independen
// sengaja, WAJIB selalu disinkronin manual kalau salah satu berubah.
const ADMIN_USER_ID = '5a6ae3db-228c-464a-9b1e-f94e3071fdc9'

// SAMA PERSIS kayak DURASI_BULAN di api/admin/users.js -- dipakai lagi
// di sini pas approve pengajuan, biar perpanjangannya numpang rumus
// yang SAMA (nge-stack dari tanggal habis lama kalau masih aktif).
const DURASI_BULAN = { '1bulan': 1, '6bulan': 6, '1tahun': 12 }

export default async function handler(req, res) {
  const supabaseUrl = process.env.VITE_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceRoleKey) {
    res.status(500).json({ error: 'Konfigurasi server belum lengkap (SUPABASE_SERVICE_ROLE_KEY belum di-set di Vercel).' })
    return
  }

  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey)

  // ---- Verifikasi admin -- SAMA PERSIS pola & alasannya kayak di
  // api/admin/users.js. ----
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
    await handleGet(req, res, supabaseAdmin)
  } else if (req.method === 'PATCH') {
    await handlePatch(req, res, supabaseAdmin)
  } else {
    res.status(405).json({ error: 'Method tidak didukung.' })
  }
}

async function handleGet(req, res, supabaseAdmin) {
  const { type } = req.query

  if (type === 'settings') {
    const { data, error } = await supabaseAdmin.from('platform_settings').select('rekening, qris_url').eq('id', true).maybeSingle()
    if (error) { res.status(500).json({ error: error.message }); return }
    res.status(200).json({ settings: data || { rekening: [], qris_url: null } })
    return
  }

  // Default: daftar pengajuan PENDING doang (yang udah approved/rejected
  // nggak perlu ditampilin lagi di sini -- itu udah "selesai").
  const { data: requests, error: reqError } = await supabaseAdmin
    .from('subscription_requests')
    .select('id, user_id, durasi, harga, metode_pembayaran, rekening_tujuan, bukti_url, status, created_at')
    .eq('status', 'pending')
    .order('created_at', { ascending: true })

  if (reqError) { res.status(500).json({ error: reqError.message }); return }

  if (!requests || requests.length === 0) {
    res.status(200).json({ requests: [] })
    return
  }

  const userIds = [...new Set(requests.map((r) => r.user_id))]
  const { data: profiles, error: profileError } = await supabaseAdmin
    .from('profiles').select('id, studio_name, whatsapp').in('id', userIds)
  if (profileError) { res.status(500).json({ error: profileError.message }); return }
  const profileById = Object.fromEntries((profiles || []).map((p) => [p.id, p]))

  // Bucket bukti-transfer PRIVATE -- link publik nggak bakal jalan,
  // jadi tiap bukti_url (path) di-generate signed URL (berlaku 1 jam,
  // cukup buat sesi review admin) pake service role key.
  const enriched = await Promise.all(requests.map(async (r) => {
    const { data: signed } = await supabaseAdmin.storage.from('bukti-transfer').createSignedUrl(r.bukti_url, 3600)
    return {
      ...r,
      studio_name: profileById[r.user_id]?.studio_name || '(belum diisi)',
      whatsapp: profileById[r.user_id]?.whatsapp || null,
      bukti_signed_url: signed?.signedUrl || null,
    }
  }))

  res.status(200).json({ requests: enriched })
}

async function handlePatch(req, res, supabaseAdmin) {
  const { action } = req.body || {}

  if (action === 'settings') {
    await handleUpdateSettings(req, res, supabaseAdmin)
  } else if (action === 'approve' || action === 'reject') {
    await handleReview(req, res, supabaseAdmin)
  } else {
    res.status(400).json({ error: 'Action tidak valid.' })
  }
}

async function handleUpdateSettings(req, res, supabaseAdmin) {
  const { rekening, qris_url } = req.body || {}

  const { error } = await supabaseAdmin
    .from('platform_settings')
    .update({ rekening: rekening ?? [], qris_url: qris_url ?? null })
    .eq('id', true)

  if (error) { res.status(500).json({ error: error.message }); return }
  res.status(200).json({ ok: true })
}

async function handleReview(req, res, supabaseAdmin) {
  const { requestId, action, catatan } = req.body || {}

  if (!requestId) { res.status(400).json({ error: 'requestId wajib diisi.' }); return }

  const { data: reqRow, error: getError } = await supabaseAdmin
    .from('subscription_requests')
    .select('id, user_id, durasi, status')
    .eq('id', requestId)
    .maybeSingle()

  if (getError || !reqRow) { res.status(404).json({ error: 'Pengajuan tidak ditemukan.' }); return }
  if (reqRow.status !== 'pending') { res.status(409).json({ error: 'Pengajuan ini udah diproses sebelumnya.' }); return }

  if (action === 'approve') {
    // Perpanjangan langganannya numpang RUMUS SAMA PERSIS kayak
    // handleExtend di api/admin/users.js (nge-stack dari tanggal habis
    // lama kalau masih aktif, mulai dari sekarang kalau udah lewat/belum
    // ada) -- biar user yang approve lewat sini vs di-extend manual lewat
    // Kelola User hasilnya konsisten.
    const tambahBulan = DURASI_BULAN[reqRow.durasi]
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles').select('subscription_ends_at').eq('id', reqRow.user_id).maybeSingle()
    if (profileError || !profile) { res.status(404).json({ error: 'User tidak ditemukan.' }); return }

    const skrg = new Date()
    const basis = profile.subscription_ends_at && new Date(profile.subscription_ends_at) > skrg
      ? new Date(profile.subscription_ends_at)
      : skrg
    basis.setMonth(basis.getMonth() + tambahBulan)

    const { error: updateProfileError } = await supabaseAdmin
      .from('profiles')
      .update({ subscription_status: 'active', subscription_ends_at: basis.toISOString() })
      .eq('id', reqRow.user_id)
    if (updateProfileError) { res.status(500).json({ error: updateProfileError.message }); return }
  }

  const { error: updateReqError } = await supabaseAdmin
    .from('subscription_requests')
    .update({ status: action === 'approve' ? 'approved' : 'rejected', catatan_admin: catatan || null, reviewed_at: new Date().toISOString() })
    .eq('id', requestId)

  if (updateReqError) { res.status(500).json({ error: updateReqError.message }); return }

  res.status(200).json({ ok: true })
}
