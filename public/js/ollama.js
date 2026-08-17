/*
 * Cliente do Ollama local (via proxy do servidor, em /api/ollama).
 * Usado para gerar novos modulos de linguagem e licoes de reforco.
 */

const SCHEMA_LICAO = {
  type: 'object',
  properties: {
    title: { type: 'string' },
    brief: { type: 'string' },
    explain: { type: 'string' },
    tags: { type: 'array', items: { type: 'string' } },
    code: { type: 'string' }
  },
  required: ['title', 'brief', 'explain', 'code']
};

// Uma unidade por requisicao: modelos locais em CPU sao lentos, e assim o
// usuario ve o curriculo crescendo em vez de esperar uma resposta gigante.
const SCHEMA_UNIDADE = {
  type: 'object',
  properties: {
    subtitle: { type: 'string' },
    lessons: { type: 'array', items: SCHEMA_LICAO }
  },
  required: ['subtitle', 'lessons']
};

// Esqueleto de progressao: o modelo preenche o conteudo, nao a estrutura.
const TEMAS = [
  { titulo: 'Simbolos e pontuacao da linguagem', detalhe: 'os caracteres, delimitadores e pontuacao que mais aparecem na linguagem, em linhas curtas e repetitivas' },
  { titulo: 'Variaveis e tipos', detalhe: 'declaracao de variaveis, tipos primitivos, conversao e interpolacao de texto' },
  { titulo: 'Operadores e controle de fluxo', detalhe: 'operadores aritmeticos e logicos, condicionais e a estrutura de selecao multipla da linguagem' },
  { titulo: 'Loops e repeticao', detalhe: 'os lacos da linguagem, incluindo iteracao sobre colecoes e controle de repeticao' },
  { titulo: 'Funcoes', detalhe: 'definicao, parametros, retorno, valores padrao e funcoes anonimas' },
  { titulo: 'Estruturas de dados', detalhe: 'listas, dicionarios/mapas, conjuntos e as operacoes mais usadas sobre eles' },
  { titulo: 'Organizacao de codigo', detalhe: 'classes, modulos, importacoes e o estilo idiomatico de estruturar arquivos' },
  { titulo: 'Erros e validacao', detalhe: 'tratamento de excecoes, validacao de entrada e mensagens de erro' },
  { titulo: 'Codigo do dia a dia', detalhe: 'trechos reais e completos, do tipo que se escreve em um projeto de verdade' }
];

// Continuacao do esqueleto para modulos com mais unidades do que os temas
// basicos acima — assuntos mais avancados/praticos, ainda em progressao.
const TEMAS_AVANCADOS = [
  { titulo: 'Padroes de projeto e boas praticas', detalhe: 'padroes de projeto comuns na linguagem e convencoes idiomaticas de codigo limpo' },
  { titulo: 'Testes automatizados', detalhe: 'testes unitarios, mocks/stubs quando aplicavel, e a ferramenta de teste mais usada na linguagem' },
  { titulo: 'Concorrencia e assincronismo', detalhe: 'threads, processos, async/await ou o modelo de concorrencia idiomatico da linguagem' },
  { titulo: 'Tratamento avancado de erros', detalhe: 'hierarquias de excecao, retries e mensagens de erro uteis para quem for debugar' },
  { titulo: 'Bibliotecas e integracoes comuns', detalhe: 'uso de bibliotecas populares do ecossistema para tarefas do dia a dia (HTTP, arquivos, datas, etc.)' },
  { titulo: 'Performance e otimizacao', detalhe: 'padroes de codigo mais eficientes e armadilhas comuns de performance' },
  { titulo: 'Arquitetura de projetos maiores', detalhe: 'organizacao de modulos/pacotes, separacao de responsabilidades, injecao de dependencia' },
  { titulo: 'Refatoracao e legibilidade', detalhe: 'transformar codigo repetitivo ou confuso em codigo limpo e idiomatico' },
  { titulo: 'Ferramentas e tooling', detalhe: 'formatadores, linters, gerenciadores de pacote e scripts de build tipicos da linguagem' },
  { titulo: 'Seguranca basica no codigo', detalhe: 'validacao de entrada, segredos e erros comuns de seguranca a evitar' }
];

const POOL_TEMAS = [...TEMAS, ...TEMAS_AVANCADOS];

