// Nomor WhatsApp ADMIN Dapur MUA -- satu-satunya sumber, ganti di sini
// aja kalau nomornya berubah nanti.
const ADMIN_WHATSAPP = '6285747911026'

// Sama persis polanya kayak fitur "Kirim Invoice ke WhatsApp" -- link
// wa.me itu "universal" (OS yang mutusin app mana yang kebuka kalau
// WhatsApp regular & Business dua-duanya keinstall, biasanya regular
// yang menang). Di Android, satu-satunya cara maksa app spesifik dari
// web itu Intent URI yang nunjuk LANGSUNG ke package WhatsApp Business
// (com.whatsapp.w4b). Di iPhone/desktop nggak perlu -- iOS udah otomatis
// nawarin pilihan "Message" vs "Open in WhatsApp Business" sendiri.
export function openAdminWhatsApp(pesan) {
  const encoded = encodeURIComponent(pesan)
  const waUrl = `https://wa.me/${ADMIN_WHATSAPP}?text=${encoded}`
  const isAndroid = /Android/i.test(navigator.userAgent)

  if (isAndroid) {
    const intentUrl = `intent://wa.me/${ADMIN_WHATSAPP}?text=${encoded}#Intent;scheme=https;package=com.whatsapp.w4b;S.browser_fallback_url=${encodeURIComponent(waUrl)};end`
    window.location.href = intentUrl
  } else {
    window.open(waUrl, '_blank')
  }
}
