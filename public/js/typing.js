/*
 * Motor de digitacao de codigo.
 *
 * Regras principais:
 *  - comparacao caractere a caractere contra o trecho original;
 *  - a indentacao no inicio de cada linha e consumida automaticamente ao
 *    pressionar Enter (como um editor de verdade), e nao entra nas metricas;
 *  - modos: estrito (bloqueia ate acertar), livre (marca e segue),
 *    rigoroso (reinicia o trecho a cada erro).
 */

import { highlight } from './highlight.js';

const WHITESPACE = /[ \t]/;
const TAB = '\t';

export class TypingEngine {
  constructor(opts) {
    this.code = String(opts.code)
      .replace(/\r\n/g, '\n')
      .replace(/[ \t]+$/gm, '')
      .replace(/\s+$/, '');
    this.language = opts.language || 'kotlin';
    this.container = opts.container;
    this.modo = opts.modo || 'estrito';
    this.autoIndent = opts.autoIndent !== false;
    this.som = !!opts.som;
    this.onUpdate = opts.onUpdate || (() => {});
    this.onFinish = opts.onFinish || (() => {});

    this.spans = [];
    this.reset(true);
    this.render();
    this._bind();
  }

  /* -------------------------------- ciclo -------------------------------- */

  reset(silencioso) {
    this.pos = 0;
    this.corretos = 0;
    this.erros = 0;
    this.teclas = 0;
    this.errosPorChar = {};
    this.inicio = null;
    this.fim = null;
    this.finalizado = false;
    this.errosAbertos = new Set();
    if (!silencioso) {
      for (const s of this.spans) {
        s.className = s.dataset.base;
      }
      this._pularIndentacao(true);
      this._marcarCursor();
      this._emitir();
    }
  }

  destroy() {
    document.removeEventListener('keydown', this._onKey, true);
    if (this._input && this._input.parentNode) this._input.remove();
  }

  /* ------------------------------ renderizacao ---------------------------- */

  render() {
    const classes = highlight(this.code, this.language);
    const wrap = document.createElement('div');
    wrap.className = 'code-surface';

    let linha = this._novaLinha(wrap, 1);
    let numeroLinha = 1;
    this.spans = [];

    for (let i = 0; i < this.code.length; i++) {
      const ch = this.code[i];
      const span = document.createElement('span');
      // a classe base precisa carregar sp/nl: o resto do motor reescreve o
      // className inteiro a partir de dataset.base
      let base = 'ch ' + classes[i];
      if (ch === '\n') base += ' nl';
      else if (ch === ' ' || ch === '\t') base += ' sp';
      span.dataset.base = base;
      span.className = base;

      if (ch === '\n') {
        span.textContent = '¶';
        linha.appendChild(span);
        this.spans.push(span);
        numeroLinha++;
        linha = this._novaLinha(wrap, numeroLinha);
        continue;
      }

      span.textContent = ch === TAB ? '    ' : ch;

      linha.appendChild(span);
      this.spans.push(span);
    }

    this.container.innerHTML = '';
    this.container.appendChild(wrap);
    this.surface = wrap;

    this._pularIndentacao(true);
    this._marcarCursor();
    this._emitir();
  }

  _novaLinha(wrap, numero) {
    const div = document.createElement('div');
    div.className = 'code-line';
    const gutter = document.createElement('span');
    gutter.className = 'gutter';
    gutter.textContent = String(numero);
    div.appendChild(gutter);
    wrap.appendChild(div);
    return div;
  }

  /* -------------------------------- teclado ------------------------------- */

  _bind() {
    // input invisivel apenas para abrir o teclado em telas touch
    const input = document.createElement('input');
    input.className = 'ghost-input';
    input.setAttribute('aria-hidden', 'true');
    input.autocapitalize = 'off';
    input.autocomplete = 'off';
    input.spellcheck = false;
    this.container.appendChild(input);
    this._input = input;

    this._onKey = (e) => this._handleKey(e);
    document.addEventListener('keydown', this._onKey, true);

    this.container.addEventListener('click', () => input.focus({ preventScroll: true }));
  }

  focus() {
    if (this._input) this._input.focus({ preventScroll: true });
  }

  _handleKey(e) {
    if (this.finalizado) return;
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.target && (e.target.tagName === 'TEXTAREA' || (e.target.tagName === 'INPUT' && e.target !== this._input))) return;

    const k = e.key;

