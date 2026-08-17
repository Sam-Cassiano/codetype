/*
 * CodeType — camada de UI: roteador por hash + telas.
 */

import { TypingEngine } from './typing.js';
import { languageLabel } from './highlight.js';
import * as store from './store.js';
import { carregarModulos, encontrarLicao, proximaLicao, todasLicoes } from '../curriculum/index.js';
import { listarModelos, gerarModulo, gerarUnidade, gerarReforco, temasDisponiveis } from './ollama.js';
import { montarTecladoProprio } from './keyboard.js';

const app = document.getElementById('app');
let MODULOS = [];
let engineAtual = null;
let tecladoProprioAtual = null;
let licoesTemporarias = {}; // licoes de reforco geradas na sessao

/**
 * Mesmo criterio ja usado no CSS pra decidir quando a tela e "de celular":
 * tela estreita ou ponteiro grosso (dedo). E nesses casos que o teclado
 * proprio substitui o teclado nativo do sistema.
 */
function ehMobile() {
  return window.matchMedia('(max-width: 860px), (pointer: coarse)').matches;
}

/* ------------------------------- utilitarios ------------------------------ */

const esc = (s) =>
  String(s == null ? '' : s).replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])
  );

const pct = (v) => Math.round(v * 100) + '%';

function moduloPorId(id) {
  return MODULOS.find((m) => m.id === id);
}

function statusLicao(modulo, ui, li) {
  const licao = modulo.units[ui].lessons[li];
  const p = store.progressoDe(licao.id);
  if (p && p.passou) return 'concluida';
  if (store.licaoLiberada(modulo, ui, li)) return 'liberada';
  return 'bloqueada';
}

function estrelas(p, licao) {
  if (!p || !p.passou) return 0;
  if (p.melhorAcc >= 0.999 && p.melhorWpm >= 30) return 3;
  if (p.melhorAcc >= store.metaDe(licao) + 0.02) return 2;
  return 1;
}

/* --------------------------------- cabecalho ------------------------------ */

function renderHeader() {
  const s = store.getState();
  const nivel = store.nivelDe(s.profile.xp);
  const el = document.getElementById('topbar');
  el.innerHTML = `
    <a class="marca" href="#/">
      <span class="marca-logo">&lt;/&gt;</span>
      <span>CodeType</span>
    </a>
    <nav class="nav">
      <a href="#/" data-rota="">Modulos</a>
      <a href="#/revisao" data-rota="revisao">Revisao</a>
      <a href="#/stats" data-rota="stats">Estatisticas</a>
      <a href="#/lab" data-rota="lab">Gerador IA</a>
      <a href="#/config" data-rota="config">Config</a>
    </nav>
    <div class="perfil">
      <div class="streak" title="Dias seguidos treinando">${s.profile.streak} dias</div>
      <div class="nivel">
        <div class="nivel-topo">
          <span>Nivel ${nivel.nivel}</span>
          <span class="xp">${s.profile.xp} XP</span>
        </div>
        <div class="barra"><div class="barra-fill" style="width:${Math.round(nivel.progresso * 100)}%"></div></div>
      </div>
    </div>`;

  const rota = (location.hash.replace('#/', '').split('/')[0]) || '';
  el.querySelectorAll('.nav a').forEach((a) => {
    a.classList.toggle('ativo', a.dataset.rota === rota);
  });
}

/* ---------------------------------- HOME ---------------------------------- */

function viewHome() {
  const cards = MODULOS.map((m) => {
    const licoes = todasLicoes(m);
    const feitas = licoes.filter((l) => {
      const p = store.progressoDe(l.id);
      return p && p.passou;
    }).length;
    const perc = licoes.length ? feitas / licoes.length : 0;
    return `
      <a class="card modulo" href="#/modulo/${esc(m.id)}" style="--cor:${esc(m.color || '#a97bff')}">
        <div class="modulo-icone">${esc(m.icon || 'ID')}</div>
        <div class="modulo-corpo">
          <h3>${esc(m.name)}${m.gerado ? '<span class="tag-ia">IA</span>' : ''}</h3>
          <p>${esc(m.description || '')}</p>
          <div class="barra fina"><div class="barra-fill" style="width:${Math.round(perc * 100)}%"></div></div>
          <span class="mini">${feitas} de ${licoes.length} licoes · ${languageLabel(m.language)}</span>
        </div>
      </a>`;
  }).join('');

  app.innerHTML = `
    <section class="hero">
      <h1>Aprenda a linguagem <em>digitando</em> a linguagem.</h1>
      <p>Precisao alta obrigatoria para avancar. Cada caractere, cada simbolo, cada indentacao.</p>
    </section>
    <div class="grid-modulos">${cards}</div>
    <section class="bloco-lab">
      <div>
        <h3>Faltou alguma linguagem?</h3>
        <p>Gere um modulo novo com os modelos que ja rodam na sua maquina via Ollama.</p>
      </div>
      <div class="acoes-modulo">
        <a class="btn primario" href="#/lab">Abrir gerador</a>
      </div>
    </section>
    <div id="painel-git"></div>`;

  renderPainelGit();
}

/**
 * Painel de envio: aparece so quando ha modulo publicado esperando para ir
 * para o GitHub. Some no executavel e na versao publicada, onde /api/git
 * nao existe.
 */
async function renderPainelGit(destinoId = 'painel-git', logPreservado = '') {
  const alvo = document.getElementById(destinoId);
  if (!alvo) return;

  const manterLog = () => {
    if (!logPreservado) return '';
    return `<div class="git-log">${logPreservado}</div>`;
  };

  let g;
  try {
    const res = await fetch('/api/git/status');
    if (!res.ok) return;
    g = await res.json();
  } catch {
    return;
  }
  if (!g.repo) return;

  const pendencias = [];
  if (g.arquivoModificado) pendencias.push('modulo publicado ainda nao commitado');
  if (g.naoEnviados > 0) pendencias.push(`${g.naoEnviados} commit${g.naoEnviados > 1 ? 's' : ''} sem enviar`);

  if (!pendencias.length) {
    alvo.innerHTML = `<div class="git-painel limpo">
      <span>Nenhum modulo esperando envio — <code>${esc(g.branch)}</code> esta em dia com o GitHub.
      A Vercel publica sozinha a cada envio.</span>
    </div>${manterLog()}`;
    return;
  }

  alvo.innerHTML = `
    <div class="git-painel">
      <div>
        <strong>Pronto para subir</strong>
        <p class="mini">${esc(pendencias.join(' · '))} — em <code>${esc(g.branch)}</code>${
    g.remoto ? ' &rarr; ' + esc(g.remoto.replace(/^https:\/\/github\.com\//, '')) : ''
  }</p>
      </div>
      <button class="btn primario" id="btn-git-enviar">Enviar ao GitHub</button>
    </div>
    <div class="git-log" id="git-log" ${logPreservado ? '' : 'hidden'}>${logPreservado}</div>`;

  document.getElementById('btn-git-enviar').onclick = async () => {
    const btn = document.getElementById('btn-git-enviar');
    const log = document.getElementById('git-log');
    const gerados = MODULOS.filter((m) => m.publicado).map((m) => m.name);
    btn.disabled = true;
    btn.textContent = 'Enviando...';
    log.hidden = false;
    log.textContent = 'git add / commit / push...';

    try {
      const res = await fetch('/api/git/enviar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mensagem: gerados.length ? 'modulos gerados: ' + gerados.join(', ') : 'modulos gerados'
        })
      });
      const r = await res.json();
      log.innerHTML = (r.passos || [])
        .map((p) => `<div class="${p.ok ? 'ok' : 'falhou'}">${esc(p.titulo)}: ${esc(p.saida || 'ok')}</div>`)
        .join('');
      if (r.ok) {
        log.innerHTML += '<div class="ok">enviado. A Vercel comeca o deploy agora.</div>';
      } else {
        log.innerHTML +=
          '<div class="falhou">Se pedir credencial, o envio nao roda daqui: use <code>git push</code> no terminal uma vez ' +
          'para o Windows guardar o token.</div>';
      }
      await renderPainelGit(destinoId, log.innerHTML);
    } catch (err) {
      log.textContent = 'Falhou: ' + err.message;
      btn.disabled = false;
      btn.textContent = 'Enviar ao GitHub';
    }
  };
}

