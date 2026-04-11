# ADR-0005: Adopt custom stateless magic-link/session auth over Auth.js

**Date:** 2026-04-10  
**Status:** Accepted  
**Deciders:** Engineering

---

## Context

Feature #3 originally referenced Auth.js email authentication with SendGrid. During implementation, the team built a custom auth flow directly in the API and web clients instead:

- API magic-link and session flow in `authService.ts`
- HMAC-signed stateless tokens in `authTokens.ts`
- Session token extraction from bearer/cookie in `authSessionToken.ts`
- Frontend auth state and token persistence in `authClient.ts`

At the same time, outbound email moved to n8n + Mailtrap (ADR-0004), so the original Auth.js + SendGrid plan no longer matches the running architecture.

## Decision

Use the existing custom auth service as the canonical authentication architecture for Velocity GP, and do not adopt Auth.js for the current product scope.

Concretely:

1. Authentication continues to be roster-gated by canonical `workEmail` and active event enrollment.
2. Magic-link tokens and session tokens remain stateless, HMAC-signed payloads verified by API code.
3. Sessions are API-validated per request from bearer token or auth cookie, with assignment-aware access controls.
4. Magic-link delivery uses the n8n + Mailtrap dispatch path defined in ADR-0004.

## Consequences

**Positive**
- Auth behavior is fully explicit in first-party code and tied directly to roster/assignment domain rules.
- No framework adapter overhead for event-specific access semantics (`AUTH_ASSIGNMENT_REQUIRED`, active-event gating, routing decisions).
- Token/session mechanics are testable at service boundaries without external auth provider coupling.
- Implementation and backlog language are aligned with current production direction.

**Negative / trade-offs**
- The team owns token security, rotation strategy, revocation semantics, and session hardening responsibilities normally handled by Auth.js.
- Future social login/OAuth expansion will require additional custom implementation.
- Compliance and threat-model rigor depends on internal discipline instead of external framework defaults.

## Alternatives considered

- **Adopt Auth.js now**: rejected because current implementation is already functional and coupled to custom roster/assignment checks, and migration would add non-trivial refactor risk.
- **Hybrid model (Auth.js session + custom eligibility checks)**: rejected due to split responsibilities and complexity.
- **External identity provider**: out of scope for current event workflow requirements.

## References

- `apps/api/src/services/authService.ts`
- `apps/api/src/services/authTokens.ts`
- `apps/api/src/services/authSessionToken.ts`
- `apps/web/src/services/auth/authClient.ts`
- `docs/adr/0004-email-provider-sendgrid-to-n8n-mailtrap.md`
