# CLAUDE.md — mp-rcp

Aplicação web da Matinés Pensantes (associação cultural em Bruxelas) para registar presenças no encontro mensal *Regresso à Casa de Partida* (RCP). Uma página pública de check-in por QR (`/`) e uma página de administração (`/admin`) para a direcção. **`SPEC.md` é a fonte de verdade**: em caso de dúvida, o SPEC manda; alterações de âmbito passam primeiro pelo SPEC e só depois pelo código.

## Stack

- React + Vite, em **JavaScript** (sem TypeScript).
- `react-router-dom` para as rotas.
- `@supabase/supabase-js` para falar com o Supabase.
- Sem bibliotecas de UI, sem gestão de estado, sem CSS-in-JS: CSS simples em ficheiros `.css`.
- **Nada mais sem perguntar ao Miguel.** Nenhuma dependência nova entra sem pedido explícito.

## Ritual das migrações (não negociável)

1. Eu (Claude Code) escrevo ficheiros numerados em `supabase/migrations/NNN_descricao.sql`.
2. O Miguel corre cada ficheiro à mão no SQL Editor do Supabase e confirma "tudo verde".
3. Uma migração aplicada **nunca se edita**: correcções vão numa migração nova.
4. Nunca SQL destrutivo (`drop`, `delete` sem `where`, `truncate`) sem pedido explícito do Miguel.
5. Eu nunca tento ligar-me à base de dados nem correr SQL.

## Segredos

- Nunca leio, escrevo nem peço o conteúdo de `.env`.
- Nunca escrevo chaves em ficheiros versionados.
- A única chave que a aplicação usa é a **publishable key** do Supabase, através das variáveis `VITE_SUPABASE_URL` e `VITE_SUPABASE_PUBLISHABLE_KEY`. A secret key nunca é usada nem copiada.
- Nunca apagues nem alteres .env.example; se um commit sair mal, diz-o antes de corrigir.

## Língua da interface

- Português europeu, tratamento por **tu**, sem anglicismos.
- Os textos dos ecrãs são os do SPEC (secções 7 e 8), tal como lá estão.

## Modo de trabalho

- Um passo de cada vez, pedido pelo Miguel. Não adianto trabalho de passos seguintes.
- No fim de cada passo: lista dos ficheiros criados/alterados e dos comandos que o Miguel deve correr.
