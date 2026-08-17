/*
 * Teclado proprio para celular.
 *
 * Substitui o teclado nativo do sistema por um teclado virtual desenhado
 * pelo app, com layout pensado pra codigo: digitos sempre visiveis, uma
 * pagina extra de simbolos comuns em programacao a um toque, e uma faixa com
 * os simbolos que a licao atual realmente usa (os que o teclado do celular
 * costuma esconder numa segunda camada).
 *
 * Alimenta o TypingEngine direto via onChar()/onApagar() (normalmente
 * engine.digitar/engine.apagar) — nenhum dos dois depende de foco em input
 * nenhum, entao o teclado funciona independente do <input> fantasma do
 * TypingEngine (que so existe pra capturar teclado fisico/bluetooth e, como
 * rede de seguranca, um eventual teclado nativo que apareca por engano).
 */

const LINHA_NUMEROS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'];

const LINHAS_LETRAS = [
  ['q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p'],
  ['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l'],
  ['z', 'x', 'c', 'v', 'b', 'n', 'm']
];

const LINHAS_SIMBOLOS = [
  ['~', '`', '!', '@', '#', '$', '%', '^', '&', '*'],
  ['-', '_', '=', '+', '[', ']', '{', '}', '\\', '|'],
  [';', ':', "'", '"', ',', '.', '<', '>', '/', '?']
];

/**
 * Simbolos que valem destaque: os proprios caracteres nao alfanumericos do
 * trecho atual, ordenados por frequencia — sao os que mais valem a pena
 * ficar a um toque so nesta licao especifica.
 */
export function simbolosDaLicao(codigo, limite = 12) {
  const contagem = new Map();
  for (const ch of String(codigo)) {
    if (/[A-Za-z0-9\s]/.test(ch)) continue;
    contagem.set(ch, (contagem.get(ch) || 0) + 1);
  }
  return [...contagem.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limite)
    .map(([ch]) => ch);
}

/**
 * Monta o teclado dentro de `container` (substitui qualquer conteudo
 * anterior). `onChar(ch)` e `onApagar()` sao chamados a cada toque.
 * Devolve `{ destroy, atualizarCodigo }`.
 */
export function montarTecladoProprio({ container, codigo, onChar, onApagar }) {
  let pagina = 'letras'; // 'letras' | 'simbolos'
  let shift = 'off'; // 'off' | 'once' | 'lock'
  let prioritarios = simbolosDaLicao(codigo);
  let holdTimer = null;
  let holdInterval = null;

  const root = document.createElement('div');
  root.className = 'teclado-proprio';

  const faixa = document.createElement('div');
  faixa.className = 'tp-faixa';

  const corpo = document.createElement('div');
  corpo.className = 'tp-corpo';

  root.appendChild(faixa);
  root.appendChild(corpo);
  container.innerHTML = '';
  container.appendChild(root);

  function criarTecla(label, extra) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'tp-tecla' + (extra ? ' ' + extra : '');
    b.textContent = label;
    return b;
  }

  function pararHold() {
    clearTimeout(holdTimer);
    clearInterval(holdInterval);
    holdTimer = null;
    holdInterval = null;
  }

  function renderFaixa() {
    faixa.innerHTML = '';
    faixa.hidden = !prioritarios.length;
    for (const ch of prioritarios) {
      const b = criarTecla(ch, 'tp-prioritario');
      b.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        onChar(ch);
      });
      faixa.appendChild(b);
    }
  }

  function renderCorpo() {
    corpo.innerHTML = '';

    const linhaNums = document.createElement('div');
    linhaNums.className = 'tp-linha';
    for (const n of LINHA_NUMEROS) {
      const b = criarTecla(n);
      b.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        onChar(n);
      });
      linhaNums.appendChild(b);
    }
    corpo.appendChild(linhaNums);

    const linhas = pagina === 'letras' ? LINHAS_LETRAS : LINHAS_SIMBOLOS;
    linhas.forEach((linha, i) => {
      const div = document.createElement('div');
      div.className = 'tp-linha';

      if (pagina === 'letras' && i === linhas.length - 1) {
        const classeShift = 'tp-shift' + (shift !== 'off' ? ' ativo' : '') + (shift === 'lock' ? ' travado' : '');
        const btnShift = criarTecla(shift === 'lock' ? '⇧⇧' : '⇧', classeShift);
        btnShift.addEventListener('pointerdown', (e) => {
          e.preventDefault();
          shift = shift === 'off' ? 'once' : shift === 'once' ? 'lock' : 'off';
          renderCorpo();
        });
        div.appendChild(btnShift);
      }

      for (const ch of linha) {
        const digitar = pagina === 'letras' && shift !== 'off' ? ch.toUpperCase() : ch;
        const b = criarTecla(digitar);
        b.addEventListener('pointerdown', (e) => {
          e.preventDefault();
          onChar(digitar);
          if (pagina === 'letras' && shift === 'once') {
            shift = 'off';
            renderCorpo();
          }
        });
        div.appendChild(b);
      }

      corpo.appendChild(div);
    });

    const linhaFinal = document.createElement('div');
    linhaFinal.className = 'tp-linha';

    const btnPagina = criarTecla(pagina === 'letras' ? '123' : 'ABC', 'tp-pagina');
    btnPagina.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      pagina = pagina === 'letras' ? 'simbolos' : 'letras';
      renderCorpo();
    });
    linhaFinal.appendChild(btnPagina);

    const btnVirgula = criarTecla(',');
    btnVirgula.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      onChar(',');
    });
    linhaFinal.appendChild(btnVirgula);

    const btnEspaco = criarTecla('espaço', 'tp-espaco');
    btnEspaco.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      onChar(' ');
    });
    linhaFinal.appendChild(btnEspaco);

    const btnPonto = criarTecla('.');
    btnPonto.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      onChar('.');
    });
    linhaFinal.appendChild(btnPonto);

    const btnEnter = criarTecla('⏎', 'tp-enter');
    btnEnter.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      onChar('\n');
    });
    linhaFinal.appendChild(btnEnter);

    const btnBack = criarTecla('⌫', 'tp-back');
    btnBack.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      onApagar();
      // segurar apaga repetido, como num teclado de verdade
      holdTimer = setTimeout(() => {
        holdInterval = setInterval(onApagar, 60);
      }, 450);
    });
    btnBack.addEventListener('pointerup', pararHold);
    btnBack.addEventListener('pointerleave', pararHold);
    btnBack.addEventListener('pointercancel', pararHold);
    linhaFinal.appendChild(btnBack);

    corpo.appendChild(linhaFinal);
  }

  renderFaixa();
  renderCorpo();

  return {
    atualizarCodigo(novoCodigo) {
      prioritarios = simbolosDaLicao(novoCodigo);
      renderFaixa();
    },
    destroy() {
      pararHold();
      if (root.parentNode) root.remove();
    }
  };
}
