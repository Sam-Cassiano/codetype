# CodeType

Treinador de digitação que usa o ato de **digitar código real** como método de aprendizado de
programação. Progressão em mapa (estilo Typing.com), precisão alta obrigatória para avançar,
gamificação e análise de erros.

O módulo de linguagem já pronto é **Kotlin voltado ao desenvolvimento Android**. Os demais
módulos (Python, JavaScript, Go, SQL, o que você quiser) são gerados sob demanda pelos modelos
que já rodam na sua máquina via **Ollama** — sem nuvem, sem chave de API.

---

## Como rodar

**Executável** (`dist/CodeType.exe`): duplo clique. Ele sobe o servidor e abre o navegador
sozinho; feche a janela do console para encerrar. Não precisa de Node instalado.

**A partir do código**:

```bash
node server.js
```

Abra <http://localhost:5173>. Não há dependências de runtime: só Node 18+.
Se a porta estiver ocupada, o servidor tenta a seguinte automaticamente (até 10 vezes);
`PORT=8080 node server.js` força uma porta específica.

Para o gerador de módulos funcionar, o Ollama precisa estar ativo:

```bash
ollama list
```

O servidor faz proxy de `/api/ollama/*` para `http://127.0.0.1:11434` (configurável em
`OLLAMA_HOST`). Isso evita CORS e mantém o streaming token a token.

---

## O módulo Kotlin/Android

56 lições em 11 unidades, da tecla `{` até uma tela completa em Jetpack Compose:

| # | Unidade | Conteúdo |
|---|---------|----------|
| 1 | Símbolos e sintaxe base | chaves, `:` de tipo, `$`/`${}`, `->`, `?.` `?:` `!!` |
| 2 | Variáveis e tipos | `val`/`var`, conversões, `const`, `lateinit`, smart cast |
| 3 | Operadores e fluxo | `if` como expressão, `when`, ranges, `in` |
| 4 | Loops e coleções | `for`/`while`, `repeat`, `listOf`, `map`/`filter`, mapas |
| 5 | Funções | default args, expressão única, **extension functions**, alta ordem |
| 6 | Classes e OOP | construtor primário, `data class`, herança, `object`, `sealed`/`enum` |
| 7 | Null safety e erros | cadeia segura, `let`/`apply`/`also`, `try`, `Result`, exceções próprias |
| 8 | Android essencial | `Activity`/`onCreate`, ViewBinding, `Intent`, ciclo de vida, RecyclerView Adapter, XML |
| 9 | Coroutines e arquitetura | `suspend`, ViewModel + `StateFlow`, Retrofit, Room, Repository + Hilt |
| 10 | Jetpack Compose | `@Composable`, `Column`/`Modifier`, `remember`, `LazyColumn`, tela completa |
| 11 | Desafios práticos | enunciado + solução, com a solução coberta até você pedir |

Cada lição declara sua própria meta de precisão (92% a 97%) e só libera a seguinte quando
essa meta é batida.

---

## Como o treino funciona

- **Comparação caractere a caractere**, incluindo espaços, símbolos e quebras de linha.
- **A indentação do início da linha é preenchida sozinha** ao pressionar Enter, como em um
  editor de verdade. Ela não conta nas métricas — você treina o código, não a barra de espaço.
- **Três modos de correção**, escolhidos na própria tela da lição:
  - `estrito` (padrão): trava no caractere errado até você acertar; o acerto fica marcado
    como *corrigido* (sublinhado âmbar);
  - `livre`: marca o erro em vermelho e segue;
  - `rigoroso`: qualquer erro reinicia o trecho do zero.
- **Métricas**: precisão (acertos ÷ total de teclas), WPM em código (5 caracteres = 1 palavra),
  contagem de erros e progresso.
- **Realce de sintaxe** próprio: o texto ainda não digitado fica esmaecido e ganha cor conforme
  você acerta.

