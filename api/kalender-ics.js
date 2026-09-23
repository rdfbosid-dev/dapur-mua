import { createClient } from '@supabase/supabase-js'

function pad(n) {
  return String(n).padStart(2, '0')
}

// Karakter khusus (koma, titik-koma, newline, backslash) WAJIB di-escape
// di format iCalendar, kalau nggak bisa bikin file .ics-nya rusak/nggak
// kebaca sama app kalender.
function escapeICS(text) {
  return String(text || '')
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n')
}

function formatDateUTC(date) {
  return `${date.getUTCFullYear()}${pad(date.getUTCMonth() + 1)}${pad(date.getUTCDate())}T${pad(date.getUTCHours())}${pad(date.getUTCMinutes())}${pad(date.getUTCSeconds())}Z`
}

export default async function handler(req, res) {
  const { kode } = req.query

  if (!kode) {
    res.status(400).send('Kode kalender tidak ditemukan di URL.')
    return
  }

  const supabaseUrl = process.env.VITE_SUPABASE_URL
  // SENGAJA pakai Service Role Key (bukan anon key yang dipakai React di
  // browser) -- soalnya endpoint ini diakses TANPA login (app Kalender di
  // HP nggak bisa "login" ke akun Dapur MUA), jadi butuh akses yang bisa
  // nembus RLS. Keamanannya digantiin sama `kode` yang acak & rahasia,
  // BUKAN dari sesi login. Env var ini WAJIB di-set di Vercel Dashboard
  // (Settings > Environment Variables), JANGAN pernah ditaruh di file
  // .env yang di-bundle ke React (itu kenapa namanya nggak diawalin
  // "VITE_" -- biar nggak ke-ikut kebundle ke kode yang jalan di browser).
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceRoleKey) {
    res.status(500).send('Konfigurasi server belum lengkap (SUPABASE_SERVICE_ROLE_KEY belum di-set di Vercel).')
    return
  }

  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey)

  const { data: profile, error: profileError } = await supabaseAdmin
    .from('profiles')
    .select('id, studio_name, trial_ends_at, subscription_status')
    .eq('kode_kalender', kode)
    .maybeSingle()

  if (profileError || !profile) {
    res.status(404).send('Kode kalender tidak valid atau tidak ditemukan.')
    return
  }

  const studioName = profile.studio_name || 'Dapur MUA'
  const now = formatDateUTC(new Date())

  // Sama persis logic-nya kayak `isLocked` di AuthContext.jsx (React) --
  // TAPI endpoint ini jalan di server, di luar app React, jadi nggak bisa
  // numpang ke situ, logic-nya perlu di-duplikasi manual di sini.
  const isLocked = profile.subscription_status !== 'active'
    && profile.trial_ends_at
    && new Date(profile.trial_ends_at) < new Date()

  if (isLocked) {
    // JANGAN ambil/bocorin data booking asli sama sekali kalau udah
    // kekunci -- balikin kalender isinya 1 event placeholder doang, yang
    // nyantumin tanggal HARI INI biar kelihatan di app kalender HP-nya
    // dan ngingetin buat lanjut berlangganan. Event lama yang sempet
    // ke-subscribe sebelumnya bakal ke-replace sama ini pas app
    // kalendernya sinkron ulang (soalnya semua event lama otomatis
    // ilang begitu file .ics-nya nggak nyantumin UID itu lagi).
    const todayStr = formatDateUTC(new Date()).slice(0, 8)
    const placeholderIcs = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Dapur MUA//Kalender Booking//ID',
      'CALSCALE:GREGORIAN',
      `X-WR-CALNAME:Jadwal Booking - ${escapeICS(studioName)}`,
      'BEGIN:VEVENT',
      `UID:trial-habis-${profile.id}@dapurmua.app`,
      `DTSTAMP:${now}`,
      `DTSTART;VALUE=DATE:${todayStr}`,
      `SUMMARY:${escapeICS('Langganan Dapur MUA kamu udah habis -- hubungi admin buat lanjut')}`,
      'END:VEVENT',
      'END:VCALENDAR',
    ].join('\r\n')

    res.setHeader('Content-Type', 'text/calendar; charset=utf-8')
    res.setHeader('Content-Disposition', 'inline; filename="dapurmua-kalender.ics"')
    res.status(200).send(placeholderIcs)
    return
  }

  const { data: bookings, error: bookingError } = await supabaseAdmin
    .from('bookings')
    .select('id, nama_klien, event, tanggal_acara, jam_start_makeup, lokasi, nomor_whatsapp')
    .eq('user_id', profile.id)
    .order('tanggal_acara', { ascending: true })

  if (bookingError) {
    res.status(500).send('Gagal mengambil data booking.')
    return
  }

  // Jumlah peserta per booking -- query kedua yang KHUSUS ngitung
  // (bukan pake nested select/aggregate PostgREST) biar lebih gampang
  // di-debug, sama pola manual-count-nya sama kayak kalkulasi lain di
  // project ini. Fail-open kalau query-nya somehow gagal: kalender
  // tetep jalan, cuma baris "Jumlah Peserta"-nya nggak nongol (bukan
  // bikin seluruh .ics gagal ke-generate).
  const { data: pesertaRows, error: pesertaError } = await supabaseAdmin
    .from('peserta')
    .select('booking_id')
    .eq('user_id', profile.id)

  const jumlahPesertaMap = {}
  if (!pesertaError) {
    for (const row of pesertaRows || []) {
      jumlahPesertaMap[row.booking_id] = (jumlahPesertaMap[row.booking_id] || 0) + 1
    }
  }

  // Ini SATU-SATUNYA sinyal yang kita punya buat tau app Kalender di HP
  // user beneran "narik" link ini (bukan cuma di-copy doang) -- link .ics
  // itu pasif, nggak ada notifikasi balik dari Google Calendar/Kalender
  // iPhone pas mereka subscribe. Jadi begitu endpoint ini kepanggil buat
  // data ASLI (bukan yang lock-placeholder di atas), dicatet sebagai
  // bukti sinkronisasi berhasil. `.is('kalender_synced_at', null)` --
  // cuma nulis SEKALI (pas masih kosong), request-request berikutnya
  // (app kalender narik ulang berkala) nggak nimpa timestamp yang udah
  // ada.
  //
  // PENTING: WAJIB di-`await`, taro SEBELUM ngirim respons -- di
  // lingkungan serverless (Vercel), eksekusi function langsung
  // "dibekukan" begitu respons dikirim, TANPA nunggu proses lain yang
  // masih jalan di belakang (beda kayak server Node.js biasa yang
  // nyala terus). Kalau ini nggak di-await, promise-nya bisa kegugurin
  // duluan sebelum sempet nyampe ke Supabase -- response .ics-nya tetep
  // sukses (makanya kelihatan "berhasil" padahal timestamp-nya nggak
  // pernah kesave). Dibungkus try/catch biar kalau update-nya somehow
  // gagal, itu TETEP nggak sampe bikin response .ics-nya ikut gagal --
  // fitur sinkronisasi kalender-nya sendiri lebih penting daripada
  // sekadar catatan status di UI.
  try {
    await supabaseAdmin
      .from('profiles')
      .update({ kalender_synced_at: new Date().toISOString() })
      .eq('id', profile.id)
      .is('kalender_synced_at', null)
  } catch {
    // sengaja diem -- lihat alasan di komentar atas
  }

  const events = (bookings || []).map((b) => {
    const [y, m, d] = b.tanggal_acara.split('-').map(Number)
    let dtStart, dtEnd
    let allDay = false

    if (b.jam_start_makeup) {
      const [jam, menit] = b.jam_start_makeup.slice(0, 5).split(':').map(Number)
      dtStart = `${y}${pad(m)}${pad(d)}T${pad(jam)}${pad(menit)}00`
      // Data kita nggak nyimpen jam SELESAI eksplisit -- default durasi
      // 3 jam per booking (angka wajar buat sesi makeup, bisa disesuaikan
      // di sini kalau perlu).
      const end = new Date(y, m - 1, d, jam, menit)
      end.setHours(end.getHours() + 3)
      dtEnd = `${end.getFullYear()}${pad(end.getMonth() + 1)}${pad(end.getDate())}T${pad(end.getHours())}${pad(end.getMinutes())}00`
    } else {
      allDay = true
      dtStart = `${y}${pad(m)}${pad(d)}`
      const end = new Date(y, m - 1, d + 1)
      dtEnd = `${end.getFullYear()}${pad(end.getMonth() + 1)}${pad(end.getDate())}`
    }

    const summary = escapeICS(`${b.event || 'Booking'} - ${b.nama_klien || ''}`)
    const location = escapeICS(b.lokasi || '')
    const jumlahPeserta = jumlahPesertaMap[b.id] || 0
    const descLines = []
    if (b.nomor_whatsapp) descLines.push(`No. WhatsApp: ${b.nomor_whatsapp}`)
    if (jumlahPeserta > 0) descLines.push(`Jumlah Peserta: ${jumlahPeserta} orang`)
    const description = escapeICS(descLines.join('\n'))

    return [
      'BEGIN:VEVENT',
      `UID:${b.id}@dapurmua.app`,
      `DTSTAMP:${now}`,
      allDay ? `DTSTART;VALUE=DATE:${dtStart}` : `DTSTART;TZID=Asia/Jakarta:${dtStart}`,
      allDay ? `DTEND;VALUE=DATE:${dtEnd}` : `DTEND;TZID=Asia/Jakarta:${dtEnd}`,
      `SUMMARY:${summary}`,
      location ? `LOCATION:${location}` : null,
      description ? `DESCRIPTION:${description}` : null,
      'END:VEVENT',
    ].filter(Boolean).join('\r\n')
  })

  const ics = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Dapur MUA//Kalender Booking//ID',
    'CALSCALE:GREGORIAN',
    `X-WR-CALNAME:Jadwal Booking - ${escapeICS(studioName)}`,
    ...events,
    'END:VCALENDAR',
  ].join('\r\n')

  res.setHeader('Content-Type', 'text/calendar; charset=utf-8')
  res.setHeader('Content-Disposition', 'inline; filename="dapurmua-kalender.ics"')
  res.status(200).send(ics)
}