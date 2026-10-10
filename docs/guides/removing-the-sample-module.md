# Removing the sample module

The sample module shows every convention once. Remove it before the first deployment,
once your own first module exists.

## Automatic

```bash
pnpm template:init --name <name> --scope <@scope> --remove-sample    # when initializing
```

## By hand

Delete:

| Path                                        | What it is                                                                                                         |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `src/modules/sample/`                       | The module (code, unit tests, README)                                                                              |
| `db/migrations/0002_sample.sql`             | Its table. Only if it was never applied to a shared database; otherwise add a migration with `DROP TABLE samples;` |
| `test/integration/sample/`                  | Repository integration tests                                                                                       |
| `test/e2e/sample.e2e-spec.ts`               | E2E tests                                                                                                          |
| `test/support/factories.ts`                 | `createSample` factory (keep the file if you added your own factories)                                             |
| `docs/guides/removing-the-sample-module.md` | This guide                                                                                                         |

Edit:

- `src/feature-modules.ts`: remove the `SampleModule` import and entry.
- `docs/operations/observability.md`: remove `app_sample_created_total`.
- `contract/README.md`: replace the `SampleResponse_Output` example with one of your types.
- `AGENTS.md` and `.agents/skills/*`: they point to the sample module as the reference
  implementation; point them to your own reference module instead.

Then:

```bash
pnpm openapi:generate      # the sample endpoints disappear from openapi/openapi.json
pnpm verify && pnpm test:e2e
```

Add a CHANGELOG line ("Removed: sample module") if the API was ever published.
