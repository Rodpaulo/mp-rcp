import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { LOAD_ERROR } from '../admin/text.js'
import { listarContactos } from './api.js'
import { ESTADOS, ETIQUETAS, TIPOS, normalizar, rotulo } from './listas.js'

export default function Contactos({ onAbrir }) {
  const [contactos, setContactos] = useState(null)
  const [erro, setErro] = useState(false)
  // Pesquisa e filtros no endereço: ao voltar de um contacto, a lista aparece como estava.
  const [searchParams, setSearchParams] = useSearchParams()
  const pesquisa = searchParams.get('q') ?? ''
  const etiqueta = searchParams.get('e') ?? ''
  const estado = searchParams.get('st') ?? ''

  useEffect(() => {
    listarContactos().then(setContactos, (error) => {
      console.error('carregar contactos falhou:', error)
      setErro(true)
    })
  }, [])

  function mudarFiltro(chave, valor) {
    const params = new URLSearchParams(searchParams)
    if (valor) params.set(chave, valor)
    else params.delete(chave)
    setSearchParams(params, { replace: true })
  }

  const nomesPorId = useMemo(
    () => new Map((contactos ?? []).map((contacto) => [contacto.id, contacto.nome])),
    [contactos],
  )

  const visiveis = useMemo(() => {
    const termo = normalizar(pesquisa)
    return (contactos ?? []).filter(
      (contacto) =>
        (!termo || normalizar(contacto.nome).includes(termo)) &&
        (!etiqueta || contacto.etiquetas.includes(etiqueta)) &&
        (!estado || contacto.estado === estado),
    )
  }, [contactos, pesquisa, etiqueta, estado])

  return (
    <section className="admin-section">
      <div className="admin-section-head">
        <h2>Contactos</h2>
        <button type="button" className="admin-button" onClick={() => onAbrir('novo')}>
          Novo contacto
        </button>
      </div>

      <div className="rede-filtros">
        <label className="admin-field">
          <span>Pesquisar por nome</span>
          <input type="search" value={pesquisa} onChange={(event) => mudarFiltro('q', event.target.value)} />
        </label>
        <label className="admin-field">
          <span>Etiqueta</span>
          <select className="rede-select" value={etiqueta} onChange={(event) => mudarFiltro('e', event.target.value)}>
            <option value="">Todas</option>
            {ETIQUETAS.map((item) => (
              <option key={item.valor} value={item.valor}>
                {item.rotulo}
              </option>
            ))}
          </select>
        </label>
        <label className="admin-field">
          <span>Estado</span>
          <select className="rede-select" value={estado} onChange={(event) => mudarFiltro('st', event.target.value)}>
            <option value="">Todos</option>
            {ESTADOS.map((item) => (
              <option key={item.valor} value={item.valor}>
                {item.rotulo}
              </option>
            ))}
          </select>
        </label>
      </div>

      {erro && (
        <p className="admin-error" role="alert">
          {LOAD_ERROR}
        </p>
      )}

      {contactos && (
        <>
          <p className="rede-contagem">
            {visiveis.length === contactos.length
              ? `${contactos.length} contactos`
              : `${visiveis.length} de ${contactos.length} contactos`}
          </p>
          {contactos.length === 0 ? (
            <p>Ainda não há contactos. Começa por "Novo contacto".</p>
          ) : visiveis.length === 0 ? (
            <p>Nenhum contacto corresponde à pesquisa.</p>
          ) : (
            <ul className="rede-lista">
              {visiveis.map((contacto) => (
                <li key={contacto.id}>
                  <button type="button" className="rede-linha" onClick={() => onAbrir(contacto.id)}>
                    <span className="rede-linha-nome">{contacto.nome}</span>
                    <span className="rede-linha-detalhe">
                      {[
                        rotulo(TIPOS, contacto.tipo_registo),
                        nomesPorId.get(contacto.organizacao_id),
                        contacto.cidade,
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                    </span>
                    <span className="rede-etiquetas">
                      <span className={`rede-estado rede-estado-${contacto.estado}`}>
                        {rotulo(ESTADOS, contacto.estado)}
                      </span>
                      {contacto.etiquetas.map((valor) => (
                        <span key={valor} className="rede-etiqueta">
                          {rotulo(ETIQUETAS, valor)}
                        </span>
                      ))}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </section>
  )
}
