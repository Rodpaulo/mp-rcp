import { useEffect, useState } from 'react'
import { LOAD_ERROR } from '../admin/text.js'
import { porExtenso } from './datas.js'
import {
  apagarContacto,
  contarParticipacoes,
  listarEdicoesComCheckin,
  listarInteraccoes,
  listarMembros,
  listarPerfis,
  listarRevisoes,
  obterContacto,
  obterPessoa,
} from './api.js'
import { CANAIS, DECISOES, ESTADOS, ETIQUETAS, TIPOS, rotulo } from './listas.js'
import Accoes from '../admin/mesa/Accoes.jsx'
import Dados from '../admin/mesa/Dados.jsx'
import FichaCartao from '../admin/mesa/FichaCartao.jsx'
import Pilula from '../admin/mesa/Pilula.jsx'
import AccaoAberta from './AccaoAberta.jsx'
import CartaoContacto from './CartaoContacto.jsx'
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
  const [organizacao, membros, pessoa, presencas] = await Promise.all([
    contacto.organizacao_id ? obterContacto(contacto.organizacao_id) : null,
    contacto.tipo_registo === 'organizacao' ? listarMembros(id) : [],
    contacto.person_id ? obterPessoa(contacto.person_id) : null,
    contacto.person_id ? listarEdicoesComCheckin(contacto.person_id) : [],
  ])
  return { contacto, perfis, interaccoes, revisoes, organizacao, membros, pessoa, presencas }
}

