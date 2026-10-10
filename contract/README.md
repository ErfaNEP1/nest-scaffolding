# {{NPM_SCOPE}}/api-contract

The API contract of `{{PROJECT_NAME}}` for front ends and other clients:

- `openapi.json`: the OpenAPI document (`import doc from '{{NPM_SCOPE}}/api-contract/openapi.json'`).
- TypeScript types generated with `openapi-typescript`:

```ts
import type { components, paths } from '{{NPM_SCOPE}}/api-contract';

type Sample = components['schemas']['SampleResponse'];
type ListSamples = paths['/api/v1/samples']['get'];
```

Works with typed clients such as `openapi-fetch`.

## Versioning

SemVer. The version in this `package.json` is also `info.version` of the OpenAPI document.

- Breaking change (removed or renamed field, endpoint or enum value, stricter validation): major.
- New endpoint or optional field: minor.
- Documentation only: patch.

## Build and publish (maintainers)

```bash
pnpm openapi:generate   # in the repository root
pnpm contract:build
pnpm contract:publish   # registry from the {{NPM_SCOPE}}:registry line in the root .npmrc
```
