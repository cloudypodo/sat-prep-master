// Dev entry point: points Electron at the already-running Vite dev server
// (run `npm run dev:backend` and `npm run dev:frontend` separately first)
// instead of spawning the packaged backend, so main.js's normal packaged
// flow doesn't need to be exercised for fast iteration.
process.env.ELECTRON_START_URL = process.env.ELECTRON_START_URL || 'http://localhost:5173';
require('./main.js');
