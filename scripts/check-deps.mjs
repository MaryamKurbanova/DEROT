import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const expoPkg = path.join(root, 'node_modules', 'expo', 'package.json');

if (!fs.existsSync(expoPkg)) {
  console.error(`
  DEROT: node_modules is missing or incomplete.

  Run:

    npm install

  Then start the dev server with:

    npm start

  Do not use bare "npx expo start" without installing first — npm may try to
  download a different Expo SDK (e.g. 55) and can fail with ENOTEMPTY on the npx cache.

  If you still see npx errors after installing, run:

    npm run fix:npx-cache
`);
  process.exit(1);
}
