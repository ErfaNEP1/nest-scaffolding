#!/usr/bin/env node
// Keeps the AI tool wiring of .agents/skills (the only real copy of the skills) in place:
// - .claude/skills -> ../.agents/skills (symlink; a junction on Windows),
// - every skill folder has a SKILL.md with `name` (equal to the folder) and `description`.
//   pnpm skills:sync           fix the link, report problems
//   pnpm skills:sync --check   report only, exit 1 on problems
import {
  existsSync,
  lstatSync,
  readdirSync,
  readFileSync,
  readlinkSync,
  rmSync,
  symlinkSync,
} from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const skillsDir = join(root, '.agents', 'skills');
const claudeLink = join(root, '.claude', 'skills');
const check = process.argv.includes('--check');
const problems = [];

function linkIsCorrect() {
  try {
    if (!lstatSync(claudeLink).isSymbolicLink()) return false;
    return resolve(dirname(claudeLink), readlinkSync(claudeLink)) === skillsDir;
  } catch {
    return false;
  }
}

if (!linkIsCorrect()) {
  if (check) {
    problems.push('.claude/skills is not a symlink to ../.agents/skills');
  } else {
    if (existsSync(claudeLink) || lstatSafe(claudeLink))
      rmSync(claudeLink, { recursive: true, force: true });
    symlinkSync(
      process.platform === 'win32' ? skillsDir : '../.agents/skills',
      claudeLink,
      'junction',
    );
    process.stdout.write('skills: linked .claude/skills -> ../.agents/skills\n');
  }
}

function lstatSafe(path) {
  try {
    return lstatSync(path);
  } catch {
    return undefined;
  }
}

for (const entry of readdirSync(skillsDir, { withFileTypes: true })) {
  if (!entry.isDirectory()) continue;
  const file = join(skillsDir, entry.name, 'SKILL.md');
  if (!existsSync(file)) {
    problems.push(`${entry.name}: missing SKILL.md`);
    continue;
  }
  const frontmatter = /^---\n([\s\S]*?)\n---/.exec(readFileSync(file, 'utf8'))?.[1] ?? '';
  const name = /^name:\s*(.+)$/m.exec(frontmatter)?.[1]?.trim();
  const description = /^description:\s*(.+)$/m.exec(frontmatter)?.[1]?.trim();
  if (name !== entry.name)
    problems.push(`${entry.name}: frontmatter name "${name ?? ''}" must equal the folder name`);
  if (!description) problems.push(`${entry.name}: frontmatter description is missing`);
}

if (problems.length > 0) {
  process.stderr.write(
    `skills: ${problems.length} problem(s)\n${problems.map((p) => `  - ${p}`).join('\n')}\n`,
  );
  process.exit(1);
}
process.stdout.write('skills: ok\n');
