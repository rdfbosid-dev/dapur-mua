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
  const transport = booking.biaya_transport || 0
  const punyaTambahan = (p) => p.layanan_tambahan && p.layanan_tambahan !== 'Tidak Ada'

  // Makeup & Tambahan -- PER KLIEN, bukan digabung jadi 1 baris "Me · N
  // klien" kayak sebelumnya. Kalau dikerjain Tim: "biaya" itu yang
  // DITAGIH ke klien (biaya_makeup/biaya_tambahan, jumlah PENUH),
  // "untung" itu bagian yang beneran masuk kantong Me (komisi dari
  // studio) -- 2 angka yang beda, makanya ditampilin terpisah. Kalau
  // dikerjain Me sendiri: nggak ada pemisahan itu, semua yang ditagih
  // ITU JUGA penghasilan Me, jadi biaya = untung (untung-nya nggak usah
  // ditampilin dobel, sama kayak pola di Add On).
  const makeupRows = peserta.map((p) => {
    const tim = p.dikerjakan_oleh_makeup === 'Tim'
    return {
      nama: p.nama_anggota,
      tim,
      biaya: Number(p.biaya_makeup) || 0,
      untung: tim ? Number(p.komisi_makeup_tim) || 0 : Number(p.biaya_makeup) || 0,
    }
  })

  const tambahanRows = peserta.filter(punyaTambahan).map((p) => {
    const tim = p.dikerjakan_oleh_tambahan === 'Tim'
    return {
      nama: p.nama_anggota,
      tim,
      biaya: Number(p.biaya_tambahan) || 0,
      untung: tim ? Number(p.komisi_tambahan) || 0 : Number(p.biaya_tambahan) || 0,
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
  const rumusOmzet = [
    makeupMeAda && 'Biaya Makeup (Me)',
    makeupTimAda && 'Komisi Makeup (Tim)',
    tambahanMeAda && 'Biaya Tambahan (Me)',
    tambahanTimAda && 'Komisi Tambahan (Tim)',
    addOnItems.length > 0 && 'Biaya Add On',
    bundlingTop.length > 0 && 'Untung Bundling',
    transport > 0 && 'Transport',
  ].filter(Boolean).join(' + ')

  const rumusPenghasilan = [
    makeupMeAda && 'Biaya Makeup (Me)',
    makeupTimAda && 'Komisi Makeup (Tim)',
    tambahanMeAda && 'Biaya Tambahan (Me)',
    tambahanTimAda && 'Komisi Tambahan (Tim)',
    addOnItems.length > 0 && 'Untung Add On',
    bundlingTop.length > 0 && 'Untung Bundling',
  ].filter(Boolean).join(' + ')

  function BiayaUntung({ biaya, untung }) {
    return (
      <div className="rincian-addon-nilai">
        <b>{formatRupiah(biaya)}</b>
        {untung !== biaya && <span className="rincian-addon-untung">Untung {formatRupiah(untung)}</span>}
      </div>
    )
  }

  return (
    <div className="rincian-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="modal">
        <div className="modal-head">
          <h2>Rincian Keuangan</h2>
          <button className="modal-close" onClick={onClose} type="button">&times;</button>
        </div>

        <div className="modal-body">
          <div className="rincian-summary">
            <div className="rincian-summary-item pembayaran">
              <div className="rincian-summary-label-pembayaran">Pembayaran</div>
              <div className="rincian-summary-value-pembayaran">{formatRupiah(booking.belanja_klien)}</div>
            </div>
            <div className="rincian-summary-item omzet">
              <div className="rincian-summary-label-omzet">Omzet</div>
              <div className="rincian-summary-value-omzet">{formatRupiah(booking.omzet)}</div>
            </div>
            <div className="rincian-summary-item penghasilan">
              <div className="rincian-summary-label-penghasilan">Penghasilan</div>
              <div className="rincian-summary-value-penghasilan">{formatRupiah(booking.penghasilan)}</div>
            </div>
          </div>

          {makeupRows.length > 0 && (
            <div className="rincian-section">
              <div className="rincian-section-title">Layanan Makeup</div>
              {makeupRows.map((r, idx) => (
                <div className="rincian-row" key={idx}>
                  <span>{r.nama} ({r.tim ? 'Tim' : 'Me'})</span>
                  <BiayaUntung biaya={r.biaya} untung={r.untung} />
                </div>
              ))}
            </div>
          )}

          {tambahanRows.length > 0 && (
            <div className="rincian-section">
              <div className="rincian-section-title">Layanan Tambahan (Hairdo/Hijabdo+)</div>
              {tambahanRows.map((r, idx) => (
                <div className="rincian-row" key={idx}>
                  <span>{r.nama} ({r.tim ? 'Tim' : 'Me'})</span>
                  <BiayaUntung biaya={r.biaya} untung={r.untung} />
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
                  <BiayaUntung biaya={item.biaya} untung={item.untung} />
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
                    <BiayaUntung biaya={item.biaya} untung={item.keuntungan} />
                  </div>
                  {bundlingItems.filter((c) => c.parent_id === item.id).map((child) => (
                    <div className="rincian-row" key={child.id} style={{ paddingLeft: 20 }}>
                      <span>↳ {child.nama}</span>
                      <BiayaUntung biaya={child.biaya} untung={child.keuntungan} />
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}

          {transport > 0 && (
            <div className="rincian-section">
              <div className="rincian-section-title">Transport</div>
              <div className="rincian-row">
                <span>Biaya Transport</span>
                <b>{formatRupiah(transport)}</b>
              </div>
            </div>
          )}

          <div className="rincian-note">
            <div className="rincian-rumus"><b>Omzet</b> = {rumusOmzet}</div>
            <div className="rincian-rumus"><b>Penghasilan</b> = {rumusPenghasilan}</div>
          </div>
        </div>

        <div className="modal-foot">
          <button className="btn-ghost" onClick={onClose} type="button">Tutup</button>
        </div>
      </div>
    </div>
  )
}
