import { kotlinAndroid } from './kotlin-android.js';
import { getState, adicionarModulo, definirExtensoes, extensoesDe } from '../js/store.js';

export const modulosBase = [kotlinAndroid];

/**
 * Junta os modulos embutidos, os salvos em disco (data/modules.json) e os
 * que estao apenas no localStorage. Disco tem prioridade sobre localStorage.
 *
 * Em cima disso, aplica as unidades acrescentadas depois (as "extensoes"):
 * elas ficam guardadas a parte porque um modulo embutido e codigo-fonte —
 * dentro do executavel nem sequer pode ser reescrito.
 */
export async function carregarModulos() {
  // Modulos "publicados": arquivo estatico dentro de public/, entao viajam no
  // deploy e aparecem em qualquer aparelho, sem API e sem localStorage.
  let publicados = [];
  try {
    const res = await fetch('curriculum/gerados.json', { cache: 'no-cache' });
    if (res.ok) publicados = await res.json();
  } catch {
    /* nenhum modulo publicado ainda */
  }

  let doDisco = [];
  try {
    const res = await fetch('/api/modules');
    if (res.ok) doDisco = await res.json();
  } catch {
    /* servidor sem persistencia: segue so com o localStorage */
  }
  for (const m of doDisco) adicionarModulo(m);

  try {
    const res = await fetch('/api/extensions');
    if (res.ok) definirExtensoes(await res.json());
  } catch {
    /* idem */
  }

  const gerados = getState().modulosGerados || [];
  const mapa = new Map();
  // publicados por ultimo: a versao do arquivo vence a copia do localStorage
  for (const m of [...modulosBase, ...gerados, ...publicados]) mapa.set(m.id, m);

  // copia rasa: nunca mutar o modulo importado, senao as unidades
  // acrescentadas se duplicariam a cada recarga do catalogo
  return [...mapa.values()].map((m) => ({
    ...m,
    units: [...m.units.filter((u) => !u.extensao), ...extensoesDe(m.id)]
  }));
}

export function encontrarLicao(modulo, licaoId) {
  for (let ui = 0; ui < modulo.units.length; ui++) {
    const unidade = modulo.units[ui];
    for (let li = 0; li < unidade.lessons.length; li++) {
      if (unidade.lessons[li].id === licaoId) {
        return { licao: unidade.lessons[li], unidade, ui, li };
      }
    }
  }
  return null;
}

export function proximaLicao(modulo, licaoId) {
  const achado = encontrarLicao(modulo, licaoId);
  if (!achado) return null;
  const { ui, li } = achado;
  const unidade = modulo.units[ui];
  if (li + 1 < unidade.lessons.length) return unidade.lessons[li + 1];
  if (ui + 1 < modulo.units.length) return modulo.units[ui + 1].lessons[0];
  return null;
}

export function todasLicoes(modulo) {
  return modulo.units.flatMap((u) => u.lessons);
}
