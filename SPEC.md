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
- Biblioteca Circulante — página /biblioteca com os gestos "levo um livro" e "deixo um livro" (desvio de 24 Out; ver 13.1).

Fora (não entra até 3 de Novembro, mesmo que pareça fácil):
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
- O admin tem a sua própria página de entrada, admin.html, com o manifesto RCP Admin (o iOS lê o manifesto ao carregar a página; a troca por JavaScript não funciona).
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

Depois, por ordem provável: pergunta ao convidado na inscrição · questionário nativo ligado à pessoa · link personalizado no lembrete (um toque, sem escrever email) · briefing automático para a Ana na véspera · ligação pretix → pessoas (depois do cutover do site, Fevereiro de 2027). Tudo na mesma aplicação; nunca mais do que isto.

## 13. Biblioteca Circulante (acrescentado a 24 de Outubro de 2026)

### 13.1 Desvio de âmbito, registado
A 19 de Outubro o piloto do RCP06 ficou fechado em "só check-in". A 24 de Outubro o Miguel decidiu acrescentar a Biblioteca Circulante ao RCP06, com três condições: âmbito mínimo (migração 003 e página `/biblioteca`; secção de admin só depois do RCP06), go/no-go próprio a 30 de Outubro, separado do check-in, e Plano B sem custo (autocolantes, livros dos fundadores, cartão na mesa e fotografias acontecem de qualquer forma; se a página não estiver pronta, o catálogo carrega-se depois a partir das fotografias).

### 13.2 O que é, e o problema que resolve
A Biblioteca Circulante é a mesa de livros do RCP: quem vem traz um livro em português e leva outro. Até hoje não há registo nenhum, ninguém está na mesa durante o encontro, e o stock anda pelos cinco livros. O objectivo não é documentar o que existe: é dar à Biblioteca memória e história para que cresça. O que a faz crescer é analógico (livros na mesa, "traz um livro" na comunicação); a aplicação dá a cada livro uma identidade e um percurso.

### 13.3 Princípios próprios
- As saídas são baratas (um número e um email); as entradas são caras (título e autor). Como não há organização na mesa, as duas são self-service, mas feitas na mesa dos livros, antes ou depois da conversa — nunca durante.
- A peça central é analógica: **autocolantes pré-numerados** (BC-001, BC-002…) numa folha na mesa. Quem deixa um livro cola o próximo autocolante na lombada e regista-o; quem leva regista o número. Ninguém atribui números.
- O público vê livros, nunca pessoas. Quem trouxe e quem levou fica no admin.
- Rede de segurança: fotografia da mesa no início e no fim; a reconciliação corrige o que o self-service não apanhou.

### 13.4 Modelo de dados (migração 003)
```
books           id, number (único, 'BC-001'), title, author, note (opcional: "porque o trago"),
                status ('na_mesa' | 'levado' | 'desaparecido'),
                entered_edition_id, entered_by (person, opcional; set null se a pessoa for apagada), created_at
book_movements  id, book_id, edition_id, person_id (opcional; set null), kind ('entrada' | 'saida'),
                source ('self' | 'manual'), at
```
Regras:
- O número é normalizado por uma função: "12", "bc12", "BC-012", "bc 12" → `BC-012`. Fora do padrão → inválido.
- Um livro que sai e volta mantém o número e o título; a volta é uma nova `entrada`. É assim que nasce o percurso.
- `status` é mantido pelas funções (não derivado) para a lista pública ser uma consulta simples.
- Pessoas desconhecidas são criadas em `people` como no check-in (sem consentimento de newsletter). Levar um livro **não** conta como presença: as duas medições ficam separadas; a reconciliação pode cruzá-las.

### 13.5 Funções públicas (o anon só pode chamar estas)
- `biblioteca_na_mesa()` → lista dos livros com `status = 'na_mesa'`: número, título, autor, código da edição de entrada, `hands` (quantas vezes já saiu). Sem dados pessoais.
- `livro_por_numero(p_number)` → número, título, autor, status, ou `null`. Serve para a página confirmar antes de agir ("Levas «título»?").
- `levar_livro(p_number, p_email)` → `ok` (com título), `invalid_number`, `invalid_email`, `not_found`, `already_taken`, `no_open_edition`.
- `deixar_livro(p_number, p_title, p_author, p_note, p_email)` → `ok` (livro novo), `returned` (número já existia e estava `levado`: o livro voltou), `number_in_use` (número já existe e está na mesa: autocolante mal lido ou repetido), `missing_title`, `invalid_number`, `invalid_email`, `no_open_edition`. Email opcional.
- Direcção (authenticated): acesso total às duas tabelas por RLS; vista `biblioteca_resumo` por edição (entradas, saídas, livros na mesa no fim).