function baixarJSON(nome, texto) {
  const url = URL.createObjectURL(new Blob([texto], { type: 'application/json' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = nome;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Grava uma copia do modulo em Cursos Gerados/<id>.json, na raiz do projeto —
 * em segundo plano, sempre que um modulo e criado, publicado ou ganha uma
 * unidade nova. E so um backup versionado no git, independente do
 * localStorage e do "Publicar no app" (que e o que realmente afeta o que o
 * app carrega). Silenciosa de proposito: so funciona rodando pelo
 * codigo-fonte (no executavel e na versao publicada essa rota nem existe, e
 * isso e esperado — nao vale interromper quem esta so treinando no celular
 * com um aviso de erro por causa disso).
 */
function salvarCopiaEmCursosGerados(modulo) {
  fetch('/api/cursos-gerados', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(modulo)
  }).catch(() => {});
}

/* ------------------------------- MAPA DO MODULO --------------------------- */

function viewModulo(id) {
  const modulo = moduloPorId(id);
  if (!modulo) return viewHome();

  const unidades = modulo.units
    .map((unidade, ui) => {
      const licoes = unidade.lessons
        .map((licao, li) => {
          const st = statusLicao(modulo, ui, li);
          const p = store.progressoDe(licao.id);
          const n = estrelas(p, licao);
          const href = st === 'bloqueada' ? '' : `href="#/licao/${esc(modulo.id)}/${esc(licao.id)}"`;
          return `
            <a class="licao ${st}" ${href}>
              <div class="licao-topo">
                <span class="licao-kind kind-${esc(licao.kind || 'code')}">${
                  licao.kind === 'challenge' ? 'desafio' : licao.kind === 'drill' ? 'drill' : 'codigo'
                }</span>
                <span class="estrelas">${'*'.repeat(n)}${'·'.repeat(3 - n)}</span>
              </div>
              <h4>${esc(licao.title)}</h4>
              <p>${esc(licao.brief || '')}</p>
              <div class="licao-rodape">
                <span>meta ${pct(store.metaDe(licao))}</span>
                ${p && p.passou ? `<span class="ok">${pct(p.melhorAcc)} · ${p.melhorWpm} WPM</span>` : `<span>${licao.xp || 20} XP</span>`}
              </div>
            </a>`;
        })
        .join('');
      return `
        <section class="unidade">
          <header class="unidade-cab">
            <h2>
              ${esc(unidade.title)}
              ${unidade.extensao ? '<span class="tag-ia">acrescentada</span>' : ''}
            </h2>
            <p>${esc(unidade.subtitle || '')}</p>
            ${
              unidade.extensao
                ? `<button class="btn fantasma mini-btn" data-remover-unidade="${esc(unidade.id)}">Remover unidade</button>`
                : ''
            }
          </header>
          <div class="grid-licoes">${licoes}</div>
        </section>`;
    })
    .join('');

  app.innerHTML = `
    <div class="cabecalho-modulo" style="--cor:${esc(modulo.color || '#a97bff')}">
      <div>
        <a class="voltar" href="#/">&larr; modulos</a>
        <h1>${esc(modulo.name)}</h1>
        <p>${esc(modulo.description || '')}</p>
      </div>
      <div class="acoes-modulo">
        <a class="btn" href="#/lab/${esc(modulo.id)}">Acrescentar unidade com IA</a>
        ${modulo.gerado ? `<button class="btn" data-exportar="${esc(modulo.id)}">Exportar .json</button>` : ''}
        ${
          modulo.gerado && !modulo.publicado
            ? `<button class="btn" data-publicar="${esc(modulo.id)}" title="Grava em public/curriculum/gerados.json para o modulo viajar no deploy">Publicar no app</button>`
            : ''
        }
        ${modulo.publicado ? '<span class="pill publicado">publicado no app</span>' : ''}
        ${modulo.gerado ? `<button class="btn perigo" data-excluir="${esc(modulo.id)}">Excluir modulo</button>` : ''}
      </div>
      <p class="dica" id="aviso-modulo"></p>
    </div>
    <div id="painel-git-modulo"></div>
    ${unidades}`;

  const avisoModulo = document.getElementById('aviso-modulo');
  if (modulo.gerado) renderPainelGit('painel-git-modulo');

  const btnExportar = app.querySelector('[data-exportar]');
  if (btnExportar) {
    btnExportar.onclick = () => {
      baixarJSON(`${modulo.id}.json`, JSON.stringify(modulo, null, 2));
      avisoModulo.textContent = 'Modulo baixado. Uma copia tambem fica salva em Cursos Gerados/, no projeto.';
    };
  }

  const btnPublicar = app.querySelector('[data-publicar]');
  if (btnPublicar) {
    btnPublicar.onclick = async () => {
      btnPublicar.disabled = true;
      const paraPublicar = { ...modulo, units: modulo.units.filter((u) => !u.extensao) };
      try {
        const res = await fetch('/api/publish', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(paraPublicar)
        });
        const dados = await res.json();
        if (!res.ok) throw new Error(dados.hint || dados.error || 'falhou');
        salvarCopiaEmCursosGerados(paraPublicar);
        MODULOS = await carregarModulos();
        viewModulo(modulo.id);
        document.getElementById('aviso-modulo').textContent =
          `Gravado em ${dados.arquivo}. Faca commit desse arquivo e o modulo aparece no celular e na versao publicada.`;
      } catch (err) {
        avisoModulo.textContent = 'Nao deu para publicar: ' + err.message;
        btnPublicar.disabled = false;
      }
    };
  }

  app.querySelectorAll('[data-remover-unidade]').forEach((btn) => {
    btn.onclick = async () => {
      const unidadeId = btn.dataset.removerUnidade;
      if (!confirm('Remover esta unidade do modulo? O progresso das licoes dela sera perdido.')) return;
      store.removerExtensao(modulo.id, unidadeId);
      await fetch(
        `/api/extensions?modulo=${encodeURIComponent(modulo.id)}&unidade=${encodeURIComponent(unidadeId)}`,
        { method: 'DELETE' }
      ).catch(() => {});
      MODULOS = await carregarModulos();
      viewModulo(modulo.id);
    };
  });

  const btn = app.querySelector('[data-excluir]');
  if (btn) {
    btn.onclick = async () => {
      if (!confirm('Excluir este modulo gerado? O progresso das licoes dele sera mantido.')) return;
      store.removerModulo(modulo.id);
      await fetch('/api/modules?id=' + encodeURIComponent(modulo.id), { method: 'DELETE' }).catch(() => {});
      MODULOS = await carregarModulos();
      location.hash = '#/';
    };
  }
}

/* ---------------------------------- LICAO --------------------------------- */

function viewLicao(moduloId, licaoId) {
  const modulo = moduloPorId(moduloId);
  if (!modulo) return viewHome();

  let achado = encontrarLicao(modulo, licaoId);
  if (!achado && licoesTemporarias[licaoId]) {
    achado = { licao: licoesTemporarias[licaoId], unidade: { title: 'Reforco' }, ui: -1, li: -1 };
  }
  if (!achado) return viewModulo(moduloId);

  const { licao } = achado;
  const s = store.getState();
  const lang = licao.lang || modulo.language;
  const ehDesafio = licao.kind === 'challenge';

  app.innerHTML = `
    <div class="licao-view">
      <header class="licao-cab">
        <div>
          <a class="voltar" href="#/modulo/${esc(modulo.id)}">&larr; ${esc(modulo.name)}</a>
          <h1>${esc(licao.title)}</h1>
          <p class="brief">${esc(licao.brief || '')}</p>
        </div>
        <div class="licao-meta">
          <span class="pill">${esc(languageLabel(lang))}</span>
          <span class="pill">meta ${pct(store.metaDe(licao))}</span>
          <span class="pill">${licao.xp || 20} XP</span>
        </div>
      </header>

      ${
        ehDesafio
          ? `<div class="enunciado"><strong>Desafio.</strong> ${esc(licao.prompt || '')}</div>`
          : ''
      }

      ${
        licao.explain
          ? `<details class="explicacao" ${s.settings.explicarAntes ? 'open' : ''}>
               <summary>Entenda antes de digitar</summary>
               <p>${esc(licao.explain)}</p>
             </details>`
          : ''
      }

      <div class="hud">
        <div class="hud-item"><span class="hud-valor" id="hud-acc">100%</span><span class="hud-label">precisao</span></div>
        <div class="hud-item"><span class="hud-valor" id="hud-wpm">0</span><span class="hud-label">WPM</span></div>
        <div class="hud-item"><span class="hud-valor" id="hud-erros">0</span><span class="hud-label">erros</span></div>
        <div class="hud-progresso"><div class="barra"><div class="barra-fill" id="hud-bar"></div></div></div>
        <select id="modo-select" title="Modo de correcao">
          <option value="estrito">Estrito — trava no erro</option>
          <option value="livre">Livre — marca e segue</option>
          <option value="rigoroso">Rigoroso — reinicia no erro</option>
        </select>
        <button class="btn fantasma" id="btn-som" title="Som de erro"></button>
      </div>

      <div class="editor ${ehDesafio ? 'coberto' : ''}" id="editor" tabindex="0"></div>
      ${ehDesafio ? '<button class="btn fantasma revelar" id="btn-revelar">Revelar a solucao para digitar</button>' : ''}

      <div id="teclado-proprio-slot"></div>

      <footer class="licao-rodape-acoes">
        <button class="btn fantasma" id="btn-reiniciar">Reiniciar (Esc)</button>
        <span class="dica">A indentacao do inicio da linha e preenchida sozinha ao pressionar Enter.</span>
      </footer>
    </div>
    <div class="overlay" id="overlay" hidden></div>`;

  const editor = document.getElementById('editor');
  const modoSelect = document.getElementById('modo-select');
  const btnSom = document.getElementById('btn-som');
  modoSelect.value = s.settings.modo;

  const pintarSom = () => {
    btnSom.textContent = store.getState().settings.som ? 'Som: on' : 'Som: off';
  };
  pintarSom();

  const criarEngine = () => {
    if (engineAtual) engineAtual.destroy();
    engineAtual = new TypingEngine({
      code: licao.code,
      language: lang,
      container: editor,
      modo: store.getState().settings.modo,
      autoIndent: store.getState().settings.autoIndent,
      som: store.getState().settings.som,
      onUpdate: (m) => {
        document.getElementById('hud-acc').textContent = pct(m.acc);
        document.getElementById('hud-wpm').textContent = m.wpm;
        document.getElementById('hud-erros').textContent = m.erros;
        document.getElementById('hud-bar').style.width = Math.round(m.progresso * 100) + '%';
        document.getElementById('hud-acc').className =
          'hud-valor ' + (m.acc >= store.metaDe(licao) ? 'bom' : 'ruim');
      },
      onFinish: (m) => finalizarLicao(modulo, licao, m)
    });
    engineAtual.focus();
  };

  criarEngine();

  modoSelect.onchange = () => {
    store.setSetting('modo', modoSelect.value);
    criarEngine();
  };
  btnSom.onclick = () => {
    store.setSetting('som', !store.getState().settings.som);
    pintarSom();
    if (engineAtual) engineAtual.som = store.getState().settings.som;
  };
  document.getElementById('btn-reiniciar').onclick = () => criarEngine();

  const revelar = document.getElementById('btn-revelar');
  if (revelar) {
    revelar.onclick = () => {
      editor.classList.remove('coberto');
      revelar.remove();
      engineAtual.focus();
    };
  }

  // No celular, o teclado nativo do sistema nunca entra em cena (o campo
  // fantasma do TypingEngine pede inputmode="none"): quem digita e o teclado
  // proprio do app, montado abaixo, chamando digitar()/apagar() direto — o
  // que funciona independente de foco em qualquer input.
  if (ehMobile()) {
    tecladoProprioAtual = montarTecladoProprio({
      container: document.getElementById('teclado-proprio-slot'),
      codigo: licao.code,
      onChar: (ch) => engineAtual.digitar(ch),
      onApagar: () => engineAtual.apagar()
    });
  }

  ajustarParaTecladoVirtual();

  app._onEsc = (e) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      const ov = document.getElementById('overlay');
      if (ov && !ov.hidden) return;
      criarEngine();
    }
  };
  document.addEventListener('keydown', app._onEsc);
}

