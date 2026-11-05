// Valores das listas fechadas dos Associados (iguais às restrições check da migração 008),
// os rótulos que se mostram e os campos dos emails-tipo (SPEC 16.8).

export const ESTADOS_PEDIDO = [
  { valor: 'recebido', rotulo: 'Recebido' },
  { valor: 'instrucoes_enviadas', rotulo: 'Instruções enviadas' },
  { valor: 'pago', rotulo: 'Pago' },
  { valor: 'admitido', rotulo: 'Admitido' },
  { valor: 'desistiu', rotulo: 'Desistiu' },
  { valor: 'nao_admitido', rotulo: 'Não admitido' },
  { valor: 'cancelado', rotulo: 'Cancelado' },
]

export const SAIDAS = [
  { valor: 'desistiu', rotulo: 'Desistiu' },
  { valor: 'nao_admitido', rotulo: 'Não admitido' },
  { valor: 'cancelado', rotulo: 'Cancelado' },
]

export const TIPOS_ASSOCIADO = [
  { valor: 'efectivo', rotulo: 'Efectivo' },
  { valor: 'aderente', rotulo: 'Aderente' },
]

export const ESTADOS_ASSOCIADO = [
  { valor: 'activo', rotulo: 'Activo' },
  { valor: 'suspenso', rotulo: 'Suspenso' },
  { valor: 'saido', rotulo: 'Saído' },
]

export const ESTADOS_ENVIO = [
  { valor: 'enviado', rotulo: 'Enviado' },
  { valor: 'falhou', rotulo: 'Falhou' },
  { valor: 'a_enviar', rotulo: 'A enviar' },
]

export function rotulo(lista, valor) {
  return lista.find((item) => item.valor === valor)?.rotulo ?? valor
}

// Nome de um associado: o do pedido e, sem pedido, o do contacto.
export function nomeDoAssociado(a) {
  return a.pedido?.nome_completo ?? a.contacto?.nome ?? '—'
}

export function estadoDaQuota(a, ano) {
  const q = a.quotas.find((item) => item.ano === ano)
  if (!q) return 'sem quota'
  return q.estado === 'paga' ? 'paga' : 'por pagar'
}

// '03a_ultimos_dias_sem_pagamento' → '3-A'; '04_pedido_recebido' → '4'.
export function numeroEmail(chave) {
  const m = chave.match(/^(\d{2})([a-z]?)_/)
  if (!m) return chave
  return `${Number(m[1])}${m[2] ? `-${m[2].toUpperCase()}` : ''}`
}

// Os emails que a direcção envia fora da aplicação: só estes têm "Copiar texto preenchido".
export const MANUAIS = ['01_convite_pendentes', '11_recibo_adesao', '14_inscricoes_antecipadas', '15_propostas_programacao', '18_quota_paga_recibo']

// De onde vêm os dados da pré-visualização de cada email.
export function fonteDoEmail(chave) {
  const n = Number(chave.slice(0, 2))
  if (n <= 2 || chave.startsWith('03_')) return 'contacto'
  if (n <= 8) return 'pedido'
  return 'associado'
}

// Título da lista de escolha da pré-visualização.
export const FONTES = {
  contacto: 'Escolhe um contacto do Rede (etiqueta associado, sem pedido de adesão)',
  pedido: 'Escolhe um pedido de adesão',
  associado: 'Escolhe um associado',
}

// Para pesquisar sem distinguir maiúsculas nem acentos, como no Rede (src/rede/listas.js).
export function normalizar(texto) {
  return (texto ?? '')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .trim()
}

// Campos disponíveis, como no documento "Emails-tipo para associados".
export const CAMPOS = [
  { nome: 'primeiro_nome', descricao: 'Nome pelo qual a pessoa quer ser tratada', origem: 'Pedido: "Nome a usar nos emails"' },
  { nome: 'nome_completo', descricao: 'Nome completo, como no recibo e no descritivo da transferência', origem: 'Pedido' },
  { nome: 'email', descricao: 'Endereço para onde se enviam os emails', origem: 'Pedido' },
  { nome: 'aniversario', descricao: 'Dia e mês (dd/mm), sem ano', origem: 'Pedido (facultativo)' },
  { nome: 'data_pedido', descricao: 'Data de submissão do pedido', origem: 'Pedido' },
  { nome: 'link_pedido_adesao', descricao: 'Ligação para o formulário "Pedido de adesão"', origem: 'Configuração' },
  { nome: 'valor_quota', descricao: 'Valor da quota ("40 €")', origem: 'Configuração, por ano; nos emails 16 e 17, a quota' },
  { nome: 'ano', descricao: 'Ano a que a quota se refere', origem: 'Quota' },
  { nome: 'IBAN', descricao: 'IBAN da conta da associação', origem: 'Configuração' },
  { nome: 'titular_conta', descricao: 'Titular da conta bancária', origem: 'Configuração' },
  { nome: 'numero_recibo', descricao: 'Número do recibo emitido', origem: 'Quota (Registar recibo)' },
  { nome: 'proxima_sessao', descricao: 'Data e tema da próxima sessão do RCP', origem: 'Configuração' },
  { nome: 'consequencia_90_dias', descricao: 'O que acontece ao pedido após 90 dias sem pagamento', origem: 'Configuração (por decidir)' },
  { nome: 'mes_regresso', descricao: 'Mês em que a programação recomeça depois de Agosto', origem: 'Configuração' },
  { nome: 'assinatura', descricao: '"A equipa das Matinés Pensantes"', origem: 'Configuração' },
  { nome: 'nome_evento', descricao: 'Evento com inscrições antecipadas', origem: 'À mão' },
  { nome: 'data_evento', descricao: 'Data do evento', origem: 'À mão' },
  { nome: 'local_evento', descricao: 'Local do evento', origem: 'À mão' },
  { nome: 'preco_associado', descricao: 'Preço para associados', origem: 'À mão' },
  { nome: 'preco_publico', descricao: 'Preço para o público', origem: 'À mão' },
  { nome: 'link_inscricao', descricao: 'Ligação para a inscrição', origem: 'À mão' },
  { nome: 'data_abertura_publico', descricao: 'Dia em que as inscrições abrem ao público', origem: 'À mão' },
  { nome: 'data_limite', descricao: 'Prazo para as propostas de nomes', origem: 'À mão' },
  { nome: 'link_sugestoes', descricao: 'Ligação para as propostas de nomes', origem: 'À mão' },
]
