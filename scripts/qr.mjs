// Gera o QR fixo do RCP em materials/: SVG para impressão e PNG de 2048 px.
// O URL não muda de edição para edição; o servidor escolhe a edição aberta.
// Uso: npm run qr

import { mkdir, writeFile } from 'node:fs/promises'
import QRCode from 'qrcode'

const SITE_URL = 'https://rcp.matinespensantes.org'
const OUT_DIR = new URL('../materials/', import.meta.url)

const options = {
  errorCorrectionLevel: 'M',
  margin: 4,
  color: { dark: '#2E3D4D', light: '#FFFFFF' },
}

await mkdir(OUT_DIR, { recursive: true })

const svg = await QRCode.toString(SITE_URL, { ...options, type: 'svg' })
await writeFile(new URL('qr-rcp.svg', OUT_DIR), svg)

const png = await QRCode.toBuffer(SITE_URL, { ...options, type: 'png', width: 2048 })
await writeFile(new URL('qr-rcp.png', OUT_DIR), png)

console.log(`QR para ${SITE_URL} gerado em materials/qr-rcp.svg e materials/qr-rcp.png`)
