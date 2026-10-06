// Ikon silang (×) buat tombol tutup modal -- PENGGANTI karakter teks
// `&times;`. Karakter teks posisinya ditentuin desain font-nya (sedikit di
// atas titik tengah), jadi meleset ~0,5px walau tombolnya udah
// flex + align-items:center. SVG ini digambar presisi di tengah viewBox-nya
// sendiri, jadi PASTI pas di tengah kotak tombol, di font & layar apapun.
//
// Warna ngikut `color` tombolnya (currentColor) -- jadi efek hover/warna
// yang udah ada di CSS tiap modal tetep jalan tanpa diubah.
//
// Cara pakai di modal lain:
//   import IconClose from './IconClose'
//   <button className="modal-close" onClick={onClose} type="button" aria-label="Tutup"><IconClose /></button>
export default function IconClose({ size = 18 }) {
  return (
    <svg
      viewBox="0 0 24 24" width={size} height={size}
      fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"
      style={{ display: 'block' }}
      aria-hidden="true"
    >
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  )
}
