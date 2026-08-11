/*
 * Realce de sintaxe minimalista.
 * Devolve um array com uma classe CSS por caractere do codigo — o motor de
 * digitacao precisa desse nivel de granularidade para pintar char a char.
 */

const KOTLIN = {
  keywords: `package import fun val var if else when while for do return break continue
    class interface object data sealed enum open override abstract final private public
    protected internal companion init constructor this super null true false is as in out
    by lateinit const suspend inline infix operator vararg typealias try catch finally throw
    where reified crossinline noinline get set field it`.split(/\s+/),
  builtins: `println print listOf mutableListOf mapOf mutableMapOf setOf arrayOf emptyList
    let run apply also with takeIf takeUnless require check error lazy launch async await
    delay withContext coroutineScope viewModelScope runCatching to repeat`.split(/\s+/),
  lineComment: '//',
  blockComment: ['/*', '*/'],
  strings: ['"""', '"', "'"],
  annotation: /^@[A-Za-z_][\w]*/
};

const JAVAISH = {
  keywords: `public private protected class interface extends implements new return if else
    for while do switch case break continue static final void int long double float boolean
    char String try catch finally throw throws import package this super null true false
    abstract enum instanceof synchronized volatile transient`.split(/\s+/),
  builtins: `System out println printf length size get put add remove`.split(/\s+/),
  lineComment: '//',
  blockComment: ['/*', '*/'],
  strings: ['"', "'"],
  annotation: /^@[A-Za-z_][\w]*/
};

const JSISH = {
  keywords: `const let var function return if else for while do switch case break continue
    class extends new import export from default async await try catch finally throw typeof
    instanceof this null undefined true false of in delete void yield static get set`.split(/\s+/),
  builtins: `console log map filter reduce forEach push pop length JSON Math Object Array
    Promise document window fetch setTimeout`.split(/\s+/),
  lineComment: '//',
  blockComment: ['/*', '*/'],
  strings: ['`', '"', "'"],
  annotation: null
};

const PYTHON = {
  keywords: `def class return if elif else for while in is not and or import from as pass
    break continue with try except finally raise lambda yield global nonlocal async await
    None True False self del assert`.split(/\s+/),
  builtins: `print len range list dict set tuple str int float bool enumerate zip map filter
    sum min max sorted open type isinstance super append`.split(/\s+/),
  lineComment: '#',
  blockComment: null,
  strings: ['"""', "'''", '"', "'"],
  annotation: /^@[A-Za-z_][\w.]*/
};

const SQL = {
  keywords: `SELECT FROM WHERE INSERT INTO VALUES UPDATE SET DELETE CREATE TABLE ALTER DROP
    JOIN LEFT RIGHT INNER OUTER ON GROUP BY ORDER HAVING LIMIT OFFSET AS AND OR NOT NULL
    PRIMARY KEY FOREIGN REFERENCES INDEX DISTINCT COUNT SUM AVG MIN MAX CASE WHEN THEN END`.split(/\s+/),
  builtins: [],
  lineComment: '--',
  blockComment: ['/*', '*/'],
  strings: ["'", '"'],
  annotation: null,
  caseInsensitive: true
};

const LANGS = {
  kotlin: KOTLIN,
  java: JAVAISH,
  csharp: JAVAISH,
  cs: JAVAISH,
  go: JAVAISH,
  c: JAVAISH,
  cpp: JAVAISH,
  javascript: JSISH,
  js: JSISH,
  typescript: JSISH,
  ts: JSISH,
  python: PYTHON,
  py: PYTHON,
  sql: SQL
};

