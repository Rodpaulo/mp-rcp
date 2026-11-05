// Números da barra do separador Rede (SPEC 17.3), com as leituras que o Rede já faz.

import { listarAccoesEmAtraso, listarContactos, listarInteressados, listarPorRever } from './api.js'

export async function lerNumerosRede() {
  const [contactos, porRever, interessados, atraso] = await Promise.all([
    listarContactos(),
    listarPorRever(),
    listarInteressados(),
    listarAccoesEmAtraso(),
  ])
  return [
    { rotulo: 'Contactos', numero: contactos.length },
    { rotulo: 'Por rever', numero: porRever.length },
    { rotulo: 'Interessados', numero: interessados.length },
    { rotulo: 'Acções em atraso', numero: atraso.length, pedeAccao: true },
  ]
}
