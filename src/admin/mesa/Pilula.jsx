// Pílula de estado (SPEC 17.5): um só mapa de estado para cor, para o Rede, os Associados e a Biblioteca.
// Sem estado (ou um que não está no mapa), fica neutra.
const TOM = {
  recebido: 'neutro',
  a_avaliar: 'neutro',
  instrucoes_enviadas: 'turquesa',
  prospecto: 'turquesa',
  pago: 'amarelo',
  em_espera: 'amarelo',
  suspenso: 'amarelo',
  a_enviar: 'amarelo',
  admitido: 'forte',
  activa: 'forte',
  activo: 'forte',
  na_mesa: 'forte',
  enviado: 'forte',
  cancelado: 'fim',
  desistiu: 'fim',
  nao_admitido: 'fim',
  encerrada: 'fim',
  saido: 'fim',
  falhou: 'fim',
  desaparecido: 'fim',
}

export default function Pilula({ estado, children }) {
  return <span className={`mesa-pilula mesa-pilula-${TOM[estado] ?? 'neutro'}`}>{children}</span>
}
