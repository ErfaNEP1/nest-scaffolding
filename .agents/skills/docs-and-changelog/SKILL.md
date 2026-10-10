---
name: docs-and-changelog
description: Use when finishing any change, to update README files, the module README, CHANGELOG.md, ADRs and other docs according to AGENTS.md section 10. Includes good and bad examples.
---

# Docs and changelog

Rules: `AGENTS.md` section 10. Do this in the same commit as the code.

## Checklist

| Changed | Update |
|---|---|
| Module code, endpoints, jobs, tables | `src/modules/<name>/README.md` |
| Scripts, setup, structure | Root `README.md` |
| Anything visible to API consumers, operators or developers | `CHANGELOG.md` → `## [Unreleased]` |
| Env var | `docs/operations/configuration.md`, `.env.example`, schema |
| Metric or log field | `docs/operations/observability.md` |
| Convention | Matching file in `docs/api/`, `docs/database/`, `docs/guides/` |
| New runtime dependency, infrastructure piece, cross-cutting pattern, or deviation from rules | ADR in `docs/architecture/adr/` (copy `0000-template.md`) and `docs/architecture/stack.md` |

## CHANGELOG

Sections: Added, Changed, Deprecated, Removed, Fixed, Security. One line per change, for the reader, ticket id if any.

Good:

```markdown
### Added
- `GET /api/v1/orders/{id}/invoice` returns the invoice PDF link (ORD-142).
### Changed
- **BREAKING:** `POST /api/v1/orders` requires `currency` (ISO 4217). Clients must send it; contract 2.0.0.
### Fixed
- Listing orders no longer skips items that share a creation timestamp.
```

Bad:

```markdown
- Updated order service.            # internal, says nothing to the reader
- Refactored repository (#12).      # no visible effect: no entry needed
- Fixed bug.                        # which bug, what effect?
```

Never edit a released section. Releasing moves `[Unreleased]` into `## [x.y.z] - YYYY-MM-DD`.

## README style

Short sentences, real commands, no marketing. Good: "Run `pnpm db:migrate` to apply pending migrations." Bad: "Our powerful migration system seamlessly handles your schema."

## ADR

Copy `docs/architecture/adr/0000-template.md` to the next number. Status starts as `Proposed`; becomes `Accepted` after review. Superseded ADRs stay, with a link to the new one.