export default function Ficha({ id, onLista, onAbrir, onModo, onApagado }) {
  const [dados, setDados] = useState(undefined) // undefined: a carregar; null: não existe
  const [erro, setErro] = useState(false)
  const [erroApagar, setErroApagar] = useState(false)
  const [aApagar, setAApagar] = useState(false)
  const [copia, setCopia] = useState('') // '' | 'feita' | 'falhou'

  // Endereço desta ficha com o domínio actual, para colar na descrição do cartão do Trello.
  const enderecoFicha = `${window.location.origin}/admin?s=rede&c=${id}`

  // Depois de concluir uma acção ou mudar o cartão: só as revisões mudaram.
  async function recarregarRevisoes() {
    const revisoes = await listarRevisoes(id)
    setDados((actuais) => ({ ...actuais, revisoes }))
  }

  // Depois de gravar o cartão: só esse campo do contacto mudou.
  function mudarCartao(cartao) {
    setDados((actuais) => ({ ...actuais, contacto: { ...actuais.contacto, cartao_trello: cartao } }))
  }

  async function handleCopiar() {
    try {
      await navigator.clipboard.writeText(enderecoFicha)
      setCopia('feita')
    } catch (error) {
      console.error('copiar endereço falhou:', error)
      setCopia('falhou')
    }
  }

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

  // No telemóvel a ficha ocupa o ecrã e "Voltar à lista" regressa à lista; ao lado da lista não aparece.
  const voltar = (
    <button type="button" className="mesa-voltar" onClick={onLista}>
      Voltar à lista
    </button>
  )

  if (erro || dados === null) {
    return (
      <FichaCartao>
        {voltar}
        <p className={erro ? 'admin-error' : undefined} role="alert">
          {erro ? LOAD_ERROR : 'Este contacto não existe.'}
        </p>
      </FichaCartao>
    )
  }

  if (dados === undefined) return <p>A carregar…</p>

  const { contacto, perfis, interaccoes, revisoes, organizacao, membros, pessoa, presencas } = dados
  const nomePerfil = (perfilId) => perfis.find((perfil) => perfil.id === perfilId)?.nome
  const linhaDoTempo = historico(interaccoes, revisoes)

  return (
    <>
      {voltar}
      <FichaCartao
        sobretitulo={[rotulo(TIPOS, contacto.tipo_registo), ...contacto.etiquetas.map((valor) => rotulo(ETIQUETAS, valor))].join(' · ')}
        nome={contacto.nome}
      >
        <div className="mesa-ficha-estado">
          <Pilula estado={contacto.estado}>{rotulo(ESTADOS, contacto.estado)}</Pilula>
          <CartaoContacto contactoId={id} cartao={contacto.cartao_trello} onMudou={mudarCartao} />
        </div>

        <Dados
          itens={[
            { rotulo: 'Próxima revisão', valor: contacto.proxima_revisao ? porExtenso(contacto.proxima_revisao) : 'por marcar' },
            {
              rotulo: 'Organização',
              valor: organizacao && (
                <button type="button" className="rede-ligacao-texto" onClick={() => onAbrir(organizacao.id)}>
                  {organizacao.nome}
                </button>
              ),
            },
            { rotulo: 'Cidade', valor: contacto.cidade },
            { rotulo: 'Email', valor: contacto.email && <a href={`mailto:${contacto.email}`}>{contacto.email}</a> },
            {
              rotulo: 'Telefone',
              valor: contacto.telefone && (
                <a href={`tel:${contacto.telefone.replace(/\s/g, '')}`}>{contacto.telefone}</a>
              ),
            },
            {
              rotulo: 'Website',
              valor: contacto.website && (
                <a href={ligacaoWeb(contacto.website)} target="_blank" rel="noreferrer">
                  {contacto.website}
                </a>
              ),
            },
            { rotulo: 'Origem', valor: contacto.origem },
            { rotulo: 'Pedido de adesão', valor: contacto.pedido_adesao_em && porExtenso(contacto.pedido_adesao_em) },
            {
              rotulo: 'Registo do RCP',
              valor: pessoa && `${pessoa.email}${presencas.length > 0 ? ` · esteve no ${presencas.join(', ')}` : ''}`,
            },
          ]}
        />

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

        <Accoes
          saidas={
            <button type="button" className="mesa-saida" onClick={handleApagar} disabled={aApagar}>
              {aApagar ? 'Um momento…' : 'Apagar contacto'}
            </button>
          }
        >
          <button type="button" className="mesa-botao" onClick={() => onModo('interaccao')}>
            Registar interacção
          </button>
          <button type="button" className="mesa-botao-secundario" onClick={() => onModo('revisao')}>
            Registar revisão
          </button>
          <button type="button" className="mesa-botao-secundario" onClick={() => onModo('editar')}>
            Editar
          </button>
          <button type="button" className="mesa-botao-secundario" onClick={handleCopiar}>
            Copiar endereço da ficha
          </button>
        </Accoes>
        {copia === 'feita' && (
          <p className="rede-aviso" role="status">
            Endereço copiado. Cola-o na descrição do cartão do Trello.
          </p>
        )}
        {copia === 'falhou' && (
          <p className="rede-aviso" role="status">
            Não foi possível copiar. Copia à mão: <span className="rede-endereco">{enderecoFicha}</span>
          </p>
        )}
        {erroApagar && (
          <p className="admin-error" role="alert">
            Não foi possível apagar. Tenta outra vez.
          </p>
        )}
      </FichaCartao>

      <FichaCartao titulo="Histórico">
        {linhaDoTempo.length === 0 ? (
          <p>Ainda não há interacções nem revisões.</p>
        ) : (
          <ol className="rede-historico">
            {linhaDoTempo.map((item) =>
              item.tipo === 'interaccao' ? (
                <li key={`i-${item.id}`}>
                  <p className="rede-historico-cabeca">
                    {porExtenso(item.data)} · {rotulo(CANAIS, item.canal)}
                  </p>
                  <p className="rede-texto">{item.resumo}</p>
                  {nomePerfil(item.registado_por) && (
                    <p className="rede-historico-pe">Registado por {nomePerfil(item.registado_por)}</p>
                  )}
                </li>
              ) : (
                <li key={`r-${item.id}`} className="rede-historico-revisao">
                  <p className="rede-historico-cabeca">
                    {porExtenso(item.data)} · Revisão: {rotulo(DECISOES, item.decisao)}
                  </p>
                  {item.accao && (
                    <p className="rede-texto">
                      Acção seguinte: {item.accao}
                      {item.prazo && ` (até ${porExtenso(item.prazo)})`}
                      {nomePerfil(item.responsavel) && `, a cargo de ${nomePerfil(item.responsavel)}`}
                      {'. '}
                      {item.concluida ? `Concluída a ${porExtenso(item.concluida_em)}.` : 'Por concluir.'}
                    </p>
                  )}
                  {item.accao && !item.concluida && <AccaoAberta revisao={item} cartao={contacto.cartao_trello} onMudou={recarregarRevisoes} />}
                  {nomePerfil(item.registado_por) && (
                    <p className="rede-historico-pe">Registado por {nomePerfil(item.registado_por)}</p>
                  )}
                </li>
              ),
            )}
          </ol>
        )}
      </FichaCartao>

      <Participacoes contactoId={id} />
    </>
  )
}
