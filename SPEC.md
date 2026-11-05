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
                newsletter_consent, newsletter_consent_at, created_at,
                associado_interesse, associado_interesse_at (migração 006)
editions        id, code ('RCP06'), title, event_date, is_open (só uma aberta), room_count
registrations   person_id + edition_id (chave), source ('mailpoet'|'pretix'|'manual')
checkins        person_id + edition_id (chave), source ('qr'|'manual'), checked_in_at
```

Regras:
- Email normalizado (trim + minúsculas) sempre, em todas as entradas.
- Uma presença por pessoa e edição: repetir o QR confirma, não duplica.
- Email desconhecido no check-in = walk-in: cria-se a pessoa e regista-se a presença.
- Consentimento de newsletter só sobe, nunca desce (a pessoa pode retirar por email à associação; não há botão para isso no piloto).
- Interesse em ser associado (migração 006, 30 de Outubro de 2026): o mesmo princípio. `associado_interesse` só sobe; `associado_interesse_at` guarda a data do primeiro pedido.
- A edição aberta é determinada no servidor: o URL do QR não muda de edição para edição.

## 6. Segurança e acesso

- **Público (anon)**: não lê nem escreve tabelas. Só pode chamar a função `check_in(p_email, p_newsletter)` e, desde a migração 006, `check_in_associado(p_email, p_newsletter, p_associado_interesse)`, que chama `check_in` por dentro e, com o interesse verdadeiro e a presença registada, marca `associado_interesse` e `associado_interesse_at` em `people`. As duas correm com `security definer`, têm as mesmas permissões (`anon` e `authenticated`) e devolvem apenas `{status, edition}`. `check_in_associado` tem nome próprio e os três parâmetros obrigatórios, para nunca se confundir com `check_in`; a `check_in` não foi alterada. `status` ∈ `ok`, `already`, `invalid_email`, `no_open_edition`. Nunca devolve nome nem se a pessoa estava inscrita — a página pública não pode servir para testar emails de terceiros.
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
- Por baixo, no mesmo estilo e também desmarcada por defeito: *Quero ser associado da Matinés Pensantes. Contactem-me.* (desde 30 de Outubro de 2026).
- Botão grande: **Estou cá**.
- Por baixo, botão secundário **Biblioteca Circulante** (para `/biblioteca`): a mesma largura, altura e letra do "Estou cá", contorno de 2 px e texto em turquesa escura #1F7A82, fundo branco. É a única ligação para `/biblioteca` na página, antes e depois do check-in (desde 31 de Outubro de 2026).
- Rodapé: ligação "Como tratamos os teus dados" (abre um bloco de 5 linhas na própria página).

Comportamento:
- Ao submeter, chama `check_in_associado` (desde a migração 006; antes, `check_in`). Enquanto espera, o botão desactiva-se e mostra "Um momento…".
- `ok` → confirmação curta e calorosa: "Bem-vindo/a de volta à Casa de Partida. Boa conversa." (sem o email, sem dados).
- `already` → "Já estavas registado/a. Boa conversa."
- `invalid_email` → "Esse email não parece completo. Vê se não falta nada." (sem bloquear por excesso).
- `no_open_edition` → "Não há nenhuma edição aberta neste momento."
- Erro de rede → "Não conseguimos registar agora. Tenta outra vez daqui a um minuto, ou diz à organização." (sem termos técnicos).
- Depois de um `ok`/`already`, o email fica guardado em `localStorage` (`mp_rcp_email`). Na visita seguinte o campo aparece preenchido, com a ligação "Não és tu? Limpar". A mesma edição não se regista duas vezes a partir do mesmo browser: se `localStorage` tiver `mp_rcp_last_edition` igual à edição aberta, a página abre já na confirmação.
- No ecrã de confirmação (`ok` e `already`), as duas caixas continuam visíveis por baixo da confirmação, seguidas do botão da Biblioteca (desde 31 de Outubro de 2026): muita gente só decide a meio do encontro.
  - Cada caixa mostra o que foi enviado a partir deste browser, guardado em `localStorage` como o email (`mp_rcp_newsletter`, `mp_rcp_associado`).
  - Marcar uma caixa chama `check_in_associado` com o email guardado e os dois valores actuais (a função é idempotente: não duplica a presença) e mostra "Guardado" junto à caixa.
  - Uma caixa marcada fica marcada e desactivada: o consentimento só sobe; retirar faz-se por email, como diz o texto de privacidade.
  - Se a chamada falhar, a caixa volta a desmarcada, com a mensagem de erro de rede.
  - "Não és tu? Limpar" esquece também as duas caixas, para a pessoa seguinte no mesmo telemóvel.
- Sem login, sem cookies de terceiros, sem analytics.

Aspecto: cores do Manual de Identidade 1.1 (azul-marinho #2C3E50, turquesa #3EBDC6 e turquesa escura #1F7A82 para botões e ligações, fundo claro), Rajdhani nos títulos e Montserrat no texto, carregadas do Google Fonts com fallback para Arial; contraste alto, legível na sala do Pestana à noite; nenhum texto branco sobre turquesa nem sobre amarelo. Sem animações além do estado do botão.

Para depois de 4 de Novembro de 2026 (registado a 31 de Outubro):
1. `check_in_associado` passa a devolver também `newsletter_consent` e `associado_interesse` da pessoa, e o ecrã "Já estavas registado/a" mostra nas caixas o estado real da base, e não só o que foi enviado a partir deste browser.
2. O ecrã de confirmação ganha uma forma de trocar de pessoa (hoje "Não és tu? Limpar" só existe no formulário).

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
- QR gerado para `https://rcp.matinespensantes.org` com margem e correcção de erro M; a testar impresso no cartão A4, a 1 m, com luz fraca.
- Cartão único em A4 (`materials/cartoes.html`; PDF pronto a imprimir `materials/MP_cartao_A4_RCP.pdf`), para a porta e a mesa dos livros; A5 e A6 abandonados. Título do evento em maiúsculas espaçadas, turquesa escura; bloco da Biblioteca com os quatro passos.
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
- A peça central é analógica: **autocolantes pré-numerados** (BC-001, BC-002…) numa folha na mesa. Quem deixa um livro cola o próximo autocolante na contracapa e regista-o; quem leva regista o número. Ninguém atribui números.
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
- **Levo um livro**: campo "Número do autocolante" (inputmode numeric; aceita "12" ou "BC-012"); ao sair do campo, `livro_por_numero` e mostra "«Título», de Autor" ou "Não encontramos esse número. Confirma o autocolante na contracapa."; campo email (preenchido de `localStorage` `mp_rcp_email` se existir); botão "Levo este". Confirmação: "Boa leitura. Quando o acabares, traz outro." `already_taken` → "Esse livro já foi registado como levado. Se o tens na mão, diz à organização."
- **Deixo um livro**: "Cola o próximo autocolante da folha na contracapa do livro, no canto de baixo, sem tapar o código de barras, e escreve aqui o número." Campos: número; título; autor (opcional); "Porque o trazes? (uma linha, opcional)"; email (opcional, preenchido se existir). Ao sair do campo número, `livro_por_numero`: se existir e estiver `levado` → "Este número é «Título». Se o livro voltou à mesa, confirma." e esconde título/autor; se existir e estiver na mesa → "Esse número já está em uso. Usa o próximo autocolante da folha." Botão "Deixo este". Confirmação: "Obrigado. O «Título» já faz parte da Biblioteca." / `returned` → "Bem-vindo de volta, «Título»."
- Erros de rede com a mesma frase das outras páginas. `localStorage`: guarda `mp_rcp_email` se a pessoa o escreveu aqui e ainda não existia.
- Rodapé: ligação "Como tratamos os teus dados" (mesmo texto do check-in, com "e os livros que deixas ou levas na Biblioteca Circulante" acrescentado à primeira frase).
- Não há QR próprio para a Biblioteca. A página de check-in dá o caminho: na confirmação, uma ligação em destaque "Biblioteca Circulante →" para `/biblioteca`; no estado de formulário, uma ligação discreta em baixo, "Só vens à Biblioteca?", para quem não quer fazer check-in.