### 13.6 Página pública — `/biblioteca`
Mesma linguagem visual da página de check-in; tratamento por tu; uma mão.
- Cabeçalho: logótipo; "Biblioteca Circulante"; linha "Traz um livro em português. Leva outro."
- **Na mesa hoje**: lista de `biblioteca_na_mesa()`: número, título, autor; em pequeno, "desde o RCP0x" e, se `hands > 0`, "já esteve em N casas". Se vazia: "A mesa ainda está vazia. Sê a primeira pessoa a deixar um livro."
- Dois botões grandes: **Levo um livro** · **Deixo um livro**. Cada um abre o seu formulário no lugar da lista; "Voltar" fecha.
- **Levo um livro**: campo "Número do autocolante" (inputmode numeric; aceita "12" ou "BC-012"); ao sair do campo, `livro_por_numero` e mostra "«Título», de Autor" ou "Não encontramos esse número. Confirma o autocolante na lombada."; campo email (preenchido de `localStorage` `mp_rcp_email` se existir); botão "Levo este". Confirmação: "Boa leitura. Quando o acabares, traz outro." `already_taken` → "Esse livro já foi registado como levado. Se o tens na mão, diz à organização."
- **Deixo um livro**: "Cola o próximo autocolante da folha na lombada e escreve aqui o número." Campos: número; título; autor (opcional); "Porque o trazes? (uma linha, opcional)"; email (opcional, preenchido se existir). Ao sair do campo número, `livro_por_numero`: se existir e estiver `levado` → "Este número é «Título». Se o livro voltou à mesa, confirma." e esconde título/autor; se existir e estiver na mesa → "Esse número já está em uso. Usa o próximo autocolante da folha." Botão "Deixo este". Confirmação: "Obrigado. O «Título» já faz parte da Biblioteca." / `returned` → "Bem-vindo de volta, «Título»."
- Erros de rede com a mesma frase das outras páginas. `localStorage`: guarda `mp_rcp_email` se a pessoa o escreveu aqui e ainda não existia.
- Rodapé: ligação "Como tratamos os teus dados" (mesmo texto do check-in, com "e os livros que deixas ou levas nos encontros" acrescentado à primeira frase).
- Não há QR próprio para a Biblioteca. A página de check-in dá o caminho: na confirmação, uma ligação em destaque "Biblioteca Circulante →" para `/biblioteca`; no estado de formulário, uma ligação discreta em baixo, "Só vens à Biblioteca?", para quem não quer fazer check-in.

### 13.7 Materiais
- Não há QR nem cartão próprios para a Biblioteca. O cartão único (`materials/cartoes.html`) ganha, por baixo da mensagem principal e separado por uma linha fina, um bloco em corpo menor: "**Biblioteca Circulante** · Traz um livro em português, leva outro. Deixas um? Cola o próximo autocolante na lombada e regista o número. Levas um? Regista o número."
- Folha de autocolantes (`materials/autocolantes.html`): BC-001 a BC-080, numeração grande e "Biblioteca Circulante · Matinés Pensantes" em pequeno, em grelha para etiquetas A4 removíveis (por omissão 3 × 8, 63,5 × 33,9 mm, tipo Avery L7159; margens e dimensões como variáveis CSS no topo do ficheiro). O cabeçalho da folha, fora das etiquetas, repete a instrução: "Cola o próximo autocolante na lombada do livro e regista o número em rcp.matinespensantes.org → Biblioteca Circulante."

### 13.8 Operação por edição
Antes: folha de autocolantes e o cartão único na mesa dos livros; os fundadores levam três livros cada (RCP06).
Durante: nada. Fotografia da mesa à chegada (Ana ou Miguel).
Depois: fotografia da mesa no fim; na reconciliação, conferir os números das fotografias com os movimentos; corrigir no admin (depois do RCP06, por SQL) o que faltar; livros que desapareceram sem registo → `desaparecido`.

### 13.9 Critérios de aceitação (go/no-go a 30 Out, próprio)
- Deixar um livro novo, levar um livro, devolver um livro que tinha saído, e os erros (número inválido, em uso, não encontrado, já levado), testados no telemóvel com dados móveis.
- Lista "na mesa hoje" correcta depois de cada gesto.
- O anon não lê `books` nem `book_movements` directamente (consulta REST devolve `[]`).
- Cartão reimpresso com o bloco da Biblioteca; folha de autocolantes impressa; autocolante aguenta numa lombada.
- Se falhar: Plano B de 13.1.

### 13.10 Depois do RCP06
Secção Biblioteca no admin (catálogo, movimentos por edição, correcções, `desaparecido`); eventual leitura de ISBN pela câmara se o volume justificar; percurso de cada livro como conteúdo de newsletter quando houver meses de história.
