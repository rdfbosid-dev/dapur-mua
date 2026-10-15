import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import Sidebar from '../components/Sidebar'
import './Pengaturan.css'
import { cekPassword, pesanErrorPassword, PANJANG_MIN_PASSWORD, PETUNJUK_PASSWORD } from '../lib/aturanPassword'
import { ZONA_WAKTU, kodeZona, tebakZonaPerangkat } from '../lib/zonaWaktu'
import { POLA_SLUG, rapikanSlug, linkBooking, muatPengaturanBooking } from '../lib/bookingOnline'
import { rapikanKetikanWa, pesanNomorWaTidakValid } from '../lib/nomorWa'
import { MAKS_LINK, MAKS_JUDUL, MAKS_TEKS_WA, rapikanUrl, pesanLinkTidakValid, muatHalamanLinkSaya, simpanHalamanLinkSaya, linkDariProfil, nomorPolos, teksSapaWa, rakitLinkWa, pecahLinkWa, placeholderAlamat } from '../lib/linkTambahan'
import { IKON_MEDSOS, IKON_LINK_BIASA, dataIkonMedsos, ikonDipakai } from '../lib/ikonMedsos'
import CustomSelect from '../components/CustomSelect'

// Pilihan ikon Link Tambahan (lib/ikonMedsos.js): Otomatis = ditebak dari
// alamat link, Link biasa = ikon rantai, sisanya ikon medsos.
const LABEL_IKON_OTOMATIS = 'Otomatis (sesuai alamat)'
const LABEL_IKON_BIASA = 'Link biasa (bukan medsos)'
const OPSI_IKON = [LABEL_IKON_OTOMATIS, LABEL_IKON_BIASA, ...IKON_MEDSOS.map((m) => m.label)]
function labelIkon(ikon) {
  if (ikon === IKON_LINK_BIASA) return LABEL_IKON_BIASA
  return dataIkonMedsos(ikon)?.label || LABEL_IKON_OTOMATIS
}
function ikonDariLabel(label) {
  if (label === LABEL_IKON_BIASA) return IKON_LINK_BIASA
  return IKON_MEDSOS.find((m) => m.label === label)?.kunci || null
}
// Pratinjau ikon yang nanti tampil di tombol halaman link.
function PratinjauIkon({ ikon, url }) {
  const m = dataIkonMedsos(ikonDipakai(ikon, url))
  if (!m) return <svg className="lt-ikon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M10 13a5 5 0 0 0 7.07 0l3-3a5 5 0 0 0-7.07-7.07l-1.5 1.5" /><path d="M14 11a5 5 0 0 0-7.07 0l-3 3a5 5 0 0 0 7.07 7.07l1.5-1.5" /></svg>
  return <svg className="lt-ikon" viewBox="0 0 24 24" fill={m.warna || 'currentColor'} aria-hidden="true"><path d={m.path} /></svg>
}

function initialsOf(name) {
  return (name || '?').split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase()
}

// Nilai form Profil dari data profil tersimpan. Kalau rekening kosong,
// tetap 1 baris kosong biar form-nya langsung ada tempat buat isi.
function isiDariProfil(profile) {
  return {
    studioName: profile.studio_name || '',
    kodePrefix: profile.kode_prefix || '',
    instagram: profile.instagram || '',
    whatsapp: profile.whatsapp || '',
    rekening: profile.rekening && profile.rekening.length > 0 ? profile.rekening : [{ bank: '', nomor: '' }],
    zonaWaktu: kodeZona(profile),
  }
}

const UMUR_DRAF_MS = 24 * 60 * 60 * 1000
function bacaDraf(kunci) {
  if (!kunci) return null
  try {
    const simpanan = JSON.parse(localStorage.getItem(kunci))
    if (!simpanan || !simpanan.isi || Date.now() - simpanan.waktu > UMUR_DRAF_MS) return null
    return simpanan.isi
  } catch {
    return null
  }
}

// Simpan draf isian yang belum disimpan (atau hapus kalau isinya sama lagi
// dengan data tersimpan). Dipakai kartu Link Booking & Isi Halaman Link --
// pola SAMA dengan draf Profil di bawah (per akun, berlaku 24 jam).
function tulisDraf(kunci, isi, asli) {
  if (!kunci) return
  try {
    if (JSON.stringify(isi) === JSON.stringify(asli)) localStorage.removeItem(kunci)
    else localStorage.setItem(kunci, JSON.stringify({ waktu: Date.now(), isi }))
  } catch { /* penyimpanan diblokir/penuh: form tetap jalan, cuma tanpa draf */ }
}
function hapusDraf(kunci) {
  try { localStorage.removeItem(kunci) } catch { /* abaikan */ }
}

