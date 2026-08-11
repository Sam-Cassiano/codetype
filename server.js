/*
 * CodeType - servidor local sem dependencias.
 *  - Serve os arquivos estaticos de ./public (ou da copia embutida, no .exe)
 *  - Faz proxy para o Ollama local (evita CORS e mantem o streaming)
 *  - Persiste modulos gerados em ./data/modules.json
 *
 * O mesmo arquivo roda em dois modos:
 *  - desenvolvimento: `node server.js`, lendo os arquivos do disco;
 *  - empacotado: dentro do executavel gerado por `npm run build:exe`, onde
 *    globalThis.__CODETYPE_FILES__ carrega o conteudo de public/ em base64.
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const EMBUTIDOS = globalThis.__CODETYPE_FILES__ || null;
const EMPACOTADO = !!EMBUTIDOS;

const PORT_INICIAL = Number(process.env.PORT || 5173);
const OLLAMA = process.env.OLLAMA_HOST || 'http://127.0.0.1:11434';
const PUBLIC_DIR = path.join(__dirname, 'public');

// no executavel, os dados ficam ao lado do .exe (o bundle e somente leitura)
const RAIZ_DADOS = EMPACOTADO ? path.dirname(process.execPath) : __dirname;
const DATA_DIR = path.join(RAIZ_DADOS, 'data');
const MODULES_FILE = path.join(DATA_DIR, 'modules.json');
// unidades acrescentadas a modulos existentes (inclusive aos embutidos, que
// sao codigo-fonte e nao podem ser reescritos)
const EXTENSOES_FILE = path.join(DATA_DIR, 'extensions.json');

const ABRIR_NAVEGADOR = EMPACOTADO || process.argv.includes('--open');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2'
};

function json(res, code, body) {
  const payload = JSON.stringify(body);
  res.writeHead(code, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(payload)
  });
  res.end(payload);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (c) => {
      size += c.length;
      if (size > 8 * 1024 * 1024) {
        reject(new Error('payload muito grande'));
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

/* ---------------------------------- Ollama --------------------------------- */

function ollamaProxy(req, res, upstreamPath) {
  const target = new URL(upstreamPath, OLLAMA);
  const options = {
    hostname: target.hostname,
    port: target.port || 80,
    path: target.pathname + target.search,
    method: req.method,
    headers: { 'Content-Type': 'application/json' }
  };

  const proxied = http.request(options, (up) => {
    res.writeHead(up.statusCode || 502, {
      'Content-Type': up.headers['content-type'] || 'application/json',
      'Cache-Control': 'no-store',
      // streaming NDJSON precisa chegar em pedacos
      'X-Accel-Buffering': 'no'
    });
    up.pipe(res);
  });

  proxied.on('error', (err) => {
    if (!res.headersSent) {
      json(res, 502, {
        error: 'ollama_indisponivel',
        detail: err.message,
        hint: 'O Ollama esta rodando? Teste: ollama list'
      });
    } else {
      res.end();
    }
  });

  if (req.method === 'POST') req.pipe(proxied);
  else proxied.end();
}

/* -------------------------- Modulos gerados (disco) ------------------------- */

function lerJSON(arquivo, padrao) {
  try {
    return JSON.parse(fs.readFileSync(arquivo, 'utf8'));
  } catch {
    return padrao;
  }
}

function gravarJSON(arquivo, dados) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(arquivo, JSON.stringify(dados, null, 2), 'utf8');
}

const loadModules = () => lerJSON(MODULES_FILE, []);
const saveModules = (list) => gravarJSON(MODULES_FILE, list);

// { [moduloId]: [unidade, ...] }
const loadExtensoes = () => lerJSON(EXTENSOES_FILE, {});
const saveExtensoes = (mapa) => gravarJSON(EXTENSOES_FILE, mapa);

/* --------------------------------- Estatico -------------------------------- */

function serveStatic(req, res) {
  const url = decodeURIComponent(req.url.split('?')[0]);
  const rel = url === '/' ? '/index.html' : url;
  const relLimpo = path.normalize(rel).replace(/^([/\\])+/, '');
  const tipo = MIME[path.extname(relLimpo).toLowerCase()] || 'application/octet-stream';

  const responder = (buf) => {
    res.writeHead(200, { 'Content-Type': tipo, 'Cache-Control': 'no-cache' });
    res.end(buf);
  };
  const naoEncontrado = () => {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('404 - nao encontrado: ' + rel);
  };

  if (EMPACOTADO) {
    const chave = relLimpo.split(path.sep).join('/');
    const conteudo = EMBUTIDOS[chave];
    if (!conteudo) return naoEncontrado();
    return responder(Buffer.from(conteudo, 'base64'));
  }

  const filePath = path.join(PUBLIC_DIR, relLimpo);
  if (!filePath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403).end('403');
    return;
  }
  fs.readFile(filePath, (err, buf) => (err ? naoEncontrado() : responder(buf)));
}