/**
 * Devolve o tema da unidade de indice `i` (0-based), sem limite de
 * quantidade: depois de esgotar o esqueleto fixo + os temas avancados, volta
 * ao comeco da lista de avancados marcando "aprofundamento" — o modelo ainda
 * varia o conteudo de verdade (nomes, cenarios, dificuldade) porque o prompt
 * de sistema ja pede isso e o dedup por codigo (`codigosVistos`) descarta
 * qualquer licao repetida demais.
 */
function temaDaUnidade(i) {
  if (i < POOL_TEMAS.length) return POOL_TEMAS[i];
  const iAvancado = (i - TEMAS.length) % TEMAS_AVANCADOS.length;
  const rodada = Math.floor((i - TEMAS.length) / TEMAS_AVANCADOS.length) + 1;
  const base = TEMAS_AVANCADOS[iAvancado];
  return { titulo: `${base.titulo} (aprofundamento ${rodada})`, detalhe: base.detalhe };
}

// Sem servidor Node por tras (ex.: publicado na Vercel como site estatico),
// as rotas /api nao existem: o 404 precisa dizer isso, e nao "o Ollama caiu".
const SEM_BACKEND =
  'Esta copia esta publicada na web e nao alcanca o Ollama da sua maquina. ' +
  'Rode o CodeType localmente (node server.js ou o CodeType.exe) para gerar modulos.';

export async function listarModelos() {
  const res = await fetch('/api/ollama/tags');
  if (!res.ok) {
    if (res.status === 404) throw new Error(SEM_BACKEND);
    const erro = await res.json().catch(() => ({}));
    throw new Error(erro.hint || erro.detail || 'Nao foi possivel falar com o Ollama');
  }
  const data = await res.json();
  return (data.models || []).map((m) => ({
    nome: m.name,
    tamanho: m.size,
    familia: (m.details && m.details.family) || '',
    capacidades: m.capabilities || []
  }));
}

/* --------------------------- chamada com streaming ------------------------- */

// tempo maximo sem NENHUM dado novo do Ollama antes de desistir (trava do
// modelo, processo caido no meio, etc). Cada pedaco recebido reinicia a
// contagem, entao geracao lenta em CPU nao aciona isso por si so.
const TEMPO_LIMITE_SEM_RESPOSTA_MS = 150000;

/** Combina varios AbortSignal num so, sem depender de AbortSignal.any. */
function combinarSinais(...sinais) {
  const controle = new AbortController();
  for (const sinal of sinais) {
    if (!sinal) continue;
    if (sinal.aborted) {
      controle.abort(sinal.reason);
      break;
    }
    sinal.addEventListener('abort', () => controle.abort(sinal.reason), { once: true });
  }
  return controle.signal;
}