    if (k === 'Backspace') {
      e.preventDefault();
      this._voltar();
      return;
    }
    if (k === 'Enter') {
      e.preventDefault();
      this._digitar('\n');
      return;
    }
    if (k === 'Tab') {
      e.preventDefault();
      // Tab so vale quando o proximo caractere realmente e um espaco
      if (WHITESPACE.test(this.code[this.pos] || '')) {
        while (WHITESPACE.test(this.code[this.pos] || '')) this._aceitar();
        this._depoisDeAvancar();
      }
      return;
    }
    if (k.length === 1) {
      e.preventDefault();
      this._digitar(k);
    }
  }

  /* ------------------------------- digitacao ------------------------------ */

  _digitar(ch) {
    if (this.inicio === null) this.inicio = performance.now();
    this.teclas++;

    const esperado = this.code[this.pos];
    if (esperado === undefined) return;

    if (ch === esperado) {
      this.errosAbertos.delete(this.pos);
      this._aceitar();
      this._depoisDeAvancar();
      return;
    }

    // ---- erro ----
    this.erros++;
    this.errosPorChar[esperado === '\n' ? '\\n' : esperado] =
      (this.errosPorChar[esperado === '\n' ? '\\n' : esperado] || 0) + 1;
    this._beep();

    if (this.modo === 'rigoroso') {
      this._flashErro();
      this._reiniciarTrecho();
      this._emitir();
      return;
    }

    if (this.modo === 'livre') {
      const span = this.spans[this.pos];
      span.className = span.dataset.base + ' errado';
      this.pos++;
      this._depoisDeAvancar();
      return;
    }

    // estrito: nao avanca, marca a posicao atual
    this.errosAbertos.add(this.pos);
    const span = this.spans[this.pos];
    span.className = span.dataset.base + ' errado atual';
    this._emitir();
  }

  _aceitar() {
    const span = this.spans[this.pos];
    const errou = this.errosAbertos.has(this.pos);
    span.className = span.dataset.base + (errou ? ' corrigido' : ' certo');
    this.corretos++;
    this.pos++;
  }

  _depoisDeAvancar() {
    if (this.code[this.pos - 1] === '\n') this._pularIndentacao(false);
    this._marcarCursor();

    if (this.pos >= this.code.length) {
      this._finalizar();
      return;
    }
    this._emitir();
  }

  // consome espacos do inicio da linha sem cobrar do usuario
  _pularIndentacao(inicial) {
    if (!this.autoIndent) return;
    if (inicial && this.pos !== 0) return;
    while (this.pos < this.code.length && WHITESPACE.test(this.code[this.pos])) {
      const span = this.spans[this.pos];
      span.className = span.dataset.base + ' auto';
      this.pos++;
    }
  }

  _voltar() {
    if (this.pos === 0) return;
    let alvo = this.pos - 1;
    // pula de volta a indentacao automatica ate um caractere realmente digitado
    while (alvo > 0 && this.spans[alvo].className.includes(' auto')) alvo--;

    for (let i = this.pos - 1; i >= alvo; i--) {
      const cls = this.spans[i].className;
      // indentacao automatica nunca entrou na contagem
      if (cls.includes(' certo') || cls.includes(' corrigido')) {
        this.corretos = Math.max(0, this.corretos - 1);
      }
      this.spans[i].className = this.spans[i].dataset.base;
    }
    this.errosAbertos.delete(this.pos);
    this.pos = alvo;
    this.errosAbertos.delete(this.pos);
    this._marcarCursor();
    this._emitir();
  }

  _reiniciarTrecho() {
    const errosSalvos = this.erros;
    const teclasSalvas = this.teclas;
    const errosChar = this.errosPorChar;
    const inicio = this.inicio;
    this.reset(true);
    for (const s of this.spans) s.className = s.dataset.base;
    this.erros = errosSalvos;
    this.teclas = teclasSalvas;
    this.errosPorChar = errosChar;
    this.inicio = inicio;
    this._pularIndentacao(true);
    this._marcarCursor();
  }

  _marcarCursor() {
    if (this._cursorAnterior !== undefined && this.spans[this._cursorAnterior]) {
      const s = this.spans[this._cursorAnterior];
      s.className = s.className.replace(' atual', '');
    }
    const span = this.spans[this.pos];
    if (span) {
      span.className += ' atual';
      this._cursorAnterior = this.pos;
      const linha = span.parentElement;
      if (linha && this.surface) {
        const topo = linha.offsetTop;
        const alturaVisivel = this.surface.parentElement.clientHeight;
        const scroll = this.surface.parentElement.scrollTop;
        if (topo < scroll + 40 || topo > scroll + alturaVisivel - 60) {
          this.surface.parentElement.scrollTop = topo - alturaVisivel / 2;
        }
      }
    }
  }

  _flashErro() {
    if (!this.container) return;
    this.container.classList.remove('shake');
    void this.container.offsetWidth;
    this.container.classList.add('shake');
  }

  _beep() {
    if (!this.som) return;
    try {
      const ctx = TypingEngine._audio || (TypingEngine._audio = new (window.AudioContext || window.webkitAudioContext)());
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'square';
      osc.frequency.value = 180;
      gain.gain.value = 0.05;
      osc.connect(gain).connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.06);
    } catch {
      /* audio indisponivel */
    }
  }

  /* -------------------------------- metricas ------------------------------ */

  metricas() {
    const digitados = this.teclas;
    const acc = digitados === 0 ? 1 : Math.max(0, (digitados - this.erros) / digitados);
    const segundos = this.inicio ? ((this.fim || performance.now()) - this.inicio) / 1000 : 0;
    const minutos = segundos / 60;
    // WPM padrao da industria: 5 caracteres = 1 palavra
    const wpm = minutos > 0 ? this.corretos / 5 / minutos : 0;
    return {
      acc,
      wpm: Math.round(wpm),
      segundos,
      chars: this.corretos,
      erros: this.erros,
      progresso: this.code.length ? this.pos / this.code.length : 0,
      errosPorChar: this.errosPorChar
    };
  }

  _emitir() {
    this.onUpdate(this.metricas());
  }

  _finalizar() {
    this.finalizado = true;
    this.fim = performance.now();
    const m = this.metricas();
    this.onUpdate(m);
    this.onFinish(m);
  }
}