/**
 * No celular o teclado proprio fica sempre visivel, fixo no rodape — nao e
 * mais algo que aparece e some como o teclado nativo do sistema fazia
 * (aquele encolhia a visualViewport; este e um elemento normal da pagina).
 * Por isso o "modo compacto" (esconde cabecalho/explicacao, teclado fixo no
 * rodape) agora depende so de ser celular, nao de detectar teclado aberto —
 * e o calculo de altura do editor usa a visualViewport (que ainda reflete a
 * barra de endereco/teclado do navegador) so pra sobrar espaco de verdade.
 */
function ajustarParaTecladoVirtual() {
  const mobile = ehMobile();
  document.body.classList.toggle('teclado-aberto', mobile);
  if (!mobile) return;

  const vv = window.visualViewport;

  const aplicar = () => {
    const editor = document.getElementById('editor');
    const slot = document.getElementById('teclado-proprio-slot');
    if (!editor) return;
    const alturaViewport = vv ? vv.height : window.innerHeight;
    const alturaTeclado = slot ? slot.getBoundingClientRect().height : 0;
    // sobra para o editor: viewport visivel menos o cabecalho da licao e o
    // espaco que o teclado proprio ocupa (medido de verdade, nao chutado —
    // o teclado flui normal no documento, logo abaixo do editor)
    const disponivel = Math.max(140, alturaViewport - editor.getBoundingClientRect().top - alturaTeclado - 16);
    editor.style.maxHeight = disponivel + 'px';
    const atual = editor.querySelector('.ch.atual');
    if (atual) atual.scrollIntoView({ block: 'center', behavior: 'auto' });
  };

  aplicar();
  if (!vv) return;
  if (app._vvHandler) {
    vv.removeEventListener('resize', app._vvHandler);
    vv.removeEventListener('scroll', app._vvHandler);
  }
  app._vvHandler = aplicar;
  vv.addEventListener('resize', aplicar);
  vv.addEventListener('scroll', aplicar);
}

