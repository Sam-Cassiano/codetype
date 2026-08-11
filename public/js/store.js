/*
 * Estado persistente do usuario (localStorage).
 * Guarda progresso por licao, XP, streak, badges, estatisticas de erro por
 * caractere e por conceito, alem dos modulos gerados pelo Ollama.
 */

const KEY = 'codetype.v1';

const DEFAULTS = {
  profile: {
    nome: 'Aprendiz',
    xp: 0,
    streak: 0,
    ultimoDia: null,
    badges: []
  },
  settings: {
    modo: 'estrito', // estrito | livre | rigoroso
    som: true,
    autoIndent: true,
    explicarAntes: true,
    modelo: null,
    liberarTudo: false, // ignora o desbloqueio encadeado
    metaPrecisao: null, // null = usar a meta declarada por cada licao
    tamanhoFonte: 15
  },
  progress: {}, // lessonId -> { melhorAcc, melhorWpm, tentativas, passou, ts }
  erros: { chars: {}, tags: {} },
  historico: [], // { ts, licao, modulo, acc, wpm, chars, segundos }
  modulosGerados: [],
  extensoes: {} // moduloId -> [unidade, ...] acrescentadas depois
};

function clone(v) {
  return JSON.parse(JSON.stringify(v));
}

function merge(base, saved) {
  const out = clone(base);
  if (!saved || typeof saved !== 'object') return out;
  for (const k of Object.keys(base)) {
    if (saved[k] === undefined) continue;
    if (base[k] && typeof base[k] === 'object' && !Array.isArray(base[k])) {
      out[k] = { ...base[k], ...saved[k] };
    } else {
      out[k] = saved[k];
    }
  }
  return out;
}

let state = load();

function load() {
  try {
    return merge(DEFAULTS, JSON.parse(localStorage.getItem(KEY)));
  } catch {
    return clone(DEFAULTS);
  }
}

export function save() {
  localStorage.setItem(KEY, JSON.stringify(state));
}

export function getState() {
  return state;
}

export function resetAll() {
  state = clone(DEFAULTS);
  save();
}

/* ---------------------------------- Nivel --------------------------------- */

// Cada nivel exige 15% mais XP que o anterior, comecando em 120.
export function nivelDe(xp) {
  let nivel = 1;
  let necessario = 120;
  let acumulado = 0;
  while (xp >= acumulado + necessario) {
    acumulado += necessario;
    necessario = Math.round(necessario * 1.15);
    nivel++;
  }
  return {
    nivel,
    atual: xp - acumulado,
    necessario,
    progresso: (xp - acumulado) / necessario
  };
}

/* --------------------------------- Streak --------------------------------- */

function hojeISO() {
  return new Date().toISOString().slice(0, 10);
}

export function marcarDia() {
  const hoje = hojeISO();
  const p = state.profile;
  if (p.ultimoDia === hoje) return p.streak;

  const ontem = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  p.streak = p.ultimoDia === ontem ? p.streak + 1 : 1;
  p.ultimoDia = hoje;
  save();
  return p.streak;
}

/* -------------------------------- Progresso ------------------------------- */

export function progressoDe(lessonId) {
  return state.progress[lessonId] || null;
}

/** Meta de precisao valendo agora: o ajuste global vence a meta da licao. */
export function metaDe(licao) {
  const global = state.settings.metaPrecisao;
  if (typeof global === 'number') return global;
  return (licao && licao.minAcc) || 0.95;
}

export function licaoLiberada(modulo, unitIndex, lessonIndex) {
  if (state.settings.liberarTudo) return true;
  if (unitIndex === 0 && lessonIndex === 0) return true;
  const unidade = modulo.units[unitIndex];
  if (lessonIndex > 0) {
    const anterior = unidade.lessons[lessonIndex - 1];
    return !!(state.progress[anterior.id] && state.progress[anterior.id].passou);
  }
  const unidadeAnterior = modulo.units[unitIndex - 1];
  const ultima = unidadeAnterior.lessons[unidadeAnterior.lessons.length - 1];
  return !!(state.progress[ultima.id] && state.progress[ultima.id].passou);
}

export function registrarResultado(modulo, licao, resultado) {
  const { acc, wpm, chars, segundos, errosPorChar } = resultado;
  const passou = acc >= metaDe(licao);

  const anterior = state.progress[licao.id] || {
    melhorAcc: 0,
    melhorWpm: 0,
    tentativas: 0,
    passou: false
  };

  let xpGanho = 0;
  if (passou) {
    const base = licao.xp || 20;
    const bonusPrecisao = acc >= 0.999 ? Math.round(base * 0.5) : 0;
    const bonusVelocidade = wpm >= 40 ? 10 : wpm >= 25 ? 5 : 0;
    // repetir uma licao ja aprovada rende menos
    xpGanho = anterior.passou
      ? Math.round((base + bonusPrecisao + bonusVelocidade) * 0.25)
      : base + bonusPrecisao + bonusVelocidade;
    state.profile.xp += xpGanho;
  }

  state.progress[licao.id] = {
    melhorAcc: Math.max(anterior.melhorAcc, acc),
    melhorWpm: Math.max(anterior.melhorWpm, wpm),
    tentativas: anterior.tentativas + 1,
    passou: anterior.passou || passou,
    ultimaAcc: acc,
    ts: Date.now()
  };

  for (const [ch, qtd] of Object.entries(errosPorChar || {})) {
    state.erros.chars[ch] = (state.erros.chars[ch] || 0) + qtd;
  }
  const totalErros = Object.values(errosPorChar || {}).reduce((a, b) => a + b, 0);
  if (totalErros > 0) {
    for (const tag of licao.tags || []) {
      state.erros.tags[tag] = (state.erros.tags[tag] || 0) + totalErros;
    }
  }

  state.historico.push({
    ts: Date.now(),
    licao: licao.id,
    titulo: licao.title,
    modulo: modulo.id,
    acc,
    wpm,
    chars,
    segundos
  });
  if (state.historico.length > 500) state.historico = state.historico.slice(-500);

  marcarDia();
  const novasBadges = avaliarBadges(modulo, licao, { acc, wpm, passou });
  save();

  return { passou, xpGanho, novasBadges };
}

