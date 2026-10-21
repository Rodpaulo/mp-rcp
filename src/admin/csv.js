// Leitura e escrita de CSV sem bibliotecas: o suficiente para o MailPoet e para o Excel.

const EMAIL_PATTERN = /^[^@\s]+@[^@\s]+\.[^@\s]+$/ // a mesma regra da função check_in

// Vírgula ou ponto-e-vírgula, consoante o que aparece mais na primeira linha (fora de aspas).
function detectDelimiter(text) {
  let commas = 0
  let semicolons = 0
  let quoted = false
  for (const char of text) {
    if (char === '"') quoted = !quoted
    else if (!quoted && (char === '\n' || char === '\r')) break
    else if (!quoted && char === ',') commas++
    else if (!quoted && char === ';') semicolons++
  }
  return semicolons > commas ? ';' : ','
}

// Devolve as linhas como listas de campos. Aceita campos entre aspas com "" e quebras de linha.
export function parseCsv(text) {
  const source = text.replace(/^﻿/, '')
  const delimiter = detectDelimiter(source)
  const rows = []
  let row = []
  let field = ''
  let quoted = false

  for (let i = 0; i < source.length; i++) {
    const char = source[i]
    if (quoted) {
      if (char === '"' && source[i + 1] === '"') {
        field += '"'
        i++
      } else if (char === '"') {
        quoted = false
      } else {
        field += char
      }
    } else if (char === '"') {
      quoted = true
    } else if (char === delimiter) {
      row.push(field)
      field = ''
    } else if (char === '\n' || char === '\r') {
      if (char === '\r' && source[i + 1] === '\n') i++
      row.push(field)
      rows.push(row)
      row = []
      field = ''
    } else {
      field += char
    }
  }
  if (field !== '' || row.length > 0) {
    row.push(field)
    rows.push(row)
  }
  return rows.filter((r) => r.some((value) => value.trim() !== ''))
}

// Encontra a coluna de email pelo cabeçalho ("email", "E-mail", "Email address"...).
// Devolve { column: false } se não houver nenhuma; senão os emails válidos (sem repetidos) e os ignorados.
export function extractEmails(text) {
  const [header, ...rows] = parseCsv(text)
  if (!header) return { column: false, emails: [], ignored: [] }

  const names = header.map((name) => name.toLowerCase().replace(/[^a-z]/g, ''))
  let index = names.indexOf('email')
  if (index === -1) index = names.findIndex((name) => name.includes('email'))
  if (index === -1) return { column: false, emails: [], ignored: [] }

  const emails = new Set()
  const ignored = []
  for (const row of rows) {
    const value = (row[index] ?? '').trim().toLowerCase()
    if (value === '') continue
    if (EMAIL_PATTERN.test(value)) emails.add(value)
    else ignored.push(value)
  }
  return { column: true, emails: [...emails], ignored }
}

// Ponto-e-vírgula: é o separador que o Excel espera com definições regionais portuguesas e belgas.
export function buildCsv(header, rows) {
  const escape = (value) => {
    const text = String(value ?? '')
    return /[";\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
  }
  return [header, ...rows].map((row) => row.map(escape).join(';')).join('\r\n')
}

// BOM no início para o Excel reconhecer UTF-8 (acentos).
export function downloadCsv(filename, csv) {
  const blob = new Blob(['﻿', csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}
