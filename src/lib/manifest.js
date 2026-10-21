// Cada página aponta para o seu manifesto, para que "Adicionar ao ecrã principal"
// instale a aplicação certa: "/" a pública, "/admin" a de administração.

export const PUBLIC_MANIFEST = '/manifest.webmanifest'
export const ADMIN_MANIFEST = '/manifest-admin.webmanifest'

const APPLE_TITLE = 'apple-mobile-web-app-title'

export function setManifest(href) {
  document.querySelector('link[rel="manifest"]')?.setAttribute('href', href)
}

export function setAppleTitle(content) {
  let meta = document.querySelector(`meta[name="${APPLE_TITLE}"]`)
  if (!meta) {
    meta = document.createElement('meta')
    meta.name = APPLE_TITLE
    document.head.appendChild(meta)
  }
  meta.content = content
}

export function removeAppleTitle() {
  document.querySelector(`meta[name="${APPLE_TITLE}"]`)?.remove()
}