### 13.7 Materiais
- Não há QR nem cartão próprios para a Biblioteca. O cartão único (`materials/cartoes.html`) ganha, por baixo da mensagem principal e separado por uma linha fina, um bloco em corpo menor, com barra amarela à esquerda: título "Biblioteca Circulante", subtítulo "Traz um livro em português. Leva outro." e quatro passos numerados — 1. Lê o código e regista a tua presença. 2. Carrega em «Biblioteca Circulante». 3. Deixas um livro? Cola o próximo autocolante na contracapa e regista o número. 4. Levas um livro? Regista o número que está na contracapa. Cartão único em A4 (`materials/cartoes.html`; PDF pronto a imprimir `materials/MP_cartao_A4_RCP.pdf`), para a porta e a mesa dos livros; A5 e A6 abandonados. Título do evento em maiúsculas espaçadas, turquesa escura; bloco da Biblioteca com os quatro passos.
- Folha de autocolantes (`materials/autocolantes.html`): BC-001 a BC-096 (quatro folhas completas), numeração grande e, em pequeno, "Biblioteca Circulante · Matinés Pensantes" e "rcp.matinespensantes.org", em grelha para etiquetas A4 removíveis (por omissão 3 × 8, 63,5 × 33,9 mm, tipo Avery L7159; margens e dimensões como variáveis CSS no topo do ficheiro). O cabeçalho da folha, fora das etiquetas, repete a instrução: "Cola o próximo autocolante na contracapa do livro e regista o número em rcp.matinespensantes.org → Biblioteca Circulante."
- Colocação: contracapa, canto inferior, sem tapar o código de barras do ISBN (reservado para leitura futura pela câmara).

### 13.8 Operação por edição
Antes: folha de autocolantes e o cartão único na mesa dos livros; os fundadores levam três livros cada (RCP06).
Durante: nada. Fotografia da mesa à chegada (Ana ou Miguel).
Depois: fotografia da mesa no fim; na reconciliação, conferir os números das fotografias com os movimentos; corrigir no admin (depois do RCP06, por SQL) o que faltar; livros que desapareceram sem registo → `desaparecido`.

### 13.9 Critérios de aceitação (go/no-go a 30 Out, próprio)
- Deixar um livro novo, levar um livro, devolver um livro que tinha saído, e os erros (número inválido, em uso, não encontrado, já levado), testados no telemóvel com dados móveis.
- Lista "na mesa hoje" correcta depois de cada gesto.
- O anon não lê `books` nem `book_movements` directamente (consulta REST devolve `[]`).
- Cartão reimpresso com o bloco da Biblioteca; folha de autocolantes impressa; autocolante aguenta numa contracapa.
- Se falhar: Plano B de 13.1.

### 13.10 Depois do RCP06
Secção Biblioteca no admin (catálogo, movimentos por edição, correcções, `desaparecido`; feita a 31 de Outubro de 2026, ver §15); eventual leitura de ISBN pela câmara se o volume justificar; percurso de cada livro como conteúdo de newsletter quando houver meses de história.

## 14. Rede (acrescentado a 30 de Outubro de 2026)

### 14.1 Desvio de âmbito, registado
A secção 12 fecha a v2 numa lista curta. A 30 de Outubro o Miguel decidiu acrescentar à mesma aplicação um módulo Rede, fora dessa lista, com quatro condições: o SPEC primeiro, depois a migração, depois o código; trabalho só no ramo `rede` até 4 de Novembro; migração estritamente aditiva, aplicada pelo Miguel; nada do que está em produção para o RCP06 muda. A transferência para contas da associação (secção 12) e a revisão do texto de privacidade são tarefas separadas, depois do RCP06, e não bloqueiam o Rede.

### 14.2 Finalidade
Um CRM leve, dentro do admin, para a relação da Matinés Pensantes com oradores, parceiros, instituições, media, patrocinadores, locais, organizadores terceiros e, mais tarde, associados. Responde a quatro perguntas: quem conhecemos, o que falámos com cada um, o que decidimos fazer a seguir, e em que edições do RCP participou. Usam-no o Miguel e a Ana, com tudo visível para os dois.

### 14.3 Âmbito fechado desta versão
- **Lista de contactos**: uma só lista, pessoas e organizações juntas, pesquisável por nome, com filtro por etiqueta e por estado.
- **Ficha do contacto**: dados, organização a que pertence (ou pessoas que lhe pertencem), etiquetas, estado, próxima revisão; interacções e revisões em ordem cronológica; participações nas edições. Num contacto ligado a `people`, a linha "Registo do RCP" mostra o email e as edições em que a pessoa fez check-in ("email · esteve no RCP05, RCP06").
- **Registo de interacção**: pensado para telemóvel, com uma mão: data (hoje por omissão), canal, resumo. Três campos e um botão.
- **Revisões**: data, decisão, acção seguinte com prazo e responsável, conclusão. Ao gravar uma revisão, a próxima revisão do contacto passa por omissão para 12 meses depois, editável.
- **Participações**: ligação de um contacto a uma edição do RCP, com papel e notas.
- **Apagar um contacto**: na ficha, com confirmação explícita; a base apaga por cascata as interacções, revisões e participações do contacto (ver 14.5), sem código adicional.
- **Vista "Por rever"**: contactos com a próxima revisão vencida ou por marcar.
- **Vista "Acções em atraso"**: acções com prazo passado e não concluídas, cada uma com "Concluir".
- **Acções abertas na ficha**: cada acção por concluir tem "Concluir" (a mesma confirmação da vista "Acções em atraso") e, quando o contacto tem cartão no Trello, "Abrir cartão".
- **Cartão do Trello na ficha**: no cabeçalho do contacto, "Abrir cartão" (quando há endereço) e "Editar cartão" (acrescentar, corrigir ou retirar o endereço, que tem de começar por `https://trello.com/`).
- **Vista "Interessados"** (30 de Outubro de 2026): as pessoas de `people` que marcaram, na página de entrada, *Quero ser associado*, com nome, email e data do pedido, e se já há um contacto ligado (`person_id`). "Criar contacto" cria em `contactos` uma pessoa com o nome (ou, sem nome, o email), o email, a etiqueta `associado`, `pedido_adesao_em` igual ao dia do pedido, `person_id` ligado e estado `a_avaliar`; com contacto ligado, o botão passa a "Abrir contacto".

### 14.4 Fora do âmbito
Pipeline visual (colunas, arrastar e largar); envio de email a partir da aplicação; pontuações ou classificações automáticas de contactos; gestão de quotas e pagamentos; importação automática de contactos; papéis e permissões diferentes entre o Miguel e a Ana.

