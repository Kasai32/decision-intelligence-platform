# Coding Standards

Applies to all workspaces (`apps/*`, `packages/*`) unless a workspace-local doc explicitly overrides a rule (it should say why).

## Language & tooling

- TypeScript only, `strict: true` (see `tsconfig.base.json`). No `any` without a `// eslint-disable-next-line` comment explaining why.
- Formatting is Prettier, enforced in CI (`npm run format:check`). Never hand-format; run `npm run format` before committing.
- Linting is ESLint, enforced in CI (`npm run lint`). Fix warnings, don't suppress them, unless the suppression comment explains the specific reason.
- Node >= 20 (see root `package.json` `engines`).

## Naming

- Files: `kebab-case.ts` (e.g. `tenant-scope.guard.ts`), except React components: `PascalCase.tsx`.
- Classes/Types/Interfaces: `PascalCase`. Do not prefix interfaces with `I`.
- Variables/functions: `camelCase`. Constants that are truly immutable module-level config: `UPPER_SNAKE_CASE`.
- NestJS artifacts follow Nest's own suffix convention: `*.controller.ts`, `*.service.ts`, `*.module.ts`, `*.guard.ts`, `*.dto.ts`, `*.entity.ts`.

## Structure

- One exported class/component per file, file named after it.
- No circular imports between `apps/*` and `packages/*` — dependency direction is always `apps/* → packages/shared`, never the reverse.
- Business logic lives in services, not controllers/components. Controllers/components stay thin (validation + delegation).
- Shared types/DTOs that cross the api/web boundary belong in `packages/shared`, not duplicated in both apps.

## Testing

- Every new module ships with at least one test file alongside it (`*.spec.ts`).
- Tests must be deterministic — no reliance on real network calls, real time, or execution order. Mock external I/O.
- A PR that adds a service/controller/component without a corresponding test is incomplete.

## Git & commits

- Commit messages: imperative mood, short summary line (<72 chars), body explains _why_ when not obvious.
- No direct commits bypassing CI once a remote/CI is active for the repo.
- Each ADR-worthy decision (see `docs/adr/README.md`) is committed alongside the code change it justifies, not after the fact.

## Errors & validation

- Validate at system boundaries only (API input via DTOs/class-validator, external integration responses) — do not re-validate internal, already-typed data.
- Don't add defensive code for states the type system already rules out.
- Prefer typed exceptions (NestJS `HttpException` subclasses) over generic `Error` in `apps/api`.

## Comments

- Default to none. A comment is only added when it explains a non-obvious _why_ (a constraint, a workaround, an invariant) — never a _what_ a well-named identifier already conveys.

## Security baseline (expanded per-phase as features land)

- Never commit secrets/credentials — see `.gitignore` and the `gitleaks` CI step in `.github/workflows/ci.yml`.
- All environment-specific config goes through environment variables, never hardcoded.
- From Phase 2 onward: every mutating endpoint requires an explicit auth guard; there is no "temporarily unauthenticated" endpoint in shipped code.
