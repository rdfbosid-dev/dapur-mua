// Cadangan otomatis untuk color-mix() -- dijalankan Vite saat build (lihat
// vite.config.js), TIDAK mengubah file CSS sumber.
//
// MASALAH: color-mix() baru didukung Chrome/Android WebView 111+ (2023) dan
// Safari 16.2+. Browser bermesin lama (contoh nyata: Huawei Browser di
// Huawei MatePad SE) MEMBUANG setiap baris yang memakainya -- latar, border &
// warna kartu hilang, tampilan berantakan.
//
// SOLUSI: di aturan aslinya, tiap color-mix() diganti "cadangan" berupa warna
// yang paling dominan di campuran itu (tanpa transparansi), lalu versi ASLInya
// dipasang lagi di blok @supports (color-mix) TEPAT SETELAH aturan itu.
// Browser lama melewati blok @supports -> pakai cadangan; browser modern
// masuk ke blok itu -> pakai nilai asli (urutan & selector sama, jadi menang).
// CATATAN: trik "taruh baris cadangan sebelum baris asli" TIDAK BISA dipakai
// di sini -- hampir semua color-mix kita berisi var(), dan baris yang berisi
// var() selalu dianggap sah saat dibaca browser lama, baru gagal saat dihitung
// -> propertinya jadi kosong, cadangannya ikut hilang. (Sudah diuji.)
// Hasilnya: di browser modern tampilan SAMA PERSIS seperti sekarang; di
// browser lama warnanya sedikit lebih pekat (tanpa efek transparan) tapi rapi.

const NAMA_FUNGSI = 'color-mix('
const SYARAT_DUKUNGAN = '(color: color-mix(in srgb, red 50%, blue))'

// Pecah teks di tingkat teratas (abaikan yang di dalam kurung).
function pecahAtas(teks, pemisah) {
  const hasil = []
  let kedalaman = 0
  let awal = 0
  for (let i = 0; i < teks.length; i++) {
    const c = teks[i]
    if (c === '(') kedalaman++
    else if (c === ')') kedalaman--
    else if (kedalaman === 0 && pemisah.test(c)) {
      hasil.push(teks.slice(awal, i))
      awal = i + 1
    }
  }
  hasil.push(teks.slice(awal))
  return hasil.map((s) => s.trim()).filter(Boolean)
}

// "var(--h3) 70%" -> { warna: 'var(--h3)', persen: 70 }; persen null kalau
// nggak ada / berupa var() (nilainya baru ketahuan saat dijalankan).
function bacaBagian(bagian) {
  const token = pecahAtas(bagian, /\s/)
  if (token.length === 0) return null
  let persen = null
  let warna = token[0]
  if (token.length > 1) {
    const iPersen = token.findIndex((t) => /^-?\d*\.?\d+%$/.test(t))
    if (iPersen !== -1) {
      persen = parseFloat(token[iPersen])
      warna = token[iPersen === 0 ? 1 : 0]
    }
  }
  return { warna, persen }
}

// Isi di dalam color-mix(...) -> satu warna cadangan.
function pilihWarna(isi) {
  const arg = pecahAtas(isi, /,/)
  if (arg.length !== 3 || !/^in\s/i.test(arg[0])) return null
  const a = bacaBagian(arg[1])
  const b = bacaBagian(arg[2])
  if (!a || !b) return null
  // Campuran dengan transparent = warna tembus pandang. Kalau warnanya
  // dominan (>= 50% atau persennya baru ketahuan saat jalan), cadangannya
  // warna itu sendiri (pekat). Kalau cuma tipis (< 50%, biasanya efek hover/
  // latar lembut), cadangannya transparent -- lebih aman daripada jadi pekat
  // dan menutupi teks yang warnanya sama.
  if (/^transparent$/i.test(b.warna)) return a.persen !== null && a.persen < 50 ? 'transparent' : a.warna
  if (/^transparent$/i.test(a.warna)) return b.persen !== null && b.persen < 50 ? 'transparent' : b.warna
  if (a.persen !== null) return a.persen >= 50 ? a.warna : b.warna
  if (b.persen !== null) return b.persen > 50 ? b.warna : a.warna
  return a.warna
}

// Ganti SEMUA color-mix() di sebuah nilai (termasuk yang bersarang) dengan
// cadangannya. null kalau ada yang nggak bisa dibaca (baris dibiarkan apa adanya).
export function gantiColorMix(nilai) {
  let hasil = nilai
  for (let jaga = 0; hasil.includes(NAMA_FUNGSI); jaga++) {
    if (jaga > 50) return null
    // Kemunculan TERAKHIR pasti yang paling dalam (nggak berisi color-mix lain).
    const awal = hasil.lastIndexOf(NAMA_FUNGSI)
    let kedalaman = 0
    let akhir = -1
    for (let i = awal + NAMA_FUNGSI.length - 1; i < hasil.length; i++) {
      if (hasil[i] === '(') kedalaman++
      else if (hasil[i] === ')') { kedalaman--; if (kedalaman === 0) { akhir = i; break } }
    }
    if (akhir === -1) return null
    const pengganti = pilihWarna(hasil.slice(awal + NAMA_FUNGSI.length, akhir))
    if (!pengganti) return null
    hasil = hasil.slice(0, awal) + pengganti + hasil.slice(akhir + 1)
  }
  return hasil
}

function dalamKeyframes(node) {
  for (let p = node.parent; p; p = p.parent) {
    if (p.type === 'atrule' && /keyframes$/i.test(p.name)) return true
  }
  return false
}

export default function cadanganColorMix() {
  return {
    postcssPlugin: 'cadangan-color-mix',
    OnceExit(root, { AtRule }) {
      root.walkRules((rule) => {
        // Lewati salinan yang kita taruh sendiri di dalam @supports, dan
        // isi @keyframes (nggak bisa dibungkus @supports per langkah).
        if (rule.parent && rule.parent.type === 'atrule' && rule.parent.name === 'supports' && rule.parent.params === SYARAT_DUKUNGAN) return
        if (dalamKeyframes(rule)) return

        const daftar = rule.nodes.filter((n) => n.type === 'decl')
        const cadanganPer = new Map()
        daftar.forEach((d) => {
          if (!d.value.includes(NAMA_FUNGSI)) return
          const c = gantiColorMix(d.value)
          if (c && c !== d.value) cadanganPer.set(d, c)
        })
        if (cadanganPer.size === 0) return

        // Salinan ASLI disalin mulai dari deklarasi color-mix PERTAMA sampai
        // akhir aturan -- bukan cuma baris color-mix-nya -- biar urutan antar
        // baris di aturan ini tetap sama persis di browser modern (misal
        // "border: color-mix(...)" lalu "border-top: none": kalau cuma border
        // yang dipindah ke bawah, border-top:none-nya ketimpa).
        const iPertama = daftar.findIndex((d) => cadanganPer.has(d))
        const salinan = rule.clone({ nodes: [] })
        daftar.slice(iPertama).forEach((d) => salinan.append(d.clone()))

        // Di aturan aslinya, nilai color-mix diganti cadangan.
        cadanganPer.forEach((c, d) => { d.value = c })

        const blok = new AtRule({ name: 'supports', params: SYARAT_DUKUNGAN })
        blok.append(salinan)
        rule.after(blok)
      })
    },
  }
}
cadanganColorMix.postcss = true