### 14.5 Modelo de dados (migrações 004, 005 e 007)
```
perfis          id (= auth.users.id), nome, created_at
contactos       id, tipo_registo ('pessoa' | 'organizacao'), nome,
                organizacao_id (outro contacto, opcional), person_id (people, opcional),
                etiquetas text[] ('orador', 'parceiro', 'instituicao', 'media', 'patrocinador',
                                  'local', 'organizador_terceiro', 'associado'),
                estado ('activa' | 'prospecto' | 'a_avaliar' | 'em_espera' | 'encerrada'),
                email, telefone, cidade, website, origem, notas,
                pedido_adesao_em (date, só com a etiqueta 'associado'), proxima_revisao (date),
                cartao_trello (endereço https://trello.com/…, opcional; migração 007),
                created_at, updated_at, criado_por (perfis)
interaccoes     id, contacto_id, data (hoje por omissão),
                canal ('email' | 'chamada' | 'presencial' | 'whatsapp' | 'evento' | 'outro'),
                resumo, registado_por (perfis), created_at
revisoes        id, contacto_id, data, decisao ('abordar' | 'manter' | 'reforcar' | 'em_espera' | 'encerrar'),
                accao, prazo, responsavel (perfis), concluida, concluida_em,
                cartao_trello (migração 005; sem uso desde a 007, mantém-se por agora),
                registado_por (perfis), created_at
participacoes   contacto_id + edition_id (chave),
                papel ('orador' | 'parceiro' | 'patrocinador' | 'media' | 'local' | 'apoio'),
                notas, created_at
vistas          rede_por_rever, rede_accoes_em_atraso (security_invoker)
```
Regras:
- Um contacto é uma pessoa ou uma organização. Uma pessoa pode pertencer a uma organização (`organizacao_id`); a aplicação só oferece organizações nesse campo.
- O email de um contacto não é único (as organizações usam endereços genéricos). `person_id` liga o contacto à tabela `people` do check-in só quando o email coincide, e só então; a aplicação procura em `people` pelo email e propõe a ligação. A tabela `people` nunca é alterada pelo Rede.
- `perfis` tem uma linha por conta da direcção; a migração cria-as a partir das contas existentes. `criado_por` e `registado_por` ficam por omissão com a conta autenticada (`auth.uid()`). Uma conta nova no Supabase Auth precisa da sua linha em `perfis` antes de registar no Rede.
- Listas fechadas por restrição `check` na base de dados; a etiqueta e o papel aceitam só os valores acima.
- Uma revisão com prazo tem de ter acção; `concluida_em` existe se e só se `concluida` for verdadeiro.
- Ao gravar uma revisão, o estado do contacto passa a seguir a decisão: `abordar` → `prospecto`; `manter` e `reforcar` → `activa`; `em_espera` → `em_espera`; `encerrar` → `encerrada`. O formulário mostra, antes de gravar, "Ao gravar, o estado passa a X". A actualização é feita pela aplicação, no mesmo gesto que grava a próxima revisão (sem triggers na base).
- Uma participação por contacto e edição.
- `updated_at` é actualizado pela aplicação ao gravar (sem triggers na base).
- Apagar um contacto apaga as suas interacções, revisões e participações. As ligações às tabelas existentes nunca impedem uma operação actual: apagar uma pessoa em `people` limpa `person_id`; apagar uma edição apaga as participações.
- "Por rever": contactos não encerrados com `proxima_revisao` nula ou até hoje. "Acções em atraso": revisões não concluídas com `prazo` anterior a hoje.
- "Interessados": pessoas com `people.associado_interesse` verdadeiro, a mais recente primeiro. O Rede só lê `people`; "Criar contacto" escreve só em `contactos`.
- **Trello** (reescrita a 30 de Outubro de 2026, migração 007). O Rede guarda os factos: interacções, revisões, decisões, estado, participações. O cartão do Trello (quadro "Rede") guarda ideias e contexto: o que propor, o que explorar, quem é quem; é alimentado nas conversas com o Claude.
  - Um cartão por contacto, permanente, com o nome exacto do contacto. Vive enquanto o contacto não estiver `encerrada`.
  - Prazo e responsável ficam só no Rede, nunca no cartão.
  - Ligação à mão nos dois sentidos: a descrição do cartão tem o endereço da ficha (botão "Copiar endereço da ficha"); o contacto tem o endereço do cartão (`contactos.cartao_trello`, que começa sempre por `https://trello.com/`).
  - Na ficha, "Abrir cartão" e "Editar cartão" ficam no cabeçalho do contacto. As acções abertas, na ficha e em "Acções em atraso", mostram "Abrir cartão" com o cartão do contacto. Concluir uma acção não mexe no cartão.
  - `revisoes.cartao_trello` (migração 005) mantém-se na base, mas a aplicação já não a lê nem a escreve.

### 14.6 Segurança e acesso
- Mesmas políticas das tabelas actuais: acesso total para `authenticated`, nenhum para `anon`. Sem funções públicas: o Rede não aparece nas páginas `/` nem `/biblioteca`.
- Sem papéis: o Miguel e a Ana vêem e alteram tudo.

### 14.7 Regras de construção
- **Migração 004 estritamente aditiva**: só cria tabelas, índices, políticas e vistas novas (mais o que estas exigem: activar RLS nas tabelas novas e criar as linhas de `perfis`). Nenhuma alteração, remoção, substituição ou permissão sobre objectos existentes: `people`, `editions`, `registrations`, `checkins`, `books`, `book_movements`, `edition_summary`, `biblioteca_resumo`, as funções e as políticas actuais.
- A migração é aplicada pelo Miguel no SQL Editor, depois de a ler e de exportar as tabelas actuais em CSV. Não há base de teste: o ramo `rede` trabalha contra a base de produção.
- O código do Rede nunca escreve em tabelas existentes. Lê `editions` (para as participações), `people` (para a ligação por email) e `checkins` (para mostrar, na ficha de um contacto ligado, as edições em que a pessoa fez check-in), só em leitura, e mais nada.
- Rotas: o `vercel.json` não muda. O admin ganha separadores dentro de `/admin` (`?s=rede`); o módulo Rede carrega com `React.lazy`, para não pesar na página pública. A leitura automática a cada 15 s do painel não se aplica ao Rede.
- `Admin.jsx` e `Panel.jsx` podem mudar no ramo `rede`. O ramo pode ser enviado para o GitHub para ter pré-visualização na Vercel. `main` recebeu o Rede a 30 de Outubro de 2026, em duas vezes no mesmo dia: primeiro os passos 1 a 3; depois o interesse em ser associado (migração 006, ramo `associado`), a ligação ao Trello (migração 005), as edições com check-in na ficha e as datas com o mês em maiúscula. A partir daí ficou fechado até 4 de Novembro; o trabalho seguinte vive no ramo `rede` até lá.
- Sem dependências novas. Interface em português europeu, tratamento por tu. Datas por extenso como no manual da marca, com o mês em maiúscula ("30 de Outubro de 2026"), em todo o admin: no Rede e também no separador RCP (painel e lista de edições), com uma só função (`formatDate`, em `src/admin/text.js`).

### 14.8 Fases seguintes
- **Associados**, quando a ASBL existir: o pedido de adesão já tem campo (`pedido_adesao_em`); quotas, estado de associado e ligação ao Tally ficam para essa fase, com secção própria neste SPEC (§16, desde 5 de Novembro de 2026).
- Transferência para contas da associação e revisão do texto de privacidade (dados de contactos externos), depois do RCP06.
- **Trello automático**: pela API do Trello, criar o cartão de cada contacto e arquivá-lo quando o contacto passa a `encerrada`. Não agora; até lá, a ligação faz-se à mão (§14.5).

