# Getting started

## 1. Requirements

- Node.js 24 (`.nvmrc`; with nvm: `nvm use`)
- pnpm via Corepack: `corepack enable` (the version is pinned in `package.json`)
- Docker with Compose

## 2. New project from the template

```bash
git clone <template-url> orders-api && cd orders-api
corepack enable && pnpm install
pnpm template:init --name orders-api --scope @acme          # add --remove-sample when ready
```

## 3. Run it

```bash
cp .env.example .env
docker compose up --build                 # postgres -> migrate -> api + worker
curl localhost:3000/health/ready
open http://localhost:3000/api/docs       # API reference (DOCS_ENABLED=true)
```

Or run the app on the host with watch mode:

```bash
docker compose up -d postgres migrate
pnpm dev            # API on :3000
pnpm dev:worker     # worker, probes on :3001
```

## 4. Call a protected endpoint

```bash
docker compose --profile auth up -d keycloak     # realm "dev", takes ~20 s
TOKEN=$(curl -s -d grant_type=password -d client_id=web -d username=alice -d password=alice \
  http://localhost:8080/realms/dev/protocol/openid-connect/token | jq -r .access_token)
curl -s -H "Authorization: Bearer $TOKEN" -H 'content-type: application/json' \
  -d '{"name":"first"}' http://localhost:3000/api/v1/samples
```

Users: `alice`/`alice` (roles `user`, `admin`), `bob`/`bob` (role `viewer`: signed in but not allowed to use the sample endpoints, so you get 403). Machine client:
`service` / `service-secret` (client credentials).

## 5. Before every commit

```bash
pnpm verify      # lint, format, types, unit + integration tests, OpenAPI up to date
pnpm test:e2e    # when endpoints changed
```

Git hooks run ESLint/Prettier on staged files and check the commit message
(Conventional Commits).

## 6. Next

- Rules: `AGENTS.md`. Architecture: `docs/architecture/overview.md`.
- Put business documents in `docs/project/` and list them in `docs/README.md`.
- Add your first module: `docs/guides/adding-a-module.md`.
