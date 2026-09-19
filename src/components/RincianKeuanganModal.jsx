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
export default function RincianKeuanganModal({ booking, peserta, onClose }) {
  const makeupMe = peserta.filter((p) => p.dikerjakan_oleh_makeup === 'Me')
  const makeupTim = peserta.filter((p) => p.dikerjakan_oleh_makeup === 'Tim')
  const punyaTambahan = (p) => p.layanan_tambahan && p.layanan_tambahan !== 'Tidak Ada'
  const tambahanMe = peserta.filter((p) => punyaTambahan(p) && p.dikerjakan_oleh_tambahan === 'Me')
  const tambahanTim = peserta.filter((p) => punyaTambahan(p) && p.dikerjakan_oleh_tambahan === 'Tim')

  const biayaAddOn = booking.biaya_lainnya_total || 0
  const untungAddOn = booking.keuntungan_lainnya_total || 0
  const transport = booking.biaya_transport || 0

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

          {biayaAddOn > 0 && (
            <div className="rincian-section">
              <div className="rincian-section-title">Add On Lainnya</div>
              <div className="rincian-row">
                <span>Biaya (ditagih ke klien)</span>
                <b>{formatRupiah(biayaAddOn)}</b>
              </div>
              <div className="rincian-row">
                <span>Keuntungan (masuk Penghasilan)</span>
                <b>{formatRupiah(untungAddOn)}</b>
              </div>
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
            Penghasilan lebih kecil dari Omzet karena Transport & biaya Add On (yang bukan keuntungan) nggak dihitung sebagai penghasilan murni MUA.
          </div>
        </div>

        <div className="modal-foot">
          <button className="btn-ghost" onClick={onClose} type="button">Tutup</button>
        </div>
      </div>
    </div>
  )
}
