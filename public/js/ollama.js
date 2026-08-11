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

async function gerar({ modelo, prompt, system, schema, onToken, semThink, signal }) {
  const corpo = {
    model: modelo,
    prompt,
    stream: true,
    options: { temperature: 0.3, top_p: 0.9, num_predict: 2500 }
  };
  if (system) corpo.system = system;
  if (schema) corpo.format = schema;
  if (semThink) corpo.think = false;

  const res = await fetch('/api/ollama/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(corpo),
    signal
  });

  if (!res.ok || !res.body) {
    if (res.status === 404) throw new Error(SEM_BACKEND);
    const erro = await res.json().catch(() => ({}));
    throw new Error(erro.hint || erro.error || 'falha ao gerar (HTTP ' + res.status + ')');
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let texto = '';
  let erroDoModelo = null;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
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

const SYSTEM = `Voce é um autor de curriculo para um treinador de digitacao de codigo.
Regras absolutas:
- Todo campo "code" deve conter codigo REAL, compilavel e idiomatico da linguagem pedida.
- Use indentacao de 4 espacos, nunca tabs, e no maximo 16 linhas por trecho.
- Nunca escreva comentarios explicativos dentro do campo "code"; a explicacao vai em "explain".
- "brief" tem no maximo 100 caracteres. "explain" tem 1 a 3 frases.
- Escreva titulos, brief e explain em portugues do Brasil; o codigo permanece na linguagem alvo.
- A progressao vai do simbolo mais simples ao trecho mais complexo.
- Responda apenas com JSON.`;

/* ------------------------------ geracao de modulo -------------------------- */

export const temasDisponiveis = TEMAS.map((t) => t.titulo);

export function detalheDoTema(titulo) {
  const achado = TEMAS.find((t) => t.titulo.toLowerCase() === String(titulo).toLowerCase().trim());
  return achado ? achado.detalhe : '';
}

function normalizarLicoes(dados, idBase, licoesEsperadas, xpBase) {
  return (dados.lessons || [])
    .filter((l) => l && typeof l.code === 'string' && l.code.trim().length > 0)
    .slice(0, licoesEsperadas)
    .map((l, li) => ({
      id: `${idBase}-${li + 1}`,
      title: l.title || `Licao ${li + 1}`,
      kind: 'code',
      tags: Array.isArray(l.tags) ? l.tags.slice(0, 4) : [],
      minAcc: 0.95,
      xp: xpBase,
      brief: l.brief || '',
      explain: l.explain || '',
      code: String(l.code).replace(/\r\n/g, '\n').replace(/\t/g, '    ').trim()
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

/**
 * Gera o modulo unidade a unidade. Cada unidade e uma requisicao curta:
 * o usuario ve o progresso e pode salvar mesmo se cancelar no meio.
 * onUnidade(unidadePronta, indice) e chamado a cada unidade concluida.
 */
export async function gerarModulo({
  modelo,
  linguagem,
  foco,
  nivel,
  unidades,
  licoes,
  onToken,
  onUnidade,
  onEtapa,
  signal
}) {
  const id = 'gen-' + slug(linguagem + '-' + (foco || 'geral')) + '-' + Date.now().toString(36);
  const escolhidos = TEMAS.slice(0, Math.min(unidades, TEMAS.length));
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

  for (let ui = 0; ui < escolhidos.length; ui++) {
    const tema = escolhidos[ui];
    if (onEtapa) onEtapa(ui, escolhidos.length, tema.titulo);

    let dados;
    try {
      dados = await pedirUnidade({
        modelo,
        linguagem,
        foco,
        nivel,
        tema: tema.titulo,
        detalhe: tema.detalhe,
        licoes,
        posicao: `Esta e a unidade ${ui + 1} de ${escolhidos.length}.`,
        onToken: onToken ? (t) => onToken(t, ui) : null,
        signal
      });
    } catch (err) {
      if (err.name === 'AbortError') throw err;
      // uma unidade malformada nao pode derrubar o modulo inteiro
      if (onEtapa) onEtapa(ui, escolhidos.length, tema.titulo + ' (descartada: ' + err.message + ')');
      continue;
    }

    const lessons = normalizarLicoes(dados, `${id}-u${ui + 1}`, licoes, 20 + ui * 5);
    if (!lessons.length) continue;

    const unidade = {
      id: `${id}-u${ui + 1}`,
      title: `Unidade ${ui + 1} — ${tema.titulo}`,
      subtitle: dados.subtitle || tema.detalhe,
      lessons
    };
    modulo.units.push(unidade);
    if (onUnidade) onUnidade(unidade, ui, modulo);
  }

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

  const dados = await pedirUnidade({
    modelo,
    linguagem: modulo.language,
    foco,
    nivel,
    tema,
    detalhe: detalhe || detalheDoTema(tema),
    licoes,
    posicao: `Esta e a unidade ${numero} de um modulo que ja existe e vai ser anexada no fim dele.`,
    evitar: jaCobertos,
    onToken,
    signal
  });

  const lessons = normalizarLicoes(dados, idBase, licoes, 30);
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