Atalhos: `Esc` reinicia o trecho · `Enter` na tela de resultado vai para a próxima lição.

---

## No celular

O treino funciona em telas pequenas e com teclado virtual — inclusive na versão publicada na
Vercel, aberta pelo navegador do telefone.

- **Entrada por `beforeinput`**: o teclado do Android manda `keydown` com `key: "Unidentified"`
  (keyCode 229) em vez do caractere, então digitar via `keydown` simplesmente não funciona no
  celular. O motor escuta `beforeinput` num campo invisível e trata `insertText`,
  `insertLineBreak` e `deleteContentBackward`. No desktop o `keydown` continua sendo o caminho,
  com uma janela de 60 ms que impede o mesmo caractere de contar duas vezes.
- **Sem erros falsos por causa do teclado preditivo**: teclados como Gboard e Samsung Keyboard
  tratam digitação comum como uma "composição" do IME (para sugestão/autocorreção), mesmo com
  autocorreção desligada — e mandam o texto **acumulado** da composição a cada tecla, não só o
  caractere novo. O motor compara com o que já foi consumido e digita apenas a diferença (e desfaz
  e redigita quando o teclado reescreve um trecho já composto, como numa autocorreção). Sem isso,
  cada tecla reprocessava a palavra inteira digitada até ali, contando erros que não existiram.
- **Barra de símbolos**: acima do teclado aparecem os caracteres não alfanuméricos **da própria
  lição**, ordenados por frequência — justamente os que o teclado virtual esconde numa segunda
  camada. Os toques usam `pointerdown` com `preventDefault` para o campo não perder o foco (senão
  o teclado fecharia a cada símbolo). Tem também `⏎` e `⌫`.
- **Teclado aberto**: o teclado virtual não redimensiona a janela, encolhe a `visualViewport`. O
  app detecta isso, recolhe cabeçalho e explicação, limita a altura do editor ao espaço que sobra
  e mantém o cursor no centro.
- Layout responsivo: navegação rolável, uma coluna nos mapas e painéis, alvos de toque de 42 px.

## Configurações (`#/config`)

Tudo vale na hora, sem recarregar, e fica salvo no navegador.

| Ajuste | O que faz |
|--------|-----------|
| **Liberar todas as lições** | Ignora o desbloqueio encadeado e abre o módulo inteiro — para treinar um assunto específico sem refazer o caminho |
| **Meta de precisão** | Sobrescreve a meta de todas as lições de uma vez: 85% (treino solto) até 100% (zero erro), ou "meta de cada lição" para voltar ao padrão |
| **Modo de correção** | estrito / livre / rigoroso — o mesmo seletor da tela da lição |
| **Indentação automática** | Desligue para digitar cada espaço do início da linha na mão |
| **Som no erro** | Bip curto a cada tecla errada |
| **Explicação aberta** | Se o bloco "Entenda antes de digitar" já vem aberto |
| **Tamanho do código** | Fonte do editor, 12 a 24 px, com amostra ao vivo |

A meta escolhida vale em tudo: nos cartões do mapa, na barra da lição, na aprovação e nas
estrelas. Colocar 100% faz uma corrida com um único erro reprovar.

**Backup do progresso**: exporta o progresso inteiro (XP, lições, estatísticas, badges e ajustes)
num `.json` e importa de volta — útil porque o progresso vive no `localStorage`, que some se você
limpar o navegador. Arquivo que não for um backup do CodeType é recusado sem tocar no que já
existe. (Isso é o progresso; para levar um **módulo gerado** para outro aparelho, veja
"Levando um módulo gerado para o celular e para o deploy", mais abaixo.)

---

## Progressão e diagnóstico

- **XP e níveis**: cada nível exige 15% mais XP que o anterior. Bônus por 100% de precisão e
  por velocidade; repetir lição já aprovada rende 25%.
- **Badges**: Primeiro passo, Zero erro, Velocista, streaks de 3 e 7 dias, Mestre dos símbolos,
  Android Dev, Módulo concluído.
