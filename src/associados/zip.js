// Zip sem compressão (método "store"), feito no browser, para o "Exportar ano" dos recibos
// (SPEC 16.17). Sem biblioteca: os PDF já vêm comprimidos e o CSV é pequeno.
// ficheiros: [{ nome, bytes (Uint8Array) }] → Blob 'application/zip'.

const TABELA_CRC = (() => {
  const t = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    t[n] = c >>> 0
  }
  return t
})()

function crc32(bytes) {
  let c = 0xffffffff
  for (let i = 0; i < bytes.length; i++) c = TABELA_CRC[(c ^ bytes[i]) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

// Data e hora no formato do MS-DOS, que o zip usa.
function dataDos(d) {
  return {
    hora: (d.getHours() << 11) | (d.getMinutes() << 5) | Math.floor(d.getSeconds() / 2),
    dia: ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate(),
  }
}

export function criarZip(ficheiros, quando = new Date()) {
  const codificar = new TextEncoder()
  const { hora, dia } = dataDos(quando)
  const partes = []
  const central = []
  let deslocamento = 0

  for (const { nome, bytes } of ficheiros) {
    const nomeBytes = codificar.encode(nome)
    const crc = crc32(bytes)

    const local = new DataView(new ArrayBuffer(30))
    local.setUint32(0, 0x04034b50, true) // assinatura do cabeçalho local
    local.setUint16(4, 20, true) // versão necessária
    local.setUint16(6, 0x0800, true) // nomes em UTF-8
    local.setUint16(8, 0, true) // sem compressão
    local.setUint16(10, hora, true)
    local.setUint16(12, dia, true)
    local.setUint32(14, crc, true)
    local.setUint32(18, bytes.length, true)
    local.setUint32(22, bytes.length, true)
    local.setUint16(26, nomeBytes.length, true)
    local.setUint16(28, 0, true)
    partes.push(new Uint8Array(local.buffer), nomeBytes, bytes)

    const entrada = new DataView(new ArrayBuffer(46))
    entrada.setUint32(0, 0x02014b50, true) // assinatura da entrada central
    entrada.setUint16(4, 20, true)
    entrada.setUint16(6, 20, true)
    entrada.setUint16(8, 0x0800, true)
    entrada.setUint16(10, 0, true)
    entrada.setUint16(12, hora, true)
    entrada.setUint16(14, dia, true)
    entrada.setUint32(16, crc, true)
    entrada.setUint32(20, bytes.length, true)
    entrada.setUint32(24, bytes.length, true)
    entrada.setUint16(28, nomeBytes.length, true)
    entrada.setUint32(42, deslocamento, true)
    central.push(new Uint8Array(entrada.buffer), nomeBytes)

    deslocamento += 30 + nomeBytes.length + bytes.length
  }

  const tamanhoCentral = central.reduce((s, p) => s + p.length, 0)
  const fim = new DataView(new ArrayBuffer(22))
  fim.setUint32(0, 0x06054b50, true) // fim do directório central
  fim.setUint16(8, ficheiros.length, true)
  fim.setUint16(10, ficheiros.length, true)
  fim.setUint32(12, tamanhoCentral, true)
  fim.setUint32(16, deslocamento, true)

  return new Blob([...partes, ...central, new Uint8Array(fim.buffer)], { type: 'application/zip' })
}

// Descarrega um Blob com um nome, sem sair da página.
export function descarregar(blob, nome) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = nome
  document.body.append(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
