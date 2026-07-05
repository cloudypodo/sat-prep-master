// Orchestrates the full pipeline for producing a desktop installer:
//   1. build the frontend
//   2. stage a clean, prod-only copy of the backend (so this never touches
//      backend/node_modules, which stays on the regular Node ABI for
//      `npm run dev:backend`)
//   3. rebuild the staged backend's native deps (better-sqlite3) against
//      Electron's ABI, for the target platform/arch
//   4. resolve ANTHROPIC_API_KEY (from a CI secret env var, or backend/.env
//      for local builds) into a dedicated resource file (never ships
//      JWT_SECRET/dev PORT/NODE_ENV)
//   5. run electron-builder
//
// Usage: node scripts/build-electron.mjs [--mac] [--arch=x64|arm64]
// Defaults to --win (the only platform buildable from this Windows dev
// machine); --mac is used by the GitHub Actions macOS runner.
import { execFileSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const ELECTRON_VERSION = JSON.parse(readFileSync(path.join(ROOT, 'package.json'), 'utf8')).devDependencies.electron;
const PRODUCT_NAME = 'SAT Prep Master';

const args = process.argv.slice(2);
const platform = args.includes('--mac') ? 'mac' : 'win';
const arch = (args.find(a => a.startsWith('--arch=')) || '--arch=x64').split('=')[1];

const STAGING_DIR = path.join(ROOT, 'electron-build', 'backend-staging');
const SECRETS_FILE = path.join(ROOT, 'electron-build', 'secrets.local.env');

function run(command, cmdArgs, cwd) {
  console.log(`\n> ${command} ${cmdArgs.join(' ')}${cwd ? `  (cwd: ${cwd})` : ''}`);
  execFileSync(command, cmdArgs, { cwd: cwd || ROOT, stdio: 'inherit', shell: process.platform === 'win32' });
}

function buildFrontend() {
  run('npm', ['install'], path.join(ROOT, 'frontend'));
  run('npm', ['run', 'build'], path.join(ROOT, 'frontend'));
}

function stageBackend() {
  rmSync(STAGING_DIR, { recursive: true, force: true });
  mkdirSync(STAGING_DIR, { recursive: true });
  cpSync(path.join(ROOT, 'backend', 'src'), path.join(STAGING_DIR, 'src'), { recursive: true });
  cpSync(path.join(ROOT, 'backend', 'package.json'), path.join(STAGING_DIR, 'package.json'));
  cpSync(path.join(ROOT, 'backend', 'package-lock.json'), path.join(STAGING_DIR, 'package-lock.json'));
  run('npm', ['ci', '--omit=dev'], STAGING_DIR);
}

function rebuildNativeModules() {
  run('npx', ['@electron/rebuild', '--module-dir', STAGING_DIR, '--version', ELECTRON_VERSION, '--arch', arch]);
}

function extractApiKey() {
  // CI (GitHub Actions) supplies the key via a repo secret env var; local
  // Windows builds read it from the gitignored backend/.env instead.
  let key = process.env.ANTHROPIC_API_KEY;
  if (!key) {
    const envPath = path.join(ROOT, 'backend', '.env');
    if (!existsSync(envPath)) {
      throw new Error(`Missing ${envPath} and no ANTHROPIC_API_KEY env var set — provide a real key before building.`);
    }
    const match = readFileSync(envPath, 'utf8').match(/^ANTHROPIC_API_KEY=(.*)$/m);
    key = match ? match[1].trim() : '';
  }
  if (!key || key === 'your_anthropic_api_key_here') {
    throw new Error('ANTHROPIC_API_KEY is missing or still the placeholder value.');
  }
  writeFileSync(SECRETS_FILE, `ANTHROPIC_API_KEY=${key}\n`);
}

// electron-builder's --dir output directory name is deterministic per
// platform/arch (not configurable), so we compute it rather than search.
function unpackedDirName() {
  if (platform === 'win') return 'win-unpacked';
  return arch === 'arm64' ? 'mac-arm64' : 'mac';
}

function resourcesDirFor(unpackedDir) {
  return platform === 'win'
    ? path.join(unpackedDir, 'resources')
    : path.join(unpackedDir, `${PRODUCT_NAME}.app`, 'Contents', 'Resources');
}

function packageApp() {
  const outputRoot = path.join(ROOT, 'dist-electron');
  const platformFlag = platform === 'win' ? '--win' : '--mac';
  const archFlag = platform === 'mac' ? [arch === 'arm64' ? '--arm64' : '--x64'] : [];

  const unpackedDir = path.join(outputRoot, unpackedDirName());
  rmSync(unpackedDir, { recursive: true, force: true });

  // electron-builder's extraResources copier unconditionally strips any
  // directory literally named "node_modules" at the root of a `from` entry
  // (app-builder-lib's createFilter treats it as app-packaging cruft).
  // Build unpacked first, then copy node_modules in ourselves with a plain
  // fs copy, then build the final distributable from that doctored directory.
  run('npx', ['electron-builder', platformFlag, ...archFlag, '--dir', '--config', 'electron-builder.yml']);

  const resourcesDir = resourcesDirFor(unpackedDir);
  const destNodeModules = path.join(resourcesDir, 'backend', 'node_modules');
  rmSync(destNodeModules, { recursive: true, force: true });
  cpSync(path.join(STAGING_DIR, 'node_modules'), destNodeModules, { recursive: true });

  run('npx', ['electron-builder', '--config', 'electron-builder.yml', platformFlag, ...archFlag, '--publish', 'never', '--prepackaged', unpackedDir]);
}

buildFrontend();
stageBackend();
rebuildNativeModules();
extractApiKey();
packageApp();

console.log(`\nDone. ${platform}/${arch} output: dist-electron/`);