- **Streak diário**, contado por dia de calendário.
- **Estatísticas** (`#/stats`): gráfico de evolução de WPM e precisão, heatmap de erros por
  caractere, conceitos mais errados e mural de conquistas.
- **Modo revisão** (`#/revisao`): lista as lições com pior precisão e mostra quais símbolos e
  conceitos mais te derrubam — e gera lições de reforço em cima exatamente desses pontos.

Tudo fica no `localStorage` do navegador. Os módulos gerados também vão para
`data/modules.json`, então sobrevivem à limpeza do navegador.

---

## Gerador de conteúdo (Ollama)

A tela `#/lab` tem duas abas.

### Módulo novo

Você escolhe modelo, linguagem, foco, nível e o tamanho do módulo — **sem limite** de unidades,
lições por unidade ou unidades em paralelo: os campos aceitam qualquer valor, quem decide o
tamanho é você, não uma trava arbitrária no código.

A geração segue um esqueleto fixo de progressão para as primeiras unidades (símbolos → tipos →
fluxo → loops → funções → estruturas de dados → organização → erros → código real), seguido por
um segundo bloco de temas mais avançados (padrões de projeto, testes automatizados, concorrência,
tratamento avançado de erros, bibliotecas comuns, performance, arquitetura, refatoração,
ferramentas, segurança). Se você pedir mais unidades do que a soma desses dois blocos, o gerador
volta a ciclar pelos temas avançados marcando "aprofundamento" — a variedade real vem do
dedup por código e da instrução anti-repetição do modelo, não de um catálogo infinito de temas.

**Cada unidade, por sua vez, é pedida em blocos de até 6 lições por requisição** (em vez de uma
única requisição gigante), independente de quantas lições você pediu no total: uma unidade de 20
lições vira ~4 requisições menores em sequência, cada uma sabendo quais lições já foram geradas
para não repetir. Isso é o que permite remover o limite de lições sem sobrecarregar o Ollama com
uma resposta enorme de uma vez — o tamanho de cada bloco é fixo, só a quantidade de blocos cresce.
Pelo mesmo motivo o `num_predict` (tamanho máximo da resposta) não tem mais teto artificial: quem
protege contra uma geração travada é o watchdog de inatividade (cliente e servidor), não um corte
de tokens.

Isso tudo permite:

- ver o currículo crescendo unidade a unidade (e lição a lição, dentro da unidade) em vez de
  esperar uma resposta gigante;
- cancelar no meio sem perder o que já ficou pronto;
- descartar uma unidade malformada sem derrubar o módulo inteiro;
- pedir módulos grandes sem que uma única requisição fique grande demais para o hardware.

**Unidades em paralelo** só acelera de verdade se o Ollama aceitar mais de uma requisição por vez
(`OLLAMA_NUM_PARALLEL`) ou você tiver GPU sobrando — em CPU com um único modelo carregado, as
requisições costumam enfileirar do mesmo jeito do lado do Ollama, então o padrão continua sendo 1
(sequencial, como sempre foi). Como o campo não tem mais teto, é você quem decide até onde vale a
pena subir esse número para a sua máquina.

A saída é forçada por **JSON Schema** (`format` do Ollama), e o `think` é desligado para modelos
que suportam raciocínio, com retry automático caso o modelo não aceite o parâmetro.

**Robustez**: uma unidade que falhar (JSON malformado, erro do modelo) ganha uma segunda
tentativa automática antes de ser descartada — a tela mostra "tentando de novo" em vez de
descartar na primeira falha. Se o Ollama parar de responder no meio de uma unidade (trava,
processo caído), tanto o navegador quanto o servidor desistem sozinhos depois de alguns minutos
sem nenhum dado novo, em vez de ficar girando para sempre, com uma mensagem de erro clara. O
modelo também recebe instrução para variar nomes e cenários entre lições, e uma lição cujo
código sair praticamente idêntico ao de outra já aceita no mesmo módulo (ou já existente, ao
acrescentar uma unidade) é descartada automaticamente.

