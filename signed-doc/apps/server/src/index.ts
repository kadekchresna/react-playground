/**
 * Process bootstrap — the only file in this package with a side effect at
 * import time. Everything else is a pure factory, which is what lets the test
 * suites build the app in-process without ever binding a port.
 */

import { createApp } from './app.js';

const port = Number.parseInt(process.env['PORT'] ?? '3001', 10);

createApp().listen(port, () => {
  console.log(
    JSON.stringify({ msg: 'listening', port, health: `http://localhost:${port}/api/health` }),
  );
});
