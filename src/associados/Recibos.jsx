import { useCallback, useEffect, useState } from 'react'
import { PilulasFiltro } from '../admin/mesa/ListaMesa.jsx'
import Pilula from '../admin/mesa/Pilula.jsx'
import { LOAD_ERROR, formatDate } from '../admin/text.js'
import { euros } from '../../supabase/functions/_shared/campos.js'
import { descarregarRecibo, listarQuotasPagasSemRecibo, listarRecibos } from './api.js'
import { nomeDoAssociado } from './textos.js'
import { criarZip, descarregar } from './zip.js'

const ESTADOS_RECIBO = { emitido: 'Emitido', anulado: 'Anulado' }

// CSV para a contabilidade: separador ";" e BOM, como o Excel em Portugal e na Bélgica espera.
function csv(recibos) {
  const campo = (v) => {
    const t = String(v ?? '')
    return /[";\n\r]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t
  }
  const linhas = [
    ['numero', 'data', 'associado_n', 'associado', 'valor', 'estado', 'nota', 'ficheiro'],
    ...recibos.map((r) => [
      r.numero,
      r.data,
      r.associado?.numero,
      nomeDoAssociado(r.associado ?? {}),
      String(r.valor).replace('.', ','),
      r.estado,
      r.nota,
      r.ficheiro ? `${r.numero}.pdf` : '',
    ]),
  ]
  return new TextEncoder().encode(`﻿${linhas.map((l) => l.map(campo).join(';')).join('\r\n')}\r\n`)
}

// Vista "Recibos" dos Associados (SPEC 16.17): por ano, com "Exportar ano" (zip dos PDF e CSV).
export default function Recibos({ onAbrirAssociado }) {
  const [recibos, setRecibos] = useState(null)
  const [semRecibo, setSemRecibo] = useState([])
  const [erro, setErro] = useState('')
  const [ano, setAno] = useState(null)
  const [aExportar, setAExportar] = useState(false)

  const carregar = useCallback(() => {
    Promise.all([listarRecibos(), listarQuotasPagasSemRecibo()]).then(
      ([lidos, quotas]) => {
        setRecibos(lidos)
        setSemRecibo(quotas)
        setErro('')
      },
      (error) => {
        console.error('carregar recibos falhou:', error)
        setErro(LOAD_ERROR)
      },
    )
  }, [])

  useEffect(carregar, [carregar])

  const anos = [...new Set((recibos ?? []).map((r) => r.ano))].sort((a, b) => b - a)
  const anoVisto = ano ?? anos[0] ?? null
  const doAno = (recibos ?? []).filter((r) => r.ano === anoVisto)

  async function exportar() {
    setAExportar(true)
    setErro('')
    try {
      const ficheiros = [{ nome: `recibos-${anoVisto}.csv`, bytes: csv(doAno) }]
      for (const r of [...doAno].reverse()) {
        if (!r.ficheiro) continue
        const blob = await descarregarRecibo(r.ficheiro)
        ficheiros.push({ nome: `${r.numero}.pdf`, bytes: new Uint8Array(await blob.arrayBuffer()) })
      }
      descarregar(criarZip(ficheiros), `recibos-${anoVisto}.zip`)
    } catch (error) {
      console.error('exportar recibos falhou:', error)
      setErro('Não foi possível exportar. Tenta outra vez.')
    } finally {
      setAExportar(false)
    }
  }

  return (
    <section className="admin-section">
      <div className="admin-section-head">
        <h2>Recibos</h2>
        {anoVisto && (
          <button type="button" className="mesa-botao-secundario" disabled={aExportar || doAno.length === 0} onClick={exportar}>
            {aExportar ? 'Um momento…' : `Exportar ${anoVisto}`}
          </button>
        )}
      </div>

      {erro && (
        <p className="admin-error" role="alert">
          {erro}
        </p>
      )}

      {recibos && (
        <>
          <dl className="assoc-sem-recibo">
            <div className={`mesa-cartao-numero${semRecibo.length ? ' mesa-cartao-alerta' : ''}`}>
              <dd>{semRecibo.length}</dd>
              <dt>Quotas pagas sem recibo</dt>
            </div>
          </dl>
          {semRecibo.length > 0 && (
            <ul className="assoc-quotas">
              {semRecibo.map((q) => (
                <li key={q.id}>
                  <button type="button" className="assoc-ligacao-texto" onClick={() => onAbrirAssociado(q.associado.id)}>
                    N.º {q.associado.numero} · {nomeDoAssociado(q.associado)}
                  </button>
                  <span className="assoc-linha-detalhe">
                    {' '}
                    · quota {q.ano}, {euros(q.valor)}, paga a {formatDate(q.data_pagamento)}
                  </span>
                </li>
              ))}
            </ul>
          )}

          {anos.length === 0 ? (
            <p>Ainda não há recibos emitidos.</p>
          ) : (
            <>
              {anos.length > 1 && (
                <PilulasFiltro
                  rotulo="Ano dos recibos"
                  opcoes={anos.map((a) => ({ valor: a, rotulo: String(a) }))}
                  valor={anoVisto}
                  onMudar={setAno}
                />
              )}
              <p className="assoc-nota">
                {doAno.length} {doAno.length === 1 ? 'recibo' : 'recibos'} em {anoVisto}. O zip leva os PDF e um CSV para a
                contabilidade.
              </p>
              <div className="admin-table-wrap">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Número</th>
                      <th>Data</th>
                      <th>Associado</th>
                      <th>Valor</th>
                      <th>Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {doAno.map((r) => (
                      <tr key={r.id} className={r.estado === 'anulado' ? 'assoc-recibo-anulado' : undefined}>
                        <td>{r.estado === 'anulado' ? <s>{r.numero}</s> : r.numero}</td>
                        <td>{formatDate(r.data)}</td>
                        <td>
                          <button type="button" className="assoc-ligacao-texto" onClick={() => onAbrirAssociado(r.associado_id)}>
                            {r.associado ? `N.º ${r.associado.numero} · ${nomeDoAssociado(r.associado)}` : '—'}
                          </button>
                        </td>
                        <td>{euros(r.valor)}</td>
                        <td>
                          <Pilula estado={r.estado === 'anulado' ? 'cancelado' : 'admitido'}>{ESTADOS_RECIBO[r.estado]}</Pilula>
                          {r.estado === 'emitido' && !r.ficheiro && ' sem PDF'}
                          {r.nota && <span className="assoc-linha-detalhe"> {r.nota}</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </>
      )}
    </section>
  )
}