## 15. Biblioteca no admin (acrescentado a 31 de Outubro de 2026)

### 15.1 Desvio de âmbito, registado
A secção 12 fecha a v2 numa lista curta, e o §13.10 deixava a secção Biblioteca no admin para depois do RCP06. A 31 de Outubro o Miguel decidiu acrescentá-la já, no separador RCP, como fez com o Rede, com estas condições: sem migração (se o esquema actual não chegasse, ficava para 4 de Novembro); escritas directas em `books` com as políticas actuais; nenhuma alteração às funções públicas da Biblioteca nem à página `/biblioteca`; trabalho no ramo `rede`, merge em `main` só com ordem do Miguel.

Verificação do esquema (passo 0): um livro acrescentado pela direcção cabe nas colunas actuais. Em `books`, só `number` (único) e `title` são obrigatórios; `entered_by` e `entered_edition_id` aceitam vazio; `status` tem `na_mesa` por omissão; a política `books_admin` dá escrita total a `authenticated`; `normalise_book_number` pode ser chamada por `authenticated`.

### 15.2 Âmbito fechado
- **Lista**: número, título, autor, estado, edição de entrada, quem trouxe; filtro por estado; pesquisa por número ou título.
- **Acrescentar**: número (o seguinte ao maior existente, por omissão, editável), título, autor, nota. O número passa por `normalise_book_number` e tem de ser único. Estado `na_mesa`; `entered_edition_id` é a edição aberta, se houver; `entered_by` fica vazio.
- **Editar**: número (com a mesma validação), título, autor, nota e estado (`na_mesa`, `levado`, `desaparecido`).
- **Histórico do livro**: movimentos (`book_movements`) com edição, tipo e data, só em leitura.
- **Apagar**: só livros sem movimentos, com confirmação. Com movimentos, o botão não aparece.

### 15.3 Regras
- Acrescentar e editar escrevem só em `books`; a secção nunca escreve em `book_movements`. Por isso:
  - um livro acrescentado pela direcção não tem movimento de entrada e não conta nas "entradas" de `biblioteca_resumo`;
  - mudar o estado à mão não cria movimento: corrige o estado, não o histórico.
- Um livro `desaparecido` que volte à mesa pela página pública conta como regresso (`deixar_livro`), como um `levado`.
- Navegação por parâmetros no endereço, dentro do separador RCP: `?b=novo` (acrescentar), `?b=<id>` (livro), `?b=<id>&m=editar` (editar). Com `b`, o painel do RCP sai do ecrã e a sua leitura a cada 15 s pára; sem `b`, a lista aparece no fim do separador RCP.
- Código em `src/biblioteca-admin/`, com um `api.js` próprio (o único ficheiro da secção que fala com a Supabase) e um CSS próprio; carrega com `React.lazy`, fora do ficheiro da página pública.
- Lê `books`, `book_movements`, `editions` e `people` (só o nome ou o email de quem trouxe o livro). Sem dependências novas.

## 16. Associados (acrescentado a 5 de Novembro de 2026)

### 16.1 Desvio de âmbito, registado
A secção 12 fecha a v2 numa lista curta, e o §14.8 deixava os associados para "quando a ASBL existir". A 5 de Novembro o Miguel decidiu acrescentar o módulo Associados, terceiro separador do admin (RCP · Rede · Associados), como fez com o Rede e a Biblioteca, com estas condições: o SPEC primeiro, depois a migração, depois as funções, depois os ecrãs; migração aditiva; `people`, `contactos` e o resto do Rede não mudam de esquema. Primeira fase: SPEC, migração 008 e as duas funções de servidor. Os ecrãs ficam para a fase seguinte.

Este módulo afasta-se de três regras anteriores, e só nisto:
- **§4** ("não há servidor intermédio nem funções serverless"): passa a haver duas Edge Functions da Supabase, no mesmo projecto, na UE. A página pública e o admin continuam a falar directamente com o Supabase.
- **§6** ("a secret key nunca é usada"): as duas funções usam a chave de serviço que a Supabase injecta no ambiente das Edge Functions (`SUPABASE_SERVICE_ROLE_KEY`). Ninguém a copia nem a escreve: não sai da Supabase. A aplicação no browser continua só com a publishable key.
- **§14.4** ("envio de email a partir da aplicação; gestão de quotas e pagamentos" fora do Rede): passam a existir, mas neste módulo, não no Rede.

### 16.2 Finalidade
Levar cada pessoa do pedido de adesão até associado com as quotas em dia, com o mínimo de trabalho humano: a direcção só confirma pagamentos, admite e regista recibos; tudo o resto (instruções de pagamento, lembretes, boas-vindas, aniversários, renovações) sai sozinho. Usam-no as quatro contas da direcção no admin: Ana, Miguel (tesoureiro), Patrícia (Patrícia Marques) e Vera, com tudo visível para as quatro.

### 16.3 Circuito
- **Entrada única**: o formulário "Pedido de adesão" no Tally (`https://tally.so/r/BEaMqN`). Cada submissão chega por webhook à Edge Function `tally-webhook`, que cria o pedido. A folha Google do Tally deixa de ser instrumento de seguimento; fica só como cópia.
- **Saída**: emails transaccionais pelo Resend, domínio `matinespensantes.org`, remetente `Matinés Pensantes <geral@matinespensantes.org>`, Reply-To `geral@matinespensantes.org`. Texto simples, com uma versão HTML mínima gerada do mesmo texto.
- **Relógio**: a Edge Function `associados-diario`, chamada por `pg_cron` + `pg_net` todos os dias às 09:00 de Bruxelas, calcula os emails devidos e envia-os.
- **Gestos humanos** (no admin, fase seguinte): confirmar pagamento, admitir, registar recibo e as saídas manuais do pedido. Nada mais é manual.

### 16.4 Formulário do Tally (campos lidos pelo título)
| Título no Tally | Coluna | Notas |
|---|---|---|
| Nome completo | `nome_completo` | obrigatório |
| Nome a usar nos emails | `nome_emails` | obrigatório; é o `{primeiro_nome}` |
| Email | `email` | obrigatório; trim + minúsculas |
| Dia de aniversário | `aniversario` | facultativo; preenchê-lo é o consentimento para o email 12 |
| Primeiro contacto com a Matinés Pensantes | `primeiro_contacto` | texto das opções escolhidas |
| Consentimento | `consentimento` | obrigatório no Tally ("Autorizo.") |
| Newsletter | `newsletter` | caixa "Quero receber a newsletter Entre encontros." |

Os títulos comparam-se sem maiúsculas, acentos nem pontuação final; mudar um título no Tally obriga a mudar a função. O aniversário aceita "5/3", "05/03", "05-03", "5.3" e datas completas (fica só o dia e o mês); o que não se perceber fica vazio e o texto original vai para `notas`. O consentimento de newsletter fica no pedido; passá-lo ao MailPoet continua à mão, como no §9.

