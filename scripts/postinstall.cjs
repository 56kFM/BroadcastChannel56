'use strict';
const { existsSync } = require('fs');
const { spawnSync } = require('child_process');
const path = require('path');

if (!existsSync('.git')) process.exit(0);

const isWin = process.platform === 'win32';
const binPath = isWin
  ? path.join('node_modules', '.bin', 'simple-git-hooks.cmd')
  : path.join('node_modules', '.bin', 'simple-git-hooks');

try {
  if (existsSync(binPath)) {
    spawnSync(binPath, { stdio: 'inherit', shell: false });
  } else {
    const cmd = isWin ? 'pnpm.cmd' : 'pnpm';
    spawnSync(cmd, ['exec', 'simple-git-hooks'], { stdio: 'inherit' });
  }
} catch (_) {
  // ignore hook errors
}
process.exit(0);
