# MP RCP — Especificação v0.2 (piloto de check-in, RCP06)

Documento de referência da aplicação. Em caso de dúvida, este ficheiro manda.
Alterações de âmbito passam por aqui antes de passarem para o código.

---

## 1. O que é

Uma aplicação web (PWA ligeira) da Matinés Pensantes para o *Regresso à Casa de Partida* (RCP), o encontro mensal da associação no Hotel Pestana Brussels Schuman. Cobre o que o site e o MailPoet não cobrem: **quem esteve presente**. Versões seguintes cobrirão a Biblioteca Circulante e mecanismos leves de envolvimento dos participantes.

A inscrição nos eventos **não** é feita aqui: continua no site (MailPoet agora; pretix depois da migração do site, em 2027).

## 2. Princípios de desenho

1. **Na sala, a Ana não toca em dados.** A ferramenta trabalha antes (importar inscritos) e depois (reconciliar). Durante o evento, só há self-service pelo participante.
2. **Um só QR, fixo, igual em todos os cartões.** Abre a página pública. A pessoa escreve o email, carrega em "Estou cá", recebe uma confirmação. O browser lembra-se dela nas edições seguintes.
3. **Nada que faça alguém olhar para o telemóvel durante a conversa.** Cada função futura passa por este crivo.
4. **A cobertura do QR nunca é 100%.** A contagem de sala no fim (única tarefa da Ana) é o número de referência; o QR dá a lista nominal e a estimativa de no-shows.
5. **Dados pessoais fora do Git.** Base de dados alojada na União Europeia, com texto de privacidade na página. No piloto, as contas de serviço são as pessoais do Miguel (ver 4); a transferência para contas em nome da associação é um passo da v2.
6. **Simples resolve.** Duas páginas, uma função de servidor, sem framework de UI, sem estado global, sem dependências que não sejam estritamente necessárias.

## 3. Âmbito do piloto (RCP06, 3 de Novembro de 2026)

Dentro:
- Página pública de check-in: email + caixa "quero receber a newsletter" + botão + confirmação.
- Admin com login (Miguel, Ana): edição aberta, inscritos vs presentes em tempo real, importação CSV do MailPoet, campo "contagem de sala", exportação CSV.
- QR do URL fixo; texto de privacidade; manifesto PWA mínimo.

Fora (não entra até 3 de Novembro, mesmo que pareça fácil):
- Biblioteca Circulante (continua em papel).
- Questionário (continua em papel + Tally).
- Pergunta ao convidado, links personalizados, briefing automático, notificações, gamificação.
- Versão francesa (a estratégia 2027–2028 abandonou o francês).

## 4. Arquitectura

| Camada | Escolha | Notas |
|---|---|---|
| Front-end | React + Vite (JavaScript) | Duas rotas: `/` (público) e `/admin`. |
| Base de dados e auth | Supabase, plano gratuito, região Central EU (Frankfurt) | Projecto `mp-rcp` na conta pessoal do Miguel durante o piloto. |
| Alojamento | Vercel, plano Hobby | Só serve ficheiros estáticos; nunca recebe dados pessoais. |
| Domínio | `rcp.matinespensantes.org` | CNAME no DNS do Hostinger a apontar para a Vercel. |
| Código | GitHub, repositório privado `mp-rcp` na conta do Miguel | Sem dados, sem chaves. |

O browser do participante fala directamente com o Supabase. Não há servidor intermédio nem funções serverless.

### Contas durante o piloto
Supabase, GitHub e Vercel são, por agora, as contas pessoais do Miguel. Consequências aceites: a Ana entra na aplicação com a sua conta de utilizador (criada no Supabase Auth), mas não entra nos painéis; o texto de privacidade continua verdadeiro (responsável: Matinés Pensantes; dados na UE); a transferência para contas em nome da associação fica para depois do piloto (o Supabase permite transferir um projecto entre organizações; o GitHub permite transferir um repositório; na Vercel importa-se de novo). Nada no código depende da conta.

### Migrações (ritual não negociável)
- O Claude Code escreve ficheiros numerados em `supabase/migrations/NNN_descricao.sql`.
- O Miguel corre cada ficheiro à mão no SQL Editor do Supabase e confirma "tudo verde".
- Uma migração aplicada nunca é editada: correcções vão numa migração nova.
- Nunca SQL destrutivo (`drop table`, `delete` sem `where`, `truncate`) sem pedido explícito do Miguel.
- A migração 001 é o ficheiro `rcp_schema_v0.1.sql` entregue com esta especificação.