### 16.5 Estados do pedido
```
recebido → instrucoes_enviadas → pago → admitido
   └──────────────┴───────────────┴──→ desistiu | nao_admitido | cancelado
```
- `recebido`: criado pelo webhook.
- `instrucoes_enviadas`: automático, quando o email 4 sai.
- `pago`: manual, com `data_pagamento` (a do pagamento, não a do registo) e `pagamento_confirmado_por`.
- `admitido`: manual; cria o associado (§16.6) e a quota (§16.7). O email 9 ou 10 sai na passagem seguinte da função diária.
- `desistiu`, `nao_admitido`, `cancelado`: manuais. Não há cancelamento automático: o que acontece aos 90 dias ainda não está decidido.
- Um segundo pedido no Tally com o email de um pedido em aberto (`recebido`, `instrucoes_enviadas` ou `pago`) não cria pedido novo nem envia email: fica uma linha nas `notas` do pedido em aberto, com a data e o identificador do Tally.

### 16.6 Associados
- Admitir cria uma linha em `associados`: contacto, pedido, número (sequência a partir de 1, nunca reutilizado; uma admissão que falhe pode deixar um salto), tipo (`efectivo` por omissão, ou `aderente`), fundador, data de admissão, quem admitiu, estado (`activo`, `suspenso`, `saido`).
- **Fundador**: `data_pagamento` do pedido até 31 de Dezembro de 2026, inclusive, mesmo que a admissão seja em Janeiro. Decide entre o email 9 e o 10.
- Um contacto é associado uma vez só. Um contacto que é associado não pode ser apagado no Rede (a base recusa): primeiro trata-se o associado. É a única excepção à regra do §14.5 de as ligações nunca impedirem uma operação actual, porque um associado tem quotas e recibos.

### 16.7 Quotas
- Valor por ano na configuração (`valor_quota_2026`, `valor_quota_2027`, …): 40 € em 2026 e em 2027.
- Quem é admitido até 31 de Dezembro de 2027 fica com a quota de 2027 paga (o primeiro exercício vai até essa data). A partir de 2028, quem é admitido fica com a quota do ano da admissão paga.
- A 1 de Janeiro de cada ano, a partir de 2028, a função diária cria para cada associado `activo` a linha da quota do ano, `nao_paga`, com o valor da configuração, e envia o email 16. Se a função não correr no dia 1, faz isto na primeira passagem de Janeiro; depois de Janeiro, não.
- Enquanto a quota do ano estiver `nao_paga`: um email 17 por trimestre, no 2.º, 3.º e 4.º trimestres (o 1.º é o do email 16), na primeira passagem do trimestre. Quotas de anos anteriores não geram lembretes.
- Registar o pagamento e o recibo (`data_pagamento`, `recibo_numero`, `recibo_data`) é manual.

### 16.8 Emails-tipo
Os textos são os do documento "Emails-tipo para associados" (5 de Novembro de 2026), carregados tal como estão na tabela `emails_tipo` e editáveis no admin. São 19: os 18 numerados e o 3-A (novo nessa versão).

| Chave | Envio | Quando sai (pela função diária, salvo o 4) |
|---|---|---|
| `01_convite_pendentes` | manual | — |
| `02_convite_contactos` | automático, por decidir | ainda não sai: falta decidir a quem (§16.12) |
| `03_ultimos_dias_sem_pedido` | automático, por decidir | ainda não sai: depende do 2 |
| `03a_ultimos_dias_sem_pagamento` | automático | uma vez, entre `data_ultimos_dias_fundador` (15 de Dezembro de 2026) e 31 de Dezembro de 2026, a cada pedido `recebido` ou `instrucoes_enviadas` |
| `04_pedido_recebido` | automático | logo, pelo webhook; se falhar, na passagem seguinte |
| `05`…`08` lembretes | automático | aos 10, 30, 60 e 90 dias após a data do pedido, só com o estado `recebido` ou `instrucoes_enviadas` |
| `09_admissao_fundador` / `10_admissao` | automático | na primeira passagem depois da admissão, consoante `fundador` |
| `11_recibo_adesao` | manual | — |
| `12_aniversario` | automático | no dia, a associados `activo` com aniversário preenchido; o 29/02 sai a 28/02 nos anos comuns |
| `13_boas_ferias` | automático | uma vez por ano, na primeira passagem entre 1 e 15 de Agosto, a associados `activo` |
| `14_inscricoes_antecipadas` | manual, por agora | o documento deixa-o por decidir |
| `15_propostas_programacao` | manual | — |
| `16_renovacao_quota` | automático | §16.7 |
| `17_lembrete_quota` | automático | §16.7 |
| `18_quota_paga_recibo` | manual | — |

Regras de envio:
- Todos os emails começam por "Olá {primeiro_nome}". Os campos `{entre_chavetas}` vêm do pedido (`primeiro_nome`, `nome_completo`, `email`, `aniversario`, `data_pedido`), da quota ou da admissão (`ano`, `valor_quota`) e da configuração (`link_pedido_adesao`, `IBAN`, `titular_conta`, `valor_quota`, `assinatura`, `proxima_sessao`, `mes_regresso`, `consequencia_90_dias`). O `{valor_quota}` dos emails do pedido é o do ano corrente; o dos emails 16 e 17 é o da linha da quota. Os valores escrevem-se "40 €"; as datas por extenso ("5 de Novembro de 2026"). Para os associados, nome e email vêm do pedido e, sem pedido, do contacto.
- Uma linha do corpo que comece por `[Só até 31/12/2026] ` só entra no email se for enviado até essa data (a marca sai do texto); depois, a linha desaparece. É o caso da frase do fundador no email 4.
- **Um email com um campo por preencher não sai**: fica registado como `falhou`, com a lista dos campos em falta, e a função tenta de novo no dia seguinte. É assim que o email 4 espera pelo IBAN e o email 8 por `{consequencia_90_dias}`.
- Nunca o mesmo email-tipo duas vezes ao mesmo pedido ou associado no mesmo período (§16.9). Um envio que falhou não conta: tenta-se de novo.
- Pedidos: em cada passagem sai, no máximo, um email por pedido. O 4 vem primeiro; sem o 4 enviado, não há lembretes. Sai só o lembrete do intervalo em que o pedido está (10–29, 30–59, 60–89, 90–119 dias); um intervalo que passe sem envio não se recupera. No período do 3-A, o 3-A passa à frente do lembrete do dia.
- Um email-tipo com `activo` falso nunca sai.
- Os emails manuais (1, 11, 14, 15, 18): na fase dos ecrãs, o admin mostra o texto já preenchido para copiar; o envio é feito fora da aplicação.
- Limites do Resend no plano gratuito (100 emails por dia, 2 por segundo): a função espera entre envios; o que passar do limite fica `falhou` e sai no dia seguinte (o 12 perde-se se falhar no dia).

