import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
// Duas páginas de entrada com a mesma aplicação: cada uma traz o seu manifesto,
// porque o iOS Safari só lê o manifesto ao carregar a página.
export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      input: {
        main: 'index.html',
        admin: 'admin.html',
      },
    },
  },
})
