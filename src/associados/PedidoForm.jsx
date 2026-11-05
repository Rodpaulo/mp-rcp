import { useState } from 'react'
import { SAVE_ERROR } from '../admin/text.js'
import { camposPedido, dataBruxelas } from '../../supabase/functions/_shared/campos.js'
import { criarPedidoManual, lerConfiguracao, obterEmailTipo, pedidoEmAbertoComEmail, preencherEmail } from './api.js'

const PRIMEIRO_CONTACTO = [
  'Num Regresso à Casa de Partida',
  'Pela newsletter',
  'Nas redes sociais',
  'Por um amigo',
  'Outro',
]

const EMAIL_VALIDO = /^[^@\s]+@[^@\s]+\.[^@\s]+$/
const DIAS_NO_MES = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]

// "5/3", "05-03", "5.3" → '05/03'; vazio → null; inválido → undefined.
function normalizarAniversario(texto) {
  const t = texto.trim()
  if (!t) return null
  const m = t.match(/^(\d{1,2})\s*[/.\-\s]\s*(\d{1,2})$/)
  if (!m) return undefined
  const [d, mes] = [Number(m[1]), Number(m[2])]
  if (mes < 1 || mes > 12 || d < 1 || d > DIAS_NO_MES[mes - 1]) return undefined
  return `${String(d).padStart(2, '0')}/${String(mes).padStart(2, '0')}`
}

// Criar pedido à mão: excepção para quem não pode passar pelo Tally (SPEC 16.15).
export default function PedidoForm({ onVoltar, onGravado }) {
  const hoje = dataBruxelas()
  const [f, setF] = useState({
    nome_completo: '',
    nome_emails: '',
    email: '',
    aniversario: '',
    primeiro_contacto: '',
    newsletter: false,
    consentimento: false,
    data: hoje,
    jaRecebeu: false,
  })
  const [aGravar, setAGravar] = useState(false)
  const [erro, setErro] = useState('')

  const mudar = (campo) => (event) =>
    setF((actual) => ({ ...actual, [campo]: event.target.type === 'checkbox' ? event.target.checked : event.target.value }))

  async function handleSubmit(event) {
    event.preventDefault()
    const email = f.email.trim().toLowerCase()
    const aniversario = normalizarAniversario(f.aniversario)
    if (!EMAIL_VALIDO.test(email)) return setErro('Esse email não parece completo.')
    if (aniversario === undefined) return setErro('O aniversário escreve-se dd/mm, por exemplo 05/03.')

    setAGravar(true)
    setErro('')
    try {
      const aberto = await pedidoEmAbertoComEmail(email)
      if (aberto) {
        setErro(`Já há um pedido em aberto com este email (${aberto.nome_completo}).`)
        setAGravar(false)
        return
      }
      const dados = {
        nome_completo: f.nome_completo.trim(),
        nome_emails: f.nome_emails.trim(),
        email,
        aniversario,
        primeiro_contacto: f.primeiro_contacto || null,
        newsletter: f.newsletter,
        consentimento: f.consentimento,
        // Meio-dia em Bruxelas: o dia não muda com o fuso.
        data_pedido: new Date(`${f.data}T12:00:00`).toISOString(),
      }
      let email4 = null
      if (f.jaRecebeu) {
        const [config, tipo] = await Promise.all([lerConfiguracao(), obterEmailTipo('04_pedido_recebido')])
        const r = preencherEmail(tipo, camposPedido(dados, config, hoje), hoje)
        email4 = { assunto: r.assunto.texto, corpo: r.corpo.texto }
      }
      const pedido = await criarPedidoManual(dados, { jaRecebeu: f.jaRecebeu, email4 })
      onGravado(pedido.id)
    } catch (error) {
      console.error('criar pedido falhou:', error)
      setErro(SAVE_ERROR)
      setAGravar(false)
    }
  }

  return (
    <form className="admin-section assoc-form" onSubmit={handleSubmit}>
      <div className="admin-section-head">
        <h2>Criar pedido à mão</h2>
        <button type="button" className="admin-button-secondary" onClick={onVoltar}>
          Voltar
        </button>
      </div>

      <p className="assoc-nota">
        Só para quem não pode usar o formulário do Tally. Os pedidos de Maio não se criam aqui: recebem o email 1 e
        entram pelo formulário.
      </p>

      <label className="admin-field">
        <span>Nome completo</span>
        <input required value={f.nome_completo} onChange={mudar('nome_completo')} />
      </label>
      <label className="admin-field">
        <span>Nome a usar nos emails</span>
        <input required value={f.nome_emails} onChange={mudar('nome_emails')} />
      </label>
      <label className="admin-field">
        <span>Email</span>
        <input type="email" required autoCapitalize="off" value={f.email} onChange={mudar('email')} />
      </label>
      <label className="admin-field">
        <span>Dia de aniversário (dd/mm, facultativo)</span>
        <input inputMode="numeric" placeholder="05/03" value={f.aniversario} onChange={mudar('aniversario')} />
      </label>
      <label className="admin-field">
        <span>Primeiro contacto com a Matinés Pensantes</span>
        <select className="assoc-select" value={f.primeiro_contacto} onChange={mudar('primeiro_contacto')}>
          <option value="">—</option>
          {PRIMEIRO_CONTACTO.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
      </label>
      <label className="admin-field">
        <span>Data do pedido</span>
        <input type="date" required max={hoje} value={f.data} onChange={mudar('data')} />
      </label>

      <label className="assoc-opcao">
        <input type="checkbox" checked={f.newsletter} onChange={mudar('newsletter')} />
        Quer receber a newsletter
      </label>
      <label className="assoc-opcao">
        <input type="checkbox" checked={f.consentimento} onChange={mudar('consentimento')} />
        Autorizou o tratamento dos dados para gerir a adesão
      </label>
      <label className="assoc-opcao">
        <input type="checkbox" checked={f.jaRecebeu} onChange={mudar('jaRecebeu')} />
        Já recebeu os dados de pagamento
      </label>
      <p className="assoc-nota">
        {f.jaRecebeu
          ? 'O email 4 fica registado como enviado à mão e não sai. Os lembretes seguem as datas do pedido.'
          : 'O email 4 (dados de pagamento) sai na passagem seguinte da função diária, às 9h.'}
      </p>

      {erro && (
        <p className="admin-error" role="alert">
          {erro}
        </p>
      )}

      <div className="assoc-gravar">
        <button type="submit" className="admin-button" disabled={aGravar}>
          {aGravar ? 'Um momento…' : 'Criar pedido'}
        </button>
      </div>
    </form>
  )
}