### 16.9 Modelo de dados (migração 008)
```
pedidos_adesao   id, tally_id (único), data_pedido, nome_completo, nome_emails, email (citext),
                 aniversario (text 'dd/mm'), primeiro_contacto, newsletter, consentimento,
                 estado, data_pagamento, pagamento_confirmado_por (perfis),
                 contacto_id (contactos), notas, created_at, updated_at
associados       id, contacto_id (único), pedido_id, numero (sequência), tipo ('efectivo' | 'aderente'),
                 fundador, data_admissao, admitido_por (perfis), estado ('activo' | 'suspenso' | 'saido'),
                 created_at
quotas           id, associado_id, ano, valor, estado ('paga' | 'nao_paga'), data_pagamento,
                 recibo_numero, recibo_data, created_at; (associado_id, ano) único
emails_tipo      chave, nome, quando, assunto, corpo, automatico, activo, updated_at
emails_enviados  id, email_tipo, pedido_id | associado_id (exactamente um), periodo,
                 destinatario, assunto, corpo, enviado_em, estado ('a_enviar' | 'enviado' | 'falhou'),
                 resposta_provider
configuracao     chave, valor, descricao, updated_at
```
Regras:
- `aniversario` é texto `dd/mm`, validado na base (dia e mês existentes, 29/02 aceite). Não existe "data sem ano" no Postgres, e uma data com um ano inventado convida a cálculos de idade que ninguém autorizou; `dd/mm` é o que o formulário pede e o que o email mostra.
- **Unicidade dos envios**: índice único em `(email_tipo, pedido_id, associado_id, periodo)`, com nulos iguais, só para as linhas que não falharam. `periodo` é vazio nos emails que saem uma vez na vida do pedido ou do associado (3-A, 4 a 10), o ano nos anuais (`2027` para 12, 13 e 16) e o ano e o trimestre no 17 (`2028-T2`). Assim, o 12 e o 13 repetem-se uma vez por ano, o 17 uma vez por trimestre, e os outros nunca.
- **Reserva antes do envio**: a função grava primeiro a linha como `a_enviar` e só depois chama o Resend; se a linha já existir, não envia. Duas passagens ao mesmo tempo (o webhook e a função diária) nunca enviam o mesmo email duas vezes. Se a função morrer entre a reserva e a resposta, a linha fica `a_enviar` e bloqueia esse envio até a direcção a ver: prefere-se um email a menos a um email repetido.
- O pedido liga-se a um contacto do Rede (`contacto_id`), como faz a vista "Interessados": o webhook procura um contacto pessoa com o mesmo email (o mais antigo, se houver vários); se existir, acrescenta-lhe a etiqueta `associado` e, se faltar, `pedido_adesao_em`; se não existir, cria-o (nome completo, email, etiqueta `associado`, `pedido_adesao_em` igual ao dia do pedido, `person_id` se o email existir em `people`, estado `a_avaliar`, origem "Pedido de adesão (Tally)"). `people` nunca é alterada.
- Apagar um pedido apaga os seus envios. Um associado e as suas quotas não se apagam por cascata: nem apagando o contacto (a base recusa), nem apagando o pedido (o associado fica com `pedido_id` vazio).
- `updated_at` é actualizado por quem grava (funções ou aplicação), sem triggers.
- Listas fechadas por `check`, como no Rede.

### 16.10 Configuração (tabela `configuracao`, editável no admin)
`iban`, `titular_conta`, `assinatura` ("A equipa das Matinés Pensantes"), `link_pedido_adesao` (`https://tally.so/r/BEaMqN`), `proxima_sessao`, `valor_quota_2026` (40), `valor_quota_2027` (40), e ainda `mes_regresso` (email 13), `consequencia_90_dias` (email 8) e `data_ultimos_dias_fundador` (email 3-A, 2026-12-15). Os valores sem omissão ficam vazios até alguém os preencher; um valor vazio impede os emails que o usam (§16.8).

### 16.11 Segurança e acesso
- As tabelas novas têm RLS com acesso total para `authenticated`, como no Rede; nada para `anon`.
- As duas funções escrevem com a chave de serviço injectada pela Supabase (§16.1). Os segredos ficam nos segredos das Edge Functions, nunca no código: `RESEND_API_KEY`, `TALLY_SIGNING_SECRET`, `CRON_SECRET`.
- `tally-webhook` só aceita pedidos com a assinatura do Tally válida (cabeçalho `Tally-Signature`, HMAC-SHA256 do corpo com o segredo de assinatura, em base64). Responde 200 a tudo o que aceitou, incluindo repetições; 401 sem assinatura válida; 500 se não conseguiu gravar o pedido (o Tally volta a tentar).
- `associados-diario` só corre com o cabeçalho `x-cron-secret` igual a `CRON_SECRET`. O `pg_cron` lê o segredo e o endereço do projecto do Vault da Supabase; nada disso fica em ficheiros versionados.
- As duas funções correm sem verificação de JWT da Supabase (o Tally e o `pg_net` não têm sessão); a protecção está na assinatura e no segredo.
- A direcção tem quatro contas no Supabase Auth, criadas à mão: Ana, Miguel, Patrícia e Vera, todas administradoras e cada uma com a sua linha em `perfis`. As linhas da Vera e da Patrícia entraram à mão, por `insert` no SQL Editor; a migração 010 não foi corrida e está marcada "não aplicar" (§16.13).

### 16.12 Pontos em aberto
- O que acontece ao pedido aos 90 dias (`{consequencia_90_dias}`); até lá, o email 8 não sai e não há cancelamento automático.
- A quem vão os emails 2 e 3 ("contactos já angariados"; "quem recebeu o convite"): contactos do Rede com a etiqueta `associado`? Pessoas da vista "Interessados"? Até se decidir, estão carregados mas não saem.
- Email 14: automático ou manual.
- O que conta como "pagamento até 31 de Dezembro" (data da transferência ou data de entrada na conta): a direcção decide ao registar `data_pagamento`.
- Email 4 a partir de 2028: a frase "até 31 de Dezembro de 2027".
- O gesto "admitir": decidido a 5 de Novembro de 2026, função `admitir_pedido` na migração 011 (§16.15).

### 16.13 Regras de construção
- **Migração 008 aditiva**: só cria tabelas, índices, políticas e dados iniciais das tabelas novas. As chaves estrangeiras para `contactos` e `perfis` são novas e vivem nas tabelas novas; nenhuma coluna, restrição, política, vista ou função existente muda. O `pg_cron` fica numa migração à parte (009), a correr depois de as funções estarem publicadas; a 010 (linha da Vera em `perfis`) **não se aplica**: não foi corrida, porque os perfis da Vera e da Patrícia entraram à mão; o ficheiro fica no repositório, marcado no cabeçalho, só como registo.
- Funções em `supabase/functions/` (JavaScript para Deno): `tally-webhook/index.js`, `associados-diario/index.js` e o módulo comum `_shared/emails.js` (preencher campos, datas, chamar o Resend, registar). Sem SDK do Resend: a chamada é um `fetch`. A única biblioteca é a `@supabase/supabase-js`, a mesma da aplicação. `supabase/config.toml` só diz às funções onde está o ficheiro de entrada e que não verificam JWT.
- A função diária só trabalha quando são 9 horas em Bruxelas (o `pg_cron` chama-a às 07:00 e às 08:00 UTC; uma das duas cai sempre nas 9 horas, de Verão ou de Inverno); `{"forcar": true}` no corpo faz correr a qualquer hora, para testes. Devolve um resumo do que enviou, do que falhou e porquê.
- Ecrãs: separador Associados em `/admin` (`?s=associados`), com `React.lazy`, como o Rede (§16.15).

### 16.14 Melhorias futuras
- **Envio imediato dos emails 9 e 10** (registado a 5 de Novembro de 2026): o botão "Admitir" chama uma Edge Function com a sessão do utilizador (JWT verificado, conta com linha em `perfis`), que envia logo o email 9 ou 10 desse associado pelo mesmo módulo comum e o regista em `emails_enviados`. Até lá, saem na passagem seguinte da função diária (§16.8). A reserva em `emails_enviados` garante que a função diária não o repete.

### 16.15 Ecrãs do separador Associados (passo 2, 5 de Novembro de 2026)

**Organização**, como o Rede: código em `src/associados/`, com um `api.js` (o único ficheiro que fala com a Supabase), CSS próprio (`Associados.css`) e `React.lazy` a partir de `Admin.jsx`. O preenchimento dos campos é o mesmo ficheiro que as Edge Functions usam, `supabase/functions/_shared/campos.js`, sem importações: a pré-visualização mostra exactamente o que o Resend envia.