export default function Pengaturan() {
  const { user, profile, refreshProfile } = useAuth()

  const [studioName, setStudioName] = useState('')
  const [kodePrefix, setKodePrefix] = useState('')
  const [instagram, setInstagram] = useState('')
  const [whatsapp, setWhatsapp] = useState('')
  // Rekening -- array of {bank, nomor}, BISA lebih dari 1 (beda dari
  // field lain di atas yang cuma 1 nilai). Selalu ada minimal 1 baris
  // kosong di form biar user langsung liat input-nya, walau profile-nya
  // belum ada rekening sama sekali.
  const [rekening, setRekening] = useState([{ bank: '', nomor: '' }])
  // Zona waktu (WIB/WITA/WIT) -- label jam di invoice/Dashboard/Kalender &
  // zona di kalender HP. Lihat lib/zonaWaktu.js.
  const [zonaWaktu, setZonaWaktu] = useState('WIB')
  // Zona perangkat ini (null kalau di luar Indonesia) -- cuma buat saran.
  const [zonaPerangkat] = useState(tebakZonaPerangkat)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState(null) // { type: 'success' | 'error', text }

  const fileInputRef = useRef(null)
  const [uploadingLogo, setUploadingLogo] = useState(false)
  const [deletingLogo, setDeletingLogo] = useState(false)
  const [logoMessage, setLogoMessage] = useState(null)

  const [newPassword, setNewPassword] = useState('')
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [savingPassword, setSavingPassword] = useState(false)
  const [passwordMessage, setPasswordMessage] = useState(null)

  const [linkCopied, setLinkCopied] = useState(false)

  // LINK BOOKING ONLINE -- form terpisah dari Profil (tombol simpan sendiri).
  // Datanya dimuat sendiri (bukan dari AuthContext), lihat lib/bookingOnline.js.
  const [lb, setLb] = useState(null) // null = memuat; { gagal: true } = fitur belum siap
  const [lbAktif, setLbAktif] = useState(false)
  const [lbSlug, setLbSlug] = useState('')
  const [lbHarga, setLbHarga] = useState(true)
  const [lbJam, setLbJam] = useState(true)
  const [lbPesan, setLbPesan] = useState('')
  // Clean hijabdo sudah termasuk jasa makeup? (default Ya) -- kalau Ya,
  // link publik menampilkan keterangan singkat di Add On Layanan Rambut.
  const [lbCleanHijabdo, setLbCleanHijabdo] = useState(true)
  const [lbSaving, setLbSaving] = useState(false)
  const [lbMessage, setLbMessage] = useState(null)
  const [lbCopied, setLbCopied] = useState(false)
  // Alamat link udah pernah diketik user? Sebelum itu, kolomnya diisi usulan
  // dari Nama Brand (dan ikut berubah kalau Nama Brand diubah).
  const [lbSlugDisentuh, setLbSlugDisentuh] = useState(false)
  // Isian kartu ini sesuai data tersimpan (pembanding draf).
  const [lbAsli, setLbAsli] = useState(null)
  // Dimuat SEKALI per akun -- bergantung ke user.id (teks), BUKAN objek user.
  // SEBELUMNYA [user]: tiap balik ke tab/aplikasi, sesi login diperbarui ->
  // objek user baru -> data dimuat ulang & isian yang belum disimpan ketimpa.
  const uid = user?.id || null
  const kunciDrafLb = uid ? `dapurmua:draf-link-booking:${uid}` : null
  useEffect(() => {
    let batal = false
    if (!uid) return undefined
    muatPengaturanBooking(uid).then((d) => {
      if (batal) return
      setLb(d || { gagal: true })
      if (d && !d.gagal) {
        const asli = {
          aktif: !!d.booking_online_aktif, slug: d.slug || '', slugDisentuh: false,
          harga: d.booking_tampil_harga !== false, jam: d.booking_tampil_jam !== false,
          pesan: d.booking_pesan || '', cleanHijabdo: d.booking_clean_hijabdo_termasuk !== false,
        }
        const isi = bacaDraf(kunciDrafLb) || asli
        setLbAktif(isi.aktif)
        setLbSlug(isi.slug)
        setLbSlugDisentuh(!!isi.slugDisentuh)
        setLbHarga(isi.harga)
        setLbJam(isi.jam)
        setLbPesan(isi.pesan)
        setLbCleanHijabdo(isi.cleanHijabdo)
        setLbAsli(asli)
      }
    })
    return () => { batal = true }
  }, [uid, kunciDrafLb])
  // Draf kartu Link Booking (baru jalan setelah data tersimpan termuat).
  useEffect(() => {
    if (!lbAsli) return
    tulisDraf(kunciDrafLb, { aktif: lbAktif, slug: lbSlug, slugDisentuh: lbSlugDisentuh, harga: lbHarga, jam: lbJam, pesan: lbPesan, cleanHijabdo: lbCleanHijabdo }, lbAsli)
  }, [lbAsli, kunciDrafLb, lbAktif, lbSlug, lbSlugDisentuh, lbHarga, lbJam, lbPesan, lbCleanHijabdo])
  // HALAMAN LINK (landing page /b/slug) -- opsi daftar paket & LINK TAMBAHAN
  // (tombol buatan MUA sendiri, ala Linktree). Form & tombol simpan sendiri.
  // Lihat lib/linkTambahan.js. null = memuat; { gagal: true } = belum siap.
  const [hl, setHl] = useState(null)
  const [hlTampilPaket, setHlTampilPaket] = useState(true)
  const [hlLinks, setHlLinks] = useState([])
  const [hlIdLama, setHlIdLama] = useState([])
  const [hlDukungIkon, setHlDukungIkon] = useState(true)
  const [hlSaving, setHlSaving] = useState(false)
  const [hlMessage, setHlMessage] = useState(null)
  const [hlAsli, setHlAsli] = useState(null) // pembanding draf
  const kunciDrafHl = uid ? `dapurmua:draf-halaman-link:${uid}` : null
  // Dimuat SEKALI per akun (lihat catatan uid di atas).
  useEffect(() => {
    let batal = false
    if (!uid) return undefined
    muatHalamanLinkSaya(uid).then((d) => {
      if (batal) return
      if (!d) { setHl({ gagal: true }); return }
      // Link WA sederhana (wa.me/nomor?text=...) diedit lewat kolom Nomor &
      // Teks pembuka chat (l.wa), bukan alamat mentah.
      const asli = {
        tampilPaket: d.tampilPaket,
        links: d.links.map((l) => ({ id: l.id, judul: l.judul, url: l.url, aktif: l.aktif, ikon: l.ikon, wa: pecahLinkWa(l.url) })),
      }
      const isi = bacaDraf(kunciDrafHl) || asli
      setHl({ siap: true })
      setHlTampilPaket(isi.tampilPaket)
      setHlDukungIkon(d.dukungIkon)
      setHlLinks(isi.links)
      setHlIdLama(d.links.map((l) => l.id))
      setHlAsli(asli)
    })
    return () => { batal = true }
  }, [uid, kunciDrafHl])
  // Draf kartu Isi Halaman Link.
  useEffect(() => {
    if (!hlAsli) return
    tulisDraf(kunciDrafHl, { tampilPaket: hlTampilPaket, links: hlLinks }, hlAsli)
  }, [hlAsli, kunciDrafHl, hlTampilPaket, hlLinks])

  function ubahLink(i, kolom, nilai) {
    setHlLinks((d) => d.map((l, idx) => (idx === i ? { ...l, [kolom]: nilai } : l)))
  }
  // Sapaan bawaan link WA: pakai Nama Brand di form Profil (atau yang tersimpan).
  const sapaWaBawaan = teksSapaWa(studioName || profile?.studio_name)
  // Kolom alamat ditinggal: nomor HP polos / link wa.me -> pindah ke kolom
  // Nomor + Teks pembuka chat (nomor HP polos dapat sapaan bawaan).
  function selesaiKetikUrl(i, teks) {
    if (nomorPolos(teks)) {
      const wa = { nomor: rapikanKetikanWa(teks), teks: sapaWaBawaan }
      setHlLinks((d) => d.map((l, idx) => (idx === i ? { ...l, wa, url: rakitLinkWa(wa.nomor, wa.teks) } : l)))
      return
    }
    const url = rapikanUrl(teks)
    setHlLinks((d) => d.map((l, idx) => (idx === i ? { ...l, url, wa: pecahLinkWa(url) } : l)))
  }
  function ubahWa(i, kolom, nilai) {
    setHlLinks((d) => d.map((l, idx) => {
      if (idx !== i) return l
      const wa = { ...l.wa, [kolom]: nilai }
      return { ...l, wa, url: rakitLinkWa(wa.nomor, wa.teks) }
    }))
  }
  // Ikon WhatsApp dipilih untuk link yang alamatnya masih kosong -> langsung
  // pakai kolom Nomor + Teks pembuka chat.
  function pilihIkon(i, ikon) {
    setHlLinks((d) => d.map((l, idx) => {
      if (idx !== i) return l
      if (ikon === 'whatsapp' && !l.wa && !String(l.url || '').trim()) return { ...l, ikon, wa: { nomor: '', teks: sapaWaBawaan } }
      return { ...l, ikon }
    }))
  }
  function keAlamatBiasa(i) {
    setHlLinks((d) => d.map((l, idx) => (idx === i ? { ...l, wa: null } : l)))
  }
  function tambahLink() {
    setHlLinks((d) => (d.length >= MAKS_LINK ? d : [...d, { id: crypto.randomUUID(), judul: '', url: '', aktif: true, ikon: null, wa: null }]))
  }
  // "+ Tambah dari Profil": bikin link Chat WhatsApp & Instagram dari isian
  // Profil Pengguna (yang sudah ada di daftar nggak ditambah lagi).
  const usulanProfil = linkDariProfil(profile, hlLinks)
  function tambahDariProfil() {
    setHlMessage(null)
    setHlLinks((d) => [...d, ...linkDariProfil(profile, d).map((l) => ({ ...l, id: crypto.randomUUID(), aktif: true }))].slice(0, MAKS_LINK))
  }
  function hapusLink(i) {
    setHlLinks((d) => d.filter((_, idx) => idx !== i))
  }
  function geserLink(i, arah) {
    setHlLinks((d) => {
      const j = i + arah
      if (j < 0 || j >= d.length) return d
      const baru = [...d]
      ;[baru[i], baru[j]] = [baru[j], baru[i]]
      return baru
    })
  }

  async function handleSaveHalamanLink(e) {
    e.preventDefault()
    setHlMessage(null)
    const rapi = hlLinks.map((l) => ({ ...l, judul: l.judul.trim(), url: l.wa ? rakitLinkWa(l.wa.nomor, l.wa.teks) : rapikanUrl(l.url) }))
    setHlLinks(rapi)
    // Link WA: nomornya dicek dulu (aturan sama dengan Nomor WhatsApp lain).
    const pesanLink = (l) => (l.wa && pesanNomorWaTidakValid(l.wa.nomor, { maksAngka: 15 })) || pesanLinkTidakValid(l)
    const iSalah = rapi.findIndex((l) => pesanLink(l))
    if (iSalah !== -1) {
      setHlMessage({ type: 'error', text: `Link ${iSalah + 1}: ${pesanLink(rapi[iSalah])}` })
      return
    }
    setHlSaving(true)
    const error = await simpanHalamanLinkSaya(user.id, { links: rapi, tampilPaket: hlTampilPaket, dukungIkon: hlDukungIkon }, hlIdLama)
    setHlSaving(false)
    if (error) {
      setHlMessage({ type: 'error', text: /VALIDASI:/.test(error.message || '') ? error.message.replace(/^.*VALIDASI:\s*/, '') : error.message })
      return
    }
    setHlIdLama(rapi.map((l) => l.id))
    setHlAsli({ tampilPaket: hlTampilPaket, links: rapi })
    hapusDraf(kunciDrafHl)
    setHlMessage({ type: 'success', text: 'Halaman link disimpan.' })
  }

  // Usulan alamat link dari Nama Brand kalau belum pernah diisi.
  const slugUsulan = rapikanSlug(studioName)
  const slugTampil = lbSlugDisentuh ? lbSlug : (lbSlug || slugUsulan)

  // Ketikan alamat link langsung dirapikan (huruf kecil, spasi -> strip),
  // strip di ujung baru dibuang pas disimpan biar masih bisa diketik.
  function ketikSlug(teks) {
    setLbSlugDisentuh(true)
    setLbSlug(String(teks).toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/-{2,}/g, '-').replace(/^-+/, '').slice(0, 40))
  }

  async function handleSaveLinkBooking(e) {
    e.preventDefault()
    setLbMessage(null)
    const slug = rapikanSlug(slugTampil)
    if ((lbAktif || slug) && !POLA_SLUG.test(slug)) {
      setLbMessage({ type: 'error', text: 'Alamat link minimal 3 karakter: huruf kecil, angka, atau tanda strip (-).' })
      return
    }
    setLbSaving(true)
    const { error } = await supabase
      .from('profiles')
      .update({
        slug: slug || null,
        booking_online_aktif: lbAktif,
        booking_tampil_harga: lbHarga,
        booking_tampil_jam: lbJam,
        booking_pesan: lbPesan.trim().slice(0, 300),
        booking_clean_hijabdo_termasuk: lbCleanHijabdo,
      })
      .eq('id', user.id)
    setLbSaving(false)
    if (error) {
      const sudahDipakai = error.code === '23505' || /duplicate|unique/i.test(error.message)
      setLbMessage({ type: 'error', text: sudahDipakai ? 'Alamat link ini sudah dipakai MUA lain. Coba alamat lain.' : error.message })
      return
    }
    setLbSlug(slug)
    setLbSlugDisentuh(true)
    setLb((lama) => ({ ...lama, slug: slug || null, booking_online_aktif: lbAktif }))
    setLbAsli({ aktif: lbAktif, slug, slugDisentuh: true, harga: lbHarga, jam: lbJam, pesan: lbPesan.trim().slice(0, 300), cleanHijabdo: lbCleanHijabdo })
    if (lbPesan !== lbPesan.trim().slice(0, 300)) setLbPesan(lbPesan.trim().slice(0, 300))
    hapusDraf(kunciDrafLb)
    setLbMessage({ type: 'success', text: lbAktif ? 'Link booking online aktif.' : 'Pengaturan link booking disimpan (link nonaktif).' })
  }

  function handleCopyLinkBooking() {
    navigator.clipboard.writeText(linkBooking(rapikanSlug(slugTampil)))
    setLbCopied(true)
    setTimeout(() => setLbCopied(false), 2000)
  }

  // DRAF isian Profil yang belum disimpan -- disimpan di penyimpanan HP
  // (localStorage, per akun, berlaku 24 jam), biar nggak hilang kalau
  // halaman dimuat ulang saat user pindah ke aplikasi lain: HP menutup
  // aplikasi di latar belakang karena memori, atau aplikasi memuat versi
  // terbaru setelah ada update. Kata sandi & logo SENGAJA nggak masuk draf.
  // Draf dihapus begitu isian sama lagi dengan data tersimpan / disimpan.
  const kunciDraf = user ? `dapurmua:draf-pengaturan:${user.id}` : null
  const [formSiap, setFormSiap] = useState(false)

  // Isi form SEKALI saja, pas profil pertama kali kebaca (pakai draf kalau
  // ada). SEBELUMNYA form diisi ulang tiap kali objek `profile` berubah --
  // dan AuthContext memuat ulang profil tiap sesi login diperbarui (misal
  // saat user balik dari aplikasi lain), jadi isian yang belum disimpan
  // ketimpa data lama dari database.
  // setState di efek ini SENGAJA (sekali jalan, nyalin data luar ke form) --
  // bukan pola render beruntun yang dikhawatirkan aturan lint ini.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (!profile || formSiap) return
    const draf = bacaDraf(kunciDraf)
    const isi = draf || isiDariProfil(profile)
    setStudioName(isi.studioName)
    setKodePrefix(isi.kodePrefix)
    setInstagram(isi.instagram)
    setWhatsapp(isi.whatsapp)
    setRekening(isi.rekening)
    // Draf lama (sebelum ada field ini) nggak punya zonaWaktu -> pakai profil.
    setZonaWaktu(isi.zonaWaktu || kodeZona(profile))
    setFormSiap(true)
    setLoading(false)
  }, [profile, formSiap, kunciDraf])
  /* eslint-enable react-hooks/set-state-in-effect */

  // Simpan/hapus draf tiap isian berubah (baru jalan setelah form terisi).
  useEffect(() => {
    if (!formSiap || !kunciDraf || !profile) return
    const isi = { studioName, kodePrefix, instagram, whatsapp, rekening, zonaWaktu }
    try {
      if (JSON.stringify(isi) === JSON.stringify(isiDariProfil(profile))) localStorage.removeItem(kunciDraf)
      else localStorage.setItem(kunciDraf, JSON.stringify({ waktu: Date.now(), isi }))
    } catch { /* penyimpanan diblokir/penuh: form tetap jalan, cuma tanpa draf */ }
  }, [formSiap, kunciDraf, profile, studioName, kodePrefix, instagram, whatsapp, rekening, zonaWaktu])

  useEffect(() => {
    // Jaring pengaman -- kalau karena sebab tak terduga `profile` nggak
    // pernah keisi, jangan biarin loading nyangkut selamanya.
    const timeout = setTimeout(() => setLoading(false), 6000)
    return () => clearTimeout(timeout)
  }, [])

  useEffect(() => {
    // Kode kalender itu "kunci" buat link langganan (.ics) -- di-generate
    // SEKALI doang, otomatis, begitu ketauan user ini belum punya. Nggak
    // perlu tombol/aksi manual dari user.
    if (profile && !profile.kode_kalender && user) {
      const kode = crypto.randomUUID().replace(/-/g, '')
      supabase.from('profiles').upsert({ id: user.id, kode_kalender: kode }).then(({ error }) => {
        if (!error) refreshProfile(user.id)
      })
    }
  }, [profile, user, refreshProfile])

  function updateRekening(idx, field, value) {
    setRekening((list) => list.map((r, i) => (i === idx ? { ...r, [field]: value } : r)))
  }
  function addRekening() {
    setRekening((list) => [...list, { bank: '', nomor: '' }])
  }
  function removeRekening(idx) {
    setRekening((list) => list.filter((_, i) => i !== idx))
  }

  async function handleSaveProfile(e) {
    e.preventDefault()
    setMessage(null)
    // Nomor WhatsApp boleh kosong, tapi kalau diisi harus nomor yang benar
    // (dipakai di invoice & tombol WhatsApp di link booking).
    if (whatsapp.trim() && pesanNomorWaTidakValid(whatsapp)) {
      setMessage({ type: 'error', text: pesanNomorWaTidakValid(whatsapp) })
      return
    }
    setSaving(true)

    const cleanPrefix = kodePrefix.trim().toUpperCase().slice(0, 5) || 'Book'
    // Baris yang bank ATAU nomornya masih kosong nggak disimpen -- filter
    // rekening yang beneran keisi doang (2-2nya, bank & nomor).
    const cleanRekening = rekening
      .map((r) => ({ bank: r.bank.trim(), nomor: r.nomor.trim() }))
      .filter((r) => r.bank && r.nomor)

    // upsert (bukan update) -- jaga-jaga kalau baris profiles ternyata
    // belum ada, update() akan diam-diam nggak ngapa-ngapain tanpa error.
    const { error } = await supabase
      .from('profiles')
      .upsert({
        id: user.id,
        studio_name: studioName.trim(),
        kode_prefix: cleanPrefix,
        instagram: instagram.trim(),
        whatsapp: whatsapp.trim(),
        rekening: cleanRekening,
        zona_waktu: zonaWaktu,
      })

    setSaving(false)
    setKodePrefix(cleanPrefix)
    setRekening(cleanRekening.length > 0 ? cleanRekening : [{ bank: '', nomor: '' }])

    if (error) {
      setMessage({ type: 'error', text: error.message })
    } else {
      try { localStorage.removeItem(`dapurmua:draf-pengaturan:${user.id}`) } catch { /* abaikan */ }
      setMessage({ type: 'success', text: 'Perubahan berhasil disimpan.' })
      await refreshProfile(user.id) // biar Sidebar (nama studio) langsung ikut update
    }
  }

  // Upload logo -- disimpen di Storage bucket "logos", pathnya
  // `{user.id}/logo.{ext}` (biar tiap user cuma bisa nimpa logo-nya
  // sendiri, sesuai RLS policy yang di-setup di Supabase). URL publiknya
  // ditempel ` ?t=timestamp` biar browser nggak nge-cache gambar lama
  // begitu logo diganti.
  async function handleLogoChange(e) {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = '' // biar bisa pilih file yang SAMA lagi kalau perlu

    if (!file.type.startsWith('image/')) {
      setLogoMessage({ type: 'error', text: 'File harus berupa gambar (JPG/PNG).' })
      return
    }
    if (file.size > 2 * 1024 * 1024) {
      setLogoMessage({ type: 'error', text: 'Ukuran file maksimal 2MB.' })
      return
    }

    setUploadingLogo(true)
    setLogoMessage(null)

    const ext = file.name.split('.').pop()
    const filePath = `${user.id}/logo.${ext}`

    const { error: uploadError } = await supabase.storage
      .from('logos')
      .upload(filePath, file, { upsert: true, cacheControl: '3600' })

    if (uploadError) {
      setUploadingLogo(false)
      setLogoMessage({ type: 'error', text: uploadError.message })
      return
    }

    const { data: urlData } = supabase.storage.from('logos').getPublicUrl(filePath)
    const publicUrl = `${urlData.publicUrl}?t=${Date.now()}`

    const { error: dbError } = await supabase.from('profiles').upsert({ id: user.id, logo_url: publicUrl })

    setUploadingLogo(false)

    if (dbError) {
      setLogoMessage({ type: 'error', text: dbError.message })
    } else {
      setLogoMessage({ type: 'success', text: 'Logo berhasil diperbarui.' })
      await refreshProfile(user.id) // biar Sidebar langsung ikut update
    }
  }

  function handleCopyLink() {
    const link = `${window.location.origin}/api/kalender-ics?kode=${profile?.kode_kalender}`
    navigator.clipboard.writeText(link)
    setLinkCopied(true)
    setTimeout(() => setLinkCopied(false), 2000)
  }

  // Hapus logo -- 2 langkah: (1) coba bersihin file-nya dari Storage juga
  // (nggak wajib sukses, biar nggak numpuk file "sampah" tak terpakai),
  // (2) yang WAJIB & penentu tampilan balik ke avatar default: reset
  // `logo_url` di database jadi null.
  async function handleDeleteLogo() {
    setDeletingLogo(true)
    setLogoMessage(null)

    const { data: files } = await supabase.storage.from('logos').list(user.id)
    if (files && files.length > 0) {
      const paths = files.map((f) => `${user.id}/${f.name}`)
      await supabase.storage.from('logos').remove(paths)
    }

    const { error: dbError } = await supabase.from('profiles').upsert({ id: user.id, logo_url: null })

    setDeletingLogo(false)

    if (dbError) {
      setLogoMessage({ type: 'error', text: dbError.message })
    } else {
      setLogoMessage({ type: 'success', text: 'Logo berhasil dihapus.' })
      await refreshProfile(user.id) // biar avatar balik ke inisial di Sidebar juga
    }
  }

  async function handleChangePassword(e) {
    e.preventDefault()
    setPasswordMessage(null)

    // Aturan sama dengan halaman Daftar & Reset (lib/aturanPassword.js).
    const masalahPassword = cekPassword(newPassword)
    if (masalahPassword) {
      setPasswordMessage({ type: 'error', text: masalahPassword })
      return
    }

    setSavingPassword(true)
    const { error } = await supabase.auth.updateUser({ password: newPassword })
    setSavingPassword(false)

    if (error) setPasswordMessage({ type: 'error', text: pesanErrorPassword(error) })
    else {
      setPasswordMessage({ type: 'success', text: 'Kata sandi berhasil diubah.' })
      setNewPassword('')
    }
  }

  return (
    <div className="app-shell">
      <Sidebar />
      <div className="main">
        <div className="topbar">
          <div>
            <div className="greeting">Pengaturan</div>
            <div className="greeting-date">Kelola Profil Dapur MUA &amp; Akunmu</div>
          </div>
        </div>

        {loading ? (
          <div className="loading-state">Memuat data ....</div>
        ) : (
          <div className="pengaturan-layout">
            <div className="card-pengaturan">
              <div className="card-head-pengaturan"><h3>Profil Pengguna</h3></div>

              <form onSubmit={handleSaveProfile}>
                <div className="field logo-field">
                  <label>Logo Brand</label>
                  <div className="logo-upload-row">
                    <div className="logo-preview" onClick={() => fileInputRef.current?.click()}>
                      {profile?.logo_url ? (
                        <img src={profile.logo_url} alt="Logo brand" />
                      ) : (
                        <span>{initialsOf(studioName)}</span>
                      )}
                      <div className="logo-preview-overlay">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" /><circle cx="12" cy="13" r="4" /></svg>
                      </div>
                    </div>
                    <div>
                      <div className="logo-actions-row">
                        <button type="button" className="btn-ghost-small" onClick={() => fileInputRef.current?.click()} disabled={uploadingLogo || deletingLogo}>
                          {uploadingLogo ? 'Mengunggah ....' : 'Ganti Logo'}
                        </button>
                        {profile?.logo_url && (
                          <button type="button" className="btn-ghost-small btn-ghost-danger" onClick={handleDeleteLogo} disabled={uploadingLogo || deletingLogo}>
                            {deletingLogo ? 'Menghapus ....' : 'Hapus Logo'}
                          </button>
                        )}
                      </div>
                      <div className="field-hint">JPG/PNG, maksimal 2MB.</div>
                    </div>
                    <input ref={fileInputRef} type="file" accept="image/*" onChange={handleLogoChange} style={{ display: 'none' }} />
                  </div>
                  {logoMessage && (
                    <div className={logoMessage.type === 'success' ? 'msg-success' : 'msg-error'} style={{ marginTop: 10, alignSelf: 'flex-start' }}>{logoMessage.text}</div>
                  )}
                </div>

                <div className="field">
                  <label>Nama Brand MUA</label>
                  <input type="text" value={studioName} onChange={(e) => setStudioName(e.target.value)} placeholder="contoh: Makeup by Jenny" />
                </div>
                <div className="field-row">
                  <div className="field">
                    <label>Kode Prefix Booking</label>
                    <input type="text" value={kodePrefix} onChange={(e) => setKodePrefix(e.target.value)} placeholder="contoh: Book" maxLength={5} />
                    <span className="field-hint">Dipakai buat kode otomatis, contoh: "{kodePrefix || 'Book'}-0001"</span>
                  </div>
                  <div className="field">
                    <label>Email</label>
                    <input type="text" value={user?.email || ''} disabled />
                  </div>
                </div>
                <div className="field-row">
                  <div className="field">
                    <label>Instagram</label>
                    <input type="text" value={instagram} onChange={(e) => setInstagram(e.target.value)} placeholder="@makeupbyjenny" />
                  </div>
                  <div className="field">
                    <label>Nomor WhatsApp</label>
                    <input type="text" inputMode="tel" value={whatsapp} onChange={(e) => setWhatsapp(rapikanKetikanWa(e.target.value))} placeholder="085xxxxxxx" />
                  </div>
                </div>

                {/* Zona Waktu -- jam booking disimpan apa adanya (jam setempat),
                    ini cuma nentuin label "WIB/WITA/WIT" & zona di kalender HP.
                    Kalau zona perangkat beda dari pilihan, dikasih saran
                    (nggak diubah otomatis). */}
                <hr className="pengaturan-garis" />
                <div className="field">
                  <label id="label-zona-waktu">Zona Waktu</label>
                  <div className="zona-row" role="radiogroup" aria-labelledby="label-zona-waktu">
                    {ZONA_WAKTU.map((z) => (
                      <button
                        type="button"
                        key={z.kode}
                        role="radio"
                        aria-checked={zonaWaktu === z.kode}
                        className={`zona-opt${zonaWaktu === z.kode ? ' sel' : ''}`}
                        onClick={() => setZonaWaktu(z.kode)}
                      >
                        {z.kode}<small>{z.utc}</small>
                      </button>
                    ))}
                  </div>
                  <span className="field-hint">
                    {ZONA_WAKTU.find((z) => z.kode === zonaWaktu)?.wilayah}. Dipakai untuk jam di invoice, Dashboard, Kalender, dan kalender HP.
                  </span>
                  {zonaPerangkat && zonaPerangkat !== zonaWaktu && (
                    <div className="zona-saran">
                      <span>Perangkatmu terdeteksi di zona <b>{zonaPerangkat}</b>.</span>
                      <button type="button" className="btn-ghost-small" onClick={() => setZonaWaktu(zonaPerangkat)}>Pakai {zonaPerangkat}</button>
                    </div>
                  )}
                </div>

                {/* Rekening -- BISA lebih dari 1 (beda dari field lain di
                    atas yang 1 nilai doang), makanya dirender sebagai
                    daftar baris yang bisa ditambah/dihapus. Ditaruh di
                    BAWAH Nomor WhatsApp, sesuai diminta. */}
                <hr className="pengaturan-garis" />
                <div className="field">
                  <label>Nomor Rekening</label>
                  <div className="field-note-italic">*jika diisi, akan ditampilkan di lembar Invoice dan Remittance Advice sebagai informasi ke klien</div>
                  {rekening.map((r, idx) => (
                    <div className="rekening-row" key={idx}>
                      <input type="text" value={r.bank} onChange={(e) => updateRekening(idx, 'bank', e.target.value)} placeholder="BCA/BRI/BNI" className="rekening-input-bank" />
                      <input type="text" inputMode="numeric" value={r.nomor} onChange={(e) => updateRekening(idx, 'nomor', e.target.value.replace(/[^0-9]/g, ''))} placeholder="Nomor Rekening" className="rekening-input-nomor" />
                      {rekening.length > 1 && (
                        <button type="button" className="rekening-hapus" onClick={() => removeRekening(idx)} aria-label="Hapus rekening ini">
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="15" height="15"><path d="M3 6h18" /><path d="M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" /><path d="M10 11v6M14 11v6" /></svg>
                        </button>
                      )}
                    </div>
                  ))}
                  <button type="button" className="btn-ghost-small" onClick={addRekening}>+ Tambah Rekening</button>
                </div>

                <hr className="pengaturan-garis" />
                <button className="btn-primary" type="submit" disabled={saving}>
                  {saving ? 'Menyimpan ....' : 'Simpan Perubahan'}
                </button>

                {message && (
                  <div className={message.type === 'success' ? 'msg-success' : 'msg-error'} style={{ marginTop: 14 }}>{message.text}</div>
                )}
              </form>
            </div>

            <div className="card-pengaturan">
              <div className="card-head-pengaturan"><h3>Link Booking Online</h3></div>
              {lb === null ? (
                <div className="field-hint">Memuat ....</div>
              ) : lb.gagal ? (
                <div className="field-hint">Fitur link booking online belum siap. Hubungi admin Dapur MUA.</div>
              ) : (
                <form onSubmit={handleSaveLinkBooking}>
                  <p className="danger-text" style={{ marginBottom: 14 }}>
                    Bagikan link ini ke calon klien (misalnya di bio Instagram). Calon klien bisa melihat tanggal yang masih kosong,
                    memilih paket, lalu mengirim permintaan booking. Permintaan masuk ke halaman Permintaan Booking dan baru jadi
                    booking setelah kamu terima.
                  </p>
                  <div className="field">
                    <label id="label-lb-aktif">Status Link</label>
                    <div className="lb-row" role="radiogroup" aria-labelledby="label-lb-aktif">
                      <button type="button" role="radio" aria-checked={lbAktif} className={`zona-opt${lbAktif ? ' sel' : ''}`} onClick={() => setLbAktif(true)}>Aktif</button>
                      <button type="button" role="radio" aria-checked={!lbAktif} className={`zona-opt${!lbAktif ? ' sel' : ''}`} onClick={() => setLbAktif(false)}>Nonaktif</button>
                    </div>
                  </div>
                  <div className="field">
                    <label>Alamat Link</label>
                    <div className="lb-slug">
                      <span className="lb-slug-awal">{window.location.host}/b/</span>
                      <input type="text" value={slugTampil} onChange={(e) => ketikSlug(e.target.value)} onBlur={() => setLbSlug(rapikanSlug(slugTampil))} placeholder="namabrand" maxLength={40} autoCapitalize="none" autoCorrect="off" spellCheck={false} />
                    </div>
                    <span className="field-hint">Link bisa diubah dengan huruf kecil, angka, atau tanda strip. Kalau alamatnya diganti, link lama nggak bisa dibuka lagi.</span>
                  </div>
                  {/* Link cuma ditampilkan kalau SUDAH tersimpan & aktif (biar yang
                      disalin pasti link yang beneran jalan). */}
                  {lb.booking_online_aktif && lb.slug && lb.slug === rapikanSlug(slugTampil) && (
                    <div className="field">
                      <div className="field-control-link lb-link">
                        <input type="text" readOnly value={linkBooking(rapikanSlug(slugTampil))} onFocus={(e) => e.target.select()} />
                        <button type="button" className="btn-primary" onClick={handleCopyLinkBooking}>{lbCopied ? 'Tersalin!' : 'Salin Link'}</button>
                        <a className="btn-primary" href={linkBooking(rapikanSlug(slugTampil))} target="_blank" rel="noreferrer">Buka</a>
                      </div>
                    </div>
                  )}
                  <hr className="pengaturan-garis" />
                  <div className="field-row">
                    <div className="field">
                      <label id="label-lb-harga">Harga Paket</label>
                      <div className="lb-row" role="radiogroup" aria-labelledby="label-lb-harga">
                        <button type="button" role="radio" aria-checked={lbHarga} className={`zona-opt${lbHarga ? ' sel' : ''}`} onClick={() => setLbHarga(true)}>Tampilkan</button>
                        <button type="button" role="radio" aria-checked={!lbHarga} className={`zona-opt${!lbHarga ? ' sel' : ''}`} onClick={() => setLbHarga(false)}>Sembunyikan</button>
                      </div>
                    </div>
                    <div className="field">
                      <label id="label-lb-jam">Jam yang Sudah Terisi</label>
                      <div className="lb-row" role="radiogroup" aria-labelledby="label-lb-jam">
                        <button type="button" role="radio" aria-checked={lbJam} className={`zona-opt${lbJam ? ' sel' : ''}`} onClick={() => setLbJam(true)}>Tampilkan</button>
                        <button type="button" role="radio" aria-checked={!lbJam} className={`zona-opt${!lbJam ? ' sel' : ''}`} onClick={() => setLbJam(false)}>Sembunyikan</button>
                      </div>
                    </div>
                  </div>
                  <span className="field-hint lb-hint">Harga baru muncul setelah calon klien memilih paket. Jam terisi cuma menampilkan jamnya (misal 04:00 – 06:00). Nama klien, acara, dan lokasi nggak pernah ditampilkan.</span>
                  <div className="field">
                    <label id="label-lb-hijabdo">Clean Hijabdo Sudah Termasuk Jasa Makeup?</label>
                    <div className="lb-row" role="radiogroup" aria-labelledby="label-lb-hijabdo">
                      <button type="button" role="radio" aria-checked={lbCleanHijabdo} className={`zona-opt${lbCleanHijabdo ? ' sel' : ''}`} onClick={() => setLbCleanHijabdo(true)}>Ya</button>
                      <button type="button" role="radio" aria-checked={!lbCleanHijabdo} className={`zona-opt${!lbCleanHijabdo ? ' sel' : ''}`} onClick={() => setLbCleanHijabdo(false)}>Tidak</button>
                    </div>
                    <span className="field-hint">Kalau Ya, calon klien melihat keterangan di pilihan Add On Layanan Rambut bahwa Clean Hijabdo sudah termasuk dalam layanan makeup, dan Hijabdo+ adalah layanan kreasi hijab khusus.</span>
                  </div>
                  <div className="field">
                    <label>Pesan untuk Calon Klien <span className="lb-opsional">(opsional)</span></label>
                    <textarea className="lb-pesan" value={lbPesan} onChange={(e) => setLbPesan(e.target.value)} maxLength={300} rows={3} placeholder="contoh: Booking dikonfirmasi setelah DP diterima. Hanya melayani area Jabodetabek." />
                  </div>
                  <hr className="pengaturan-garis" />
                  {!profile?.whatsapp && <div className="msg-error">Isi Nomor WhatsApp di Profil Pengguna supaya calon klien bisa langsung menghubungimu setelah mengirim permintaan.</div>}
                  <button className="btn-primary" type="submit" disabled={lbSaving}>{lbSaving ? 'Menyimpan ....' : 'Simpan Link Booking'}</button>
                  {lbMessage && <div className={lbMessage.type === 'success' ? 'msg-success' : 'msg-error'} style={{ marginTop: 14 }}>{lbMessage.text}</div>}
                </form>
              )}
            </div>

            <div className="card-pengaturan">
              <div className="card-head-pengaturan"><h3>Isi Halaman Link</h3></div>
              {hl === null ? (
                <div className="field-hint">Memuat ....</div>
              ) : hl.gagal ? (
                <div className="field-hint">Fitur halaman link belum siap. Hubungi admin Dapur MUA.</div>
              ) : (
                <form onSubmit={handleSaveHalamanLink}>
                  <p className="danger-text" style={{ marginBottom: 14 }}>
                    Atur apa saja yang tampil di halaman link booking-mu (yang dipasang di bio medsos), selain tombol
                    Booking Sekarang dan kalender jadwal.
                  </p>
                  <div className="field">
                    <label id="label-hl-paket">Daftar Paket Makeup</label>
                    <div className="lb-row" role="radiogroup" aria-labelledby="label-hl-paket">
                      <button type="button" role="radio" aria-checked={hlTampilPaket} className={`zona-opt${hlTampilPaket ? ' sel' : ''}`} onClick={() => setHlTampilPaket(true)}>Tampilkan</button>
                      <button type="button" role="radio" aria-checked={!hlTampilPaket} className={`zona-opt${!hlTampilPaket ? ' sel' : ''}`} onClick={() => setHlTampilPaket(false)}>Sembunyikan</button>
                    </div>
                    <span className="field-hint">Diambil dari paket aktif di Paket Layanan. Harga ikut pilihan Harga Paket di atas.</span>
                  </div>
                  <hr className="pengaturan-garis" />
                  <div className="field">
                    <label>Link Tambahan <span className="lb-opsional">(opsional, maks. {MAKS_LINK})</span></label>
                    <span className="field-hint lt-hint">Contoh: WhatsApp, Instagram, TikTok, pricelist Google Drive, link affiliate. Tampil sebagai tombol di bawah tombol Booking Sekarang, sesuai urutan di sini. Untuk WhatsApp cukup ketik nomornya, otomatis jadi link chat.</span>
                    {hlLinks.map((l, i) => (
                      <div className={`lt-item${l.aktif ? '' : ' lt-nonaktif'}`} key={l.id}>
                        <div className="lt-isian">
                          <input type="text" value={l.judul} onChange={(e) => ubahLink(i, 'judul', e.target.value)} placeholder="Judul tombol, contoh: Pricelist Lengkap" maxLength={MAKS_JUDUL} aria-label={`Judul link ${i + 1}`} />
                          {l.wa ? (
                            <input type="tel" inputMode="tel" value={l.wa.nomor} onChange={(e) => ubahWa(i, 'nomor', rapikanKetikanWa(e.target.value))} placeholder="Nomor WhatsApp, contoh: 0812xxxxxxx" maxLength={25} aria-label={`Nomor WhatsApp link ${i + 1}`} />
                          ) : (
                            <input type="url" inputMode="url" value={l.url} onChange={(e) => ubahLink(i, 'url', e.target.value)} onBlur={(e) => selesaiKetikUrl(i, e.target.value)} placeholder={placeholderAlamat(l.judul, l.ikon)} maxLength={500} autoCapitalize="none" autoCorrect="off" spellCheck={false} aria-label={`Alamat link ${i + 1}`} />
                          )}
                        </div>
                        {/* Link WhatsApp: teks yang otomatis terisi di kolom chat
                            calon klien (ditulis biasa, tanpa %20). */}
                        {l.wa && (
                          <div className="lt-wa-teks">
                            <label htmlFor={`lt-wa-teks-${l.id}`}>Teks pembuka chat <span className="lb-opsional">(opsional)</span></label>
                            <textarea id={`lt-wa-teks-${l.id}`} className="lb-pesan" value={l.wa.teks} onChange={(e) => ubahWa(i, 'teks', e.target.value)} maxLength={MAKS_TEKS_WA} rows={2} placeholder="contoh: Halo Kak, saya mau tanya jadwal makeup." />
                            <span className="field-hint">Otomatis terisi di kolom chat calon klien. <button type="button" className="lt-link-kecil" onClick={() => keAlamatBiasa(i)}>Pakai alamat link biasa</button></span>
                          </div>
                        )}
                        {/* Ikon tombol: Otomatis (ditebak dari alamat, misal
                            tiktok.com -> ikon TikTok), Link biasa, atau pilih
                            ikon medsos sendiri. */}
                        {hlDukungIkon && (
                          <div className="lt-ikon-baris">
                            <span className="lt-ikon-label">Ikon</span>
                            <div className="lt-ikon-pilih">
                              <CustomSelect options={OPSI_IKON} value={labelIkon(l.ikon)} onChange={(lbl) => pilihIkon(i, ikonDariLabel(lbl))} icon={<PratinjauIkon ikon={l.ikon} url={rapikanUrl(l.url)} />} />
                            </div>
                          </div>
                        )}
                        <div className="lt-aksi">
                          <button type="button" className="lt-btn" onClick={() => geserLink(i, -1)} disabled={i === 0} aria-label="Naikkan">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M6 15l6-6 6 6" /></svg>
                          </button>
                          <button type="button" className="lt-btn" onClick={() => geserLink(i, 1)} disabled={i === hlLinks.length - 1} aria-label="Turunkan">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M6 9l6 6 6-6" /></svg>
                          </button>
                          <button type="button" className={`lt-btn lt-tampil${l.aktif ? ' sel' : ''}`} onClick={() => ubahLink(i, 'aktif', !l.aktif)} aria-pressed={l.aktif}>
                            {l.aktif ? 'Tampil' : 'Disembunyikan'}
                          </button>
                          <button type="button" className="rekening-hapus" onClick={() => hapusLink(i)} aria-label={`Hapus link ${i + 1}`} title="Hapus link">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="15" height="15"><path d="M3 6h18" /><path d="M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" /><path d="M10 11v6M14 11v6" /></svg>
                          </button>
                        </div>
                      </div>
                    ))}
                    {hlLinks.length < MAKS_LINK ? (
                      <div className="lt-tambah-baris">
                        <button type="button" className="btn-ghost-small lt-tambah" onClick={tambahLink}>+ Tambah Link</button>
                        {usulanProfil.length > 0 && (
                          <button type="button" className="btn-ghost-small lt-tambah" onClick={tambahDariProfil}>
                            + Tambah {usulanProfil.map((l) => (l.ikon === 'whatsapp' ? 'WhatsApp' : 'Instagram')).join(' & ')} dari Profil
                          </button>
                        )}
                      </div>
                    ) : (
                      <span className="field-hint">Sudah {MAKS_LINK} link (batas maksimal).</span>
                    )}
                  </div>
                  <hr className="pengaturan-garis" />
                  <button className="btn-primary" type="submit" disabled={hlSaving}>{hlSaving ? 'Menyimpan ....' : 'Simpan Halaman Link'}</button>
                  {hlMessage && <div className={hlMessage.type === 'success' ? 'msg-success' : 'msg-error'} style={{ marginTop: 14 }}>{hlMessage.text}</div>}
                </form>
              )}
            </div>

            <div className="card-pengaturan">
              <div className="card-head-pengaturan"><h3>Ubah Kata Sandi</h3></div>
              {passwordMessage && (
                <div className={passwordMessage.type === 'success' ? 'msg-success' : 'msg-error'}>{passwordMessage.text}</div>
              )}
              <form onSubmit={handleChangePassword}>
                <div className="field">
                  <label>Kata Sandi Baru</label>
                  <div className="field-control-pw">
                    <input
                      type={showNewPassword ? 'text' : 'password'}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder={`Minimal ${PANJANG_MIN_PASSWORD} karakter`}
                      autoComplete="new-password"
                      aria-describedby="ubah-password-petunjuk"
                    />
                    <button
                      type="button"
                      className="field-toggle-pw"
                      onClick={() => setShowNewPassword((v) => !v)}
                      aria-label={showNewPassword ? 'Sembunyikan kata sandi' : 'Tampilkan kata sandi'}
                    >
                      {showNewPassword ? (
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17.94 17.94A10.94 10.94 0 0 1 12 20c-7 0-11-8-11-8a18.5 18.5 0 0 1 5.06-5.94M9.9 4.24A10.94 10.94 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19M14.12 14.12a3 3 0 1 1-4.24-4.24" /><path d="M1 1l22 22" /></svg>
                      ) : (
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>
                      )}
                    </button>
                  </div>
                  <span className="field-hint" id="ubah-password-petunjuk">{PETUNJUK_PASSWORD}</span>
                </div>
                <button className="btn-primary" type="submit" disabled={savingPassword}>
                  {savingPassword ? 'Menyimpan ....' : 'Ubah Kata Sandi'}
                </button>
              </form>
            </div>

            <div className="card-pengaturan">
              <div className="card-head-pengaturan"><h3>Sinkronisasi Kalender</h3></div>
              <p className="danger-text" style={{ marginBottom: 14 }}>
                Salin link di bawah, terus tempel di app Kalender HP kamu (Google Calendar / Kalender iPhone / Outlook)
                lewat menu "Subscribe from URL" atau "Tambah kalender lain". Semua jadwal booking bakal otomatis
                muncul di situ, dan ke-update sendiri kalau ada booking baru.
              </p>
              {profile?.kode_kalender ? (
                <div className="field">
                  <label>Link Kalender</label>
                  <div className="field-control-link">
                    <input
                      type="text"
                      readOnly
                      value={`${window.location.origin}/api/kalender-ics?kode=${profile.kode_kalender}`}
                      onFocus={(e) => e.target.select()}
                    />
                    <button type="button" className="btn-primary" onClick={handleCopyLink}>
                      {linkCopied ? 'Tersalin!' : 'Salin Link'}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="field-hint">Menyiapkan link kalender kamu</div>
              )}
            </div>

          </div>
        )}
      </div>
    </div>
  )
}
