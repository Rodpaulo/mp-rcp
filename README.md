# mp-rcp

Aplicação web da Matinés Pensantes para registar presenças no *Regresso à Casa de Partida* (RCP): uma página pública de check-in por QR (`/`) e uma página de administração (`/admin`). A especificação completa está em [SPEC.md](SPEC.md).

## Correr localmente

Precisas de Node.js 20 ou mais recente.

```bash
npm install
cp .env.example .env   # e preenche os dois valores (vê os comentários no ficheiro)
npm run dev
```

A aplicação fica em http://localhost:5173 (`/` e `/admin`).

## Regras do projecto

O ritual das migrações da base de dados, as regras sobre segredos e o modo de trabalho estão em [CLAUDE.md](CLAUDE.md). As migrações ficam em `supabase/migrations/` e correm-se à mão no SQL Editor do Supabase.