**Navegação** por parâmetros no endereço:
```
?s=associados                    pedidos (vista por omissão); &st=<estado> filtra
?s=associados&p=novo             criar pedido à mão
?s=associados&p=<id>             ficha do pedido
?s=associados&v=associados       associados
?s=associados&a=<id>             ficha do associado
?s=associados&v=emails           emails-tipo
?s=associados&e=<chave>          editar um email-tipo, com pré-visualização
?s=associados&v=config           configuração
?s=associados&v=enviados         últimos 100 envios
```

**Pedidos**
- Lista por estado, com a contagem de cada um; por omissão, os pedidos em aberto (`recebido`, `instrucoes_enviadas`, `pago`). O mais recente primeiro.
- Ficha: os dados do pedido, o contacto do Rede ligado (com ligação para a ficha), o associado (depois de admitido), os emails enviados e os gestos, cada um só no estado em que faz sentido:
  - **Pagamento confirmado** (`recebido`, `instrucoes_enviadas`): data do pagamento, hoje por omissão, nunca no futuro. Passa a `pago` e grava `pagamento_confirmado_por` com a conta autenticada.
  - **Admitir** (`pago`): tipo (`efectivo` por omissão ou `aderente`); mostra antes se fica fundador e que quota fica paga. Chama `admitir_pedido` (migração 011, corrigida pela 012: ao ligar um contacto existente, a 011 falhava com 22P02 por juntar o texto 'associado' a `etiquetas` como se fosse um array), que faz tudo numa só operação: liga ou cria o contacto, cria o associado com o número seguinte, decide o fundador pela data do pagamento, cria a quota paga com o valor da configuração e passa o pedido a `admitido`. O email 9 ou 10 não se grava aqui: a ficha diz que sai na passagem seguinte da função diária, às 9h (§16.14 regista o envio imediato como melhoria futura).
  - **Saídas** (`recebido`, `instrucoes_enviadas`, `pago`): Desistiu, Não admitido, Cancelado, com nota obrigatória. A nota entra em `notas` com a data e o nome de quem a escreveu.
- **Criar pedido à mão** é uma excepção: os pedidos de Maio não se criam à mão; recebem o email 1 e entram pelo Tally. Campos: os do formulário e a data do pedido (hoje por omissão). O `tally_id` fica `manual-<identificador>`. O contacto liga-se ou cria-se como no webhook. A caixa **"Já recebeu os dados de pagamento"** regista o email 4 como enviado à mão (estado `enviado`, resposta "Registado à mão no admin") e passa o pedido a `instrucoes_enviadas`; sem a caixa, o email 4 sai na passagem seguinte da função diária. Um email com um pedido em aberto não deixa criar outro.

**Associados**
- Lista: número, nome, tipo, fundador, estado e a quota do ano. "Ano da quota" é 2027 até ao fim de 2027 (o primeiro exercício) e o ano corrente a partir de 2028.
- Ficha: dados, contacto e pedido ligados, quotas e emails enviados. **Registar recibo** numa quota paga: número e data (hoje por omissão). Marcar como pagas as quotas abertas a partir de 2028 fica para quando houver quotas por pagar.

**Emails-tipo**
- Lista dos 19, com o envio (automático ou manual) e o "quando".
- Edição do assunto e do corpo, com a lista dos campos disponíveis e o que cada um contém. Gravar actualiza `updated_at`.
- **Pré-visualização** preenchida com dados reais. O registo escolhe-se numa lista sempre à vista, nunca escrevendo o nome; com mais de 15 registos, há uma pesquisa por cima (sem distinguir maiúsculas nem acentos). A lista depende do email: para o 1 (e o 2 e o 3), os contactos do Rede com a etiqueta `associado` e sem pedido de adesão, por nome; para os do pedido (3-A a 8), os pedidos, com nome e estado, por nome; para os do associado (9 a 18), os associados, com número e nome, por número (com a quota mais recente para `{ano}`, `{valor_quota}` e `{numero_recibo}`). Os campos que vêm do registo ou da configuração mostram-se só para leitura; os que não têm valor (`{data_limite}`, `{link_sugestoes}`, …) aparecem numa caixa para preencher, marcados. A pré-visualização usa o texto que está a ser editado, mesmo antes de gravar.
- **Copiar assunto** e **Copiar texto preenchido** nos manuais (1, 11, 14, 15, 18), só com todos os campos preenchidos. Copiar não regista envio.

**Configuração**: as chaves, com a descrição; cada valor grava-se à parte. "Acrescentar chave" para os anos seguintes (`valor_quota_2028`, …).

**Emails enviados**: os últimos 100, o mais recente primeiro: data, email-tipo, destinatário, estado e, quando falhou, a resposta (campos em falta ou erro do Resend), com ligação para o pedido ou o associado. Uma linha `a_enviar` com mais de 10 minutos pode ser marcada como falhada ("Libertar"), para a função diária tentar de novo (§16.9).

**Regras**: o módulo escreve só nas tabelas da migração 008, em `contactos` (só ligar ou criar o contacto do pedido, como o webhook) e chama `admitir_pedido`; lê `perfis` e `people` (o `person_id` do contacto novo). Datas por extenso com `formatDate`. Sem dependências novas.

## 17. Apresentação do admin (acrescentado a 5 de Novembro de 2026)

### 17.1 Desvio de âmbito, registado
A 5 de Novembro o Miguel decidiu dar ao admin uma apresentação nova, a partir de um modelo desenhado num canvas: só CSS e estrutura. Nenhuma função da base, migração nem chamada de escrita à Supabase muda, e a navegação por parâmetros no endereço mantém-se exactamente como está. Trabalho no ramo `mesa`, criado a partir do `rede`, em cinco passos com paragem em cada um: 1) cabeçalho, separadores e barra de números; 2) Rede em mesa de trabalho; 3) Associados; 4) Biblioteca; 5) revisão.

### 17.2 Cabeçalho e separadores
- Cabeçalho branco fino: o nome "matinés pensantes" em Montserrat 300 + 600, como no logótipo; os separadores **RCP · Rede · Associados · Biblioteca** em Rajdhani 700, maiúsculas com espaçamento de 0,14em, o activo com fundo azul-marinho e texto branco; à direita, o nome de quem está com sessão (de `perfis`; sem perfil, o email da sessão) e "Sair".
- **A Biblioteca passa a separador próprio** (`?s=biblioteca`) e sai do fim do separador RCP. Os endereços da Biblioteca não mudam: `?b=novo`, `?b=<id>` e `?b=<id>&m=editar` abrem o separador Biblioteca. O separador RCP fica só com o painel, que mantém o conteúdo e a leitura a cada 15 s.
- No telemóvel, o nome e "Sair" ficam numa linha e os separadores na seguinte, numa só linha; alvos de toque de 44 px.

