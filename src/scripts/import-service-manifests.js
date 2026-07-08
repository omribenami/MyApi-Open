require('dotenv').config();

const path = require('path');
const { initDatabase } = require('../database');
const { importManifestDirectory, importManifestFile } = require('../services/service-manifest-loader');

function resolveTarget(inputArg) {
  if (!inputArg) {
    return path.join(__dirname, '..', 'services', 'manifests');
  }
  return path.resolve(process.cwd(), inputArg);
}

function main() {
  const target = resolveTarget(process.argv[2]);
  initDatabase();

  let results;
  if (target.endsWith('.json')) {
    results = [importManifestFile(target)];
  } else {
    results = importManifestDirectory(target);
  }

  console.log(JSON.stringify({
    ok: true,
    imported: results.length,
    results,
  }, null, 2));
}

try {
  main();
} catch (error) {
  console.error(JSON.stringify({ ok: false, error: error.message }, null, 2));
  process.exit(1);
}
