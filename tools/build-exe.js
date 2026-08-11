/*
 * Gera dist/CodeType.exe usando o Single Executable Application do Node 20.
 *
 * Etapas:
 *  1. le tudo de public/ e escreve build/codetype.cjs = mapa de arquivos
 *     em base64 + o codigo de server.js;
 *  2. `node --experimental-sea-config` transforma isso em um blob;
 *  3. copia o node.exe local e injeta o blob com o postject.
 *
 * Uso: npm run build:exe
 */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const RAIZ = path.join(__dirname, '..');
const PUBLIC_DIR = path.join(RAIZ, 'public');
const BUILD = path.join(RAIZ, 'build');
const DIST = path.join(RAIZ, 'dist');

const EXE = path.join(DIST, process.platform === 'win32' ? 'CodeType.exe' : 'CodeType');
const BUNDLE = path.join(BUILD, 'codetype.cjs');
const BLOB = path.join(BUILD, 'codetype.blob');
const SEA_CONFIG = path.join(BUILD, 'sea-config.json');
const FUSE = 'NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2';

function listar(dir, base = '') {
  const saida = [];
  for (const item of fs.readdirSync(dir, { withFileTypes: true })) {
    const rel = base ? base + '/' + item.name : item.name;
    if (item.isDirectory()) saida.push(...listar(path.join(dir, item.name), rel));
    else saida.push(rel);
  }
  return saida;
}

function passo(n, texto) {
  console.log(`  [${n}/4] ${texto}`);
}

/* ------------------------------ 1. bundle ---------------------------------- */

passo(1, 'embutindo public/ no bundle...');
fs.mkdirSync(BUILD, { recursive: true });
fs.mkdirSync(DIST, { recursive: true });

const arquivos = listar(PUBLIC_DIR);
const mapa = {};
let bytes = 0;
for (const rel of arquivos) {
  const buf = fs.readFileSync(path.join(PUBLIC_DIR, rel));
  mapa[rel] = buf.toString('base64');
  bytes += buf.length;
}

const servidor = fs.readFileSync(path.join(RAIZ, 'server.js'), 'utf8');
fs.writeFileSync(
  BUNDLE,
  '// gerado por tools/build-exe.js — nao edite a mao\n' +
    'globalThis.__CODETYPE_FILES__ = ' +
    JSON.stringify(mapa) +
    ';\n\n' +
    servidor,
  'utf8'
);
console.log(
  `        ${arquivos.length} arquivos · ${(bytes / 1024).toFixed(0)} KB · bundle ${(
    fs.statSync(BUNDLE).size / 1024
  ).toFixed(0)} KB`
);

/* -------------------------------- 2. blob ---------------------------------- */

passo(2, 'gerando o blob SEA...');
fs.writeFileSync(
  SEA_CONFIG,
  JSON.stringify(
    {
      main: BUNDLE.replace(/\\/g, '/'),
      output: BLOB.replace(/\\/g, '/'),
      disableExperimentalSEAWarning: true,
      useSnapshot: false,
      useCodeCache: false
    },
    null,
    2
  ),
  'utf8'
);
execFileSync(process.execPath, ['--experimental-sea-config', SEA_CONFIG], { stdio: 'inherit' });

/* ------------------------------ 3. copia node ------------------------------ */

passo(3, 'copiando o node local para dist/...');
try {
  fs.copyFileSync(process.execPath, EXE);
} catch (err) {
  if (err.code === 'EBUSY' || err.code === 'EPERM') {
    console.error('\n  O executavel esta em uso. Feche a janela do CodeType e rode de novo.\n');
    process.exit(1);
  }
  throw err;
}
console.log(`        ${(fs.statSync(EXE).size / 1024 / 1024).toFixed(0)} MB (node ${process.version})`);

/* ------------------------------- 4. postject ------------------------------- */

passo(4, 'injetando o blob com o postject...');
const npx = process.platform === 'win32' ? 'npx.cmd' : 'npx';
// caminhos relativos de proposito: o postject e chamado via shell no Windows e
// o caminho absoluto deste projeto tem espaco, o que quebra a citacao dos args
execFileSync(
  npx,
  [
    '--yes',
    'postject',
    path.relative(RAIZ, EXE).replace(/\\/g, '/'),
    'NODE_SEA_BLOB',
    path.relative(RAIZ, BLOB).replace(/\\/g, '/'),
    '--sentinel-fuse',
    FUSE
  ],
  { stdio: 'inherit', cwd: RAIZ, shell: process.platform === 'win32' }
);

console.log('');
console.log('  pronto: ' + EXE);
console.log('  tamanho: ' + (fs.statSync(EXE).size / 1024 / 1024).toFixed(0) + ' MB');
console.log('  execute com um duplo clique — o navegador abre sozinho.');
console.log('');
