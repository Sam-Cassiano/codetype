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
    if (this._onClick) this.container.removeEventListener('click', this._onClick);
    if (this._input) {
      this._input.removeEventListener('beforeinput', this._onBeforeInput);
      this._input.removeEventListener('input', this._onInput);
      this._input.removeEventListener('compositionstart', this._onCompositionStart);
      this._input.removeEventListener('compositionend', this._onCompositionEnd);
      if (this._input.parentNode) this._input.remove();
    }
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
    // Campo invisivel que recebe o teclado virtual. No desktop a digitacao
    // chega por keydown; no celular o teclado do Android manda keydown com
    // key === 'Unidentified', entao o caminho real e o beforeinput.
    const input = document.createElement('input');
    input.className = 'ghost-input';
    input.type = 'text';
    input.setAttribute('aria-label', 'area de digitacao');
    input.setAttribute('autocapitalize', 'none');
    input.setAttribute('autocorrect', 'off');
    input.setAttribute('autocomplete', 'off');
    input.setAttribute('enterkeyhint', 'enter');
    // pede pro navegador nao abrir o teclado nativo ao focar este campo — no
    // celular quem digita e o teclado proprio do app (ver keyboard.js). Se
    // algum navegador ignorar essa dica (aconteceu historicamente em versoes
    // antigas do iOS Safari) o pior caso e o teclado nativo aparecer TAMBEM:
    // a digitacao continua correta porque o tratamento de composicao do IME
    // (compositionstart/end + beforeinput) abaixo continua ativo como rede de
    // seguranca, exatamente como antes desta tela ter um teclado proprio.
    input.setAttribute('inputmode', 'none');
    input.spellcheck = false;
    this.container.appendChild(input);
    this._input = input;

    this._ultimaTeclaFisica = 0;

    this._onKey = (e) => this._handleKey(e);
    document.addEventListener('keydown', this._onKey, true);

    this._onBeforeInput = (e) => this._handleBeforeInput(e);
    input.addEventListener('beforeinput', this._onBeforeInput);

    // Muitos teclados de celular (Gboard, Samsung Keyboard) tratam digitacao
    // comum como uma "composicao" do IME, mesmo com autocorrect desligado —
    // e o beforeinput de insertCompositionText manda o texto ACUMULADO da
    // composicao a cada tecla, nao so o caractere novo. compositionstart/end
    // marcam o inicio/fim dessa sessao; _compBase guarda o que ja foi
    // consumido para so digitar a diferenca (ver _processarComposicao).
    this._compBase = null;
    this._ultimoCommitComposicao = 0;

    this._onCompositionStart = () => {
      this._compBase = '';
    };
    this._onCompositionEnd = (e) => {
      this._processarComposicao(e.data || this._compBase || '');
      this._compBase = null;
      this._ultimoCommitComposicao = performance.now();
      input.value = '';
    };
    input.addEventListener('compositionstart', this._onCompositionStart);
    input.addEventListener('compositionend', this._onCompositionEnd);

    // rede de seguranca: se algum teclado ignorar o preventDefault, o texto
    // que sobrar no campo e consumido aqui e o campo volta a ficar vazio.
    // Isso SEMPRE acontece durante uma composicao (o preventDefault do
    // beforeinput nao tem efeito nesse caso, por especificacao) — por isso
    // ignora enquanto ainda esta compondo ou logo depois de um commit, que
    // ja foi tratado por _processarComposicao/_onCompositionEnd.
    this._onInput = () => {
      const texto = input.value;
      if (!texto) return;
      input.value = '';
      if (this._compBase !== null) return;
      if (performance.now() - this._ultimoCommitComposicao < 300) return;
      if (this._recemProcessado()) return;
      for (const ch of texto) this._digitar(ch);
    };
    input.addEventListener('input', this._onInput);

    this._onClick = () => this.focus();
    this.container.addEventListener('click', this._onClick);
  }

  _recemProcessado() {
    return performance.now() - this._ultimaTeclaFisica < 60;
  }

  _handleBeforeInput(e) {
    if (this.finalizado) return;
    if (e.cancelable) e.preventDefault();

    const tipo = e.inputType;

    // composicao do IME: nao depende do guard de 60ms (e um caminho so de
    // celular, nao colide com o keydown do desktop)
    if (tipo === 'insertCompositionText') {
      this._processarComposicao(e.data || '');
      return;
    }

    if (this._recemProcessado()) return; // o keydown do desktop ja cuidou

    if (tipo === 'deleteContentBackward' || tipo === 'deleteWordBackward') {
      if (this._compBase !== null) {
        // apagando dentro de uma composicao ainda ativa: a proxima
        // insertCompositionText vai refletir o texto encolhido
        return;
      }
      this._voltar();
      return;
    }
    if (tipo === 'insertLineBreak' || tipo === 'insertParagraph') {
      this._finalizarComposicaoPendente();
      this._digitar('\n');
      return;
    }
    if (tipo === 'insertText' || tipo === 'insertFromPaste' || tipo === 'insertReplacementText') {
      if (this._compBase !== null) {
        // commit de uma composicao chegando como insertText: processa so a
        // diferenca — o compositionend (se disparar depois) fica um no-op
        this._processarComposicao(e.data || '');
        return;
      }
      for (const ch of e.data || '') this._digitar(ch === '\n' ? '\n' : ch);
    }
  }

  _finalizarComposicaoPendente() {
    if (this._compBase === null) return;
    this._compBase = null;
    this._ultimoCommitComposicao = performance.now();
  }

  /**
   * Processa um evento de composicao do IME. O navegador manda o texto
   * ACUMULADO da composicao a cada tecla (ex.: 'c', depois 'co', depois
   * 'con'), entao comparamos com o que ja foi consumido (_compBase) e so
   * digitamos a diferenca — do contrario cada tecla reprocessaria tudo de
   * novo, contando erros falsos e duplicando caracteres. Tambem cobre o caso
   * de autocorrecao reescrever o meio da composicao (ex.: 'teh' -> 'the').
   */
  _processarComposicao(atual) {
    const anterior = this._compBase || '';
    this._compBase = atual;

    if (atual.startsWith(anterior)) {
      for (const ch of atual.slice(anterior.length)) this._digitar(ch === '\n' ? '\n' : ch);
      return;
    }

    let comuns = 0;
    while (comuns < anterior.length && comuns < atual.length && anterior[comuns] === atual[comuns]) comuns++;
    for (let i = anterior.length; i > comuns; i--) this._voltar();
    for (const ch of atual.slice(comuns)) this._digitar(ch === '\n' ? '\n' : ch);
  }

  /** Entrada por toque (barra de simbolos), tratada como digitacao normal. */
  digitar(ch) {
    if (this.finalizado) return;
    this._ultimaTeclaFisica = performance.now();
    this._digitar(ch);
  }

  apagar() {
    if (this.finalizado) return;
    this._ultimaTeclaFisica = performance.now();
    this._voltar();
  }

  focus() {
    if (this._input) this._input.focus({ preventScroll: true });
  }

  get focado() {
    return document.activeElement === this._input;
  }

  _handleKey(e) {
    if (this.finalizado) return;
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.target && (e.target.tagName === 'TEXTAREA' || (e.target.tagName === 'INPUT' && e.target !== this._input))) return;

    const k = e.key;
    // teclado virtual do Android manda isso: quem resolve e o beforeinput
    if (k === 'Unidentified' || k === 'Process' || e.isComposing || e.keyCode === 229) return;

    if (k === 'Backspace') {
      e.preventDefault();
      this._ultimaTeclaFisica = performance.now();
      this._voltar();
      return;
    }
    if (k === 'Enter') {
      e.preventDefault();
      this._ultimaTeclaFisica = performance.now();
      this._digitar('\n');
      return;
    }
    if (k === 'Tab') {
      e.preventDefault();
      this._ultimaTeclaFisica = performance.now();
      // Tab so vale quando o proximo caractere realmente e um espaco
      if (WHITESPACE.test(this.code[this.pos] || '')) {
        while (WHITESPACE.test(this.code[this.pos] || '')) this._aceitar();
        this._depoisDeAvancar();
      }
      return;
    }
    if (k.length === 1) {
      e.preventDefault();
      this._ultimaTeclaFisica = performance.now();
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
