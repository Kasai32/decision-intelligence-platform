# 0005. Authentication: self-hosted email/password + JWT

Date: 2026-07-19

## Status

Accepted

## Context

Phase 2 requires Authentication. Two broad paths exist: buy (Auth0, Clerk, WorkOS, etc.) or build (NestJS + Passport + JWT, self-hosted). This is being decided and built by an autonomous agent with no ability to create third-party accounts, obtain API keys, or make a paid-vendor commitment on the user's behalf.

## Decision

Self-hosted authentication: `apps/api`'s `AuthModule` implements email/password registration and login, password hashing with `argon2`, and short-lived JWT access tokens + longer-lived rotating refresh tokens (refresh tokens persisted in the `RefreshToken` table so they can be revoked). Implemented with `@nestjs/passport` + `passport-jwt`.

## Consequences

- No external account/vendor dependency — buildable and testable entirely within this environment, consistent with the autonomous build constraint.
- The team owns password-reset, email-verification, and eventual SSO/SAML flows instead of getting them for free from a vendor — real ongoing cost, explicitly accepted here as a tradeoff, not overlooked.
- Refresh tokens are stored server-side (not just stateless JWT), so a compromised token can be revoked — a deliberate choice over pure stateless JWT, which cannot be revoked before expiry.
- No email delivery provider is configured yet (see `memory/context.md` open questions), so email-verification/password-reset flows are out of scope for this Phase 2 cut — accounts are active immediately on registration. This is a known gap to close before real production traffic, not before Phase 2 "foundation" is considered done.
- Switching to a third-party provider later remains possible (the `AuthModule` is isolated behind its own service boundary) but would require a migration of the `User`/credential model — not a zero-cost pivot.

## Alternatives considered

- **Auth0 / Clerk / WorkOS (buy)** — faster to a production-grade feature set (SSO, MFA, breach detection) but requires an account and API keys that don't exist in this environment; cannot be wired up by an autonomous agent without those credentials. Explicitly the right call to revisit with the user before real customers are onboarded, given the roadmap's enterprise/SSO-adjacent audience.
- **Session-cookie based auth instead of JWT** — simpler revocation story, but `apps/web` and `apps/api` are deployed as separate origins/services; JWT is the more standard fit for a decoupled SPA/API architecture and for the eventual mobile/API-consumer use cases enterprise integrations (Phase 6) imply.
