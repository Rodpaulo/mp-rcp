import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { ItemMesa, PilulasFiltro } from '../admin/mesa/ListaMesa.jsx'
import Pilula from '../admin/mesa/Pilula.jsx'
import { LOAD_ERROR } from '../admin/text.js'
import { listarContactos } from './api.js'
import { ESTADOS, ETIQUETAS, TIPOS, normalizar, rotulo } from './listas.js'

const FILTRO_ESTADO = [{ valor: '', rotulo: 'Todos' }, ...ESTADOS]

// Coluna da lista do Rede, vista Contactos. recarga muda quando se abre, grava ou fecha um contacto.
export default function Contactos({ aberto, recarga, onAbrir }) {
  const [contactos, setContactos] = useState(null)
  const [erro, setErro] = useState(false)
  // Pesquisa e filtros no endereço: ao voltar de um contacto, a lista aparece como estava.
  const [searchParams, setSearchParams] = useSearchParams()
  const pesquisa = searchParams.get('q') ?? ''
  const etiqueta = searchParams.get('e') ?? ''
  const estado = searchParams.get('st') ?? ''

  useEffect(() => {
    listarContactos().then(
      (lidos) => {
        setContactos(lidos)
        setErro(false)
      },
      (error) => {
        console.error('carregar contactos falhou:', error)
        setErro(true)
      },
    )
  }, [recarga])

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
    <>
      <label className="admin-field mesa-pesquisa">
        <span>Pesquisar por nome</span>
        <input type="search" value={pesquisa} onChange={(event) => mudarFiltro('q', event.target.value)} />
      </label>
      <PilulasFiltro
        rotulo="Estado"
        opcoes={FILTRO_ESTADO}
        valor={estado}
        onMudar={(valor) => mudarFiltro('st', valor)}
      />
      <label className="admin-field mesa-pesquisa">
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

      {erro && (
        <p className="admin-error" role="alert">
          {LOAD_ERROR}
        </p>
      )}

      {contactos && (
        <>
          <p className="mesa-contagem">
            {visiveis.length === contactos.length
              ? `${contactos.length} contactos`
              : `${visiveis.length} de ${contactos.length} contactos`}
          </p>
          {contactos.length === 0 ? (
            <p>Ainda não há contactos. Começa por "Novo contacto".</p>
          ) : visiveis.length === 0 ? (
            <p>Nenhum contacto corresponde à pesquisa.</p>
          ) : (
            <ul className="mesa-itens">
              {visiveis.map((contacto) => (
                <ItemMesa
                  key={contacto.id}
                  aberto={contacto.id === aberto}
                  onAbrir={() => onAbrir(contacto.id)}
                  nome={contacto.nome}
                  detalhe={[
                    rotulo(TIPOS, contacto.tipo_registo),
                    nomesPorId.get(contacto.organizacao_id),
                    contacto.cidade,
                    ...contacto.etiquetas.map((valor) => rotulo(ETIQUETAS, valor)),
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                  pilula={<Pilula estado={contacto.estado}>{rotulo(ESTADOS, contacto.estado)}</Pilula>}
                />
              ))}
            </ul>
          )}
        </>
      )}
    </>
  )
}
