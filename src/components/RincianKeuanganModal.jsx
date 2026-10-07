import { useState } from 'react'
import RemittanceAdviceModal from './RemittanceAdviceModal'
import './RincianKeuanganModal.css'
import IconClose from './IconClose'

function formatRupiah(n) {
  const num = Number(n) || 0
  const sign = num < 0 ? '-' : ''
  return sign + 'Rp' + Math.abs(num).toLocaleString('id-ID')
}

// Modal INTERNAL buat MUA sendiri -- beda total sama section "PEMBAYARAN"
// di BookingDetailModal (yang itu soal tagihan KE KLIEN). Ini jawab
// pertanyaan "dari booking ini, MUA-nya dapet berapa & dari mana aja".
// SENGAJA dipisah total jadi modal sendiri (bukan disisipin/collapsible
// di detail booking) -- biar nggak nyampur 2 jenis informasi yang beda
// audiens-nya, dan biar detail booking yang udah lumayan padat nggak
// tambah panjang.
//
// SEMUA section di bawah SENGAJA dipecah PER ITEM (per klien, per add
// on, per paket bundling) -- BUKAN digabung/dijumlahin -- biar user
// bisa liat & cocokin manual satu-satu, dari mana asal tiap rupiah-nya.
export default function RincianKeuanganModal({ booking, peserta, bundlingItems = [], onClose }) {
  // Kartu mana yang lagi aktif -- nentuin ANGKA MANA yang ditampilin di
  // tiap baris rincian di bawah. Defaultnya "belanja" (kartu paling
  // kiri) biar modal nggak kosong pas pertama dibuka.
  const [activeCard, setActiveCard] = useState('belanja')
  // Key pihak (Tim/Vendor) yang lagi dipilih buat dibikinin Remittance
  // Advice -- null berarti nggak ada modal RA yang lagi kebuka.
  const [selectedPayeeKey, setSelectedPayeeKey] = useState(null)

  const transport = booking.biaya_transport || 0
  const punyaTambahan = (p) => p.layanan_tambahan && p.layanan_tambahan !== 'Tidak Ada'

  // Makeup & Tambahan -- PER KLIEN, bukan digabung jadi 1 baris "Me · N
  // klien". "biaya" = jumlah PENUH yang ditagih ke klien (dipake pas
  // kartu Belanja Klien aktif). "komisi" = bagian yang MASUK ke Me
  // kalau dikerjain Tim (dipake pas kartu Omzet/Penghasilan aktif,
  // liat pickNilai di bawah).
  const makeupRows = peserta.map((p) => {
    const tim = p.dikerjakan_oleh_makeup === 'Tim'
    // Jumlah Sesi Makeup -- TERPISAH dari Jumlah Sesi Layanan
    // Tambahan (lihat tambahanRows di bawah). Biaya & komisi yang
    // ditampilin di sini UDAH dikali, biar rincian ini selalu cocok
    // sama angka final di kartu Belanja Klien/Omzet/Penghasilan.
    const sesi = Math.max(1, Number(p.jumlah_sesi_makeup) || 1)
    return {
      nama: p.nama_anggota,
      tim,
      namaTim: p.nama_tim_makeup,
      sesi,
      biaya: (Number(p.biaya_makeup) || 0) * sesi,
      komisi: (Number(p.komisi_makeup_tim) || 0) * sesi,
    }
  })

  // Retouch -- JASA (sekelas Makeup), BUKAN produk. Selalu Me, nggak
  // ada Tim/Komisi, jadi nilainya SELALU biaya penuh apapun kartu yang
  // lagi aktif (Belanja Klien/Omzet/Penghasilan sama-sama make angka
  // ini apa adanya).
  const retouchRows = peserta.filter((p) => p.retouch).map((p) => ({
    nama: p.nama_anggota,
    biaya: Number(p.biaya_retouch) || 0,
  }))

  const tambahanRows = peserta.filter(punyaTambahan).map((p) => {
    const tim = p.dikerjakan_oleh_tambahan === 'Tim'
    const sesi = Math.max(1, Number(p.jumlah_sesi_tambahan) || 1)
    return {
      nama: p.nama_anggota,
      jenis: p.layanan_tambahan,
      tim,
      namaTim: p.nama_tim_tambahan,
      sesi,
      biaya: (Number(p.biaya_tambahan) || 0) * sesi,
      komisi: (Number(p.komisi_tambahan) || 0) * sesi,
    }
  })

  // Fee Transport Tim -- ongkos transport yang ditagih ke klien &
  // diteruskan PENUH ke tim (per peserta, nempel ke nama tim Makeup
  // atau tim Layanan Tambahan-nya). Konsep "3 ember": Belanja Klien =
  // Penghasilan + Ongkos Transport + Pengeluaran Booking. Fee ini masuk
  // ember ONGKOS (sama kayak Biaya Transport punya MUA) -- BUKAN
  // Omzet/Penghasilan, dan BUKAN Pengeluaran. Tapi tetep ikut ke
  // Remittance Advice (uangnya emang ditransfer ke tim). Cuma dihitung
  // kalau beneran dikerjain Tim, sama kayak filter di VIEW
  // booking_summary (transport_tim_total).
  const transportTimRows = []
  peserta.forEach((p) => {
    const feeMakeup = Number(p.transport_tim_makeup) || 0
    if (p.dikerjakan_oleh_makeup === 'Tim' && feeMakeup > 0) {
      transportTimRows.push({ nama: p.nama_anggota, jenis: 'Makeup', namaTim: p.nama_tim_makeup, fee: feeMakeup })
    }
    const feeTambahan = Number(p.transport_tim_tambahan) || 0
    if (punyaTambahan(p) && p.dikerjakan_oleh_tambahan === 'Tim' && feeTambahan > 0) {
      transportTimRows.push({ nama: p.nama_anggota, jenis: p.layanan_tambahan, namaTim: p.nama_tim_tambahan, fee: feeTambahan })
    }
  })

  const addOnItems = []
  peserta.forEach((p) => {
    for (let n = 1; n <= 5; n++) {
      const suffix = n === 1 ? '' : `_${n}`
      const nama = (p[`layanan_lainnya${suffix}`] || '').trim()
      if (nama) {
        const jumlah = Math.max(1, Number(p[`jumlah_lainnya${suffix}`]) || 1)
        addOnItems.push({
          nama,
          pesertaNama: p.nama_anggota,
          jumlah,
          biaya: (Number(p[`biaya_lainnya${suffix}`]) || 0) * jumlah,
          untung: (Number(p[`keuntungan_lainnya${suffix}`]) || 0) * jumlah,
        })
      }
    }
  })

  // Add On Item (Sewa) -- section TERPISAH dari Add On Item biasa di
  // atas, rumusnya BEDA: numpang Paket Bundling (biaya PENUH masuk
  // Belanja Klien, UNTUNG DOANG yang masuk Omzet/Penghasilan -- bukan
  // biaya penuh kayak Add On Item biasa). Karena rumusnya beda, arraynya
  // dipisah sendiri, bukan digabung ke addOnItems.
  const sewaRows = []
  peserta.forEach((p) => {
    for (let n = 1; n <= 5; n++) {
      const suffix = n === 1 ? '' : `_${n}`
      const nama = (p[`nama_sewa${suffix}`] || '').trim()
      if (nama) {
        const jumlah = Math.max(1, Number(p[`jumlah_sewa${suffix}`]) || 1)
        sewaRows.push({
          nama,
          vendor: (p[`vendor_sewa${suffix}`] || '').trim(),
          pesertaNama: p.nama_anggota,
          jumlah,
          biaya: (Number(p[`biaya_sewa${suffix}`]) || 0) * jumlah,
          untung: (Number(p[`untung_sewa${suffix}`]) || 0) * jumlah,
        })
      }
    }
  })

  const bundlingTop = bundlingItems.filter((b) => !b.parent_id)
  const makeupMeAda = makeupRows.some((r) => !r.tim)
  const makeupTimAda = makeupRows.some((r) => r.tim)
  const tambahanMeAda = tambahanRows.some((r) => !r.tim)
  const tambahanTimAda = tambahanRows.some((r) => r.tim)

  // "Pengeluaran" (kartu ke-4, BARU) -- BEDA TOTAL sama fitur tabel
  // `pengeluaran` yang terpisah (itu buat pengeluaran bisnis umum yang
  // diinput manual, bukan dari sini). Yang ini adalah bagian dari data
  // booking yang SUDAH ADA, cuma belum pernah ditarik keluar jadi
  // angka sendiri: selisih antara biaya PENUH yang ditagih ke klien
  // dan komisi/untung yang di-set user -- itu bagian yang "keluar" ke
  // tim/vendor luar, BUKAN masuk kantong MUA. Cuma dihitung buat
  // baris yang MEMANG dikerjain Tim (Makeup/Tambahan) atau emang
  // punya vendor luar (Add On/Paket Bundling) -- baris yang dikerjain
  // Me sendiri nggak ada "pengeluaran"-nya (0).
  function pengeluaranMakeupTambahan(r) {
    return r.tim ? Math.max(0, r.biaya - r.komisi) : 0
  }
  function pengeluaranAddOn(item) {
    return Math.max(0, item.biaya - item.untung)
  }
  function pengeluaranSewa(item) {
    return Math.max(0, item.biaya - item.untung)
  }
  function pengeluaranBundling(item) {
    return Math.max(0, (Number(item.biaya) || 0) - (Number(item.keuntungan) || 0))
  }
  const totalPengeluaranMakeup = makeupRows.reduce((s, r) => s + pengeluaranMakeupTambahan(r), 0)
  const totalPengeluaranTambahan = tambahanRows.reduce((s, r) => s + pengeluaranMakeupTambahan(r), 0)
  const totalPengeluaranAddOn = addOnItems.reduce((s, i) => s + pengeluaranAddOn(i), 0)
  const totalPengeluaranSewa = sewaRows.reduce((s, i) => s + pengeluaranSewa(i), 0)
  const totalPengeluaranBundling = bundlingItems.reduce((s, i) => s + pengeluaranBundling(i), 0)
  const totalPengeluaran = totalPengeluaranMakeup + totalPengeluaranTambahan + totalPengeluaranAddOn + totalPengeluaranSewa + totalPengeluaranBundling
  // Baris yang beneran ditampilin di section "Pengeluaran" -- CUMA yang
  // nilainya > 0 (baris Me/item tanpa selisih nggak usah nongol, biar
  // nggak berisik nampilin "Rp0" di mana-mana).
  const pengeluaranMakeupRows = makeupRows.filter((r) => pengeluaranMakeupTambahan(r) > 0)
  const pengeluaranTambahanRows = tambahanRows.filter((r) => pengeluaranMakeupTambahan(r) > 0)
  const pengeluaranAddOnRows = addOnItems.filter((i) => pengeluaranAddOn(i) > 0)
  const pengeluaranSewaRows = sewaRows.filter((i) => pengeluaranSewa(i) > 0)
  const pengeluaranBundlingTop = bundlingTop.filter((i) => pengeluaranBundling(i) > 0 || bundlingItems.some((c) => c.parent_id === i.id && pengeluaranBundling(c) > 0))

  // ============================================================
  // REMITTANCE ADVICE -- gabungin semua baris Pengeluaran (Tim Makeup,
  // Tim Layanan Tambahan, Add On Sewa, Paket Bundling) JADI 1 PIHAK
  // per nama/handle yang SAMA -- misal vendor "@fourgrads" ngerjain
  // Fotografer & Attire dalam 1 booking, harus jadi 1 dokumen, bukan 2.
  //
  // Cara ngelompokinnya: ambil bagian "(...)" di AKHIR nama kalau ada
  // (pola sama kayak highlightKurung di bawah) -- itu yang jadi KUNCI
  // pengelompokan (misal "Fotografer (@fourgrads)" -> kunci "@fourgrads").
  // Kalau nggak ada tanda kurung (misal Tim ditulis "@hairdobygal"
  // polos, atau Nama Vendor Sewa "Toko Kebaya Ayu"), kunci = teks penuh
  // apa adanya. "role" (bagian SEBELUM kurung) dipake buat label jasa
  // baris Paket Bundling-nya sendiri (misal "Fotografer").
  function splitNamaVendor(nama) {
    const n = (nama || '').trim()
    const match = n.match(/^(.*?)\s*\(([^)]*)\)\s*$/)
    if (match) {
      const handle = match[2].trim()
      return { key: handle.toLowerCase(), display: handle, role: match[1].trim() || handle }
    }
    return { key: n.toLowerCase(), display: n, role: n }
  }

  const pengeluaranPayeeMap = new Map()
  function tambahKePayee(rawNama, jasa, jumlah, dibayar) {
    const nama = (rawNama || '').trim()
    if (!nama || dibayar <= 0) return
    const { key, display } = splitNamaVendor(nama)
    if (!pengeluaranPayeeMap.has(key)) pengeluaranPayeeMap.set(key, { key, display, items: [], total: 0 })
    const entry = pengeluaranPayeeMap.get(key)
    entry.items.push({ jasa, jumlah, dibayar })
    entry.total += dibayar
  }

  makeupRows.forEach((r) => {
    if (r.tim) tambahKePayee(r.namaTim, `Makeup — ${r.nama}`, r.sesi, pengeluaranMakeupTambahan(r))
  })
  tambahanRows.forEach((r) => {
    if (r.tim) tambahKePayee(r.namaTim, `${r.jenis} — ${r.nama}`, r.sesi, pengeluaranMakeupTambahan(r))
  })
  transportTimRows.forEach((r) => {
    tambahKePayee(r.namaTim, `Transport — ${r.nama}`, 1, r.fee)
  })
  sewaRows.forEach((item) => {
    tambahKePayee(item.vendor, `${item.nama}${peserta.length > 1 ? ' — ' + item.pesertaNama : ''}`, item.jumlah, pengeluaranSewa(item))
  })
  bundlingTop.forEach((item) => {
    // item.vendor -- field BARU (bersih, dipisah dari item.nama). Kalau
    // ADA, itu yang dipakai buat identitas pengelompokan (lebih akurat,
    // nggak perlu nebak lewat regex lagi) -- item.nama sekarang murni
    // "Jasa/Produk Vendor" doang (misal "Attire"), dipakai sebagai
    // "role"/label jasa apa adanya. Data booking LAMA (sebelum field
    // vendor ini ada) fallback ke cara lama: nama masih gabungan 1
    // teks, di-urai pakai splitNamaVendor.
    const identitySource = item.vendor || item.nama
    const role = item.vendor ? item.nama : splitNamaVendor(item.nama).role
    tambahKePayee(identitySource, role, 1, pengeluaranBundling(item))
    bundlingItems.filter((c) => c.parent_id === item.id).forEach((child) => {
      tambahKePayee(identitySource, child.nama, 1, pengeluaranBundling(child))
    })
  })

  const selectedPayee = selectedPayeeKey ? pengeluaranPayeeMap.get(selectedPayeeKey) : null

  // Rumus -- SENGAJA cuma nulis LABEL/poin-nya doang, BUKAN angka --
  // biar rumus ini jelasin KONSEPNYA ("dari mana asalnya Omzet"),
  // bukan sekadar ngulang angka yang udah keliatan di kartu Omzet/
  // Penghasilan & baris-baris rincian di atas.
  const rumusBelanja = [
    makeupRows.length > 0 && 'Biaya Makeup',
    tambahanRows.length > 0 && 'Biaya Layanan Tambahan',
    retouchRows.length > 0 && 'Biaya Retouch',
    addOnItems.length > 0 && 'harga Add On (Beli)',
    sewaRows.length > 0 && 'Biaya Add On (Sewa)',
    bundlingTop.length > 0 && 'Biaya Paket Bundling',
    transport > 0 && 'Biaya Transport',
    transportTimRows.length > 0 && 'Fee Transport Tim',
  ].filter(Boolean).join(' + ')

  const rumusOmzet = [
    makeupMeAda && 'Biaya Makeup (Me)',
    makeupTimAda && 'Komisi Makeup (Tim)',
    tambahanMeAda && 'Biaya Layanan Tambahan (Me)',
    tambahanTimAda && 'Komisi Layanan Tambahan (Tim)',
    retouchRows.length > 0 && 'Biaya Retouch',
    addOnItems.length > 0 && 'Biaya Add On',
    sewaRows.length > 0 && 'Untung Add On (Sewa)',
    bundlingTop.length > 0 && 'Untung Paket Bundling',
    transport > 0 && 'Biaya Transport',
  ].filter(Boolean).join(' + ')

  const rumusPenghasilan = [
    makeupMeAda && 'Biaya Makeup (Me)',
    makeupTimAda && 'Komisi Makeup (Tim)',
    tambahanMeAda && 'Biaya LayananTambahan (Me)',
    tambahanTimAda && 'Komisi Layanan Tambahan (Tim)',
    retouchRows.length > 0 && 'Biaya Retouch',
    addOnItems.length > 0 && 'Untung Add On',
    sewaRows.length > 0 && 'Untung Add On (Sewa)',
    bundlingTop.length > 0 && 'Untung Paket Bundling',
  ].filter(Boolean).join(' + ')

  // Pengeluaran -- BEDA konsep dari 3 rumus di atas (yang jumlahin
  // biaya/komisi APA ADANYA dari data booking). Ini SELISIH: biaya
  // penuh yang ditagih ke klien dikurangi komisi/untung yang di-set
  // user -- bagian yang "keluar" ke tim/vendor, BUKAN masuk kantong
  // MUA. Retouch SENGAJA nggak pernah muncul di sini (selalu Me,
  // nggak ada yang "dibayarin"). Add On (Sewa) masuk kelompok "Bayar
  // ke Vendor" (bareng Paket Bundling) -- BUKAN "Belanja Produk" --
  // soalnya rumusnya numpang Paket Bundling, bukan Add On biasa.
  const rumusPengeluaran = [
    (pengeluaranMakeupRows.length > 0 || pengeluaranTambahanRows.length > 0) && 'Bayar ke Tim (Makeup/Layanan Tambahan)',
    pengeluaranAddOnRows.length > 0 && 'Belanja Produk (Add On)',
    (pengeluaranSewaRows.length > 0 || pengeluaranBundlingTop.length > 0) && 'Bayar ke Vendor (Add On Sewa/Paket Bundling)',
  ].filter(Boolean).join(' + ')

  // Inti dari fitur klik-kartu ini: 1 baris peserta/add-on/bundling itu
  // punya lebih dari 1 "arti angka" tergantung lagi ngeliat sisi Belanja
  // Klien, Omzet, atau Penghasilan. Fungsi-fungsi ini yang mutusin ANGKA
  // MANA yang dipake dari 1 baris yang sama, sesuai activeCard -- bukan
  // bikin 3 daftar data terpisah, biar SATU sumber data ini nggak bisa
  // "kelewat sinkron" antar 3 tampilan.
  function nilaiMakeupTambahan(r) {
    if (activeCard === 'belanja') return r.biaya
    return r.tim ? r.komisi : r.biaya // Omzet & Penghasilan: logikanya sama
  }
  function nilaiAddOn(item) {
    if (activeCard === 'penghasilan') return item.untung
    return item.biaya // Belanja Klien & Omzet: pake biaya PENUH
  }
  function nilaiBundling(item) {
    if (activeCard === 'belanja') return item.biaya
    return item.keuntungan // Omzet & Penghasilan: cuma untungnya
  }
  // Add On (Sewa) numpang pola Bundling PERSIS (biaya penuh cuma pas
  // Belanja Klien, sisanya untung doang) -- BEDA dari nilaiAddOn di
  // atas (yang masih pake biaya penuh sampai kartu Omzet).
  function nilaiSewa(item) {
    if (activeCard === 'belanja') return item.biaya
    return item.untung
  }

  // Keterangan kecil di bawah angka -- CUMA muncul kalau angka yang lagi
  // ditampilin itu BUKAN biaya penuh (jadi nunjukin komisi/untung).
  // Makeup/Tambahan: cuma baris Tim yang dapet keterangan (baris Me
  // selalu nampilin biaya penuh apapun kartunya, jadi nggak butuh
  // keterangan). Add On: cuma pas kartu Penghasilan (Omzet masih pake
  // biaya penuh buat Add On). Bundling: pas Omzet ATAU Penghasilan
  // (dua-duanya sama-sama nampilin untung doang).
  function keteranganTim(r) {
    return (r.tim && activeCard !== 'belanja') ? 'Komisi dari tim' : null
  }
  function keteranganAddOn() {
    return activeCard === 'penghasilan' ? 'Keuntungan' : null
  }
  function keteranganBundling() {
    return activeCard !== 'belanja' ? 'Keuntungan' : null
  }
  function keteranganSewa() {
    return activeCard !== 'belanja' ? 'Keuntungan' : null
  }

  const judulCard = { belanja: 'Belanja Klien', omzet: 'Omzet', penghasilan: 'Penghasilan', pengeluaran: 'Pengeluaran' }

  // Highlight bagian "(...)" di AKHIR sebuah nama -- dipake buat nandain
  // klien/vendor yang berkaitan (misal "Fotografer (@fourgrads)" atau
  // "Softlens (Jennie)") pake warna yang SAMA kayak highlight "Tim -
  // @handle" di section Makeup/Tambahan (.rincian-metim), biar visual-nya
  // konsisten: warna itu = "penanda pihak yang terlibat".
  function highlightKurung(nama) {
    const match = nama.match(/^(.*?)\s*\(([^)]*)\)\s*$/)
    if (!match) return nama
    return <>{match[1]} (<span className="rincian-metim">{match[2]}</span>)</>
  }

  return (
    <>
    <div className="rincian-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="modal">
        <div className="modal-head">
          <h2>Rincian Keuangan</h2>
          <button className="modal-close" onClick={onClose} type="button" aria-label="Tutup"><IconClose /></button>
        </div>

        <div className="modal-body">
          <div className="modal-info">
            <div className="modal-info-text">Ini adalah data rincian keuangan dalam booking ini</div>
            <div className="modal-info-hint">Ketuk kotak ringkasan untuk lihat rincian data</div>
          </div>
          <div className="rincian-summary">
            <button type="button" className={`rincian-summary-item belanja${activeCard === 'belanja' ? ' active' : ''}`} onClick={() => setActiveCard('belanja')}>
              <div className="rincian-summary-label-belanja">Belanja Klien</div>
              <div className="rincian-summary-value-belanja">{formatRupiah(booking.belanja_klien)}</div>
            </button>
            <button type="button" className={`rincian-summary-item omzet${activeCard === 'omzet' ? ' active' : ''}`} onClick={() => setActiveCard('omzet')}>
              <div className="rincian-summary-label-omzet">Omzet</div>
              <div className="rincian-summary-value-omzet">{formatRupiah(booking.omzet)}</div>
            </button>
            <button type="button" className={`rincian-summary-item penghasilan${activeCard === 'penghasilan' ? ' active' : ''}`} onClick={() => setActiveCard('penghasilan')}>
              <div className="rincian-summary-label-penghasilan">Penghasilan</div>
              <div className="rincian-summary-value-penghasilan">{formatRupiah(booking.penghasilan)}</div>
            </button>
            <button type="button" className={`rincian-summary-item pengeluaran${activeCard === 'pengeluaran' ? ' active' : ''}`} onClick={() => setActiveCard('pengeluaran')}>
              <div className="rincian-summary-label-pengeluaran">Pengeluaran</div>
              <div className="rincian-summary-value-pengeluaran">{formatRupiah(totalPengeluaran)}</div>
            </button>
          </div>

          <div className="rincian-aktif-label">Rincian {judulCard[activeCard]}</div>

          {activeCard === 'pengeluaran' && totalPengeluaran === 0 && (
            <div className="rincian-kosong">Nggak ada pengeluaran di booking ini — semua layanan dikerjain sendiri (Me), tanpa Add On atau Paket Bundling.</div>
          )}

          {(activeCard === 'pengeluaran' ? pengeluaranMakeupRows : makeupRows).length > 0 && (
            <div className="rincian-section">
              <div className="rincian-section-title">Layanan Makeup</div>
              {(activeCard === 'pengeluaran' ? pengeluaranMakeupRows : makeupRows).map((r, idx) => (
                <div className="rincian-row" key={idx}>
                  <div className="rincian-nama-grup">
                    <span>{r.nama} (<span className="rincian-metim">{r.tim ? `Tim${r.namaTim ? ' - ' + r.namaTim : ''}` : 'Me'}</span>){r.sesi > 1 ? ` (${r.sesi}x sesi)` : ''}</span>
                    {activeCard === 'pengeluaran' && r.tim && r.namaTim && r.namaTim.trim() && (
                      <button type="button" className="btn-ra rincian-ra-btn" onClick={() => setSelectedPayeeKey(splitNamaVendor(r.namaTim).key)}>Buat Remittance Advice</button>
                    )}
                  </div>
                  <div className="rincian-nilai-wrap">
                    <b>{formatRupiah(activeCard === 'pengeluaran' ? pengeluaranMakeupTambahan(r) : nilaiMakeupTambahan(r))}</b>
                    {activeCard === 'pengeluaran'
                      ? <span className="rincian-keterangan">Ke tim</span>
                      : (keteranganTim(r) && <span className="rincian-keterangan">{keteranganTim(r)}</span>)}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Retouch -- JASA (sekelas Makeup), BUKAN produk, jadi TIDAK
              pernah muncul di kartu Pengeluaran (nggak ada Tim/vendor
              yang "dibayarin", semuanya penuh masuk kantong MUA). */}
          {activeCard !== 'pengeluaran' && retouchRows.length > 0 && (
            <div className="rincian-section">
              <div className="rincian-section-title">Retouch</div>
              {retouchRows.map((r, idx) => (
                <div className="rincian-row" key={idx}>
                  <span>{r.nama}</span>
                  <b>{formatRupiah(r.biaya)}</b>
                </div>
              ))}
            </div>
          )}
          {(activeCard === 'pengeluaran' ? pengeluaranTambahanRows : tambahanRows).length > 0 && (
            <div className="rincian-section">
              <div className="rincian-section-title">Layanan Tambahan (Hairdo/Hijabdo+)</div>
              {(activeCard === 'pengeluaran' ? pengeluaranTambahanRows : tambahanRows).map((r, idx) => (
                <div className="rincian-row" key={idx}>
                  <div className="rincian-nama-grup">
                    <span>{r.nama} ({r.jenis} | <span className="rincian-metim">{r.tim ? `Tim${r.namaTim ? ' - ' + r.namaTim : ''}` : 'Me'}</span>){r.sesi > 1 ? ` (${r.sesi}x sesi)` : ''}</span>
                    {activeCard === 'pengeluaran' && r.tim && r.namaTim && r.namaTim.trim() && (
                      <button type="button" className="btn-ra rincian-ra-btn" onClick={() => setSelectedPayeeKey(splitNamaVendor(r.namaTim).key)}>Buat Remittance Advice</button>
                    )}
                  </div>
                  <div className="rincian-nilai-wrap">
                    <b>{formatRupiah(activeCard === 'pengeluaran' ? pengeluaranMakeupTambahan(r) : nilaiMakeupTambahan(r))}</b>
                    {activeCard === 'pengeluaran'
                      ? <span className="rincian-keterangan">Ke tim</span>
                      : (keteranganTim(r) && <span className="rincian-keterangan">{keteranganTim(r)}</span>)}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Add On (Sewa) -- numpang rumus Paket Bundling (biaya penuh
              cuma pas Belanja Klien, Omzet/Penghasilan cuma untungnya),
              makanya pakai nilaiSewa/keteranganSewa (BUKAN nilaiAddOn),
              dan pas Pengeluaran ikut kelompok "Ke vendor" (bareng
              Paket Bundling), bukan "Belanja produk" kayak Add On
              biasa di bawah. */}
          {(activeCard === 'pengeluaran' ? pengeluaranSewaRows : sewaRows).length > 0 && (
            <div className="rincian-section">
              <div className="rincian-section-title">Add On (Sewa)</div>
              {(activeCard === 'pengeluaran' ? pengeluaranSewaRows : sewaRows).map((item, idx) => (
                <div className="rincian-row" key={idx}>
                  <div className="rincian-nama-grup">
                    <span>{item.nama}{item.jumlah > 1 ? ` (x${item.jumlah})` : ''}{peserta.length > 1 ? <> (<span className="rincian-metim">{item.pesertaNama}</span>)</> : ''}</span>
                    {activeCard === 'pengeluaran' && item.vendor && item.vendor.trim() && (
                      <button type="button" className="btn-ra rincian-ra-btn" onClick={() => setSelectedPayeeKey(splitNamaVendor(item.vendor).key)}>Buat Remittance Advice</button>
                    )}
                  </div>
                  <div className="rincian-nilai-wrap">
                    <b>{formatRupiah(activeCard === 'pengeluaran' ? pengeluaranSewa(item) : nilaiSewa(item))}</b>
                    {activeCard === 'pengeluaran'
                      ? <span className="rincian-keterangan">Ke vendor</span>
                      : (keteranganSewa() && <span className="rincian-keterangan">{keteranganSewa()}</span>)}
                  </div>
                </div>
              ))}
            </div>
          )}

          {(activeCard === 'pengeluaran' ? pengeluaranAddOnRows : addOnItems).length > 0 && (
            <div className="rincian-section">
              <div className="rincian-section-title">Add On (Beli)</div>
              {(activeCard === 'pengeluaran' ? pengeluaranAddOnRows : addOnItems).map((item, idx) => (
                <div className="rincian-row" key={idx}>
                  <span>{item.nama}{item.jumlah > 1 ? ` (x${item.jumlah})` : ''}{peserta.length > 1 ? <> (<span className="rincian-metim">{item.pesertaNama}</span>)</> : ''}</span>
                  <div className="rincian-nilai-wrap">
                    <b>{formatRupiah(activeCard === 'pengeluaran' ? pengeluaranAddOn(item) : nilaiAddOn(item))}</b>
                    {activeCard === 'pengeluaran'
                      ? <span className="rincian-keterangan">Belanja produk</span>
                      : (keteranganAddOn() && <span className="rincian-keterangan">{keteranganAddOn()}</span>)}
                  </div>
                </div>
              ))}
            </div>
          )}

          {(activeCard === 'pengeluaran' ? pengeluaranBundlingTop : bundlingTop).length > 0 && (
            <div className="rincian-section">
              <div className="rincian-section-title">Paket Bundling</div>
              {(activeCard === 'pengeluaran' ? pengeluaranBundlingTop : bundlingTop).map((item) => (
                <div key={item.id}>
                  {(activeCard !== 'pengeluaran' || pengeluaranBundling(item) > 0) && (
                    <div className="rincian-row">
                      <div className="rincian-nama-grup">
                        <span>{item.vendor ? <>{item.nama} (<span className="rincian-metim">{item.vendor}</span>)</> : highlightKurung(item.nama)}</span>
                        {activeCard === 'pengeluaran' && (item.vendor || item.nama).trim() && (
                          <button type="button" className="btn-ra rincian-ra-btn" onClick={() => setSelectedPayeeKey(splitNamaVendor(item.vendor || item.nama).key)}>Buat Remittance Advice</button>
                        )}
                      </div>
                      <div className="rincian-nilai-wrap">
                        <b>{formatRupiah(activeCard === 'pengeluaran' ? pengeluaranBundling(item) : nilaiBundling(item))}</b>
                        {activeCard === 'pengeluaran'
                          ? <span className="rincian-keterangan">Ke vendor</span>
                          : (keteranganBundling() && <span className="rincian-keterangan">{keteranganBundling()}</span>)}
                      </div>
                    </div>
                  )}
                  {bundlingItems.filter((c) => c.parent_id === item.id && (activeCard !== 'pengeluaran' || pengeluaranBundling(c) > 0)).map((child) => (
                    <div className="rincian-row" key={child.id} style={{ paddingLeft: 20 }}>
                      <span>↳ {highlightKurung(child.nama)}</span>
                      <div className="rincian-nilai-wrap">
                        <b>{formatRupiah(activeCard === 'pengeluaran' ? pengeluaranBundling(child) : nilaiBundling(child))}</b>
                        {activeCard === 'pengeluaran'
                          ? <span className="rincian-keterangan">Ke vendor</span>
                          : (keteranganBundling() && <span className="rincian-keterangan">{keteranganBundling()}</span>)}
                      </div>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}

          {/* Transport CUMA nampil pas kartu Belanja Klien/Omzet aktif --
              Penghasilan emang nggak masukin Transport sama sekali
              (bukan Rp0, tapi beneran nggak dihitung), jadi baris ini
              disembunyiin total biar nggak nyesatin. */}
          {/* Fee Transport Tim -- CUMA nampil pas kartu Belanja Klien
              (ditagih ke klien). Di Omzet/Penghasilan nggak nongol karena
              itu bukan uang MUA, di Pengeluaran juga nggak karena masuk
              ember Ongkos (bukan pengeluaran). Kalau 2-duanya ada pas
              Belanja Klien, nampil 1 section "Transport" bareng Biaya
              Transport punya MUA. */}
          {((transport > 0 && (activeCard === 'belanja' || activeCard === 'omzet')) || (transportTimRows.length > 0 && activeCard === 'belanja')) && (
            <div className="rincian-section">
              <div className="rincian-section-title">Transport</div>
              {transport > 0 && (activeCard === 'belanja' || activeCard === 'omzet') && (
                <div className="rincian-row">
                  <span>Biaya Transport</span>
                  <b>{formatRupiah(transport)}</b>
                </div>
              )}
              {activeCard === 'belanja' && transportTimRows.map((r, idx) => (
                <div className="rincian-row" key={idx}>
                  <span>Fee Transport Tim — {r.nama} ({r.jenis} | <span className="rincian-metim">{`Tim${r.namaTim ? ' - ' + r.namaTim : ''}`}</span>)</span>
                  <b>{formatRupiah(r.fee)}</b>
                </div>
              ))}
            </div>
          )}

          <div className="rincian-note">
            <div className="rincian-note-title">Rumus</div>
            {activeCard === 'belanja' && <div className="rincian-rumus"><b>Belanja Klien</b> = {rumusBelanja}</div>}
            {activeCard === 'omzet' && <div className="rincian-rumus"><b>Omzet</b> = {rumusOmzet}</div>}
            {activeCard === 'penghasilan' && <div className="rincian-rumus"><b>Penghasilan</b> = {rumusPenghasilan}</div>}
            {activeCard === 'pengeluaran' && (
              rumusPengeluaran
                ? <div className="rincian-rumus"><b>Pengeluaran</b> = {rumusPengeluaran}</div>
                : <div className="rincian-rumus"><b>Pengeluaran</b> = Rp0 (semua dikerjain sendiri/Me, nggak ada Tim/vendor luar yang dibayar)</div>
            )}

            <div className="rincian-note-divider"></div>

            <div className="rincian-note-title">Penjelasan</div>
            <div className="rincian-penjelasan"><b>Remittance Advice/Pemberitahuan Pembayaran</b> = Dokumen pemberitahuan pembayaran yang dikirimkan MUA kepada tim/vendor/penyedia jasa yang berkaitan dengan booking-an ini, setelah acara selesai/tanggungjawab selesai dilaksanakan.</div>
            <div className="rincian-penjelasan"><b>Belanja Klien</b> = total semua yang ditagihkan ke klien dalam sebuah booking. Apapun jenisnya dan siapapun yang mengerjakan. Termasuk biaya Retouch, seluruh harga Add On (Beli), biaya Add On (Sewa), biaya Paket Bundling, dan Fee Transport Tim, jika ada.</div>
            <div className="rincian-penjelasan"><b>Omzet</b> = total pemasukan dalam sebuah booking yang terdiri dari biaya jasa/layanan yang dikerjain sendiri (Me) dihitung penuh, yang dikerjain Tim cuma dihitung komisinya (jika ada), ditambah biaya Retouch (selalu penuh), harga penuh dari Add On (Beli), untung dari Add On (Sewa) dan untung dari Paket Bundling (jika ada), dan biaya transport.</div>
            <div className="rincian-penjelasan"><b>Penghasilan</b> = bagian yang beneran jadi keuntungan bagi MUA. Sama kayak Omzet, tapi Add On (Beli) cuma dihitung untungnya (bukan biaya penuh), Add On (Sewa) dan Paket Bundling cuma dihitung untung/komisinya, biaya Retouch tetap dihitung penuh, dan biaya transport nggak dihitung sama sekali (karena biaya transport itu ongkos, bukan keuntungan).</div>
            <div className="rincian-penjelasan"><b>Pengeluaran</b> = bagian dari Belanja Klien yang KELUAR LAGI ke tim/vendor luar, bukan masuk kantong MUA. Selisih antara biaya penuh yang ditagih ke klien dan komisi/untung yang di-set user, dari Makeup/Layanan Tambahan yang dikerjain Tim, Add On (Beli), Add On (Sewa), dan Paket Bundling. Biaya Transport dan Fee Transport Tim TIDAK termasuk pengeluaran, karena keduanya dianggap ongkos perjalanan (Fee Transport Tim tetap tercantum di Remittance Advice ke tim yang bersangkutan).</div>
          </div>
        </div>

        <div className="modal-foot">
          <button className="btn-ghost" onClick={onClose} type="button">Tutup</button>
        </div>
      </div>
    </div>

    {selectedPayee && (
      <RemittanceAdviceModal booking={booking} payee={selectedPayee} onClose={() => setSelectedPayeeKey(null)} />
    )}
    </>
  )
}