function finalizarLicao(modulo, licao, m) {
  const resultado = store.registrarResultado(modulo, licao, m);
  renderHeader();

  const prox = proximaLicao(modulo, licao.id);
  const overlay = document.getElementById('overlay');
  const meta = store.metaDe(licao);

  const badges = resultado.novasBadges.length
    ? `<div class="badges-novas">${resultado.novasBadges
        .map((b) => `<span class="badge"><i>${esc(b.icone)}</i>${esc(b.nome)}</span>`)
        .join('')}</div>`
    : '';

  overlay.innerHTML = `
    <div class="modal ${resultado.passou ? 'passou' : 'falhou'}">
      <h2>${resultado.passou ? 'Passou!' : 'Ainda nao'}</h2>
      <p class="sub">${
        resultado.passou
          ? `Precisao acima da meta de ${pct(meta)}.`
          : `Voce precisa de ${pct(meta)} de precisao para liberar a proxima licao.`
      }</p>
      <div class="resultado-grid">
        <div><span>${pct(m.acc)}</span><small>precisao</small></div>
        <div><span>${m.wpm}</span><small>WPM</small></div>
        <div><span>${m.erros}</span><small>erros</small></div>
        <div><span>+${resultado.xpGanho}</span><small>XP</small></div>
      </div>
      ${
        Object.keys(m.errosPorChar).length
          ? `<div class="erros-detalhe">Mais errados: ${Object.entries(m.errosPorChar)
              .sort((a, b) => b[1] - a[1])
              .slice(0, 6)
              .map(([c, q]) => `<code>${esc(c === ' ' ? 'espaco' : c)}</code>&times;${q}`)
              .join(' ')}</div>`
          : '<div class="erros-detalhe limpo">Nenhum erro registrado. Impecavel.</div>'
      }
      ${badges}
      <div class="modal-acoes">
        <button class="btn fantasma" id="modal-repetir">Repetir</button>
        ${
          resultado.passou && prox
            ? `<a class="btn primario" id="modal-proxima" href="#/licao/${esc(modulo.id)}/${esc(prox.id)}">Proxima licao</a>`
            : `<a class="btn primario" href="#/modulo/${esc(modulo.id)}">Voltar ao mapa</a>`
        }
      </div>
    </div>`;
  overlay.hidden = false;

  document.getElementById('modal-repetir').onclick = () => {
    overlay.hidden = true;
    limpar(); // evita acumular listeners de Esc/Enter a cada repeticao
    viewLicao(modulo.id, licao.id);
  };

  const irProxima = document.getElementById('modal-proxima');
  overlay._onEnter = (e) => {
    if (e.key === 'Enter' && irProxima) {
      e.preventDefault();
      location.hash = irProxima.getAttribute('href');
    }
  };
  document.addEventListener('keydown', overlay._onEnter);
}

/* -------------------------------- REVISAO --------------------------------- */

function viewRevisao() {
  const s = store.getState();
  const fracas = [];
  for (const modulo of MODULOS) {
    for (const licao of todasLicoes(modulo)) {
      const p = s.progress[licao.id];
      if (!p) continue;
      fracas.push({ modulo, licao, p });
    }
  }
  fracas.sort((a, b) => a.p.melhorAcc - b.p.melhorAcc || b.p.tentativas - a.p.tentativas);

  const lista = fracas.slice(0, 12);
  const { chars, tags } = store.piores(6);

  const temporarias = Object.values(licoesTemporarias);

  app.innerHTML = `
    <section class="hero pequeno">
      <h1>Modo revisao</h1>
      <p>As licoes em que voce teve mais dificuldade, ordenadas da pior precisao para a melhor.</p>
    </section>

    <div class="painel-duplo">
      <div class="card painel">
        <h3>Simbolos que mais te derrubam</h3>
        ${
          chars.length
            ? `<div class="chips">${chars
                .map(([c, q]) => `<span class="chip"><code>${esc(c === ' ' ? 'espaco' : c)}</code>${q}</span>`)
                .join('')}</div>`
            : '<p class="vazio">Sem erros registrados ainda.</p>'
        }
        <h3>Conceitos fracos</h3>
        ${
          tags.length
            ? `<div class="chips">${tags.map(([t, q]) => `<span class="chip">${esc(t)}<b>${q}</b></span>`).join('')}</div>`
            : '<p class="vazio">Complete algumas licoes para o diagnostico aparecer.</p>'
        }
        <button class="btn primario" id="btn-reforco" ${chars.length ? '' : 'disabled'}>
          Gerar licoes de reforco com IA
        </button>
        <div class="stream" id="stream-reforco" hidden></div>
      </div>

      <div class="card painel">
        <h3>Repetir as mais fracas</h3>
        ${
          lista.length
            ? `<ul class="lista-revisao">${lista
                .map(
                  (f) => `<li>
                    <a href="#/licao/${esc(f.modulo.id)}/${esc(f.licao.id)}">
                      <span class="titulo">${esc(f.licao.title)}</span>
                      <span class="mini">${esc(f.modulo.name)}</span>
                    </a>
                    <span class="acc ${f.p.melhorAcc >= store.metaDe(f.licao) ? 'bom' : 'ruim'}">${pct(f.p.melhorAcc)}</span>
                  </li>`
                )
                .join('')}</ul>`
            : '<p class="vazio">Voce ainda nao completou nenhuma licao.</p>'
        }
      </div>
    </div>

    ${
      temporarias.length
        ? `<section class="unidade">
             <header class="unidade-cab"><h2>Reforco gerado nesta sessao</h2>
             <p>Licoes criadas pelo modelo local a partir dos seus erros.</p></header>
             <div class="grid-licoes">${temporarias
               .map(
                 (l) => `<a class="licao liberada" href="#/licao/${esc(MODULOS[0].id)}/${esc(l.id)}">
                   <div class="licao-topo"><span class="licao-kind kind-code">reforco</span></div>
                   <h4>${esc(l.title)}</h4><p>${esc(l.brief)}</p>
                   <div class="licao-rodape"><span>meta ${pct(store.metaDe(l))}</span><span>${l.xp} XP</span></div>
                 </a>`
               )
               .join('')}</div>
           </section>`
        : ''
    }`;

  const btn = document.getElementById('btn-reforco');
  if (btn) {
    btn.onclick = async () => {
      const stream = document.getElementById('stream-reforco');
      const modelo = await escolherModelo();
      if (!modelo) return;
      btn.disabled = true;
      btn.textContent = 'Gerando...';
      stream.hidden = false;
      stream.textContent = 'conectando ao modelo ' + modelo + '...';
      try {
        const licoes = await gerarReforco({
          modelo,
          linguagem: MODULOS[0].language,
          simbolos: chars.map(([c]) => c),
          conceitos: tags.map(([t]) => t),
          quantidade: 3,
          onToken: (t) => {
            stream.textContent = t.slice(-600);
            stream.scrollTop = stream.scrollHeight;
          }
        });
        for (const l of licoes) licoesTemporarias[l.id] = l;
        viewRevisao();
      } catch (err) {
        stream.textContent = 'Falhou: ' + err.message;
        btn.disabled = false;
        btn.textContent = 'Tentar de novo';
      }
    };
  }
}