## 5. Modelo de dados

A entidade central é a **pessoa**, não o evento. É isso que permite, ao longo das edições, saber quem volta, quem é novo e quem consentiu.

```
people          id, email (único, minúsculas), name (opcional),
                newsletter_consent, newsletter_consent_at, created_at
editions        id, code ('RCP06'), title, event_date, is_open (só uma aberta), room_count
registrations   person_id + edition_id (chave), source ('mailpoet'|'pretix'|'manual')
checkins        person_id + edition_id (chave), source ('qr'|'manual'), checked_in_at
```

Regras:
- Email normalizado (trim + minúsculas) sempre, em todas as entradas.
- Uma presença por pessoa e edição: repetir o QR confirma, não duplica.
- Email desconhecido no check-in = walk-in: cria-se a pessoa e regista-se a presença.
- Consentimento de newsletter só sobe, nunca desce (a pessoa pode retirar por email à associação; não há botão para isso no piloto).
- A edição aberta é determinada no servidor: o URL do QR não muda de edição para edição.

## 6. Segurança e acesso

- **Público (anon)**: não lê nem escreve tabelas. Só pode chamar a função `check_in(p_email, p_newsletter)`, que corre com `security definer` e devolve apenas `{status, edition}`. `status` ∈ `ok`, `already`, `invalid_email`, `no_open_edition`. Nunca devolve nome nem se a pessoa estava inscrita — a página pública não pode servir para testar emails de terceiros.
- **Direcção (authenticated)**: acesso total às quatro tabelas por RLS. Só existem duas contas, criadas à mão no painel. **O registo livre de utilizadores está desligado no Supabase** — é a linha que impede estranhos de verem os dados.
- Importação de inscritos pela função `import_registrations(p_edition_code, p_emails[])`, reservada a utilizadores autenticados, repetível sem duplicar.
- Chaves do Supabase (modelo novo): a **publishable key** (`sb_publishable_...`) é a única usada pela aplicação; corresponde ao papel `anon` sem sessão e `authenticated` com sessão. A **secret key** (sucessora da service_role) nunca é usada nem copiada para lado nenhum.
- `VITE_SUPABASE_URL` e `VITE_SUPABASE_PUBLISHABLE_KEY` em `.env` local e nas variáveis de ambiente da Vercel; `.env` no `.gitignore`. Cópia no Bitwarden da associação, para que a Ana as tenha se for preciso.
- A publishable key é pública por natureza; a protecção está no RLS e na função, não no segredo da chave.
- Limite de carga: não há rate limiting no piloto. Risco aceite para ~60 pessoas; a revisitar na v2.

## 7. Ecrã público — `/`

Uma página, uma mão, em português, tratamento por **tu**.

Estado inicial:
- Logótipo ou nome "Matinés Pensantes"; título "Regresso à Casa de Partida"; linha com código e título da edição aberta (ex.: "RCP06 · Portugal em Tom Maior").
- Campo: *O teu email* (type email, autocomplete email, autocapitalize off, teclado de email no telemóvel).
- Caixa, desmarcada por defeito: *Quero receber a newsletter da Matinés Pensantes.*
- Botão grande: **Estou cá**.
- Rodapé: ligação "Como tratamos os teus dados" (abre um bloco de 5 linhas na própria página).

Comportamento:
- Ao submeter, chama `check_in`. Enquanto espera, o botão desactiva-se e mostra "Um momento…".
- `ok` → confirmação curta e calorosa: "Bem-vindo/a de volta à Casa de Partida. Boa conversa." (sem o email, sem dados).
- `already` → "Já estavas registado/a. Boa conversa."
- `invalid_email` → "Esse email não parece completo. Vê se não falta nada." (sem bloquear por excesso).
- `no_open_edition` → "Não há nenhuma edição aberta neste momento."
- Erro de rede → "Não conseguimos registar agora. Tenta outra vez daqui a um minuto, ou diz à organização." (sem termos técnicos).
- Depois de um `ok`/`already`, o email fica guardado em `localStorage` (`mp_rcp_email`). Na visita seguinte o campo aparece preenchido, com a ligação "Não és tu? Limpar". A mesma edição não se regista duas vezes a partir do mesmo browser: se `localStorage` tiver `mp_rcp_last_edition` igual à edição aberta, a página abre já na confirmação.
- Sem login, sem cookies de terceiros, sem analytics.

