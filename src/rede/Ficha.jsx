import { useEffect, useState } from 'react'
import { LOAD_ERROR, formatDate } from '../admin/text.js'
import {
  apagarContacto,
  contarParticipacoes,
  listarInteraccoes,
  listarMembros,
  listarPerfis,
  listarRevisoes,
  obterContacto,
  obterPessoa,
} from './api.js'
import { CANAIS, DECISOES, ESTADOS, ETIQUETAS, TIPOS, rotulo } from './listas.js'
import Participacoes from './Participacoes.jsx'

function plural(n, singular, plural) {
  return `${n} ${n === 1 ? singular : plural}`
}

function ligacaoWeb(website) {
  return /^https?:\/\//i.test(website) ? website : `https://${website}`
}

// Interacções e revisões numa só linha do tempo, a mais recente primeiro.
function historico(interaccoes, revisoes) {
  return [
    ...interaccoes.map((item) => ({ ...item, tipo: 'interaccao' })),
    ...revisoes.map((item) => ({ ...item, tipo: 'revisao' })),
  ].sort((a, b) => b.data.localeCompare(a.data) || b.created_at.localeCompare(a.created_at))
}

async function carregarFicha(id) {
  const [contacto, perfis, interaccoes, revisoes] = await Promise.all([
    obterContacto(id),
    listarPerfis(),
    listarInteraccoes(id),
    listarRevisoes(id),
  ])
  if (!contacto) return null
  const [organizacao, membros, pessoa] = await Promise.all([
    contacto.organizacao_id ? obterContacto(contacto.organizacao_id) : null,
    contacto.tipo_registo === 'organizacao' ? listarMembros(id) : [],
    contacto.person_id ? obterPessoa(contacto.person_id) : null,
  ])
  return { contacto, perfis, interaccoes, revisoes, organizacao, membros, pessoa }
}