async function escolherModelo() {
  const salvo = store.getState().settings.modelo;
  if (salvo) return salvo;
  try {
    const modelos = await listarModelos();
    if (!modelos.length) {
      alert('Nenhum modelo encontrado no Ollama.');
      return null;
    }
    store.setSetting('modelo', modelos[0].nome);
    return modelos[0].nome;
  } catch (err) {
    alert('Ollama indisponivel: ' + err.message);
    return null;
  }
}

/* ------------------------------ ESTATISTICAS ------------------------------ */

function viewStats() {
  const s = store.getState();
  const r = store.resumo();
  const { chars, tags } = store.piores(12);
  const nivel = store.nivelDe(s.profile.xp);
  const hist = s.historico.slice(-40);

  const maxErro = chars.length ? chars[0][1] : 1;

  app.innerHTML = `
    <section class="hero pequeno">
      <h1>Suas estatisticas</h1>
      <p>Nivel ${nivel.nivel} · ${s.profile.xp} XP · ${s.profile.streak} dias de streak</p>
    </section>

    <div class="cards-stats">
      <div class="card stat"><span>${r.sessoes}</span><small>sessoes</small></div>
      <div class="card stat"><span>${Math.round(r.wpmMedio)}</span><small>WPM medio (30 ult.)</small></div>
      <div class="card stat"><span>${pct(r.accMedia || 0)}</span><small>precisao media</small></div>
      <div class="card stat"><span>${r.chars.toLocaleString('pt-BR')}</span><small>caracteres digitados</small></div>
      <div class="card stat"><span>${Math.round(r.minutos)}</span><small>minutos de treino</small></div>
    </div>

    <div class="painel-duplo">
      <div class="card painel">
        <h3>Evolucao</h3>
        ${hist.length > 1 ? grafico(hist) : '<p class="vazio">Complete pelo menos duas licoes para ver o grafico.</p>'}
        <div class="legenda"><span class="l-wpm">WPM</span><span class="l-acc">precisao</span></div>
      </div>

      <div class="card painel">
        <h3>Heatmap de erros por caractere</h3>
        ${
          chars.length
            ? `<div class="heat">${chars
                .map(
                  ([c, q]) =>
                    `<div class="heat-cell" style="--i:${q / maxErro}"><code>${esc(
                      c === ' ' ? '␣' : c
                    )}</code><b>${q}</b></div>`
                )
                .join('')}</div>`
            : '<p class="vazio">Nenhum erro registrado ainda.</p>'
        }
        <h3>Conceitos com mais erros</h3>
        ${
          tags.length
            ? `<div class="chips">${tags.map(([t, q]) => `<span class="chip">${esc(t)}<b>${q}</b></span>`).join('')}</div>`
            : '<p class="vazio">—</p>'
        }
      </div>
    </div>

    <div class="card painel">
      <h3>Conquistas</h3>
      <div class="badges">
        ${store
          .todasBadges()
          .map((b) => {
            const tem = s.profile.badges.includes(b.id);
            return `<div class="badge ${tem ? 'ativa' : ''}"><i>${esc(b.icone)}</i>${esc(b.nome)}</div>`;
          })
          .join('')}
      </div>
    </div>

    <div class="zona-perigo">
      <button class="btn perigo" id="btn-reset">Apagar todo o progresso</button>
    </div>`;

  document.getElementById('btn-reset').onclick = () => {
    if (!confirm('Isso apaga XP, progresso, estatisticas e modulos gerados. Continuar?')) return;
    store.resetAll();
    renderHeader();
    viewStats();
  };
}

function grafico(hist) {
  const w = 560;
  const h = 180;
  const pad = 28;
  const n = hist.length;
  const maxWpm = Math.max(50, ...hist.map((x) => x.wpm));

  const px = (i) => pad + (i * (w - pad * 2)) / Math.max(1, n - 1);
  const pyWpm = (v) => h - pad - (v / maxWpm) * (h - pad * 2);
  const pyAcc = (v) => h - pad - v * (h - pad * 2);

  const linha = (fn, key) => hist.map((x, i) => `${i ? 'L' : 'M'}${px(i).toFixed(1)},${fn(x[key]).toFixed(1)}`).join(' ');

  return `<svg class="gr" viewBox="0 0 ${w} ${h}" role="img" aria-label="evolucao">
    <line x1="${pad}" y1="${h - pad}" x2="${w - pad}" y2="${h - pad}" class="eixo" />
    <line x1="${pad}" y1="${pad}" x2="${pad}" y2="${h - pad}" class="eixo" />
    <path d="${linha(pyAcc, 'acc')}" class="serie acc" />
    <path d="${linha(pyWpm, 'wpm')}" class="serie wpm" />
  </svg>`;
}

/* ------------------------------ CONFIGURACOES ----------------------------- */

const MODOS = {
  estrito: 'Estrito — trava no caractere errado ate voce acertar',
  livre: 'Livre — marca o erro em vermelho e segue em frente',
  rigoroso: 'Rigoroso — qualquer erro reinicia o trecho do zero'
};

function linhaConfig({ id, titulo, descricao, controle }) {
  return `
    <div class="config-linha">
      <div class="config-texto">
        <label for="${id}">${esc(titulo)}</label>
        <p>${descricao}</p>
      </div>
      <div class="config-controle">${controle}</div>
    </div>`;
}

function interruptor(id, ligado) {
  return `<button class="switch ${ligado ? 'on' : ''}" id="${id}" role="switch"
    aria-checked="${ligado}"><span></span></button>`;
}