/* --------------------------------- Badges --------------------------------- */

const BADGES = [
  { id: 'primeiro-passo', nome: 'Primeiro passo', icone: 'A', teste: (s) => Object.keys(s.progress).length >= 1 },
  { id: 'zero-erro', nome: 'Zero erro', icone: 'O', teste: (s, ctx) => ctx.acc >= 0.999 },
  { id: 'dez-licoes', nome: '10 licoes', icone: 'X', teste: (s) => Object.values(s.progress).filter((p) => p.passou).length >= 10 },
  { id: 'velocista', nome: 'Velocista (40 WPM)', icone: 'V', teste: (s, ctx) => ctx.wpm >= 40 },
  { id: 'streak-3', nome: 'Streak de 3 dias', icone: '3', teste: (s) => s.profile.streak >= 3 },
  { id: 'streak-7', nome: 'Streak de 7 dias', icone: '7', teste: (s) => s.profile.streak >= 7 },
  {
    id: 'mestre-simbolos',
    nome: 'Mestre dos simbolos',
    icone: 'S',
    teste: (s, ctx) => ctx.modulo.units[0].lessons.every((l) => s.progress[l.id] && s.progress[l.id].passou)
  },
  {
    id: 'android-dev',
    nome: 'Android Dev',
    icone: 'D',
    teste: (s, ctx) => {
      const u = ctx.modulo.units.find((x) => x.id === 'kt-u8');
      return !!u && u.lessons.every((l) => s.progress[l.id] && s.progress[l.id].passou);
    }
  },
  {
    id: 'modulo-completo',
    nome: 'Modulo concluido',
    icone: 'C',
    teste: (s, ctx) => ctx.modulo.units.every((u) => u.lessons.every((l) => s.progress[l.id] && s.progress[l.id].passou))
  }
];

function avaliarBadges(modulo, licao, ctx) {
  const novas = [];
  for (const badge of BADGES) {
    if (state.profile.badges.includes(badge.id)) continue;
    let ok = false;
    try {
      ok = badge.teste(state, { ...ctx, modulo, licao });
    } catch {
      ok = false;
    }
    if (ok) {
      state.profile.badges.push(badge.id);
      novas.push(badge);
    }
  }
  return novas;
}

export function todasBadges() {
  return BADGES;
}

/* -------------------------------- Estatistica ------------------------------ */

export function piores(limite = 8) {
  const chars = Object.entries(state.erros.chars)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limite);
  const tags = Object.entries(state.erros.tags)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limite);
  return { chars, tags };
}

export function resumo() {
  const h = state.historico;
  if (!h.length) return { sessoes: 0, wpmMedio: 0, accMedia: 0, chars: 0, minutos: 0 };
  const ultimos = h.slice(-30);
  return {
    sessoes: h.length,
    wpmMedio: ultimos.reduce((a, b) => a + b.wpm, 0) / ultimos.length,
    accMedia: ultimos.reduce((a, b) => a + b.acc, 0) / ultimos.length,
    chars: h.reduce((a, b) => a + (b.chars || 0), 0),
    minutos: h.reduce((a, b) => a + (b.segundos || 0), 0) / 60
  };
}

/* ---------------------------- Modulos gerados ------------------------------ */

export function adicionarModulo(modulo) {
  state.modulosGerados = state.modulosGerados.filter((m) => m.id !== modulo.id);
  state.modulosGerados.push(modulo);
  save();
}

export function removerModulo(id) {
  state.modulosGerados = state.modulosGerados.filter((m) => m.id !== id);
  delete state.extensoes[id];
  save();
}

/* --------------------------- Unidades acrescentadas ------------------------ */

export function extensoesDe(moduloId) {
  return state.extensoes[moduloId] || [];
}

export function adicionarExtensao(moduloId, unidade) {
  const atual = (state.extensoes[moduloId] || []).filter((u) => u.id !== unidade.id);
  atual.push(unidade);
  state.extensoes[moduloId] = atual;
  save();
}

export function removerExtensao(moduloId, unidadeId) {
  const atual = (state.extensoes[moduloId] || []).filter((u) => u.id !== unidadeId);
  if (atual.length) state.extensoes[moduloId] = atual;
  else delete state.extensoes[moduloId];
  save();
}

export function definirExtensoes(mapa) {
  for (const [moduloId, unidades] of Object.entries(mapa || {})) {
    if (Array.isArray(unidades) && unidades.length) state.extensoes[moduloId] = unidades;
  }
  save();
}

export function setSetting(chave, valor) {
  state.settings[chave] = valor;
  save();
}

/* ------------------------------ Backup local ------------------------------- */

export function exportar() {
  return JSON.stringify({ versao: 1, exportadoEm: new Date().toISOString(), estado: state }, null, 2);
}

export function importar(texto) {
  const dados = JSON.parse(texto);
  const bruto = dados && dados.estado ? dados.estado : dados;
  if (!bruto || typeof bruto !== 'object' || !bruto.profile) {
    throw new Error('arquivo nao parece um backup do CodeType');
  }
  state = merge(DEFAULTS, bruto);
  save();
  return {
    licoes: Object.keys(state.progress).length,
    xp: state.profile.xp,
    modulos: state.modulosGerados.length
  };
}