### 17.3 Barra de números
Quatro cartões brancos sobre fundo cinzento claro (#EDEDED): número em Rajdhani 700 a 40 px, rótulo em Montserrat 12 px. O quarto cartão é turquesa (#3EBDC6, texto azul-marinho) quando o seu número pede acção e é maior do que zero; branco quando é zero. No telemóvel, duas colunas.

| Separador | 1 | 2 | 3 | 4 |
|---|---|---|---|---|
| RCP | Presenças (edição aberta) | Inscritos | Ausentes | Contagem de sala ("—" enquanto não for registada) |
| Rede | Contactos | Por rever | Interessados | **Acções em atraso** (pede acção) |
| Associados | Pedidos em aberto | Pagos por admitir | Associados (activos) | **Emails que não saíram** (pede acção) |
| Biblioteca | Na mesa | Levados | Desaparecidos | Entradas nesta edição |

- Os números contam as listas que cada módulo já lê (um `numeros.js` por módulo, com as funções do seu `api.js`). Duas leituras novas, só de leitura, em objectos que já existem: o nome em `perfis` e "Entradas nesta edição" na vista `biblioteca_resumo` (linha da edição aberta). No RCP, a barra lê a edição aberta e `edition_summary`, como o painel, e actualiza-se a cada 15 s enquanto o separador está aberto.
- "Ausentes" são os inscritos sem presença (`registered_absent`). "Lotação" não existe na base: o quarto número do RCP é a contagem de sala (`room_count`).
- "Emails que não saíram": entre os últimos 100 envios (a leitura da vista "Emails enviados"), os `falhou` ou `a_enviar` sem envio `enviado` posterior do mesmo email-tipo, ao mesmo pedido ou associado, no mesmo período. Um falhado já recuperado não conta.
- A barra lê de novo ao mudar de separador e ao abrir ou fechar um item (`c`, `p`, `a`, `b`, `m` e, nos Associados, `e`); pesquisas e filtros não a fazem ler.

### 17.4 Mesa de trabalho (passos 2 a 4)
- Lista e ficha lado a lado: coluna da esquerda com 340 a 380 px, fundo branco, cantos de 10 px, com título, pesquisa, filtros em pílulas (Rajdhani 600 12 px, maiúsculas) e os itens (nome, linha secundária em cinzento #828487, pílula de estado à direita); o item aberto tem fundo #EDEDED e uma barra carmim de 4 px à esquerda.
- Coluna da direita com a ficha em cartões brancos: sobretítulo em carmim (Rajdhani 600 12 px, espaçado), nome em Rajdhani 700 32 px, dados em grelha de três colunas (rótulo 11 px cinzento em maiúsculas, valor 600), linha de acções com o botão principal carmim (#C01C36, texto branco) e os secundários com contorno turquesa escura (#1F7A82); as saídas (encerrar, apagar) em texto cinzento, alinhadas à direita. Cartões seguintes para histórico, emails, participações, quotas.
- No telemóvel, empilham-se: a lista primeiro; ao abrir um item, a ficha ocupa o ecrã e "Voltar" regressa à lista.
- Aplica-se ao Rede (contactos e ficha; as vistas Por rever, Em atraso e Interessados passam a pílulas da coluna da lista), aos Associados (pedidos e associados; Emails-tipo, Emails enviados e Configuração em largura total) e à Biblioteca (livros e ficha).
- Lado a lado a partir de 64rem (1024 px); abaixo disso empilha-se como no telemóvel. Sem item aberto, a coluna da ficha mostra "Escolhe um contacto na lista.".
- Rede: na vista Contactos, a pesquisa e o estado em pílulas (Todos e os cinco estados); a etiqueta fica numa lista de escolha, por serem oito. As etiquetas passam para a linha secundária do item e para o sobretítulo da ficha. Abrir ou fechar um contacto mantém os parâmetros da lista (`v`, `q`, `e`, `st`), para a lista não mudar ao lado da ficha; a lista lê de novo ao abrir, gravar ou fechar um contacto. As acções da própria linha ficam: "Registar revisão" (Por rever), "Abrir cartão" e "Concluir" (Em atraso), "Criar contacto" (Interessados). "Apagar contacto" passa a saída da linha de acções da ficha, com a mesma confirmação.
- Os formulários abertos na coluna da ficha (contacto, interacção, revisão) mantêm-se; só os botões tomam as cores da mesa.
- Todos os botões do admin têm o mesmo tamanho: 44 px de altura, Montserrat 600 a 14 px. Três estilos: principal (carmim, texto branco), secundário (contorno turquesa escura) e discreto (contorno cinzento claro, texto azul-marinho). O botão de gravar dos formulários só ocupa a largura toda no telemóvel. As ligações em texto (saídas, "Voltar à lista", acções da linha) não são botões e ficam como estão.
- As pílulas de filtro da coluna da lista ficam numa grelha de duas colunas iguais: todas da mesma largura e, no mesmo grupo, da mesma altura (36 px, mais se um rótulo precisar de duas linhas).
- Associados: as cinco vistas ficam numa linha de separadores discretos por cima da mesa (Rajdhani 700 13 px, maiúsculas, cinzento; a escolhida em azul-marinho, sublinhada a carmim), para não se confundirem com as pílulas de filtro. Nos pedidos, as pílulas de estado mostram "Em aberto", "Todos" e só os estados com pedidos (ou o escolhido); "Criar pedido à mão" é um botão discreto (contorno cinzento claro, texto azul-marinho) ao lado do título, por ser excepção. A ficha do pedido fica ao lado da lista dos pedidos (com o mesmo filtro `st`); a do associado ao lado da lista dos associados, que deixa de ser tabela (n.º e nome; tipo, fundador e quota do ano na linha secundária). Abrir um associado leva `v=associados`; abrir um pedido tira o `v`. "Encerrar o pedido" passa a saída da ficha: abre o formulário de saída (com nota e confirmação, como antes) e "Cancelar" fecha-o. "Pagamento confirmado" e "Admitir" ficam na ficha como estão. A origem do pedido (Tally ou criado à mão) passa ao sobretítulo. Os Emails-tipo usam os itens da mesa, em largura total.

### 17.5 Pílulas de estado
Um só mapa de estado para cor, para os três módulos:
- fundo #EDEDED: Recebido, A avaliar;
- fundo turquesa #3EBDC6: Instruções enviadas, Prospecto;
- fundo amarelo #EAB81C: Pago, Em espera;
- fundo turquesa escura #1F7A82 com texto branco: Admitido, Activa, Na mesa;
- texto carmim sobre branco, com contorno: Cancelado, Encerrada, Desaparecido.

Texto sobre turquesa e amarelo sempre azul-marinho.

Estados que o mapa acima não nomeia: Desistiu, Não admitido e Saído como Cancelado; Suspenso como Em espera; nos envios, Enviado como Admitido, A enviar como Pago e Falhou como Cancelado. Sem estado (Manual, Automático), fundo #EDEDED.

### 17.6 Regras de construção
- **O ficheiro público só pode diminuir.** O admin inteiro carrega com `React.lazy` a partir de `App.jsx`: o painel, o login, o `Admin.css` e os módulos saem do ficheiro da página pública.
- Ficheiros: `src/admin/mesa.css` (CSS partilhado da apresentação); `src/admin/mesa/` com os componentes comuns, só de apresentação: `Cabecalho.jsx`, `BarraNumeros.jsx`, `Mesa.jsx`, `ListaMesa.jsx`, `FichaCartao.jsx`, `Dados.jsx`, `Accoes.jsx`, `Pilula.jsx`. O `Admin.css` fica com o que é do painel do RCP; os CSS dos módulos perdem o que passa para o partilhado.
- Tipografia e cores só as do manual: Rajdhani e Montserrat (já carregadas do Google Fonts), azul-marinho para todo o texto corrido, cinzento #828487 só em notas e rótulos, turquesa escura nas ligações. Sem sombras, gradientes nem ícones novos. Sem dependências novas.