function viewConfig() {
  const c = store.getState().settings;
  const metaGlobal = typeof c.metaPrecisao === 'number';

  app.innerHTML = `
    <section class="hero pequeno">
      <h1>Configuracoes</h1>
      <p>Tudo vale na hora — nao precisa recarregar. Fica salvo neste navegador.</p>
    </section>

    <div class="card painel">
      <h3>Progressao</h3>
      ${linhaConfig({
        id: 'c-liberar',
        titulo: 'Liberar todas as licoes',
        descricao:
          'Ignora o desbloqueio encadeado e abre o modulo inteiro. Util para treinar um assunto especifico sem refazer o caminho.',
        controle: interruptor('c-liberar', c.liberarTudo)
      })}
      ${linhaConfig({
        id: 'c-meta',
        titulo: 'Meta de precisao',
        descricao:
          'Cada licao traz a propria meta (92% a 97%). Aqui voce sobrescreve todas de uma vez — para baixo, se estiver travado; para 100%, se quiser perfeicao.',
        controle: `
          <div class="meta-controle">
            <select id="c-meta">
              <option value="auto" ${metaGlobal ? '' : 'selected'}>meta de cada licao</option>
              <option value="0.85" ${c.metaPrecisao === 0.85 ? 'selected' : ''}>85% — treino solto</option>
              <option value="0.9" ${c.metaPrecisao === 0.9 ? 'selected' : ''}>90%</option>
              <option value="0.95" ${c.metaPrecisao === 0.95 ? 'selected' : ''}>95%</option>
              <option value="0.98" ${c.metaPrecisao === 0.98 ? 'selected' : ''}>98%</option>
              <option value="1" ${c.metaPrecisao === 1 ? 'selected' : ''}>100% — zero erro</option>
            </select>
          </div>`
      })}
    </div>

    <div class="card painel">
      <h3>Digitacao</h3>
      ${linhaConfig({
        id: 'c-modo',
        titulo: 'Modo de correcao',
        descricao: 'O mesmo seletor que aparece dentro da licao.',
        controle: `<select id="c-modo">${Object.entries(MODOS)
          .map(([v, t]) => `<option value="${v}" ${c.modo === v ? 'selected' : ''}>${esc(t)}</option>`)
          .join('')}</select>`
      })}
      ${linhaConfig({
        id: 'c-indent',
        titulo: 'Indentacao automatica',
        descricao:
          'Ao pressionar Enter, os espacos do inicio da proxima linha sao preenchidos sozinhos e nao contam nas metricas. Desligue para digitar cada espaco na mao.',
        controle: interruptor('c-indent', c.autoIndent)
      })}
      ${linhaConfig({
        id: 'c-som',
        titulo: 'Som no erro',
        descricao: 'Um bip curto a cada tecla errada.',
        controle: interruptor('c-som', c.som)
      })}
      ${linhaConfig({
        id: 'c-explicar',
        titulo: 'Abrir a explicacao antes de digitar',
        descricao: 'Deixa o bloco "Entenda antes de digitar" aberto ao entrar na licao.',
        controle: interruptor('c-explicar', c.explicarAntes)
      })}
      ${linhaConfig({
        id: 'c-fonte',
        titulo: 'Tamanho do codigo',
        descricao: 'Fonte do editor, em pixels.',
        controle: `<div class="meta-controle">
          <input type="range" id="c-fonte" min="12" max="24" step="1" value="${c.tamanhoFonte}" />
          <output id="c-fonte-val">${c.tamanhoFonte}px</output>
        </div>`
      })}
      <div class="config-demo">
        <div class="code-surface" id="demo-fonte"><div class="code-line"><span class="gutter">1</span><span class="ch tok-kw certo">val</span><span class="ch sp certo"> </span><span class="ch tok-id certo">meta</span><span class="ch tok-op certo">:</span><span class="ch sp certo"> </span><span class="ch tok-type certo">Double</span><span class="ch sp certo"> </span><span class="ch tok-op atual">=</span><span class="ch sp"> </span><span class="ch tok-num">0.97</span></div></div>
      </div>
    </div>

    <div class="card painel">
      <h3>Seus dados</h3>
      <p class="mini">
        Progresso, XP e estatisticas ficam no localStorage deste navegador. Modulos gerados e unidades
        acrescentadas tambem vao para a pasta <code>data/</code> ao lado do servidor.
      </p>
      <div class="config-acoes">
        <button class="btn" id="c-exportar">Exportar backup (.json)</button>
        <button class="btn" id="c-importar">Importar backup</button>
        <input type="file" id="c-arquivo" accept="application/json,.json" hidden />
        <button class="btn perigo" id="c-reset">Apagar todo o progresso</button>
      </div>
      <p class="dica" id="c-aviso"></p>
    </div>`;

  /* ----------------------------- ligacoes ------------------------------- */

  const aviso = document.getElementById('c-aviso');

  const ligarInterruptor = (id, chave, aoMudar) => {
    const el = document.getElementById(id);
    el.onclick = () => {
      const novo = !el.classList.contains('on');
      el.classList.toggle('on', novo);
      el.setAttribute('aria-checked', String(novo));
      store.setSetting(chave, novo);
      if (aoMudar) aoMudar(novo);
    };
  };

  ligarInterruptor('c-liberar', 'liberarTudo');
  ligarInterruptor('c-indent', 'autoIndent');
  ligarInterruptor('c-som', 'som');
  ligarInterruptor('c-explicar', 'explicarAntes');

  document.getElementById('c-meta').onchange = (e) => {
    const v = e.target.value;
    store.setSetting('metaPrecisao', v === 'auto' ? null : Number(v));
  };

  document.getElementById('c-modo').onchange = (e) => store.setSetting('modo', e.target.value);

  const fonte = document.getElementById('c-fonte');
  fonte.oninput = () => {
    const px = Number(fonte.value);
    document.getElementById('c-fonte-val').textContent = px + 'px';
    store.setSetting('tamanhoFonte', px);
    aplicarTamanhoFonte();
  };

  document.getElementById('c-exportar').onclick = () => {
    const blob = new Blob([store.exportar()], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `codetype-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    aviso.textContent = 'Backup baixado.';
  };

  const arquivo = document.getElementById('c-arquivo');
  document.getElementById('c-importar').onclick = () => arquivo.click();
  arquivo.onchange = async () => {
    const f = arquivo.files && arquivo.files[0];
    if (!f) return;
    try {
      const resumo = store.importar(await f.text());
      MODULOS = await carregarModulos();
      aplicarTamanhoFonte();
      renderHeader();
      viewConfig(); // redesenha com os valores importados...
      // ...e so entao escreve o aviso, senao ele morre junto com o DOM antigo
      document.getElementById(
        'c-aviso'
      ).textContent = `Importado: ${resumo.licoes} licoes, ${resumo.xp} XP, ${resumo.modulos} modulos gerados.`;
    } catch (err) {
      aviso.textContent = 'Falhou: ' + err.message;
    }
  };

  document.getElementById('c-reset').onclick = () => {
    if (!confirm('Isso apaga XP, progresso, estatisticas e modulos gerados. Continuar?')) return;
    store.resetAll();
    aplicarTamanhoFonte();
    renderHeader();
    viewConfig();
  };
}

function aplicarTamanhoFonte() {
  document.documentElement.style.setProperty('--code-size', store.getState().settings.tamanhoFonte + 'px');
}

/* ------------------------------- GERADOR IA ------------------------------- */

/**
 * Duas operacoes na mesma tela:
 *  - criar um modulo novo do zero;
 *  - acrescentar uma unidade ao fim de um modulo que ja existe (inclusive o
 *    Kotlin embutido, via extensoes).
 * moduloAlvo pre-seleciona o segundo modo, vindo de #/lab/<moduloId>.
 */
async function viewLab(moduloAlvo) {
  const s = store.getState();
  const modo = moduloAlvo ? 'anexar' : 'novo';

  const niveis = `
    <option value="iniciante absoluto">iniciante absoluto</option>
    <option value="iniciante" selected>iniciante</option>
    <option value="intermediario">intermediario</option>
    <option value="avancado">avancado</option>`;

  app.innerHTML = `
    <section class="hero pequeno">
      <h1>Gerador de conteudo</h1>
      <p>Os modelos que ja estao na sua maquina escrevem novas licoes — sem nuvem, sem chave de API.</p>
    </section>

    <div class="card painel lab">
      <div class="abas">
        <button class="aba ${modo === 'novo' ? 'ativa' : ''}" data-modo="novo">Modulo novo</button>
        <button class="aba ${modo === 'anexar' ? 'ativa' : ''}" data-modo="anexar">Acrescentar unidade</button>
      </div>

      <label class="campo-largo">Modelo local
        <select id="f-modelo"><option>carregando...</option></select>
      </label>

      <div id="painel-novo" class="painel-modo" ${modo === 'novo' ? '' : 'hidden'}>
        <div class="form-grid">
          <label>Linguagem
            <input id="f-linguagem" value="Python" list="langs" />
            <datalist id="langs">
              <option>Python</option><option>JavaScript</option><option>TypeScript</option>
              <option>Java</option><option>C#</option><option>Go</option><option>SQL</option>
              <option>Rust</option><option>Swift</option><option>Dart</option>
            </datalist>
          </label>
          <label>Foco (opcional)
            <input id="f-foco" placeholder="ex.: automacao, backend, data science" />
          </label>
          <label>Nivel <select id="f-nivel">${niveis}</select></label>
          <label>Unidades <input id="f-unidades" type="number" min="1" value="4" /></label>
          <label>Licoes por unidade <input id="f-licoes" type="number" min="2" value="3" /></label>
          <label title="Quantas unidades sao pedidas ao mesmo tempo. So acelera de verdade se o Ollama aceitar mais de uma requisicao por vez (OLLAMA_NUM_PARALLEL) ou tiver GPU sobrando; sem isso, mais paralelismo so faz as requisicoes enfileirarem do mesmo jeito.">
            Unidades em paralelo <input id="f-paralelo" type="number" min="1" value="1" />
          </label>
        </div>
      </div>

      <div id="painel-anexar" class="painel-modo" ${modo === 'anexar' ? '' : 'hidden'}>
        <div class="form-grid">
          <label>Modulo de destino
            <select id="a-modulo">
              ${MODULOS.map(
                (m) =>
                  `<option value="${esc(m.id)}" ${m.id === moduloAlvo ? 'selected' : ''}>${esc(m.name)} (${
                    m.units.length
                  } unidades)</option>`
              ).join('')}
            </select>
          </label>
          <label>Tema da unidade
            <input id="a-tema" list="temas" placeholder="ex.: Testes com JUnit" />
            <datalist id="temas">
              ${temasDisponiveis.map((t) => `<option>${esc(t)}</option>`).join('')}
            </datalist>
          </label>
          <label>Nivel <select id="a-nivel">${niveis}</select></label>
          <label>Licoes <input id="a-licoes" type="number" min="2" value="4" /></label>
        </div>
        <label class="campo-largo">O que a unidade deve cobrir (opcional)
          <input id="a-detalhe" placeholder="ex.: @Test, assertEquals, mock de repositorio, teste de ViewModel com coroutines" />
        </label>
        <p class="dica" id="a-info"></p>
      </div>

      <div class="lab-acoes">
        <button class="btn primario" id="btn-gerar">Gerar</button>
        <button class="btn perigo" id="btn-cancelar" hidden>Cancelar</button>
        <span class="dica" id="lab-status">
          Sem limite de unidades, licoes ou tamanho de resposta — cada unidade e pedida em blocos de ate 6 licoes por
          vez, entao um modulo grande vira varias requisicoes menores em sequencia (ou em paralelo, se voce aumentar
          "Unidades em paralelo"), no ritmo que a sua maquina aguentar. Em CPU, conte ~2 a 4 minutos por bloco — o
          resultado aparece aqui conforme fica pronto. Um bloco que falhar ganha uma segunda tentativa automatica
          antes de ser descartado.
        </span>
      </div>

      <div id="lab-etapas" class="etapas" hidden></div>
      <div class="stream" id="lab-stream" hidden></div>
      <div id="lab-preview"></div>
    </div>`;

  /* --------------------------- estado da tela ---------------------------- */

  let modoAtual = modo;
  const sel = document.getElementById('f-modelo');
  const btn = document.getElementById('btn-gerar');
  const btnCancelar = document.getElementById('btn-cancelar');
  const stream = document.getElementById('lab-stream');
  const etapas = document.getElementById('lab-etapas');
  const status = document.getElementById('lab-status');
  const preview = document.getElementById('lab-preview');

  const atualizarInfoAnexo = () => {
    const alvo = moduloPorId(document.getElementById('a-modulo').value);
    const info = document.getElementById('a-info');
    if (!alvo) return;
    info.textContent = `A unidade entra como "Unidade ${alvo.units.length + 1}" no fim de ${alvo.name}, em ${languageLabel(
      alvo.language
    )}. O modelo recebe a lista de temas ja cobertos para nao repetir.`;
  };

  app.querySelectorAll('.aba').forEach((aba) => {
    aba.onclick = () => {
      modoAtual = aba.dataset.modo;
      app.querySelectorAll('.aba').forEach((x) => x.classList.toggle('ativa', x === aba));
      document.getElementById('painel-novo').hidden = modoAtual !== 'novo';
      document.getElementById('painel-anexar').hidden = modoAtual !== 'anexar';
      preview.innerHTML = '';
      etapas.hidden = true;
      stream.hidden = true;
    };
  });

  if (MODULOS.length) {
    document.getElementById('a-modulo').onchange = atualizarInfoAnexo;
    atualizarInfoAnexo();
  }

  /* ------------------------------ modelos -------------------------------- */

  // qwen2.5-coder e especializado em geracao de codigo (bom equilibrio entre
  // qualidade e velocidade em CPU); qwen3-coder tambem conta como recomendado
  // para quem ja tem ele. Marcamos visualmente e preferimos como padrao
  // quando o usuario ainda nao escolheu um modelo manualmente.
  const ehModeloRecomendado = (nome) => /qwen2\.5-coder|qwen3-coder/i.test(nome);

  try {
    const modelos = await listarModelos();
    const recomendado = modelos.find((m) => ehModeloRecomendado(m.nome));
    sel.innerHTML = modelos
      .map((m) => {
        const marcado = ehModeloRecomendado(m.nome);
        const selecionado = s.settings.modelo ? m.nome === s.settings.modelo : m === recomendado;
        return `<option value="${esc(m.nome)}" ${selecionado ? 'selected' : ''}>${esc(m.nome)} (${(
          m.tamanho / 1e9
        ).toFixed(1)} GB)${marcado ? ' — recomendado p/ codigo' : ''}</option>`;
      })
      .join('');
    if (!s.settings.modelo) {
      const escolhido = recomendado || modelos[0];
      if (escolhido) store.setSetting('modelo', escolhido.nome);
    }
    if (!recomendado) {
      status.textContent =
        'Dica: qwen2.5-coder e especializado em codigo e roda bem em CPU. Para instalar: "ollama pull qwen2.5-coder:7b" ' +
        '(maquinas mais simples) ou "ollama pull qwen2.5-coder:14b" (se sua maquina ja aguenta modelos de ~12b-14b).';
    }
  } catch (err) {
    sel.innerHTML = '<option>indisponivel</option>';
    status.textContent = 'Ollama indisponivel: ' + err.message;
  }
  sel.onchange = () => store.setSetting('modelo', sel.value);

  /* ------------------------------ geracao -------------------------------- */

  btn.onclick = async () => {
    const controle = new AbortController();
    const t0 = Date.now();
    const decorrido = () => Math.round((Date.now() - t0) / 1000);
    const linhasEtapa = [];

    const pintarEtapas = () => {
      etapas.innerHTML = linhasEtapa
        .map((e) => `<div class="etapa ${e.estado}"><span>${esc(e.texto)}</span><small>${esc(e.info)}</small></div>`)
        .join('');
    };

    btn.disabled = true;
    btn.textContent = 'Gerando...';
    btnCancelar.hidden = false;
    btnCancelar.onclick = () => controle.abort();
    preview.innerHTML = '';
    etapas.hidden = false;
    etapas.innerHTML = '';
    stream.hidden = false;
    stream.textContent = 'enviando o primeiro prompt para ' + sel.value + '...';

    const acompanharTokens = (t, ui) => {
      status.textContent = `${t.length} caracteres nesta unidade · ${decorrido()}s no total`;
      stream.textContent = t.slice(-900);
      stream.scrollTop = stream.scrollHeight;
      // com paralelismo > 1 varias unidades escrevem ao mesmo tempo: a caixa
      // de stream so mostra a mais recente, mas cada etapa ganha seu proprio
      // contador de caracteres para o progresso continuar visivel em todas
      if (typeof ui === 'number' && linhasEtapa[ui] && linhasEtapa[ui].estado === 'ativa') {
        linhasEtapa[ui].info = `${t.length} caracteres · ${decorrido()}s`;
        pintarEtapas();
      }
    };

    try {
      if (modoAtual === 'novo') {
        const modulo = await gerarModulo({
          modelo: sel.value,
          linguagem: document.getElementById('f-linguagem').value.trim() || 'Python',
          foco: document.getElementById('f-foco').value.trim(),
          nivel: document.getElementById('f-nivel').value,
          unidades: Number(document.getElementById('f-unidades').value),
          licoes: Number(document.getElementById('f-licoes').value),
          paralelismo: Number(document.getElementById('f-paralelo').value) || 1,
          signal: controle.signal,
          onEtapa: (i, total, titulo) => {
            // "descartada" so acontece depois da segunda tentativa (o cliente
            // ja tenta de novo uma vez sozinho); ate la a etapa continua
            // "ativa", so a mensagem de status muda
            const descartada = /descartada/.test(titulo);
            if (linhasEtapa[i]) {
              linhasEtapa[i].estado = descartada ? 'falhou' : 'ativa';
              linhasEtapa[i].info = titulo;
            } else {
              linhasEtapa[i] = { texto: `Unidade ${i + 1}/${total} — ${titulo}`, info: 'gerando...', estado: 'ativa' };
            }
            pintarEtapas();
          },
          onUnidade: (unidade, i) => {
            linhasEtapa[i] = {
              texto: unidade.title,
              info: `${unidade.lessons.length} licoes · ${decorrido()}s`,
              estado: 'pronta'
            };
            pintarEtapas();
          },
          onToken: acompanharTokens
        });

        stream.hidden = true;
        mostrarPreviewModulo(modulo, decorrido());
      } else {
        const alvo = moduloPorId(document.getElementById('a-modulo').value);
        const tema = document.getElementById('a-tema').value.trim();
        if (!alvo) throw new Error('escolha um modulo de destino');
        if (!tema) throw new Error('escreva o tema da unidade');

        linhasEtapa[0] = { texto: `${alvo.name} — ${tema}`, info: 'gerando...', estado: 'ativa' };
        pintarEtapas();

        const unidade = await gerarUnidade({
          modelo: sel.value,
          modulo: alvo,
          tema,
          detalhe: document.getElementById('a-detalhe').value.trim(),
          nivel: document.getElementById('a-nivel').value,
          licoes: Number(document.getElementById('a-licoes').value),
          signal: controle.signal,
          onToken: acompanharTokens
        });

        linhasEtapa[0] = {
          texto: unidade.title,
          info: `${unidade.lessons.length} licoes · ${decorrido()}s`,
          estado: 'pronta'
        };
        pintarEtapas();
        stream.hidden = true;
        mostrarPreviewUnidade(alvo, unidade, decorrido());
      }
    } catch (err) {
      const cancelado = err.name === 'AbortError';
      status.textContent = cancelado ? 'Geracao cancelada.' : 'Falhou: ' + err.message;
      if (!cancelado) stream.textContent += '\n\nERRO: ' + err.message;
    } finally {
      btn.disabled = false;
      btn.textContent = 'Gerar';
      btnCancelar.hidden = true;
    }
  };

  /* ------------------------------ previews ------------------------------- */

  function listaDeLicoes(lessons) {
    return `<ul>${lessons.map((l) => `<li>${esc(l.title)} <span class="mini">${esc(l.brief || '')}</span></li>`).join('')}</ul>`;
  }

  function mostrarPreviewModulo(modulo, segundos) {
    const total = todasLicoes(modulo).length;
    preview.innerHTML = `
      <div class="preview">
        <h3>${esc(modulo.name)}</h3>
        <p>${esc(modulo.description)}</p>
        <p class="mini">${modulo.units.length} unidades · ${total} licoes · ${esc(
      languageLabel(modulo.language)
    )} · gerado em ${segundos}s</p>
        <ol class="preview-lista">
          ${modulo.units.map((u) => `<li><b>${esc(u.title)}</b>${listaDeLicoes(u.lessons)}</li>`).join('')}
        </ol>
        <button class="btn primario" id="btn-salvar">Salvar e abrir modulo</button>
      </div>`;

    document.getElementById('btn-salvar').onclick = async () => {
      store.adicionarModulo(modulo);
      await fetch('/api/modules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(modulo)
      }).catch(() => {});
      salvarCopiaEmCursosGerados(modulo);
      MODULOS = await carregarModulos();
      location.hash = '#/modulo/' + modulo.id;
    };
  }

  function mostrarPreviewUnidade(alvo, unidade, segundos) {
    preview.innerHTML = `
      <div class="preview">
        <h3>${esc(unidade.title)}</h3>
        <p>${esc(unidade.subtitle || '')}</p>
        <p class="mini">${unidade.lessons.length} licoes · vai para o fim de ${esc(alvo.name)} · gerada em ${segundos}s</p>
        <div class="preview-lista">${listaDeLicoes(unidade.lessons)}</div>
        <div class="modal-acoes" style="justify-content:flex-start">
          <button class="btn primario" id="btn-anexar">Adicionar ao modulo</button>
          <button class="btn fantasma" id="btn-descartar">Descartar</button>
        </div>
      </div>`;

    document.getElementById('btn-descartar').onclick = () => {
      preview.innerHTML = '';
      status.textContent = 'Unidade descartada.';
    };

    document.getElementById('btn-anexar').onclick = async () => {
      store.adicionarExtensao(alvo.id, unidade);
      await fetch('/api/extensions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ moduloId: alvo.id, unidade })
      }).catch(() => {});
      salvarCopiaEmCursosGerados({ ...alvo, units: [...alvo.units, unidade] });
      MODULOS = await carregarModulos();
      location.hash = '#/modulo/' + alvo.id;
    };
  }
}

/* --------------------------------- ROTEADOR ------------------------------- */

function limpar() {
  if (engineAtual) {
    engineAtual.destroy();
    engineAtual = null;
  }
  if (tecladoProprioAtual) {
    tecladoProprioAtual.destroy();
    tecladoProprioAtual = null;
  }
  if (app._onEsc) {
    document.removeEventListener('keydown', app._onEsc);
    app._onEsc = null;
  }
  const overlay = document.getElementById('overlay');
  if (overlay && overlay._onEnter) document.removeEventListener('keydown', overlay._onEnter);

  if (app._vvHandler && window.visualViewport) {
    window.visualViewport.removeEventListener('resize', app._vvHandler);
    window.visualViewport.removeEventListener('scroll', app._vvHandler);
    app._vvHandler = null;
  }
  document.body.classList.remove('teclado-aberto');
}

function rotear() {
  limpar();
  renderHeader();
  window.scrollTo(0, 0);

  const partes = location.hash.replace(/^#\/?/, '').split('/').filter(Boolean);
  const [rota, a, b] = partes;

  if (rota === 'modulo' && a) return viewModulo(decodeURIComponent(a));
  if (rota === 'licao' && a && b) return viewLicao(decodeURIComponent(a), decodeURIComponent(b));
  if (rota === 'stats') return viewStats();
  if (rota === 'config') return viewConfig();
  if (rota === 'lab') return viewLab(a ? decodeURIComponent(a) : null);
  if (rota === 'revisao') return viewRevisao();
  return viewHome();
}

async function iniciar() {
  aplicarTamanhoFonte();
  MODULOS = await carregarModulos();
  window.addEventListener('hashchange', rotear);
  rotear();
}

iniciar();