Aspecto: cores da marca (navy `#2E3D4D`, turquesa `#3AAEB8`, fundo claro), tipografia do sistema, contraste alto, legível na sala do Pestana à noite. Sem animações além do estado do botão.

## 8. Ecrã de administração — `/admin`

Login por email e senha (Supabase Auth). Sem registo, sem "recuperar senha" no piloto (as senhas estão no Bitwarden).

Depois do login:
- **Cabeçalho**: edição aberta (código, título, data) e os três números: inscritos · presentes · dos quais walk-ins. Actualiza em tempo real (Supabase Realtime na tabela `checkins`) ou por refresh a cada 15 s — o que for mais simples e fiável.
- **Lista de presenças**: email, hora, origem (qr/manual), inscrito sim/não. Ordenada pela mais recente.
- **Inscritos ausentes**: lista dos inscritos ainda sem presença (serve para marcar presença à mão no fim, se a Ana quiser: botão "Marcar presente" → `checkins.source = 'manual'`).
- **Importar inscritos**: área de texto onde se cola o CSV exportado do MailPoet (ou upload do ficheiro). A aplicação extrai a coluna de email (detecta a coluna pelo cabeçalho `email`, sem distinção de maiúsculas), mostra "N emails encontrados", e ao confirmar chama `import_registrations`. Mostra "N inscrições novas; M já existiam".
- **Contagem de sala**: campo numérico + guardar → `editions.room_count`.
- **Exportar CSV**: presenças da edição (email, hora, origem, inscrito, consentimento newsletter). Serve para a reconciliação e para passar os consentimentos ao MailPoet.
- **Edições**: lista; botão "Abrir esta edição" (fecha a anterior); criar edição (código, título, data). É assim que se passa do RCP06 ao RCP07 sem tocar na base.
- Sair.

Funciona em telemóvel (a Ana pode querer ver os números na sala) e em desktop (a reconciliação faz-se à secretária).

## 9. Operação por edição

Antes (véspera): criar/abrir a edição no admin → exportar segmento do MailPoet → colar no admin → conferir o número.
Durante: nada. Cartões QR na porta, nas mesas e na mesa dos livros.
Depois (20 minutos): registar contagem de sala → exportar CSV → reconciliar (inscritos, presentes, walk-ins, no-show estimado, cobertura do QR) → consentimentos para o MailPoet → fechar a edição.

## 10. PWA e materiais

- `manifest.webmanifest`: nome "Matinés Pensantes · RCP", nome curto "RCP", ícone 192 e 512 (logótipo sobre navy), cor de tema navy, `display: standalone`. Sem service worker no piloto (a página precisa de rede para funcionar; cache offline só esconderia erros).
- QR gerado para `https://rcp.matinespensantes.org` com margem e correcção de erro M; testado impresso em A6 e A5 a 1 m com luz fraca.
- Texto de privacidade (5 linhas, na página): quem é o responsável (Matinés Pensantes, geral@), para quê (registo de presenças nos eventos; newsletter só com consentimento), onde ficam (base de dados na União Europeia), quanto tempo (enquanto a associação organizar o RCP), como apagar (um email para geral@).

## 11. Critérios de aceitação do piloto (go/no-go a 30 Out)

- Ponta a ponta em iOS Safari e Android Chrome, com dados móveis: ler QR → email → confirmação → aparece no admin em menos de 15 s.
- Email repetido, desconhecido e mal formado tratados como descrito em 7.
- 20 submissões em 2 minutos sem erro.
- Três pessoas que não conhecem o projecto conseguem registar-se sem explicação.
- Nenhum dado pessoal nem chave no repositório; `.env` ignorado; dados de teste apagados.
- Texto de privacidade visível na página.

Se um destes falhar a 30 Out: Plano B — cartões ficam na gaveta, presença faz-se como sempre, piloto passa para o RCP08 (Janeiro de 2027).

## 12. Depois do piloto (v2, a decidir em Novembro)

Primeiro, independentemente de funcionalidades: transferir o projecto Supabase, o repositório e o deploy da Vercel para contas em nome da associação (geral@), e registar tudo no cartão "Contas em nome da associação".

Depois, por ordem provável: Biblioteca Circulante (catálogo com autocolantes numerados) · pergunta ao convidado na inscrição · questionário nativo ligado à pessoa · link personalizado no lembrete (um toque, sem escrever email) · briefing automático para a Ana na véspera · ligação pretix → pessoas (depois do cutover do site, Fevereiro de 2027). Tudo na mesma aplicação; nunca mais do que isto.
