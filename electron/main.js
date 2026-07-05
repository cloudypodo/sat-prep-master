const { app, BrowserWindow, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const http = require('http');
const { spawn } = require('child_process');

const PORT = process.env.SAT_PORT ? Number(process.env.SAT_PORT) : 3001;

// Packaged: backend/frontend ship as siblings under resources/, mirroring
// their layout in the repo so the backend's own relative path resolution
// (index.js -> ../../frontend/dist, database.js -> ../../data) keeps working
// unmodified. Unpackaged (`electron .`): resolve the same layout from the
// repo root.
const resourceRoot = app.isPackaged ? process.resourcesPath : path.join(__dirname, '..');
const backendEntry = path.join(resourceRoot, 'backend', 'src', 'index.js');
const secretsPath = app.isPackaged
  ? path.join(process.resourcesPath, 'backend-secrets.env')
  : path.join(__dirname, '..', 'electron-build', 'secrets.local.env');

let mainWindow = null;
let backendProcess = null;

function readApiKey() {
  if (!fs.existsSync(secretsPath)) return null;
  const content = fs.readFileSync(secretsPath, 'utf8');
  const match = content.match(/^ANTHROPIC_API_KEY=(.*)$/m);
  return match ? match[1].trim() : null;
}

function getOrCreateJwtSecret(dataDir) {
  const secretFile = path.join(dataDir, 'jwt_secret.txt');
  if (fs.existsSync(secretFile)) {
    return fs.readFileSync(secretFile, 'utf8').trim();
  }
  fs.mkdirSync(dataDir, { recursive: true });
  const secret = crypto.randomBytes(48).toString('hex');
  fs.writeFileSync(secretFile, secret, { mode: 0o600 });
  return secret;
}

function spawnBackend({ dataDir, jwtSecret, apiKey }) {
  killBackend(); // guard against leaking a prior child if createWindow ever runs twice in one process

  backendProcess = spawn(process.execPath, [backendEntry], {
    cwd: path.dirname(backendEntry),
    env: {
      ...process.env,
      ELECTRON_RUN_AS_NODE: '1',
      PORT: String(PORT),
      HOST: '127.0.0.1',
      DATA_DIR: dataDir,
      JWT_SECRET: jwtSecret,
      ANTHROPIC_API_KEY: apiKey,
      NODE_ENV: 'production',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  const logDir = app.getPath('logs');
  fs.mkdirSync(logDir, { recursive: true });
  const logStream = fs.createWriteStream(path.join(logDir, 'backend.log'), { flags: 'a' });
  backendProcess.stdout.pipe(logStream);
  backendProcess.stderr.pipe(logStream);

  backendProcess.on('exit', () => {
    backendProcess = null;
  });
}

function killBackend() {
  if (backendProcess) {
    try {
      backendProcess.kill();
    } catch {
      // already gone
    }
    backendProcess = null;
  }
}

function waitForHealth(timeoutMs = 15000) {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    const attempt = () => {
      const req = http.get({ host: '127.0.0.1', port: PORT, path: '/api/health', timeout: 1000 }, (res) => {
        res.resume();
        if (res.statusCode === 200) resolve();
        else retry();
      });
      req.on('error', retry);
      req.on('timeout', () => {
        req.destroy();
        retry();
      });
    };
    const retry = () => {
      if (Date.now() - start > timeoutMs) reject(new Error('Backend did not become ready in time'));
      else setTimeout(attempt, 300);
    };
    attempt();
  });
}

function createBrowserWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 860,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
  });
  win.on('closed', () => {
    mainWindow = null;
  });
  return win;
}

async function createWindow() {
  // electron:dev points straight at the already-running Vite dev server;
  // no backend spawn/health-poll needed since dev:backend is run separately.
  const devUrl = process.env.ELECTRON_START_URL;
  if (devUrl) {
    mainWindow = createBrowserWindow();
    mainWindow.loadURL(devUrl);
    return;
  }

  const dataDir = app.getPath('userData');
  const jwtSecret = getOrCreateJwtSecret(dataDir);
  const apiKey = readApiKey();

  if (!apiKey) {
    dialog.showErrorBox(
      'Setup error',
      'ANTHROPIC_API_KEY is missing from this build. The app cannot generate practice questions without it.'
    );
    app.quit();
    return;
  }

  spawnBackend({ dataDir, jwtSecret, apiKey });

  try {
    await waitForHealth();
  } catch (err) {
    dialog.showErrorBox('Startup error', `The backend server did not start in time.\n\n${err.message}`);
    killBackend();
    app.quit();
    return;
  }

  mainWindow = createBrowserWindow();
  mainWindow.loadURL(`http://127.0.0.1:${PORT}/`);
}

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  app.whenReady().then(createWindow);

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });

  app.on('window-all-closed', () => {
    killBackend();
    if (process.platform !== 'darwin') app.quit();
  });

  app.on('before-quit', killBackend);
  app.on('will-quit', killBackend);
}
