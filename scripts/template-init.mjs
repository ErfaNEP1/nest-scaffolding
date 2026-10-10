#!/usr/bin/env node
// Turns the template into a project. Run once, right after cloning:
//
//   pnpm template:init --name orders-api --scope @acme [--remove-sample]
//
// - replaces {{PROJECT_NAME}} and {{NPM_SCOPE}} in every tracked text file,
// - resets CHANGELOG.md to an empty Unreleased section and the versions to 0.1.0,
// - with --remove-sample, deletes the sample module and regenerates openapi/openapi.json.
import { execFileSync } from 'node:child_process';
import { existsSync, lstatSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const SELF = 'scripts/template-init.mjs';
const PLACEHOLDERS = ['{{PROJECT_NAME}}', '{{NPM_SCOPE}}'];

/** Everything that belongs only to the sample module (see docs/guides/removing-the-sample-module.md). */
export const SAMPLE_PATHS = [
  'src/modules/sample',
  'db/migrations/0002_sample.sql',
  'test/integration/sample',
  'test/e2e/sample.e2e-spec.ts',
  'test/support/factories.ts',
  'docs/guides/removing-the-sample-module.md',
];

function fail(message) {
  process.stderr.write(`template:init: ${message}\n`);
  process.exit(1);
}

function parseArgs(argv) {
  const args = { name: undefined, scope: undefined, removeSample: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--name') args.name = argv[++i];
    else if (arg === '--scope') args.scope = argv[++i];
    else if (arg === '--remove-sample') args.removeSample = true;
    else if (arg === '--') continue;
    else fail(`unknown argument ${arg}`);
  }
  if (!args.name || !/^[a-z0-9][a-z0-9-]*$/.test(args.name)) {
    fail('--name is required: lower case letters, digits and dashes (for example orders-api)');
  }
  if (!args.scope || !/^@[a-z0-9][a-z0-9-._]*$/.test(args.scope)) {
    fail('--scope is required: an npm scope such as @acme');
  }
  return args;
}

const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8' });

function replacePlaceholders(name, scope) {
  const files = git('ls-files', '-z')
    .split('\0')
    .filter((file) => file && file !== SELF);
  const changed = [];
  for (const file of files) {
    const path = join(root, file);
    // Skip deleted files and symlinks (for example .claude/skills).
    if (!existsSync(path) || !lstatSync(path).isFile()) continue;
    const content = readFileSync(path, 'utf8');
    if (!PLACEHOLDERS.some((placeholder) => content.includes(placeholder))) continue;
    writeFileSync(
      path,
      content.replaceAll('{{PROJECT_NAME}}', name).replaceAll('{{NPM_SCOPE}}', scope),
    );
    changed.push(file);
  }
  return changed;
}

function resetVersions() {
  for (const file of ['package.json', 'contract/package.json']) {
    const path = join(root, file);
    const pkg = JSON.parse(readFileSync(path, 'utf8'));
    pkg.version = '0.1.0';
    writeFileSync(path, `${JSON.stringify(pkg, null, 2)}\n`);
  }
  writeFileSync(
    join(root, 'CHANGELOG.md'),
    `# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]
`,
  );
}

function removeSample() {
  for (const path of SAMPLE_PATHS) rmSync(join(root, path), { recursive: true, force: true });
  const registry = join(root, 'src/feature-modules.ts');
  const source = readFileSync(registry, 'utf8')
    .replace("import { SampleModule } from './modules/sample';\n", '')
    .replace('[SampleModule]', '[]');
  writeFileSync(registry, source);
  const observability = join(root, 'docs/operations/observability.md');
  const lines = readFileSync(observability, 'utf8').split('\n');
  writeFileSync(observability, lines.filter((line) => !line.includes('app_sample_')).join('\n'));
  execFileSync('pnpm', ['openapi:generate'], { cwd: root, stdio: 'inherit' });
}

const args = parseArgs(process.argv.slice(2));
const changed = replacePlaceholders(args.name, args.scope);
resetVersions();
// Longer names change table widths; keep the files formatted.
execFileSync(
  'pnpm',
  ['exec', 'prettier', '--write', '--log-level', 'warn', '--ignore-unknown', ...changed],
  {
    cwd: root,
    stdio: 'inherit',
  },
);
if (args.removeSample) removeSample();

process.stdout.write(`
template:init: done (${changed.length} files updated${args.removeSample ? ', sample module removed' : ''}).

Next steps:
  1. Review the changes:            git status && git diff
  2. Set your registry in .npmrc:    ${args.scope}:registry=https://...
  3. Local settings:                 cp .env.example .env
  4. Start the stack:                docker compose up --build
  5. Check everything:               pnpm verify && pnpm test:e2e
  6. Put the project's documents in docs/project/ and list them in docs/README.md.
  7. Commit:                         git commit -am "chore: initialize from template"
`);
