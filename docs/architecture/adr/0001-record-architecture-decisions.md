# 0001. Record architecture decisions

- Status: Accepted
- Date: 2026-10-10
- Deciders: template maintainers

## Context

Decisions about structure, dependencies and cross-cutting patterns get lost in chat and
pull requests. New developers and AI agents need to know why things are the way they are,
and which rules they may not change on their own.

## Decision

We record architecture decisions as short Markdown files in `docs/architecture/adr/`,
numbered `NNNN-title.md`, using `0000-template.md`. An ADR is required for: a new runtime
dependency or infrastructure piece, a change to a cross-cutting pattern, or any deviation
from the rules in `AGENTS.md`. Status goes Proposed → Accepted, or Superseded with a link.
Accepted ADRs are not rewritten; a new ADR supersedes an old one.

## Alternatives considered

- Wiki pages: drift from the code and are not reviewed with it.
- Only commit messages: hard to find, no status.

## Consequences

Decisions are reviewed like code and versioned with it. `docs/README.md` defines ADRs as the
second source of truth after `docs/project/`.