async function gerar({ modelo, prompt, system, schema, onToken, semThink, signal }) {
  const corpo = {
    model: modelo,
    prompt,
    stream: true,
    // num_predict: -1 = sem limite de tokens (gera ate o modelo parar
    // sozinho ou bater no contexto). Um teto fixo cortava licoes maiores no
    // meio do JSON, forcando retry; a trava real contra travamento e o
    // watchdog de inatividade logo abaixo, que reage a "parou de responder",
    // nao a "esta demorando".
    options: { temperature: 0.3, top_p: 0.9, num_predict: -1 }
  };
  if (system) corpo.system = system;
  if (schema) corpo.format = schema;
  if (semThink) corpo.think = false;

  // trava de seguranca client-side: se o Ollama parar de mandar dados,
  // aborta em vez de prender a geracao do modulo inteiro para sempre. Nao
  // confunde com um cancelamento do usuario (err.name continua 'AbortError'
  // so quando o 'signal' recebido de fora e que foi abortado).
  const watchdog = new AbortController();
  let travou = false;
  let temporizador = setTimeout(() => {
    travou = true;
    watchdog.abort();
  }, TEMPO_LIMITE_SEM_RESPOSTA_MS);
  const reiniciarTemporizador = () => {
    clearTimeout(temporizador);
    temporizador = setTimeout(() => {
      travou = true;
      watchdog.abort();
    }, TEMPO_LIMITE_SEM_RESPOSTA_MS);
  };
  const mensagemTravou = () =>
    'sem resposta do modelo por ' + Math.round(TEMPO_LIMITE_SEM_RESPOSTA_MS / 1000) + 's (travou?) — tente de novo';

  let res;
  try {
    res = await fetch('/api/ollama/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(corpo),
      signal: combinarSinais(signal, watchdog.signal)
    });
  } catch (err) {
    clearTimeout(temporizador);
    if (travou) throw new Error(mensagemTravou());
    throw err;
  }

  if (!res.ok || !res.body) {
    clearTimeout(temporizador);
    if (res.status === 404) throw new Error(SEM_BACKEND);
    const erro = await res.json().catch(() => ({}));
    throw new Error(erro.hint || erro.error || 'falha ao gerar (HTTP ' + res.status + ')');
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let texto = '';
  let erroDoModelo = null;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      reiniciarTemporizador();
      buffer += decoder.decode(value, { stream: true });

      let quebra;
      while ((quebra = buffer.indexOf('\n')) !== -1) {
        const linha = buffer.slice(0, quebra).trim();
        buffer = buffer.slice(quebra + 1);
        if (!linha) continue;
        let obj;
        try {
          obj = JSON.parse(linha);
        } catch {
          continue;
        }
        if (obj.error) erroDoModelo = obj.error;
        if (obj.response) {
          texto += obj.response;
          if (onToken) onToken(texto);
        }
      }
    }
  } catch (err) {
    if (travou) throw new Error(mensagemTravou());
    throw err;
  } finally {
    clearTimeout(temporizador);
  }

  if (erroDoModelo) {
    // alguns modelos nao aceitam o parametro think: tenta de novo sem ele
    if (semThink && /think/i.test(erroDoModelo)) {
      return gerar({ modelo, prompt, system, schema, onToken, semThink: false, signal });
    }
    throw new Error(erroDoModelo);
  }
  return texto;
}

/* ------------------------------- utilitarios ------------------------------ */

function extrairJSON(texto) {
  let limpo = texto.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
  limpo = limpo.replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
  try {
    return JSON.parse(limpo);
  } catch {
    /* tenta recortar o maior objeto */
  }
  const inicio = limpo.indexOf('{');
  const fim = limpo.lastIndexOf('}');
  if (inicio === -1 || fim <= inicio) throw new Error('o modelo nao devolveu JSON valido');
  return JSON.parse(limpo.slice(inicio, fim + 1));
}

function slug(texto) {
  return String(texto)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 40);
}

/** Assinatura de um trecho de codigo, para detectar licoes quase identicas
 * (o modelo as vezes repete a mesma logica so trocando um nome de variavel). */
