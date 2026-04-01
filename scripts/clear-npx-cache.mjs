import fs from 'fs';
import os from 'os';
import path from 'path';

const npxDir = path.join(os.homedir(), '.npm', '_npx');

try {
  if (fs.existsSync(npxDir)) {
    fs.rmSync(npxDir, { recursive: true, force: true });
    console.log('Removed npx cache:', npxDir);
  } else {
    console.log('Nothing to remove:', npxDir);
  }
} catch (err) {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
}
