import { pesanAngkaTakWajar } from '../lib/validasiBooking'
import './PeringatanKewajaran.css'

// Kotak peringatan yang muncul LANGSUNG di dalam kartu klien (form
// Booking Baru & Edit Booking) begitu ada isian yang nggak masuk akal --
// yaitu "bagian untuk MUA" (komisi/untung) lebih besar dari biayanya.
// Hilang sendiri begitu angkanya dibenerin. Aturan lengkapnya ada di
// lib/validasiBooking.js.
//
// `daftar` = hasil cariAngkaTakWajar() -- array item yang melanggar.
// Kosong = nggak render apa-apa.
export default function PeringatanKewajaran({ daftar }) {
  if (!daftar || daftar.length === 0) return null
  return (
    <div className="peringatan-kewajaran" role="alert">
      <div className="peringatan-kewajaran-judul">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
          <path d="M12 9v4M12 17h.01" />
        </svg>
        Ada angka yang tidak masuk akal
      </div>
      <ul>
        {daftar.map((it, i) => <li key={i}>{pesanAngkaTakWajar(it)}</li>)}
      </ul>
      <div className="peringatan-kewajaran-saran">
        Komisi/untung tidak boleh lebih besar dari biayanya. Perbaiki dulu supaya booking bisa disimpan.
      </div>
    </div>
  )
}
