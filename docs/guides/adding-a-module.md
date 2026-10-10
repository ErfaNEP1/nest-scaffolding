# Adding a module

A module is one business capability in `src/modules/<name>/`. The sample module
(`src/modules/sample/`) is the reference; the `new-module` skill
(`.agents/skills/new-module/SKILL.md`) has the full checklist.

1. Read the business rules in `docs/project/`.
2. Create the folder with the files you need: `<name>.module.ts`, `index.ts`, controller,
   service, repository, entity, DTOs, errors, and `README.md` from
   `.agents/skills/new-module/templates/README.md`.
3. Tables: `pnpm db:new <name>_init` (see `adding-a-migration.md`).
4. Register the module in `src/feature-modules.ts`.
5. Export only the public API from `index.ts`. Other modules import nothing else
   (ESLint fails otherwise).
6. Endpoints: `adding-an-endpoint.md`. Jobs: `adding-a-job.md`.
7. Tests: unit (service), integration (repository), e2e (endpoints).
8. README, CHANGELOG, `pnpm openapi:generate`, `pnpm verify`.
