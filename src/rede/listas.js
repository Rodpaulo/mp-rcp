// Valores das listas fechadas do Rede (iguais às restrições check da migração 004) e os rótulos que se mostram.

export const TIPOS = [
  { valor: 'pessoa', rotulo: 'Pessoa' },
  { valor: 'organizacao', rotulo: 'Organização' },
]

export const ETIQUETAS = [
  { valor: 'orador', rotulo: 'Orador' },
  { valor: 'parceiro', rotulo: 'Parceiro' },
  { valor: 'instituicao', rotulo: 'Instituição' },
  { valor: 'media', rotulo: 'Media' },
  { valor: 'patrocinador', rotulo: 'Patrocinador' },
  { valor: 'local', rotulo: 'Local' },
  { valor: 'organizador_terceiro', rotulo: 'Organizador terceiro' },
  { valor: 'associado', rotulo: 'Associado' },
]

export const ESTADOS = [
  { valor: 'activa', rotulo: 'Activa' },
  { valor: 'prospecto', rotulo: 'Prospecto' },
  { valor: 'a_avaliar', rotulo: 'A avaliar' },
  { valor: 'em_espera', rotulo: 'Em espera' },
  { valor: 'encerrada', rotulo: 'Encerrada' },
]

export const CANAIS = [
  { valor: 'email', rotulo: 'Email' },
  { valor: 'chamada', rotulo: 'Chamada' },
  { valor: 'presencial', rotulo: 'Presencial' },
  { valor: 'whatsapp', rotulo: 'WhatsApp' },
  { valor: 'evento', rotulo: 'Evento' },
  { valor: 'outro', rotulo: 'Outro' },
]

export const DECISOES = [
  { valor: 'abordar', rotulo: 'Abordar' },
  { valor: 'manter', rotulo: 'Manter' },
  { valor: 'reforcar', rotulo: 'Reforçar' },
  { valor: 'em_espera', rotulo: 'Em espera' },
  { valor: 'encerrar', rotulo: 'Encerrar' },
]

// Estado em que o contacto fica ao gravar uma revisão com esta decisão (SPEC 14.5).
export const ESTADO_POR_DECISAO = {
  abordar: 'prospecto',
  manter: 'activa',
  reforcar: 'activa',
  em_espera: 'em_espera',
  encerrar: 'encerrada',
}

export const PAPEIS = [
  { valor: 'orador', rotulo: 'Orador' },
  { valor: 'parceiro', rotulo: 'Parceiro' },
  { valor: 'patrocinador', rotulo: 'Patrocinador' },
  { valor: 'media', rotulo: 'Media' },
  { valor: 'local', rotulo: 'Local' },
  { valor: 'apoio', rotulo: 'Apoio' },
]

export function rotulo(lista, valor) {
  return lista.find((item) => item.valor === valor)?.rotulo ?? valor
}

// Para pesquisar sem distinguir maiúsculas nem acentos: "Câmara" encontra-se com "camara".
export function normalizar(texto) {
  return (texto ?? '')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .trim()
}