### Acrescentar unidade a um módulo existente

Também dá para anexar uma unidade ao fim de um módulo que já existe — **inclusive ao Kotlin
embutido**. Botão "Acrescentar unidade com IA" na página do módulo, ou a segunda aba de `#/lab`.
Você informa o tema (ex.: *Testes com JUnit*), opcionalmente o que ela deve cobrir, o nível e
quantas lições.

O modelo recebe a lista de temas já cobertos pelo módulo e é instruído a não repetir. Antes de
adicionar, a unidade aparece em preview com as lições geradas — dá para descartar.

Essas unidades ficam guardadas **à parte**, como *extensões* (`data/extensions.json` +
`localStorage`), e são mescladas ao módulo no carregamento. Isso é o que permite estender um
módulo que é código-fonte — e que dentro do `.exe` é somente leitura. Elas aparecem no mapa com
o selo "acrescentada" e podem ser removidas ali mesmo.

Ids são carimbados com o id do módulo mais um timestamp
(`kotlin-android-ext-mso1x2y3-1`), então nunca colidem com os das unidades originais nem com os
de uma geração posterior — e o progresso salvo continua válido.

> Como o desbloqueio é encadeado, uma unidade acrescentada no fim exige a última lição da
> unidade anterior. Lições já concluídas continuam abertas de qualquer forma.

### Levando um módulo gerado para o celular e para o deploy

Um módulo gerado nasce só no `localStorage` de quem gerou.

**Toda vez que você gera um módulo novo, publica um módulo ou acrescenta uma unidade, o CodeType
já salva sozinho uma cópia em `Cursos Gerados/<id>.json`, na raiz do projeto** — sem precisar
clicar em nada. É um backup legível e versionado no git, independente do `localStorage` e de o
módulo estar publicado ou não; sobrevive até se você excluir o módulo do app. Isso só funciona
rodando pelo código-fonte (`node server.js`), porque grava dentro da pasta do projeto — no
executável essa pasta está embutida e é somente leitura, e nesse caso o salvamento simplesmente
não acontece, sem avisar nada (não é um erro, é o modo de uso esperado do `.exe`). O app não
carrega módulos de lá de volta: é puramente uma trilha do que foi gerado.

Além disso, na página do módulo:

| Botão | O que faz | Serve para |
|-------|-----------|-----------|
| **Publicar no app** | grava o módulo em `public/curriculum/gerados.json` | commitar e o módulo passa a viajar no deploy — aparece na Vercel e no celular de qualquer pessoa, sem API e sem `localStorage` |
| **Exportar .json** | baixa o módulo como arquivo | guardar fora do projeto ou mandar manualmente para outro aparelho |

Módulos publicados aparecem com o selo **publicado no app** e são carregados de um arquivo
estático, então vencem a cópia local em caso de conflito de id.

### Enviando ao GitHub sem sair do app

Depois de publicar, aparece um painel na home (e na página do módulo) com o que está pendente:

> **Pronto para subir** — módulo publicado ainda não commitado · em `main` → Sam-Cassiano/codetype
> **[ Enviar ao GitHub ]**

O botão roda `git add` → `git commit` → `git push` e mostra o resultado de cada passo. Depois é
só esperar o deploy automático da Vercel.

Detalhes que importam:

- o `git add` é **restrito a `public/curriculum/gerados.json` e à pasta `Cursos Gerados/`**.
  Nunca é `git add -A`, então trabalho em andamento em outros arquivos não é arrastado para o
  commit sem querer;
- a mensagem sai como `modulos gerados: <nomes dos módulos publicados>`;
- o git roda com `GIT_TERMINAL_PROMPT=0`. Se faltar credencial, o push **falha na hora** com a
  mensagem em vez de travar o servidor esperando uma senha que ninguém vai digitar. O commit já
  feito continua lá, o painel passa a mostrar "1 commit sem enviar" e o botão vira um retry;
