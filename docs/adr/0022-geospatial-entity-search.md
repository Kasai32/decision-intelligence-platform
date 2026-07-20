# 0022. Geospatial entity search — mapping where things happened

Date: 2026-07-20

## Status

Accepted

## Context

Third of the four intelligence-mission pillars (ADR-0021's context): "geospatial analysis — mapping where things happened." The entity-relationship graph already lets a `LOCATION` entity exist and be linked to people/organizations/events via `Relationship`; what it couldn't do yet was answer "what's near this point" or "show me everything with a known location" — the actual geospatial query an analyst needs.

## Decision

`Entity` gains real, queryable `latitude`/`longitude` columns (plain `Float?`, WGS84) — not buried in the existing free-form `attributes` JSON, since geospatial search needs to filter and sort on them directly. Both or neither: `CreateEntityDto` validates that if either coordinate is present, both must be (`@ValidateIf`), range-checked (`-90..90`, `-180..180`) — never a half coordinate silently persisted.

Two new read endpoints, both logged to the audit log (ADR-0021) with the same enforced-`reason` purpose-limitation rule every other entity read follows:

- **`GET /entities/nearby`** — every entity within a given radius of a point, sorted nearest-first, with a real computed `distanceKm` on each result.
- **`GET /entities/map`** — every located entity for the tenant, no radius filter, for rendering a full map view once a UI exists for it.

**Distance is computed in application code via the Haversine formula (`entities/geospatial.ts`), not a PostGIS query.** Given the entity counts this platform will see at its current stage, fetching a tenant's located entities via a normal Prisma query and computing/filtering/sorting distance in JavaScript is simpler, needs no new Postgres extension or Docker image change, and stays entirely within Prisma's normal type-safe query builder (so it's automatically RLS-scoped through the existing tenant-aware proxy, with no raw SQL to audit for correctness). `haversineDistanceKm()` is verified against real, well-known distances between real cities (New York–London, Washington D.C.–New York), not synthetic coordinates.

## Consequences

- No spatial index exists — `nearby`/`map` both fetch every located entity for the tenant and filter/sort in memory. Fine at this stage's scale (a single tenant's located-entity count); if that count grows large enough for this to become a real cost, the natural next step is PostGIS (`geography(Point, 4326)` column + a GiST index + `ST_DWithin` queries) rather than optimizing the in-memory version further.
- Every entity type can carry coordinates, not just `LOCATION` — an `ORGANIZATION`'s headquarters or a specific `EVENT`'s location are equally valid uses; the schema doesn't restrict this, matching the existing "flexible, not over-constrained" philosophy already used for `attributes`.
- `nearby`/`map` are additive reads on the existing `Entity` model — no new tables, no new RLS policy needed (the existing `entities` table policy already covers the new columns).
- No frontend map visualization exists yet — these are API-layer only, same disclosed scope boundary ADR-0021 drew for the graph itself.

## Alternatives considered

- **PostGIS from the start.** Rejected for now — a real Postgres extension change (new Docker image for `docker-compose.yml` and testcontainers both), a new Prisma `Unsupported("geography...")` column type requiring raw SQL for every spatial query, for a capability this stage doesn't need yet. The disclosed migration path above (revisit once real scale justifies it) is the honest way to defer this without pretending the current approach scales indefinitely.
- **Storing coordinates only in the existing `attributes` JSON field.** Rejected — JSON fields can't be efficiently filtered or sorted by Postgres in a normal indexed query; geospatial search is exactly the use case that needs real columns.
- **A single combined "search" endpoint with optional geospatial parameters bolted onto `SearchEntitiesDto`.** Rejected in favor of a dedicated `nearby` endpoint — mixing "text search with optional radius" into one DTO makes the required-parameter logic (lat/lng/radius all required together, but only when doing a geospatial search) far messier than two small, single-purpose endpoints.
