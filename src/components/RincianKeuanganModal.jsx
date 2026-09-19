import './RincianKeuanganModal.css'

function formatRupiah(n) {
  const num = Number(n) || 0
  const sign = num < 0 ? '-' : ''
  return sign + 'Rp' + Math.abs(num).toLocaleString('id-ID')
}

function sum(arr, field) {
  return arr.reduce((s, p) => s + (Number(p[field]) || 0), 0)
}

// Modal INTERNAL buat MUA sendiri -- beda total sama section "PEMBAYARAN"
// di BookingDetailModal (yang itu soal tagihan KE KLIEN). Ini jawab
// pertanyaan "dari booking ini, MUA-nya dapet berapa & dari mana aja".
// SENGAJA dipisah total jadi modal sendiri (bukan disisipin/collapsible
// di detail booking) -- biar nggak nyampur 2 jenis informasi yang beda
// audiens-nya, dan biar detail booking yang udah lumayan padat nggak
// tambah panjang.
export default function RincianKeuanganModal({ booking, peserta, bundlingItems = [], onClose }) {
  const makeupMe = peserta.filter((p) => p.dikerjakan_oleh_makeup === 'Me')
  const makeupTim = peserta.filter((p) => p.dikerjakan_oleh_makeup === 'Tim')
  const punyaTambahan = (p) => p.layanan_tambahan && p.layanan_tambahan !== 'Tidak Ada'
  const tambahanMe = peserta.filter((p) => punyaTambahan(p) && p.dikerjakan_oleh_tambahan === 'Me')
  const tambahanTim = peserta.filter((p) => punyaTambahan(p) && p.dikerjakan_oleh_tambahan === 'Tim')

  const biayaAddOn = booking.biaya_lainnya_total || 0
  const untungAddOn = booking.keuntungan_lainnya_total || 0
  const transport = booking.biaya_transport || 0

  // Pecah add-on PER ITEM (bukan cuma total gabungan) -- ngambil dari
  // tiap peserta, tiap slot 1-5, biar user bisa liat & cocokin manual
  // satu-satu (misal: Photographer, Strobist, Attire -- masing-masing
  // baris sendiri, bukan dijumlahin jadi 1 angka doang).
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

  const makeupMeTotal = sum(makeupMe, 'biaya_makeup')
  const makeupTimTotal = sum(makeupTim, 'komisi_makeup_tim')
  const tambahanMeTotal = sum(tambahanMe, 'biaya_tambahan')
  const tambahanTimTotal = sum(tambahanTim, 'komisi_tambahan')
  // Bundling -- BEDA sama Add On: yang masuk Omzet/Penghasilan cuma
  // UNTUNG-nya doang, biaya penuh yang ditagih ke klien nggak dihitung
  // sebagai pemasukan bisnis MUA (itu duit yang diterusin ke vendor
  // luar). Liat diskusi lengkapnya soal ini di percakapan sebelumnya.
  const untungBundlingTotal = sum(bundlingItems, 'keuntungan')

  // Komponen rumus Omzet & Penghasilan -- SENGAJA cuma masukin komponen
  // yang emang ada baris-nya di daftar rincian DI ATAS (misal kalau
  // nggak ada yang pake Layanan Tambahan, komponen itu nggak usah
  // muncul di rumus juga) -- biar user bisa NYOCOKIN LANGSUNG, angka di
  // rumus ini match persis sama baris yang dia liat di atasnya.
  const komponenOmzet = [
    makeupMe.length > 0 && { label: 'Makeup Me', nilai: makeupMeTotal },
    makeupTim.length > 0 && { label: 'Makeup Tim', nilai: makeupTimTotal },
    tambahanMe.length > 0 && { label: 'Tambahan Me', nilai: tambahanMeTotal },
    tambahanTim.length > 0 && { label: 'Tambahan Tim', nilai: tambahanTimTotal },
    addOnItems.length > 0 && { label: 'Add On', nilai: biayaAddOn },
    bundlingItems.length > 0 && { label: 'Untung Bundling', nilai: untungBundlingTotal },
    transport > 0 && { label: 'Transport', nilai: transport },
  ].filter(Boolean)

  const komponenPenghasilan = [
    makeupMe.length > 0 && { label: 'Makeup Me', nilai: makeupMeTotal },
    makeupTim.length > 0 && { label: 'Makeup Tim', nilai: makeupTimTotal },
    tambahanMe.length > 0 && { label: 'Tambahan Me', nilai: tambahanMeTotal },
    tambahanTim.length > 0 && { label: 'Tambahan Tim', nilai: tambahanTimTotal },
    addOnItems.length > 0 && { label: 'Untung Add On', nilai: untungAddOn },
    bundlingItems.length > 0 && { label: 'Untung Bundling', nilai: untungBundlingTotal },
  ].filter(Boolean)

  function formatRumus(komponen) {
    return komponen.map((k) => `${formatRupiah(k.nilai)} (${k.label})`).join(' + ')
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
            <div className="rincian-summary-item">
              <div className="rincian-summary-label-omzet">Omzet</div>
              <div className="rincian-summary-value-omzet">{formatRupiah(booking.omzet)}</div>
            </div>
            <div className="rincian-summary-item penghasilan">
              <div className="rincian-summary-label-penghasilan">Penghasilan</div>
              <div className="rincian-summary-value-penghasilan">{formatRupiah(booking.penghasilan)}</div>
            </div>
          </div>

          <div className="rincian-section">
            <div className="rincian-section-title">Layanan Makeup</div>
            {makeupMe.length > 0 && (
              <div className="rincian-row">
                <span>Dikerjakan Sendiri (Me) · {makeupMe.length} klien</span>
                <b>{formatRupiah(sum(makeupMe, 'biaya_makeup'))}</b>
              </div>
            )}
            {makeupTim.length > 0 && (
              <div className="rincian-row">
                <span>Dikerjakan Tim · {makeupTim.length} klien</span>
                <b>{formatRupiah(sum(makeupTim, 'komisi_makeup_tim'))}</b>
              </div>
            )}
          </div>

          {(tambahanMe.length > 0 || tambahanTim.length > 0) && (
            <div className="rincian-section">
              <div className="rincian-section-title">Layanan Tambahan (Hairdo/Hijabdo+)</div>
              {tambahanMe.length > 0 && (
                <div className="rincian-row">
                  <span>Dikerjakan Sendiri (Me) · {tambahanMe.length} klien</span>
                  <b>{formatRupiah(sum(tambahanMe, 'biaya_tambahan'))}</b>
                </div>
              )}
              {tambahanTim.length > 0 && (
                <div className="rincian-row">
                  <span>Dikerjakan Tim · {tambahanTim.length} klien</span>
                  <b>{formatRupiah(sum(tambahanTim, 'komisi_tambahan'))}</b>
                </div>
              )}
            </div>
          )}

          {addOnItems.length > 0 && (
            <div className="rincian-section">
              <div className="rincian-section-title">Add On Lainnya</div>
              {addOnItems.map((item, idx) => (
                <div className="rincian-row" key={idx}>
                  <span>{item.nama}{peserta.length > 1 ? ` (${item.pesertaNama})` : ''}</span>
                  <div className="rincian-addon-nilai">
                    <b>{formatRupiah(item.biaya)}</b>
                    {/* Untung ditampilin terpisah dari biaya -- biar
                        kelihatan berapa MARGIN yang diambil per item,
                        bukan cuma total ditagih ke klien. Nggak
                        ditampilin kalau angkanya sama persis (redundan). */}
                    {item.untung !== item.biaya && (
                      <span className="rincian-addon-untung">Untung {formatRupiah(item.untung)}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {bundlingItems.length > 0 && (
            <div className="rincian-section">
              <div className="rincian-section-title">Paket Bundling</div>
              {bundlingItems.map((item) => (
                <div className="rincian-row" key={item.id}>
                  <span>{item.nama}</span>
                  <b>Untung {formatRupiah(item.keuntungan)}</b>
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
            <div className="rincian-rumus"><b>Omzet</b> = {formatRumus(komponenOmzet)} = {formatRupiah(booking.omzet)}</div>
            <div className="rincian-rumus"><b>Penghasilan</b> = {formatRumus(komponenPenghasilan)} = {formatRupiah(booking.penghasilan)}</div>
          </div>
        </div>

        <div className="modal-foot">
          <button className="btn-ghost" onClick={onClose} type="button">Tutup</button>
        </div>
      </div>
    </div>
  )
}