export default function Ficha({ id, onLista, onAbrir, onModo, onApagado }) {
  const [dados, setDados] = useState(undefined) // undefined: a carregar; null: não existe
  const [erro, setErro] = useState(false)
  const [erroApagar, setErroApagar] = useState(false)
  const [aApagar, setAApagar] = useState(false)

  useEffect(() => {
    let activo = true
    carregarFicha(id).then(
      (resultado) => activo && setDados(resultado),
      (error) => {
        console.error('carregar ficha falhou:', error)
        if (activo) setErro(true)
      },
    )
    return () => {
      activo = false
    }
  }, [id])

  async function handleApagar() {
    const { contacto, interaccoes, revisoes, membros } = dados
    setErroApagar(false)
    setAApagar(true)
    try {
      const participacoes = await contarParticipacoes(id)
      const linhas = [
        `Apagar «${contacto.nome}»?`,
        '',
        `Apaga também ${plural(interaccoes.length, 'interacção', 'interacções')}, ${plural(
          revisoes.length,
          'revisão',
          'revisões',
        )} e ${plural(participacoes, 'participação', 'participações')}.`,
      ]
      if (membros.length > 0) {
        linhas.push(`${plural(membros.length, 'pessoa desta organização fica', 'pessoas desta organização ficam')} sem organização.`)
      }
      linhas.push('', 'Não se pode desfazer.')
      if (!window.confirm(linhas.join('\n'))) {
        setAApagar(false)
        return
      }
      await apagarContacto(id)
      onApagado()
    } catch (error) {
      console.error('apagar contacto falhou:', error)
      setErroApagar(true)
      setAApagar(false)
    }
  }

  const voltar = (
    <button type="button" className="admin-button-secondary" onClick={onLista}>
      Voltar à lista
    </button>
  )

  if (erro || dados === null) {
    return (
      <section className="admin-section">
        <p className={erro ? 'admin-error' : undefined} role="alert">
          {erro ? LOAD_ERROR : 'Este contacto não existe.'}
        </p>
        {voltar}
      </section>
    )
  }

  if (dados === undefined) return <p>A carregar…</p>

  const { contacto, perfis, interaccoes, revisoes, organizacao, membros, pessoa } = dados
  const nomePerfil = (perfilId) => perfis.find((perfil) => perfil.id === perfilId)?.nome
  const linhaDoTempo = historico(interaccoes, revisoes)

  return (
    <>
      <section className="admin-section">
        <div className="admin-section-head">
          <h2>{contacto.nome}</h2>
          {voltar}
        </div>

        <p className="rede-linha-detalhe">
          {rotulo(TIPOS, contacto.tipo_registo)}
          {organizacao && (
            <>
              {' · '}
              <button type="button" className="rede-ligacao-texto" onClick={() => onAbrir(organizacao.id)}>
                {organizacao.nome}
              </button>
            </>
          )}
          {contacto.cidade && ` · ${contacto.cidade}`}
        </p>

        <p className="rede-etiquetas">
          <span className={`rede-estado rede-estado-${contacto.estado}`}>{rotulo(ESTADOS, contacto.estado)}</span>
          {contacto.etiquetas.map((valor) => (
            <span key={valor} className="rede-etiqueta">
              {rotulo(ETIQUETAS, valor)}
            </span>
          ))}
        </p>

        <dl className="rede-dados">
          <dt>Próxima revisão</dt>
          <dd>{contacto.proxima_revisao ? formatDate(contacto.proxima_revisao) : 'por marcar'}</dd>
          {contacto.email && (
            <>
              <dt>Email</dt>
              <dd>
                <a href={`mailto:${contacto.email}`}>{contacto.email}</a>
              </dd>
            </>
          )}
          {contacto.telefone && (
            <>
              <dt>Telefone</dt>
              <dd>
                <a href={`tel:${contacto.telefone.replace(/\s/g, '')}`}>{contacto.telefone}</a>
              </dd>
            </>
          )}
          {contacto.website && (
            <>
              <dt>Website</dt>
              <dd>
                <a href={ligacaoWeb(contacto.website)} target="_blank" rel="noreferrer">
                  {contacto.website}
                </a>
              </dd>
            </>
          )}
          {contacto.origem && (
            <>
              <dt>Origem</dt>
              <dd>{contacto.origem}</dd>
            </>
          )}
          {contacto.pedido_adesao_em && (
            <>
              <dt>Pedido de adesão</dt>
              <dd>{formatDate(contacto.pedido_adesao_em)}</dd>
            </>
          )}
          {pessoa && (
            <>
              <dt>Registo do RCP</dt>
              <dd>{pessoa.email}</dd>
            </>
          )}
        </dl>

        {contacto.notas && <p className="rede-texto">{contacto.notas}</p>}

        {membros.length > 0 && (
          <>
            <h3>Pessoas desta organização</h3>
            <ul className="rede-membros">
              {membros.map((membro) => (
                <li key={membro.id}>
                  <button type="button" className="rede-ligacao-texto" onClick={() => onAbrir(membro.id)}>
                    {membro.nome}
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}

        <div className="rede-accoes">
          <button type="button" className="admin-button" onClick={() => onModo('interaccao')}>
            Registar interacção
          </button>
          <button type="button" className="admin-button" onClick={() => onModo('revisao')}>
            Registar revisão
          </button>
          <button type="button" className="admin-button-secondary" onClick={() => onModo('editar')}>
            Editar
          </button>
        </div>
      </section>

      <section className="admin-section">
        <h2>Histórico</h2>
        {linhaDoTempo.length === 0 ? (
          <p>Ainda não há interacções nem revisões.</p>
        ) : (
          <ol className="rede-historico">
            {linhaDoTempo.map((item) =>
              item.tipo === 'interaccao' ? (
                <li key={`i-${item.id}`}>
                  <p className="rede-historico-cabeca">
                    {formatDate(item.data)} · {rotulo(CANAIS, item.canal)}
                  </p>
                  <p className="rede-texto">{item.resumo}</p>
                  {nomePerfil(item.registado_por) && (
                    <p className="rede-historico-pe">Registado por {nomePerfil(item.registado_por)}</p>
                  )}
                </li>
              ) : (
                <li key={`r-${item.id}`} className="rede-historico-revisao">
                  <p className="rede-historico-cabeca">
                    {formatDate(item.data)} · Revisão: {rotulo(DECISOES, item.decisao)}
                  </p>
                  {item.accao && (
                    <p className="rede-texto">
                      Acção seguinte: {item.accao}
                      {item.prazo && ` (até ${formatDate(item.prazo)})`}
                      {nomePerfil(item.responsavel) && `, a cargo de ${nomePerfil(item.responsavel)}`}
                      {'. '}
                      {item.concluida ? `Concluída a ${formatDate(item.concluida_em)}.` : 'Por concluir.'}
                    </p>
                  )}
                  {nomePerfil(item.registado_por) && (
                    <p className="rede-historico-pe">Registado por {nomePerfil(item.registado_por)}</p>
                  )}
                </li>
              ),
            )}
          </ol>
        )}
      </section>

      <Participacoes contactoId={id} />

      <section className="admin-section">
        <h2>Apagar contacto</h2>
        <p>Apaga o contacto e todo o seu histórico: interacções, revisões e participações.</p>
        {erroApagar && (
          <p className="admin-error" role="alert">
            Não foi possível apagar. Tenta outra vez.
          </p>
        )}
        <button type="button" className="rede-botao-perigo" onClick={handleApagar} disabled={aApagar}>
          {aApagar ? 'Um momento…' : 'Apagar contacto'}
        </button>
      </section>
    </>
  )
}
