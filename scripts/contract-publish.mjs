#!/usr/bin/env node
// Publishes contract/ to the registry configured for the package scope in the root .npmrc
// ("<scope>:registry=https://..."). Credentials come from your user ~/.npmrc.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runPnpm } from './run-pnpm.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const pkg = JSON.parse(readFileSync(join(root, 'contract', 'package.json'), 'utf8'));
const scope = pkg.name.split('/')[0];
const npmrc = readFileSync(join(root, '.npmrc'), 'utf8');
const line = npmrc.split('\n').find((l) => l.trim().startsWith(`${scope}:registry=`));
if (!line) {
  process.stderr.write(
    `contract: no "${scope}:registry=" line in .npmrc. Add your registry URL first.\n`,
  );
  process.exit(1);
}
const registry = line.split('=').slice(1).join('=').trim();
runPnpm(['publish', '--registry', registry, '--no-git-checks', '--access', 'restricted'], {
  cwd: join(root, 'contract'),
  stdio: 'inherit',
});
