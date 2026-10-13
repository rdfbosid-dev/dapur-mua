import { formatAngkaInput, parseAngkaInput } from '../lib/format'
import { hitungTagihan, persenDiskon, pesanDiskonTidakValid, PANJANG_MAKS_KETERANGAN_DISKON } from '../lib/tagihan'
import './DiskonBooking.css'

function rupiah(n) {
  return 'Rp' + (Number(n) || 0).toLocaleString('id-ID')
}

// Isian DISKON per booking -- dipakai BARENG di form Booking Baru
// (BookingModal.jsx) & Edit Booking (BookingDetailModal.jsx). Opsional:
// defaultnya "Tidak" dan booking tampil/terhitung persis kayak biasa.
// Pilih "Ya" -> muncul Nominal Diskon + Keterangan (opsional), plus
// ringkasan "tagihan - diskon = total" yang ikut berubah selagi kartu
// klien diisi. Aturan & rumusnya di lib/tagihan.js.
//
// Class CSS-nya numpang class form yang udah ada (.field, .toggle-row,
// .toggle-opt) biar tampilannya sama di dua modal; yang khusus diskon
// pakai awalan "diskon-" (DiskonBooking.css).
export default function DiskonBooking({ ada, onUbahAda, diskon, onUbahDiskon, keterangan, onUbahKeterangan, tagihanSebelumDiskon }) {
  const { total } = hitungTagihan(tagihanSebelumDiskon, diskon)
  const galat = ada && Number(diskon) > 0 ? pesanDiskonTidakValid(diskon, tagihanSebelumDiskon) : null
  const persen = persenDiskon(diskon, tagihanSebelumDiskon)

  return (
    <div className="diskon-booking">
      <div className="field-grid-booking diskon-grid">
        <div className="field">
          <label>Diskon <span className="field-note">*opsional</span></label>
          <div className="toggle-row">
            <div className={`toggle-opt${!ada ? ' sel' : ''}`} onClick={() => onUbahAda(false)}>Tidak</div>
            <div className={`toggle-opt${ada ? ' sel' : ''}`} onClick={() => onUbahAda(true)}>Ya</div>
          </div>
        </div>
        {ada && (
          <div className="field">
            <label>Nominal Diskon</label>
            <input
              type="text"
              inputMode="numeric"
              placeholder="Rp0"
              data-diskon-nominal=""
              className={galat ? 'diskon-input-galat' : undefined}
              value={diskon ? `Rp${formatAngkaInput(diskon)}` : ''}
              onChange={(e) => onUbahDiskon(parseAngkaInput(e.target.value))}
            />
          </div>
        )}
        {ada && (
          <div className="field diskon-keterangan">
            <label>Keterangan Diskon</label>
            <input
              type="text"
              placeholder="Contoh: Promo Akhir Tahun"
              maxLength={PANJANG_MAKS_KETERANGAN_DISKON}
              value={keterangan}
              onChange={(e) => onUbahKeterangan(e.target.value)}
            />
          </div>
        )}
      </div>

      {ada && (
        <div className={`diskon-ringkasan${galat ? ' galat' : ''}`} aria-live="polite">
          {galat ? galat
            : Number(tagihanSebelumDiskon) <= 0
              ? 'Total tagihan masih Rp0. Isi biaya di kartu klien dulu, nanti potongannya dihitung otomatis.'
              : Number(diskon) > 0
                ? <>Tagihan {rupiah(tagihanSebelumDiskon)} − Diskon {rupiah(diskon)} ({String(persen).replace('.', ',')}%) = <b>Total Tagihan {rupiah(total)}</b></>
                : <>Total tagihan sebelum diskon: <b>{rupiah(tagihanSebelumDiskon)}</b></>}
          <div className="diskon-catatan">Diskon ditanggung kamu: komisi tim, fee transport tim, dan pembayaran ke vendor tidak ikut berkurang.</div>
        </div>
      )}
    </div>
  )
}
