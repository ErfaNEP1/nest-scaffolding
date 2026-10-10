# {{PROJECT_NAME}}

Backend service built from the NestJS backend template.

## Requirements

- Node.js 24 (see `.nvmrc`)
- pnpm through Corepack: `corepack enable`
- Docker (for PostgreSQL, integration tests and the local stack)

## Quick start

```bash
corepack enable
pnpm install
cp .env.example .env
pnpm dev
```

## Scripts

| Script                         | What it does                                          |
| ------------------------------ | ----------------------------------------------------- |
| `pnpm dev`                     | Run the API with watch mode (SWC).                    |
| `pnpm build`                   | Compile `src/` to `dist/` with `tsc`.                 |
| `pnpm start`                   | Run the compiled API.                                 |
| `pnpm lint` / `pnpm lint:fix`  | ESLint, including architecture boundary rules.        |
| `pnpm format`                  | Format all files with Prettier.                       |
| `pnpm typecheck`               | Type-check the whole repo.                            |
| `pnpm test` / `pnpm test:unit` | Unit tests (`src/**/*.spec.ts`).                      |
| `pnpm test:int`                | Integration tests (`test/integration`, needs Docker). |
| `pnpm test:e2e`                | End-to-end tests (`test/e2e`, needs Docker).          |
| `pnpm test:cov`                | Unit tests with coverage thresholds.                  |
| `pnpm verify`                  | Everything that must pass before a change is done.    |
