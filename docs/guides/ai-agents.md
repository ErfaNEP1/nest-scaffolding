# AI agents: how rules and skills are wired

`AGENTS.md` is the single rule file for people and AI agents. Skills (task playbooks) live
once in `.agents/skills/<name>/SKILL.md`. Nothing is copied by hand.

## Per tool (checked 2026-10-10)

| Tool        | Rules                                                                                                      | Skills                                                                                                                               |
| ----------- | ---------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| Claude Code | `CLAUDE.md` contains `@AGENTS.md` (imports it).                                                            | Reads `.claude/skills/`; `.claude/skills` is a symlink to `../.agents/skills`. Claude Code follows symlinks and loads a target once. |
| Codex       | Reads `AGENTS.md` natively.                                                                                | Reads `.agents/skills/` from the working directory up to the repository root.                                                        |
| Cursor      | `.cursor/rules/000-agents.mdc` (`alwaysApply: true`) points to `AGENTS.md`; Cursor also reads `AGENTS.md`. | Reads `.agents/skills/` (and `.claude/skills/` for compatibility, which is the same folder through the symlink).                     |

Sources: [Claude Code skills](https://code.claude.com/docs/en/skills),
[Codex skills](https://developers.openai.com/codex/skills),
[Cursor skills](https://cursor.com/docs/skills).

Known caveats:

- Some Cursor versions discover skills in `.agents/skills` but did not list them in the
  agent's prompt (reported on the Cursor forum). The rule file tells the agent where the
  skills are, so it can read them anyway.
- Because Cursor reads both folders, it may list each skill twice. Harmless.
- Skill frontmatter uses only the portable Agent Skills fields (`name`, `description`;
  optionally `license`, `compatibility`, `metadata`, `allowed-tools`). Tool-specific fields
  break other tools.

## Keeping the wiring correct

```bash
pnpm skills:sync           # recreate .claude/skills -> ../.agents/skills, check frontmatter
pnpm skills:sync --check   # what pnpm verify runs
```

On Windows, enable symlinks before cloning (`git config --global core.symlinks true` and
Developer Mode), or run `pnpm skills:sync` after cloning: it creates a directory junction.

## Our skills

See the table in `AGENTS.md` section 12. Each skill is short and points to `docs/` and the
sample module instead of repeating them. Write new skills with the `skill-creator` skill;
keep `name` equal to the folder name and make `description` say **when** to use it.

## Third-party skills

Vendored copies of public skills live next to ours and are listed in
`.agents/skills/THIRD_PARTY.md` (source repository, commit, license, date, local changes).
Rules:

1. Only original repositories, never forks with similar names.
2. Read every file before adding it. Remove anything that runs scripts, downloads files,
   sends data out or changes git settings, and record the removal in `THIRD_PARTY.md`.
3. The license must allow copying into a private repository.
4. Do not edit vendored files to resolve conflicts with our rules. Add a line to
   "Project overrides" in `AGENTS.md` section 12 instead. Our rules always win.
5. `find-skills` may only search and suggest. Agents never run `npx skills add` and never
   use a skill that is not in `.agents/skills/`.

### Adding or updating a third-party skill (manual, reviewed)

```bash
# in a scratch directory, not in the repository
npx skills add <owner/repo> --skill <name>       # check `npx skills --help` for current flags
```

1. Read every file of the skill. Apply rule 2.
2. Copy the skill folder into `.agents/skills/<name>/`.
3. Update `THIRD_PARTY.md` (commit SHA, license, date, local changes) and the override list
   in `AGENTS.md` if the skill conflicts with our rules.
4. `pnpm skills:sync --check`, then open a pull request with a CHANGELOG entry
   ("Changed: updated vendored skill X to <sha>"). A reviewer reads the diff of the skill.
