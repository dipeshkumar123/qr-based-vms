import fs from 'fs';
import path from 'path';

const DIST_ASSETS_DIR = path.resolve('dist', 'assets');
const JS_BUDGET_KB = Number(process.env.BUNDLE_JS_BUDGET_KB || '1300');
const CSS_BUDGET_KB = Number(process.env.BUNDLE_CSS_BUDGET_KB || '90');
const CHUNK_BUDGET_KB = Number(process.env.BUNDLE_CHUNK_BUDGET_KB || '480');

function toKb(bytes) {
  return bytes / 1024;
}

function listAssetFiles(dir) {
  if (!fs.existsSync(dir)) {
    throw new Error(`Missing dist assets directory: ${dir}. Run build first.`);
  }
  return fs.readdirSync(dir).map((name) => path.join(dir, name));
}

function formatKb(value) {
  return `${value.toFixed(2)} KB`;
}

function run() {
  const files = listAssetFiles(DIST_ASSETS_DIR);
  const jsFiles = files.filter((f) => f.endsWith('.js'));
  const cssFiles = files.filter((f) => f.endsWith('.css'));

  const jsSizes = jsFiles.map((file) => ({
    file: path.basename(file),
    kb: toKb(fs.statSync(file).size),
  }));

  const cssSizes = cssFiles.map((file) => ({
    file: path.basename(file),
    kb: toKb(fs.statSync(file).size),
  }));

  const totalJsKb = jsSizes.reduce((sum, item) => sum + item.kb, 0);
  const totalCssKb = cssSizes.reduce((sum, item) => sum + item.kb, 0);
  const largestChunk = jsSizes.reduce(
    (best, current) => (current.kb > best.kb ? current : best),
    { file: 'n/a', kb: 0 }
  );

  console.log('Bundle budget report');
  console.log(`- Total JS: ${formatKb(totalJsKb)} (budget ${JS_BUDGET_KB} KB)`);
  console.log(`- Total CSS: ${formatKb(totalCssKb)} (budget ${CSS_BUDGET_KB} KB)`);
  console.log(`- Largest JS chunk: ${largestChunk.file} ${formatKb(largestChunk.kb)} (budget ${CHUNK_BUDGET_KB} KB)`);

  let failed = false;

  if (totalJsKb > JS_BUDGET_KB) {
    console.error(`JS budget exceeded by ${formatKb(totalJsKb - JS_BUDGET_KB)}`);
    failed = true;
  }

  if (totalCssKb > CSS_BUDGET_KB) {
    console.error(`CSS budget exceeded by ${formatKb(totalCssKb - CSS_BUDGET_KB)}`);
    failed = true;
  }

  if (largestChunk.kb > CHUNK_BUDGET_KB) {
    console.error(
      `Chunk budget exceeded by ${formatKb(largestChunk.kb - CHUNK_BUDGET_KB)} in ${largestChunk.file}`
    );
    failed = true;
  }

  if (failed) {
    process.exitCode = 1;
    return;
  }

  console.log('Bundle budgets passed');
}

run();
