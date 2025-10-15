'use strict';
const { existsSync } = require('fs');
const { spawnSync } = require('child_process');
const path = require('path');

// If not a git repo (e.g., installed as a dependency), do nothing.
if (!existsSync('.git')) {
  process.exit(0);
}

// Prefer local .bin shim if present
const isWin = process.platform === 'win32';
const binPath = isWin
  ? path.join('node_modules', '.bin', 'simple-git-hooks.cmd')
  : path.join('node_modules', '.bin', 'simple-git-hooks');

if (existsSync(binPath)) {
  const res = spawnSync(binPath, { stdio: 'inherit', shell: false });
  process.exit(res.status ?? 0);
}

// Fallback: pnpm exec
const cmd = isWin ? 'pnpm.cmd' : 'pnpm';
const res = spawnSync(cmd, ['exec', 'simple-git-hooks'], { stdio: 'inherit' });
process.exit(res.status ?? 0);
