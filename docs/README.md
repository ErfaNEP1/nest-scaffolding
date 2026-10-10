# Documentation

This folder is the source of truth for the service. Code follows these documents.

## Precedence

1. `docs/project/`: business truth (what the system must do).
2. `docs/architecture/adr/`: technical decisions.
3. Other files in `docs/`: conventions and guides.
4. Code follows docs. If code and docs disagree, or two docs disagree, do **not** guess:
   stop and report the conflict.

Business documents and technical documents stay in separate folders.

## What lives where

| Path                          | Content                                                                                                            |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `project/`                    | Business documents of the project, any format. List them below.                                                    |
| `architecture/overview.md`    | How the service is built: layers, request flow, job flow.                                                          |
| `architecture/stack.md`       | Every dependency, its version and why it is here.                                                                  |
| `architecture/adr/`           | Architecture decision records.                                                                                     |
| `api/conventions.md`          | URLs, versioning, errors, pagination, ids, dates, money.                                                           |
| `database/conventions.md`     | Naming, migrations, TypeORM rules, transactions, locking.                                                          |
| `operations/configuration.md` | Every environment variable.                                                                                        |
| `operations/observability.md` | Health endpoints, metrics, log fields, tracing.                                                                    |
| `operations/runbook.md`       | Start, stop, migrate, common failures.                                                                             |
| `guides/`                     | Step-by-step guides: getting started, modules, endpoints, migrations, jobs, AI agents, removing the sample module. |

## Project documents

<!-- List every file in docs/project/ here with one line on what it covers. -->

_None yet._