- se o push falhar por credencial, rode `git push` uma vez no terminal para o Windows guardar o
  token — depois disso o botão funciona sozinho;
- o painel só existe rodando local: no executável e na versão publicada as rotas `/api/git/*`
  não respondem e ele simplesmente não aparece.

### Escrevendo uma unidade à mão

Se preferir escrever em vez de gerar, adicione o objeto direto no array `units` de
`public/curriculum/kotlin-android.js` (formato no fim deste arquivo) e recarregue a página —
não há build. Nesse caso, `npm run build:exe` de novo se você usa o executável.

### Modelo recomendado: Qwen2.5-Coder

A tela `#/lab` reconhece automaticamente qualquer modelo instalado cujo nome contenha
`qwen2.5-coder` ou `qwen3-coder`, marca ele como **"recomendado p/ código"** na lista e o
pré-seleciona (se você ainda não tiver escolhido um modelo manualmente). Se nenhum estiver
instalado, a tela mostra uma dica com o comando de instalação.

O Qwen2.5-Coder é especializado em geração de código (treinado especificamente para isso, ao
contrário de modelos generalistas como o Gemma) e tem boa relação qualidade/velocidade em CPU.
Para instalar:

```bash
ollama pull qwen2.5-coder:7b    # maquinas mais simples / so CPU
ollama pull qwen2.5-coder:14b   # se sua maquina ja aguenta modelos de ~12b-14b
```

Use o `:14b` se a sua máquina já roda bem modelos na faixa de 12b (como o `gemma4:12b` testado
abaixo); caso contrário, o `:7b` é bem mais rápido em CPU sem perder muito em qualidade de código.
Existe também o Qwen3-Coder mais recente, mas as variantes disponíveis hoje pedem bem mais VRAM
(ou são otimizadas para Apple Silicon), então para uma máquina comum com Ollama em CPU o
Qwen2.5-Coder continua sendo a escolha mais prática.

Modelos testados nesta máquina:

| Modelo | Observação |
|--------|------------|
| `gemma4:12b` | testado de ponta a ponta; ~2 a 4 min por unidade em CPU |
| `hf.co/empero-ai/Qwythos-9B-Claude-Mythos-5-1M-GGUF:Q8_0` | disponível na lista; contexto de 1M |

> Em CPU a geração é lenta por natureza. Comece com 2–3 unidades × 3 lições para sentir o ritmo
> da sua máquina, mesmo sem limite artificial — nada te impede de pedir mais depois.

---

## Gerando o executável

```bash
npm run build:exe
```

Sai em `dist/CodeType.exe` (~68 MB). O build usa o **Single Executable Application** nativo do
Node 20 — ou seja, o `node.exe` que já está na sua máquina, sem baixar binário nenhum:

1. `tools/build-exe.js` embute todo o `public/` em base64 dentro de `build/codetype.cjs`,
   junto com o código de `server.js`;
2. `node --experimental-sea-config` transforma isso num blob;
3. o `node.exe` local é copiado para `dist/` e o blob é injetado com `postject`
   (baixado na hora pelo `npx`, é a única dependência — e só do build).

O `server.js` é o mesmo arquivo nos dois modos: quando `globalThis.__CODETYPE_FILES__` existe,
ele serve da memória em vez do disco.

Detalhes do executável:

- os módulos gerados vão para `data/modules.json` **ao lado do .exe** (o bundle é somente leitura),
  então dá para carregar o app inteiro num pendrive;
- o progresso continua no `localStorage` do navegador;
- o `postject` avisa `The signature seems corrupted!` — é esperado: injetar o blob invalida a
  assinatura Authenticode do `node.exe`. O executável roda normalmente, mas o SmartScreen pode
  pedir "Mais informações → Executar assim mesmo" na primeira vez, por ser um binário sem assinatura;
