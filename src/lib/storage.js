// O localStorage pode falhar (navegação privada em alguns browsers): nesse caso, segue sem memória.

export const KEY_EMAIL = 'mp_rcp_email'
export const KEY_LAST_EDITION = 'mp_rcp_last_edition'
// Caixas já enviadas a partir deste browser ('1'): no ecrã de confirmação aparecem marcadas e fechadas.
export const KEY_NEWSLETTER = 'mp_rcp_newsletter'
export const KEY_ASSOCIADO = 'mp_rcp_associado'

export function readKey(key) {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

export function writeKey(key, value) {
  try {
    localStorage.setItem(key, value)
  } catch {
    // sem memória neste browser
  }
}

export function removeKey(key) {
  try {
    localStorage.removeItem(key)
  } catch {
    // sem memória neste browser
  }
}
