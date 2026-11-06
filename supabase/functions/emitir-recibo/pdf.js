// PDF do recibo (SPEC §16.17): uma página A4, Rajdhani nos títulos, Montserrat no texto,
// azul-marinho, carmim só no título. Sem assinatura.
// As fontes (licença SIL OFL, ver fonts/LICENSE) estão na pasta da função, como ficheiros estáticos
// (static_files em supabase/config.toml): nada se vai buscar à rede. Lêem-se antes de atribuir o
// número: sem fontes, não há recibo.

import { PDFDocument, rgb } from 'npm:pdf-lib@1.17.1'
import fontkit from 'npm:@pdf-lib/fontkit@1.1.1'

const FONTES = {
  titulo: 'Rajdhani-Bold.ttf',
  rotulo: 'Rajdhani-SemiBold.ttf',
  texto: 'Montserrat-Regular.ttf',
  forte: 'Montserrat-SemiBold.ttf',
}

const NAVY = rgb(0x2c / 255, 0x3e / 255, 0x50 / 255)
const CARMIM = rgb(0xc0 / 255, 0x1c / 255, 0x36 / 255)
const CINZENTO = rgb(0x82 / 255, 0x84 / 255, 0x87 / 255)
const LINHA = rgb(0xd5 / 255, 0xdc / 255, 0xe2 / 255)

export const ASSOCIACAO = 'Matinés Pensantes ASBL'
export const NUMERO_EMPRESA = '1044.742.359'

let cache = null

export async function lerFontes() {
  if (cache) return cache
  const pares = await Promise.all(
    Object.entries(FONTES).map(async ([nome, ficheiro]) => {
      try {
        return [nome, await Deno.readFile(new URL(`./fonts/${ficheiro}`, import.meta.url))]
      } catch (erro) {
        throw new Error(`Não foi possível ler a fonte ${ficheiro}: ${erro?.message ?? erro}`)
      }
    }),
  )
  cache = Object.fromEntries(pares)
  return cache
}

// Parte um texto em linhas que caibam na largura.
function partir(texto, fonte, tamanho, largura) {
  const linhas = []
  for (const paragrafo of String(texto).split(/\r?\n/)) {
    let linha = ''
    for (const palavra of paragrafo.split(/\s+/).filter(Boolean)) {
      const tentativa = linha ? `${linha} ${palavra}` : palavra
      if (linha && fonte.widthOfTextAtSize(tentativa, tamanho) > largura) {
        linhas.push(linha)
        linha = palavra
      } else {
        linha = tentativa
      }
    }
    linhas.push(linha)
  }
  return linhas
}

// dados: { numero (null na pré-visualização), data (por extenso), nome, valor ('40 €'), ano, sede, tesoureiro }
export async function gerarPdf(fontes, dados) {
  const pdf = await PDFDocument.create()
  pdf.registerFontkit(fontkit)
  const f = {}
  for (const [nome, bytes] of Object.entries(fontes)) f[nome] = await pdf.embedFont(bytes, { subset: true })

  const numeroTexto = dados.numero ?? '(atribuído ao emitir)'
  pdf.setTitle(`Recibo n.º ${numeroTexto}`)
  pdf.setAuthor(ASSOCIACAO)
  pdf.setCreator(ASSOCIACAO)

  const pagina = pdf.addPage([595.28, 841.89]) // A4
  const margem = 64
  const largura = 595.28 - 2 * margem
  let y = 841.89 - 80

  const escrever = (texto, fonte, tamanho, cor = NAVY, x = margem) => {
    for (const linha of partir(texto, fonte, tamanho, largura - (x - margem))) {
      pagina.drawText(linha, { x, y, size: tamanho, font: fonte, color: cor })
      y -= tamanho * 1.45
    }
  }
  const rotulo = (texto) => {
    pagina.drawText(texto.toUpperCase(), { x: margem, y, size: 10, font: f.rotulo, color: CINZENTO })
    y -= 16
  }
  const separador = (espaco = 18) => {
    y -= espaco / 2
    pagina.drawLine({ start: { x: margem, y }, end: { x: margem + largura, y }, thickness: 0.75, color: LINHA })
    y -= espaco
  }

  // Título: a única coisa em carmim. O Rajdhani não tem "º": esse carácter (e qualquer outro que
  // lhe falte) sai em Montserrat, ao mesmo tamanho.
  {
    const temGlifo = new Set(f.titulo.getCharacterSet())
    let x = margem
    for (const c of `Recibo n.º ${numeroTexto}`) {
      const fonte = temGlifo.has(c.codePointAt(0)) ? f.titulo : f.forte
      pagina.drawText(c, { x, y, size: 30, font: fonte, color: CARMIM })
      x += fonte.widthOfTextAtSize(c, 30)
    }
  }
  y -= 22
  escrever('Reçu de cotisation', f.texto, 13)
  if (!dados.numero) {
    y -= 4
    escrever('Pré-visualização: sem número, sem validade.', f.texto, 10, CINZENTO)
  }
  separador(24)

  escrever(ASSOCIACAO, f.forte, 12)
  escrever(`Número de empresa ${NUMERO_EMPRESA}`, f.texto, 10.5)
  escrever(`Sede: ${dados.sede}`, f.texto, 10.5)
  separador(24)

  const campo = (titulo, valor, fonte = f.texto, tamanho = 12) => {
    rotulo(titulo)
    escrever(valor, fonte, tamanho)
    y -= 12
  }
  campo('Data', dados.data)
  campo('Associado', dados.nome, f.forte, 13)
  campo('Valor', dados.valor, f.forte, 13)
  campo('Referente a', `Quota de associado, exercício até 31 de Dezembro de ${dados.ano}`)

  separador(24)
  rotulo('O tesoureiro')
  escrever(dados.tesoureiro, f.texto, 12)

  return await pdf.save()
}