- para rodar em outra máquina Windows x64 basta copiar o `.exe`. Para Linux/macOS, rode
  `npm run build:exe` na própria plataforma (o build usa o Node local, não faz cross-compile).

## Publicando (GitHub + Vercel)

### GitHub

```bash
git init -b main
git add .
git commit -m "CodeType: treinador de digitacao com modulo Kotlin/Android"
git remote add origin https://github.com/SEU-USUARIO/codetype.git
git push -u origin main
```

O `.gitignore` já deixa de fora `node_modules/`, `build/`, `dist/` e `data/`. O `.exe` de 68 MB
**não deve ir para o repositório** — publique-o como binário de uma *Release* do GitHub, que é o
lugar certo para isso (e o limite de arquivo do Git é 100 MB).

### Vercel

O `vercel.json` já está pronto: publica `public/` como site estático, sem build.
Em vercel.com → *Add New Project* → importe o repositório → *Deploy*. Não há variável de
ambiente nem comando de build para configurar.

**O que funciona publicado:** o treino inteiro — as 56 lições de Kotlin/Android, digitação,
precisão, WPM, XP, badges, streak, estatísticas, revisão e configurações. Tudo é client-side, e o
progresso fica no `localStorage` de cada visitante.

Módulos gerados por IA **também aparecem publicados**, desde que você use o botão *Publicar no
app* antes de commitar (veja a seção do gerador) — eles viram um arquivo estático dentro de
`public/curriculum/`.

**O que não funciona:** o gerador com IA e a persistência em `data/`. As rotas `/api/*` são do
servidor Node, que não sobe na Vercel; e mesmo que subisse, uma função serverless não alcança o
Ollama que roda na *sua* máquina. A tela do gerador detecta isso e explica em vez de dar erro
genérico. Módulos gerados localmente continuam salvos no `localStorage` de quem os gerou.

Ou seja: **Vercel para compartilhar o treino, local (ou `.exe`) para gerar conteúdo.**

Se quiser que os módulos gerados apareçam também na versão publicada, gere-os localmente e
copie o conteúdo de `data/modules.json` para dentro de `public/curriculum/` como um módulo
escrito à mão — aí ele vai junto no deploy.

## Estrutura

```
server.js                     servidor estático + proxy do Ollama + persistência de módulos
tools/build-exe.js            empacota tudo em dist/CodeType.exe (Node SEA)
public/
  index.html
  styles.css
  js/
    app.js                    roteador por hash e todas as telas
    typing.js                 motor de digitação (comparação, modos, métricas)
    highlight.js              realce de sintaxe por caractere (kotlin, java, js, python, sql, xml)
    store.js                  progresso, XP, badges, streak, estatísticas
    ollama.js                 cliente do Ollama (streaming + JSON Schema)
  curriculum/
    index.js                  registro e carregamento dos módulos
    kotlin-android.js         o módulo Kotlin/Android
data/modules.json             módulos gerados (criado no primeiro salvamento)
Cursos Gerados/                backup versionado de módulos gerados (salvo automaticamente)
```

## Adicionando um módulo à mão

Copie o formato de `public/curriculum/kotlin-android.js`, importe em
`public/curriculum/index.js` e adicione a `modulosBase`. Campos de uma lição:

```js
{
  id: 'py-1-1',              // estável: é a chave do progresso salvo
  title: 'Variáveis',
  kind: 'code',              // 'drill' | 'code' | 'challenge'
  tags: ['variavel'],        // alimenta a análise de erros e o modo revisão
  minAcc: 0.96,              // meta de precisão
  xp: 20,
  brief: 'uma linha acima do trecho',
  explain: 'explicação do modo "Entenda + Digite"',
  prompt: 'enunciado (só em challenge)',
  lang: 'xml',               // opcional: sobrescreve a linguagem do módulo
  code: `...`                // 4 espaços de indentação, sem tabs
}
```