const IDENT_START = /[A-Za-z_$]/;
const IDENT_PART = /[A-Za-z0-9_$]/;
const DIGIT = /[0-9]/;
const PUNCT = /[{}()[\];,.]/;
const OPERATOR = /[+\-*/%=<>!&|?:^~@#]/;

function fill(classes, from, to, cls) {
  for (let i = from; i < to; i++) classes[i] = cls;
}

/* ------------------------------- XML / HTML ------------------------------- */

function highlightMarkup(code) {
  const classes = new Array(code.length).fill('tok-txt');
  let i = 0;
  while (i < code.length) {
    if (code.startsWith('<!--', i)) {
      const end = code.indexOf('-->', i);
      const stop = end === -1 ? code.length : end + 3;
      fill(classes, i, stop, 'tok-com');
      i = stop;
      continue;
    }
    if (code[i] === '<') {
      const end = code.indexOf('>', i);
      const stop = end === -1 ? code.length : end + 1;
      let j = i + 1;
      fill(classes, i, stop, 'tok-punc');
      while (j < stop && /[/?!]/.test(code[j])) j++;
      const tagStart = j;
      while (j < stop && /[\w:.-]/.test(code[j])) j++;
      fill(classes, tagStart, j, 'tok-kw');
      // atributos
      while (j < stop) {
        if (/[\w:.-]/.test(code[j])) {
          const attrStart = j;
          while (j < stop && /[\w:.-]/.test(code[j])) j++;
          fill(classes, attrStart, j, 'tok-ann');
        } else if (code[j] === '"' || code[j] === "'") {
          const quote = code[j];
          const strStart = j++;
          while (j < stop && code[j] !== quote) j++;
          j = Math.min(j + 1, stop);
          fill(classes, strStart, j, 'tok-str');
        } else {
          j++;
        }
      }
      i = stop;
      continue;
    }
    i++;
  }
  return classes;
}

/* ------------------------------ Linguagens C ------------------------------ */

export function highlight(code, language) {
  const lang = String(language || '').toLowerCase();
  if (lang === 'xml' || lang === 'html') return highlightMarkup(code);

  const spec = LANGS[lang] || KOTLIN;
  const classes = new Array(code.length).fill('tok-txt');
  const kw = new Set(spec.caseInsensitive ? spec.keywords.map((k) => k.toLowerCase()) : spec.keywords);
  const bi = new Set(spec.builtins || []);

  let i = 0;
  while (i < code.length) {
    const ch = code[i];

    // comentario de linha
    if (spec.lineComment && code.startsWith(spec.lineComment, i)) {
      let end = code.indexOf('\n', i);
      if (end === -1) end = code.length;
      fill(classes, i, end, 'tok-com');
      i = end;
      continue;
    }

    // comentario de bloco
    if (spec.blockComment && code.startsWith(spec.blockComment[0], i)) {
      const close = code.indexOf(spec.blockComment[1], i + 2);
      const end = close === -1 ? code.length : close + spec.blockComment[1].length;
      fill(classes, i, end, 'tok-com');
      i = end;
      continue;
    }

    // strings
    let matchedString = false;
    for (const delim of spec.strings || []) {
      if (code.startsWith(delim, i)) {
        let j = i + delim.length;
        while (j < code.length) {
          if (code[j] === '\\' && delim.length === 1) {
            j += 2;
            continue;
          }
          if (code.startsWith(delim, j)) {
            j += delim.length;
            break;
          }
          if (code[j] === '\n' && delim.length === 1) break;
          j++;
        }
        fill(classes, i, Math.min(j, code.length), 'tok-str');
        // interpolacao ${...} e $var dentro da string
        for (let k = i; k < j && k < code.length; k++) {
          if (code[k] === '$' && (lang === 'kotlin' || lang === 'javascript' || lang === 'js' || lang === 'typescript' || lang === 'ts')) {
            let m = k + 1;
            if (code[m] === '{') {
              let depth = 1;
              m++;
              while (m < code.length && depth > 0) {
                if (code[m] === '{') depth++;
                if (code[m] === '}') depth--;
                m++;
              }
            } else {
              while (m < code.length && IDENT_PART.test(code[m])) m++;
            }
            if (m > k + 1) fill(classes, k, Math.min(m, j), 'tok-interp');
            k = m - 1;
          }
        }
        i = Math.min(j, code.length);
        matchedString = true;
        break;
      }
    }
    if (matchedString) continue;

    // anotacoes / decorators
    if (spec.annotation) {
      const rest = code.slice(i);
      const m = rest.match(spec.annotation);
      if (m) {
        fill(classes, i, i + m[0].length, 'tok-ann');
        i += m[0].length;
        continue;
      }
    }

    // numeros
    if (DIGIT.test(ch)) {
      let j = i;
      while (j < code.length && /[0-9._a-fA-FxXlLfF]/.test(code[j])) j++;
      fill(classes, i, j, 'tok-num');
      i = j;
      continue;
    }

    // identificadores
    if (IDENT_START.test(ch)) {
      let j = i;
      while (j < code.length && IDENT_PART.test(code[j])) j++;
      const word = code.slice(i, j);
      const probe = spec.caseInsensitive ? word.toLowerCase() : word;
      let cls = 'tok-id';
      if (kw.has(probe)) cls = 'tok-kw';
      else if (bi.has(word)) cls = 'tok-fn';
      else if (code[j] === '(') cls = 'tok-fn';
      else if (/^[A-Z]/.test(word)) cls = 'tok-type';
      fill(classes, i, j, cls);
      i = j;
      continue;
    }

    if (PUNCT.test(ch)) classes[i] = 'tok-punc';
    else if (OPERATOR.test(ch)) classes[i] = 'tok-op';
    i++;
  }

  return classes;
}

export function languageLabel(lang) {
  const map = {
    kotlin: 'Kotlin',
    java: 'Java',
    javascript: 'JavaScript',
    typescript: 'TypeScript',
    python: 'Python',
    sql: 'SQL',
    go: 'Go',
    csharp: 'C#',
    xml: 'XML',
    html: 'HTML'
  };
  return map[String(lang || '').toLowerCase()] || (lang || 'codigo');
}
