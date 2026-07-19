# Glossary

Domain terms as used specifically in this codebase (from [PREREQUIS.md](../PREREQUIS.md)). Definitions will sharpen as each phase is implemented — treat these as working definitions until the corresponding phase lands.

| Term                               | Meaning in this platform                                                                                                                                               |
| ---------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Decision Intelligence Platform** | The overall product: helps organizations track incidents/decisions, generate evidence-backed recommendations, and produce executive reporting.                         |
| **Executive Command Center**       | The top-level dashboard surface (Phase 3) an executive uses to monitor incidents and decisions in flight.                                                              |
| **Incident Timeline**              | Chronological view (Phase 3) of events for a given incident.                                                                                                           |
| **Decision Timeline**              | Chronological view (Phase 3) of decisions made in response to an incident — distinct from the Incident Timeline, which tracks what _happened_, not what was _decided_. |
| **Decision Intelligence Engine**   | The Phase 4 subsystem that turns raw evidence into recommendations with an associated confidence score.                                                                |
| **Evidence Collection**            | Phase 4 subsystem responsible for gathering the source data (from integrations, manual input, etc.) that the Recommendation Engine reasons over.                       |
| **Recommendation Engine**          | Phase 4 subsystem that proposes a course of action from collected evidence.                                                                                            |
| **Confidence Model**               | Phase 4 subsystem that scores how confident the platform is in a given recommendation — a first-class, inspectable number, not a black box.                            |
| **Business Impact Analysis**       | Phase 4 subsystem that translates an incident/decision into business-facing impact terms (cost, risk, downtime, etc.).                                                 |
| **Executive Brief**                | Phase 5 auto-generated summary document aimed at executive/leadership audiences.                                                                                       |
| **Decision Report**                | Phase 5 document capturing a specific decision, its evidence, and its outcome.                                                                                         |
| **Lessons Learned**                | Phase 5 knowledge artifact capturing retrospective insight from a closed incident/decision.                                                                            |
| **Tenant**                         | A single customer organization using the platform; all Phase 2+ data is scoped by tenant.                                                                              |
| **API Gateway (module)**           | The Phase 2 NestJS module boundary through which all external traffic (UI + Phase 6 integrations) is routed.                                                           |