function assinaturaCodigo(codigo) {
  return String(codigo)
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

const SYSTEM = `Voce é um autor de curriculo para um treinador de digitacao de codigo.
Regras absolutas:
- Todo campo "code" deve conter codigo REAL, compilavel e idiomatico da linguagem pedida.
- Use indentacao de 4 espacos, nunca tabs, e no maximo 16 linhas por trecho.
- Nunca escreva comentarios explicativos dentro do campo "code"; a explicacao vai em "explain".
- "brief" tem no maximo 100 caracteres. "explain" tem 1 a 3 frases.
- Escreva titulos, brief e explain em portugues do Brasil; o codigo permanece na linguagem alvo.
- A progressao vai do simbolo mais simples ao trecho mais complexo.
- Varie nomes de variaveis, funcoes, classes e o cenario de cada licao (ex.: nao reuse
  "usuario"/"foo"/"exemplo" toda hora); cada licao deve parecer um trecho de um projeto
  diferente, nao a mesma licao com nomes trocados.
- Responda apenas com JSON.`;

/* ------------------------------ geracao de modulo -------------------------- */

export const temasDisponiveis = POOL_TEMAS.map((t) => t.titulo);

export function detalheDoTema(titulo) {
  const achado = POOL_TEMAS.find((t) => t.titulo.toLowerCase() === String(titulo).toLowerCase().trim());
  return achado ? achado.detalhe : '';
}

/**
 * Normaliza as licoes cruas devolvidas pelo modelo.
 * `codigosVistos`, se passado, e um Set de assinaturas de codigo ja aceitas
 * (no modulo inteiro, ou no modulo existente ao anexar uma unidade) — licoes
 * cujo codigo repete uma dessas sao descartadas para nao duplicar conteudo.
 */
function normalizarLicoes(dados, idBase, licoesEsperadas, xpBase, codigosVistos) {
  const aceitas = [];
  for (const l of dados.lessons || []) {
    if (!l || typeof l.code !== 'string' || !l.code.trim()) continue;
    const codigo = String(l.code).replace(/\r\n/g, '\n').replace(/\t/g, '    ').trim();
    if (codigosVistos) {
      const assinatura = assinaturaCodigo(codigo);
      if (codigosVistos.has(assinatura)) continue;
      codigosVistos.add(assinatura);
    }
    aceitas.push({ ...l, code: codigo });
    if (aceitas.length >= licoesEsperadas) break;
  }
  return aceitas.map((l, li) => ({
    id: `${idBase}-${li + 1}`,
    title: l.title || `Licao ${li + 1}`,
    kind: 'code',
    tags: Array.isArray(l.tags) ? l.tags.slice(0, 4) : [],
    minAcc: 0.95,
    xp: xpBase,
    brief: l.brief || '',
    explain: l.explain || '',
    code: l.code
  }));
}

/** Uma requisicao = uma unidade. Devolve { subtitle, lessons } ja parseado. */
async function pedirUnidade({
  modelo,
  linguagem,
  foco,
  nivel,
  tema,
  detalhe,
  licoes,
  posicao,
  evitar,
  onToken,
  signal
}) {
  const prompt = `Linguagem alvo: ${linguagem}${foco ? ' (contexto: ' + foco + ')' : ''}.
Nivel do aluno: ${nivel}.
${posicao}
Tema desta unidade: ${tema}.
Conteudo esperado: ${detalhe || tema}.
${
  evitar && evitar.length
    ? 'Estes temas ja foram cobertos em outras unidades, NAO os repita: ' + evitar.join('; ') + '.'
    : ''
}
Gere exatamente ${licoes} licoes desta unidade, da mais simples para a mais complexa,
sem repetir codigo entre elas. Escreva tambem um subtitle de uma linha para a unidade.`;

  const bruto = await gerar({
    modelo,
    prompt,
    system: SYSTEM,
    schema: SCHEMA_UNIDADE,
    onToken,
    semThink: true,
    signal
  });
  return extrairJSON(bruto);
}

// Quantas licoes pedir por requisicao, no maximo. Sem esse teto interno, uma
// unidade com muitas licoes viraria uma unica resposta gigante — mais lenta,
// mais facil de sair malformada, e sem feedback ate terminar. Em vez disso a
// unidade e montada aos poucos, em pedacos do tamanho que qualquer maquina
// aguenta, nao importa quantas licoes o usuario pediu no total.
const LICOES_POR_REQUISICAO = 6;

/**
 * Gera as licoes de UMA unidade, em blocos de ate LICOES_POR_REQUISICAO,
 * encadeando quantas requisicoes forem necessarias ate juntar o total
 * pedido. Cada bloco informa os titulos ja gerados nesta mesma unidade para
 * o modelo nao repetir, alem dos temas de outras unidades (`evitar`).
 * Devolve { subtitle, lessons } no mesmo formato de pedirUnidade.
 */
async function pedirLicoesDaUnidade({
  modelo,
  linguagem,
  foco,
  nivel,
  tema,
  detalhe,
  licoesTotais,
  posicao,
  evitar,
  onToken,
  signal
}) {
  const lessons = [];
  let subtitle = '';
  let rodada = 0;

  while (lessons.length < licoesTotais) {
    rodada++;
    const pedirAgora = Math.min(LICOES_POR_REQUISICAO, licoesTotais - lessons.length);
    const jaGeradas = lessons.map((l) => l.title).filter(Boolean);
    const evitarNestaRodada = [
      ...(evitar || []),
      ...(jaGeradas.length ? jaGeradas.map((t) => `licao "${t}" (ja gerada nesta unidade)`) : [])
    ];

    const dados = await pedirUnidade({
      modelo,
      linguagem,
      foco,
      nivel,
      tema,
      detalhe,
      licoes: pedirAgora,
      posicao:
        rodada === 1
          ? posicao
          : `${posicao} Continuando a mesma unidade: essas sao mais ${pedirAgora} licoes dela, vindo depois das ${lessons.length} ja prontas.`,
      evitar: evitarNestaRodada.length ? evitarNestaRodada : undefined,
      onToken: onToken ? (t) => onToken(t, rodada) : null,
      signal
    });

    if (!subtitle) subtitle = dados.subtitle || '';
    const novas = (dados.lessons || []).filter((l) => l && typeof l.code === 'string' && l.code.trim());
    if (!novas.length) break; // o modelo parou de produzir algo aproveitavel: evita loop infinito
    lessons.push(...novas);
  }

  return { subtitle, lessons };
}

/**
 * Gera o modulo unidade a unidade (e cada unidade, por sua vez, em blocos de
 * ate LICOES_POR_REQUISICAO licoes — ver pedirLicoesDaUnidade). O usuario ve
 * o progresso e pode salvar mesmo se cancelar no meio.
 * onUnidade(unidadePronta, indice) e chamado a cada unidade concluida.
 *
 * Sem limite de unidades: alem do esqueleto fixo de 9 temas + 10 temas
 * avancados, `temaDaUnidade` cicla de volta pelos avancados marcando
 * "aprofundamento" — o dedup por codigo garante que nao vire so repeticao.
 *
 * `paralelismo` controla quantas unidades sao pedidas ao mesmo tempo. O
 * padrao (1) mantem o comportamento sequencial original — subir esse numero
 * so ajuda de verdade se o Ollama estiver configurado para atender mais de
 * uma requisicao por vez (OLLAMA_NUM_PARALLEL) ou tiver GPU sobrando; em CPU
 * com um unico modelo carregado, as requisicoes tendem a enfileirar do mesmo
 * jeito do lado do Ollama — quem decide o quanto sua maquina aguenta e voce.
 */
export async function gerarModulo({
  modelo,
  linguagem,
  foco,
  nivel,
  unidades,
  licoes,
  paralelismo = 1,
  onToken,
  onUnidade,
  onEtapa,
  signal
}) {
  const id = 'gen-' + slug(linguagem + '-' + (foco || 'geral')) + '-' + Date.now().toString(36);
  const totalUnidades = Math.max(1, Number(unidades) || 1);
  const modulo = {
    id,
    name: `${linguagem}${foco ? ' — ' + foco : ''}`,
    language: String(linguagem).toLowerCase(),
    icon: String(linguagem).slice(0, 2).toUpperCase(),
    color: '#5ad1a0',
    gerado: true,
    criadoEm: Date.now(),
    modelo,
    description: `Modulo de ${linguagem}${foco ? ' com foco em ' + foco : ''} gerado localmente por ${modelo}.`,
    units: []
  };

  const codigosVistos = new Set();
  const resultados = new Array(totalUnidades);

  const gerarUma = async (ui) => {
    const tema = temaDaUnidade(ui);
    if (onEtapa) onEtapa(ui, totalUnidades, tema.titulo);

    let dados;
    let tentativas = 0;
    while (true) {
      tentativas++;
      try {
        dados = await pedirLicoesDaUnidade({
          modelo,
          linguagem,
          foco,
          nivel,
          tema: tema.titulo,
          detalhe: tema.detalhe,
          licoesTotais: licoes,
          posicao: `Esta e a unidade ${ui + 1} de ${totalUnidades}.`,
          onToken: onToken ? (t) => onToken(t, ui) : null,
          signal
        });
        break;
      } catch (err) {
        if (err.name === 'AbortError') throw err;
        if (tentativas < 2) {
          // uma falha isolada (JSON malformado, hiccup do modelo) merece
          // uma segunda chance antes de desistir da unidade inteira
          if (onEtapa) onEtapa(ui, totalUnidades, tema.titulo + ' (tentando de novo: ' + err.message + ')');
          continue;
        }
        // uma unidade malformada nao pode derrubar o modulo inteiro
        if (onEtapa) onEtapa(ui, totalUnidades, tema.titulo + ' (descartada apos 2 tentativas: ' + err.message + ')');
        return;
      }
    }

    const lessons = normalizarLicoes(dados, `${id}-u${ui + 1}`, licoes, 20 + ui * 5, codigosVistos);
    if (!lessons.length) return;

    const unidade = {
      id: `${id}-u${ui + 1}`,
      title: `Unidade ${ui + 1} — ${tema.titulo}`,
      subtitle: dados.subtitle || tema.detalhe,
      lessons
    };
    resultados[ui] = unidade;
    if (onUnidade) onUnidade(unidade, ui, modulo);
  };

  const fila = Array.from({ length: totalUnidades }, (_, i) => i);
  const nParalelo = Math.max(1, Math.min(Number(paralelismo) || 1, totalUnidades));
  async function trabalhador() {
    while (fila.length) {
      const ui = fila.shift();
      await gerarUma(ui);
    }
  }
  await Promise.all(Array.from({ length: nParalelo }, trabalhador));

  modulo.units = resultados.filter(Boolean);
  if (!modulo.units.length) throw new Error('o modelo nao produziu nenhuma licao aproveitavel');
  return modulo;
}

/* ------------------- unidade avulsa para um modulo existente --------------- */

/**
 * Gera UMA unidade para anexar ao fim de um modulo que ja existe.
 * Os ids saem carimbados com o id do modulo e um timestamp, entao nunca
 * colidem com os das unidades originais nem com os de outra geracao.
 */
export async function gerarUnidade({
  modelo,
  modulo,
  tema,
  detalhe,
  nivel,
  licoes,
  foco,
  onToken,
  signal
}) {
  const idBase = `${modulo.id}-ext-${Date.now().toString(36)}`;
  const numero = modulo.units.length + 1;
  const jaCobertos = modulo.units
    .map((u) => String(u.title).replace(/^Unidade\s+\d+\s+[—-]\s*/i, ''))
    .slice(0, 14);

  // nao repetir codigo que ja existe no modulo (inclusive nas unidades
  // originais e nas ja acrescentadas antes)
  const codigosVistos = new Set(
    modulo.units.flatMap((u) => u.lessons.map((l) => assinaturaCodigo(l.code)))
  );

  let dados;
  let tentativas = 0;
  while (true) {
    tentativas++;
    try {
      dados = await pedirLicoesDaUnidade({
        modelo,
        linguagem: modulo.language,
        foco,
        nivel,
        tema,
        detalhe: detalhe || detalheDoTema(tema),
        licoesTotais: licoes,
        posicao: `Esta e a unidade ${numero} de um modulo que ja existe e vai ser anexada no fim dele.`,
        evitar: jaCobertos,
        onToken,
        signal
      });
      break;
    } catch (err) {
      if (err.name === 'AbortError' || tentativas >= 2) throw err;
      // uma falha isolada merece uma segunda tentativa antes de desistir
    }
  }

  const lessons = normalizarLicoes(dados, idBase, licoes, 30, codigosVistos);
  if (!lessons.length) throw new Error('o modelo nao produziu nenhuma licao aproveitavel');

  return {
    id: idBase,
    title: `Unidade ${numero} — ${tema}`,
    subtitle: dados.subtitle || detalhe || '',
    extensao: true,
    criadaEm: Date.now(),
    modelo,
    lessons
  };
}

/* ---------------------------- licoes de reforco --------------------------- */

const SCHEMA_REFORCO = {
  type: 'object',
  properties: {
    lessons: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          brief: { type: 'string' },
          explain: { type: 'string' },
          code: { type: 'string' }
        },
        required: ['title', 'brief', 'explain', 'code']
      }
    }
  },
  required: ['lessons']
};

