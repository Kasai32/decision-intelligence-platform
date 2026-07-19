# API Reference

No public API surface exists yet — `apps/api` currently exposes only a health-check endpoint (`GET /health`) as part of the Phase 1 scaffold.

This section will be populated starting in Phase 2 (Authentication, RBAC, Tenant Management, API Gateway, Core Database), once real endpoints exist. Preferred approach: generate from NestJS's OpenAPI (`@nestjs/swagger`) decorators rather than hand-maintaining a separate spec, to avoid drift — to be set up as part of Phase 2's API Gateway module.
