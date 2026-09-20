import { useState } from 'react'
import './RincianKeuanganModal.css'

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

  const transport = booking.biaya_transport || 0
  const punyaTambahan = (p) => p.layanan_tambahan && p.layanan_tambahan !== 'Tidak Ada'

  // Makeup & Tambahan -- PER KLIEN, bukan digabung jadi 1 baris "Me · N
  // klien". "biaya" = jumlah PENUH yang ditagih ke klien (dipake pas
  // kartu Belanja Klien aktif). "komisi" = bagian yang MASUK ke Me
  // kalau dikerjain Tim (dipake pas kartu Omzet/Penghasilan aktif,
  // liat pickNilai di bawah).
  const makeupRows = peserta.map((p) => {
    const tim = p.dikerjakan_oleh_makeup === 'Tim'
    return {
      nama: p.nama_anggota,
      tim,
      biaya: Number(p.biaya_makeup) || 0,
      komisi: Number(p.komisi_makeup_tim) || 0,
    }
  })

  const tambahanRows = peserta.filter(punyaTambahan).map((p) => {
    const tim = p.dikerjakan_oleh_tambahan === 'Tim'
    return {
      nama: p.nama_anggota,
      jenis: p.layanan_tambahan,
      tim,
      biaya: Number(p.biaya_tambahan) || 0,
      komisi: Number(p.komisi_tambahan) || 0,
    }
  })

  // Add-on PER ITEM -- ngambil dari tiap peserta, tiap slot 1-5.
  const addOnItems = []
  peserta.forEach((p) => {
    for (let n = 1; n <= 5; n++) {
      const suffix = n === 1 ? '' : `_${n}`
      const nama = (p[`layanan_lainnya${suffix}`] || '').trim()
      if (nama) {
        addOnItems.push({
          nama,
          pesertaNama: p.nama_anggota,
          biaya: Number(p[`biaya_lainnya${suffix}`]) || 0,
          untung: Number(p[`keuntungan_lainnya${suffix}`]) || 0,
        })
      }
    }
  })

  const bundlingTop = bundlingItems.filter((b) => !b.parent_id)
  const makeupMeAda = makeupRows.some((r) => !r.tim)
  const makeupTimAda = makeupRows.some((r) => r.tim)
  const tambahanMeAda = tambahanRows.some((r) => !r.tim)
  const tambahanTimAda = tambahanRows.some((r) => r.tim)

  // Rumus -- SENGAJA cuma nulis LABEL/poin-nya doang, BUKAN angka --
  // biar rumus ini jelasin KONSEPNYA ("dari mana asalnya Omzet"),
  // bukan sekadar ngulang angka yang udah keliatan di kartu Omzet/
  // Penghasilan & baris-baris rincian di atas.
  const rumusBelanja = [
    makeupRows.length > 0 && 'Biaya Makeup',
    tambahanRows.length > 0 && 'Biaya Layanan Tambahan',
    addOnItems.length > 0 && 'Biaya Add On',
    bundlingTop.length > 0 && 'Biaya Paket Bundling',
    transport > 0 && 'Biaya Transport',
  ].filter(Boolean).join(' + ')

  const rumusOmzet = [
    makeupMeAda && 'Biaya Makeup (Me)',
    makeupTimAda && 'Komisi Makeup (Tim)',
    tambahanMeAda && 'Biaya Layanan Tambahan (Me)',
    tambahanTimAda && 'Komisi Layanan Tambahan (Tim)',
    addOnItems.length > 0 && 'Biaya Add On',
    bundlingTop.length > 0 && 'Untung Paket Bundling',
    transport > 0 && 'Biaya Transport',
  ].filter(Boolean).join(' + ')

  const rumusPenghasilan = [
    makeupMeAda && 'Biaya Makeup (Me)',
    makeupTimAda && 'Komisi Makeup (Tim)',
    tambahanMeAda && 'Biaya LayananTambahan (Me)',
    tambahanTimAda && 'Komisi Layanan Tambahan (Tim)',
    addOnItems.length > 0 && 'Untung Add On',
    bundlingTop.length > 0 && 'Untung Paket Bundling',
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

  const judulCard = { belanja: 'Belanja Klien', omzet: 'Omzet', penghasilan: 'Penghasilan' }

  return (
    <div className="rincian-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="modal">
        <div className="modal-head">
          <h2>Rincian Keuangan</h2>
          <button className="modal-close" onClick={onClose} type="button">&times;</button>
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
          </div>

          <div className="rincian-aktif-label">Rincian {judulCard[activeCard]}</div>

          {makeupRows.length > 0 && (
            <div className="rincian-section">
              <div className="rincian-section-title">Layanan Makeup</div>
              {makeupRows.map((r, idx) => (
                <div className="rincian-row" key={idx}>
                  <span>{r.nama} ({r.tim ? 'Tim' : 'Me'})</span>
                  <b>{formatRupiah(nilaiMakeupTambahan(r))}</b>
                </div>
              ))}
            </div>
          )}

          {tambahanRows.length > 0 && (
            <div className="rincian-section">
              <div className="rincian-section-title">Layanan Tambahan (Hairdo/Hijabdo+)</div>
              {tambahanRows.map((r, idx) => (
                <div className="rincian-row" key={idx}>
                  <span>{r.nama} ({r.jenis} | {r.tim ? 'Tim' : 'Me'})</span>
                  <b>{formatRupiah(nilaiMakeupTambahan(r))}</b>
                </div>
              ))}
            </div>
          )}

          {addOnItems.length > 0 && (
            <div className="rincian-section">
              <div className="rincian-section-title">Add On Lainnya</div>
              {addOnItems.map((item, idx) => (
                <div className="rincian-row" key={idx}>
                  <span>{item.nama}{peserta.length > 1 ? ` (${item.pesertaNama})` : ''}</span>
                  <b>{formatRupiah(nilaiAddOn(item))}</b>
                </div>
              ))}
            </div>
          )}

          {bundlingTop.length > 0 && (
            <div className="rincian-section">
              <div className="rincian-section-title">Paket Bundling</div>
              {bundlingTop.map((item) => (
                <div key={item.id}>
                  <div className="rincian-row">
                    <span>{item.nama}</span>
                    <b>{formatRupiah(nilaiBundling(item))}</b>
                  </div>
                  {bundlingItems.filter((c) => c.parent_id === item.id).map((child) => (
                    <div className="rincian-row" key={child.id} style={{ paddingLeft: 20 }}>
                      <span>↳ {child.nama}</span>
                      <b>{formatRupiah(nilaiBundling(child))}</b>
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
          {transport > 0 && activeCard !== 'penghasilan' && (
            <div className="rincian-section">
              <div className="rincian-section-title">Transport</div>
              <div className="rincian-row">
                <span>Biaya Transport</span>
                <b>{formatRupiah(transport)}</b>
              </div>
            </div>
          )}

          <div className="rincian-note">
            <div className="rincian-note-title">Rumus</div>
            <div className="rincian-rumus"><b>Belanja Klien</b> = {rumusBelanja}</div>
            <div className="rincian-rumus"><b>Omzet</b> = {rumusOmzet}</div>
            <div className="rincian-rumus"><b>Penghasilan</b> = {rumusPenghasilan}</div>

            <div className="rincian-note-divider"></div>

            <div className="rincian-note-title">Penjelasan</div>
            <div className="rincian-penjelasan"><b>Belanja Klien</b> = total semua yang ditagihkan ke klien dalam sebuah booking. Apapun jenisnya dan siapapun yang mengerjakan. Termasuk seluruh biaya Add On, jika ada.</div>
            <div className="rincian-penjelasan"><b>Omzet</b> = total pemasukan dalam sebuah booking yang terdiri dari biaya jasa/layanan yang dikerjain sendiri (Me) dihitung penuh, yang dikerjain Tim cuma dihitung komisinya (jika ada), ditambah untung dari Add On, komisi/untung dari Paket Bundling dan Add On Paket Bundling (jika ada), dan biaya transport.</div>
            <div className="rincian-penjelasan"><b>Penghasilan</b> = bagian yang beneran jadi keuntungan bagi MUA. Sama kayak Omzet, tapi Add On cuma dihitung untungnya (bukan biaya penuh), Paket Bundling dan Add On Paket Bundling cuma dihitung untung/komisinya, dan biaya transport nggak dihitung sama sekali (karena biaya transport itu ongkos, bukan keuntungan).</div>
          </div>
        </div>

        <div className="modal-foot">
          <button className="btn-ghost" onClick={onClose} type="button">Tutup</button>
        </div>
      </div>
    </div>
  )
}
