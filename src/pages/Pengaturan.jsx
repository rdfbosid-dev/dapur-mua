import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import Sidebar from '../components/Sidebar'
import './Pengaturan.css'

function initialsOf(name) {
  return (name || '?').split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase()
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

  useEffect(() => {
    if (profile) {
      setStudioName(profile.studio_name || '')
      setKodePrefix(profile.kode_prefix || '')
      setInstagram(profile.instagram || '')
      setWhatsapp(profile.whatsapp || '')
      // Kalau profile.rekening kosong/belum ada, tetep pasang 1 baris
      // kosong (bukan array kosong beneran) -- biar form-nya langsung
      // ada tempat buat isi, bukan cuma tombol "+ Tambah" doang.
      setRekening(profile.rekening && profile.rekening.length > 0 ? profile.rekening : [{ bank: '', nomor: '' }])
      setLoading(false)
    }
  }, [profile])

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
    setSaving(true)
    setMessage(null)

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
      })

    setSaving(false)
    setKodePrefix(cleanPrefix)
    setRekening(cleanRekening.length > 0 ? cleanRekening : [{ bank: '', nomor: '' }])

    if (error) {
      setMessage({ type: 'error', text: error.message })
    } else {
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

    if (newPassword.length < 6) {
      setPasswordMessage({ type: 'error', text: 'Kata sandi minimal 6 karakter.' })
      return
    }

    setSavingPassword(true)
    const { error } = await supabase.auth.updateUser({ password: newPassword })
    setSavingPassword(false)

    if (error) setPasswordMessage({ type: 'error', text: error.message })
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
          <div className="loading-state">Memuat data...</div>
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
                          {uploadingLogo ? 'Mengunggah...' : 'Ganti Logo'}
                        </button>
                        {profile?.logo_url && (
                          <button type="button" className="btn-ghost-small btn-ghost-danger" onClick={handleDeleteLogo} disabled={uploadingLogo || deletingLogo}>
                            {deletingLogo ? 'Menghapus...' : 'Hapus Logo'}
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
                    <input type="text" value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} placeholder="085xxxxxxx" />
                  </div>
                </div>

                {/* Rekening -- BISA lebih dari 1 (beda dari field lain di
                    atas yang 1 nilai doang), makanya dirender sebagai
                    daftar baris yang bisa ditambah/dihapus. Ditaruh di
                    BAWAH Nomor WhatsApp, sesuai diminta. */}
                <div className="field">
                  <label>Nomor Rekening</label>
                  <div className="field-note-italic">*jika diisi, akan ditampilkan di lembar Invoice dan Remittance Advice sebagai informasi ke klien</div>
                  {rekening.map((r, idx) => (
                    <div className="rekening-row" key={idx}>
                      <input type="text" value={r.bank} onChange={(e) => updateRekening(idx, 'bank', e.target.value)} placeholder="BCA/BRI/BNI" className="rekening-input-bank" />
                      <input type="text" inputMode="numeric" value={r.nomor} onChange={(e) => updateRekening(idx, 'nomor', e.target.value.replace(/[^0-9]/g, ''))} placeholder="Nomor Rekening" className="rekening-input-nomor" />
                      {rekening.length > 1 && (
                        <button type="button" className="rekening-hapus" onClick={() => removeRekening(idx)} aria-label="Hapus rekening ini">
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" width="14" height="14"><path d="M6 6l12 12M18 6L6 18" /></svg>
                        </button>
                      )}
                    </div>
                  ))}
                  <button type="button" className="btn-ghost-small" onClick={addRekening}>+ Tambah Rekening</button>
                </div>

                <button className="btn-primary" type="submit" disabled={saving}>
                  {saving ? 'Menyimpan...' : 'Simpan Perubahan'}
                </button>

                {message && (
                  <div className={message.type === 'success' ? 'msg-success' : 'msg-error'} style={{ marginTop: 14 }}>{message.text}</div>
                )}
              </form>
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
                      placeholder="Minimal 6 karakter"
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
                </div>
                <button className="btn-primary" type="submit" disabled={savingPassword}>
                  {savingPassword ? 'Menyimpan...' : 'Ubah Kata Sandi'}
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
                <div className="field-hint">Menyiapkan link kalender kamu...</div>
              )}
            </div>

          </div>
        )}
      </div>
    </div>
  )
}
