import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { envVariableNames } from './config';

const root = join(__dirname, '..', '..');
const read = (path: string) => readFileSync(join(root, path), 'utf8');

describe('configuration docs', () => {
  const envExample = read('.env.example');
  const docs = read('docs/operations/configuration.md');

  it.each(envVariableNames)('%s is in .env.example and configuration.md', (name) => {
    expect(envExample).toMatch(new RegExp(`^#? ?${name}=`, 'm'));
    expect(docs).toContain(`\`${name}\``);
  });
});