/* ---------------------------------- Router --------------------------------- */

const server = http.createServer(async (req, res) => {
  const url = req.url.split('?')[0];

  try {
    if (url === '/api/health') {
      return json(res, 200, { ok: true, ollama: OLLAMA, empacotado: EMPACOTADO });
    }

    if (url === '/api/ollama/tags' && req.method === 'GET') {
      return ollamaProxy(req, res, '/api/tags');
    }

    if (url === '/api/ollama/generate' && req.method === 'POST') {
      return ollamaProxy(req, res, '/api/generate');
    }

    if (url === '/api/modules') {
      if (req.method === 'GET') return json(res, 200, loadModules());
      if (req.method === 'POST') {
        const mod = JSON.parse(await readBody(req));
        if (!mod || !mod.id) return json(res, 400, { error: 'modulo invalido' });
        const list = loadModules().filter((m) => m.id !== mod.id);
        list.push(mod);
        saveModules(list);
        return json(res, 200, { ok: true, count: list.length });
      }
      if (req.method === 'DELETE') {
        const id = new URL(req.url, 'http://x').searchParams.get('id');
        saveModules(loadModules().filter((m) => m.id !== id));
        const extensoes = loadExtensoes();
        delete extensoes[id];
        saveExtensoes(extensoes);
        return json(res, 200, { ok: true });
      }
    }

    if (url === '/api/extensions') {
      if (req.method === 'GET') return json(res, 200, loadExtensoes());

      if (req.method === 'POST') {
        const { moduloId, unidade } = JSON.parse(await readBody(req));
        if (!moduloId || !unidade || !unidade.id) return json(res, 400, { error: 'extensao invalida' });
        const mapa = loadExtensoes();
        const atual = (mapa[moduloId] || []).filter((u) => u.id !== unidade.id);
        atual.push(unidade);
        mapa[moduloId] = atual;
        saveExtensoes(mapa);
        return json(res, 200, { ok: true, unidades: atual.length });
      }

      if (req.method === 'DELETE') {
        const params = new URL(req.url, 'http://x').searchParams;
        const moduloId = params.get('modulo');
        const unidadeId = params.get('unidade');
        const mapa = loadExtensoes();
        if (mapa[moduloId]) {
          mapa[moduloId] = mapa[moduloId].filter((u) => u.id !== unidadeId);
          if (!mapa[moduloId].length) delete mapa[moduloId];
          saveExtensoes(mapa);
        }
        return json(res, 200, { ok: true });
      }
    }

    if (req.method === 'GET') return serveStatic(req, res);
    return json(res, 405, { error: 'metodo nao suportado' });
  } catch (err) {
    return json(res, 500, { error: err.message });
  }
});

/* ---------------------------------- Boot ----------------------------------- */

function abrirNavegador(url) {
  try {
    if (process.platform === 'win32') {
      spawn('cmd', ['/c', 'start', '""', url], { detached: true, stdio: 'ignore' }).unref();
    } else if (process.platform === 'darwin') {
      spawn('open', [url], { detached: true, stdio: 'ignore' }).unref();
    } else {
      spawn('xdg-open', [url], { detached: true, stdio: 'ignore' }).unref();
    }
  } catch {
    /* segue sem abrir: a URL fica impressa no console */
  }
}

function iniciar(porta, tentativasRestantes) {
  server.once('error', (err) => {
    if (err.code === 'EADDRINUSE' && tentativasRestantes > 0) {
      console.log('  porta ' + porta + ' ocupada, tentando ' + (porta + 1) + '...');
      iniciar(porta + 1, tentativasRestantes - 1);
      return;
    }
    console.error('  nao foi possivel iniciar o servidor: ' + err.message);
    process.exit(1);
  });

  server.listen(porta, () => {
    const url = 'http://localhost:' + porta;
    console.log('');
    console.log('  CodeType rodando em  ' + url);
    console.log('  Ollama proxy ->      ' + OLLAMA);
    if (EMPACOTADO) {
      console.log('  Modulos gerados em   ' + MODULES_FILE);
      console.log('');
      console.log('  Feche esta janela para encerrar o CodeType.');
    }
    console.log('');
    if (ABRIR_NAVEGADOR) abrirNavegador(url);
  });
}

iniciar(PORT_INICIAL, 10);