export async function gerarReforco({ modelo, linguagem, simbolos, conceitos, quantidade = 3, onToken, signal }) {
  const prompt = `O aluno esta treinando ${linguagem} e erra com mais frequencia:
- caracteres: ${simbolos.join(' ') || 'nenhum registrado'}
- conceitos: ${conceitos.join(', ') || 'nenhum registrado'}

Crie ${quantidade} licoes curtas de reforco (4 a 10 linhas de codigo cada) que obriguem o aluno
a repetir exatamente esses caracteres e conceitos em codigo real e idiomatico.`;

  const bruto = await gerar({
    modelo,
    prompt,
    system: SYSTEM,
    schema: SCHEMA_REFORCO,
    onToken,
    semThink: true,
    signal
  });

  const dados = extrairJSON(bruto);
  const ts = Date.now().toString(36);
  return (dados.lessons || [])
    .filter((l) => l && l.code)
    .map((l, i) => ({
      id: `reforco-${ts}-${i}`,
      title: l.title || 'Reforco',
      kind: 'code',
      tags: ['reforco', ...conceitos.slice(0, 2)],
      minAcc: 0.96,
      xp: 25,
      brief: l.brief || 'Licao gerada a partir dos seus erros mais frequentes.',
      explain: l.explain || '',
      code: String(l.code).replace(/\r\n/g, '\n').replace(/\t/g, '    ').trim()
    }));
}
