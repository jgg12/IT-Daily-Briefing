// scripts/build-site.mjs
// Copies only the files the browser needs into _site/ for GitHub Pages.

import { cp, mkdir, rm } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const out = new URL('_site/', root);

await rm(out, { recursive: true, force: true });
await mkdir(out, { recursive: true });
for (const path of ['index.html', 'styles.css', 'app.js', 'config', 'data']) {
  await cp(new URL(path, root), new URL(path, out), { recursive: true });
}
console.log('Site files copied to _site/');
