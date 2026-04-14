# Placeholder & TODO Audit

> Generated: 2026-04-14  
> Scope: `apps/` source files (`.ts`, `.tsx`)  
> Excludes: `node_modules`, test fixtures, skill templates, doc comments that are purely explanatory

---

## Priority 1 — Critical / Blocks Production

These are half-implemented pieces that could silently misbehave in production or hide security holes.

### 1.1 `requireAdmin` middleware uses a transitional auth path
**File:** `apps/api/src/middleware/requireAdmin.ts:6`  
**Note:** `#TODO(#12)` — middleware accepts bearer tokens and legacy `x-user-*` headers instead of validating the server-managed session cookie. If someone crafts a header with `role: admin`, they bypass the gate until this is fully replaced with the cookie-backed JWT check.  
**Priority:** 🔴 **P1 — Security**

### 1.2 `AdminRouteGuard` sources auth from placeholder context
**File:** `apps/web/src/app/components/auth/AdminRouteGuard.tsx:24`  
**Note:** `#TODO(#12)` — frontend admin guard reads from a placeholder context instead of the real Auth.js session provider. Corresponds directly to the backend TODO above.  
**Priority:** 🔴 **P1 — Security**

---

## Priority 2 — Functional Gaps / Wrong Behaviour at Runtime

### 2.1 `playerService` is entirely placeholder-backed
**File:** `apps/api/src/services/playerService.ts` (lines 7, 12–51)  
**Note:** `createPlayer`, `getPlayer`, and `updatePlayer` all return hardcoded `placeholderPlayer` data. Players created via the admin flow hit `rosterService` (which is real), but any callers routing through `playerService` get fake data.  
**Priority:** 🟠 **P2 — Data integrity**

### 2.2 `teamService` is entirely placeholder-backed
**File:** `apps/api/src/services/teamService.ts` (lines 10–66)  
**Note:** `createTeam`, `getTeam`, `joinTeam`, and `getTeamMembers` all operate against static fixture data in `placeholderData.ts`. The admin-facing `rosterService` has real DB implementations; the public team endpoints do not.  
**Priority:** 🟠 **P2 — Data integrity**

### 2.3 `gameService` leaderboard falls back to placeholder teams
**File:** `apps/api/src/services/gameService.ts` (lines 17–147)  
**Note:** Race-state responses for specific players and the empty-event leaderboard fallback both serve `placeholderTeam` / `placeholderPlayer` data. In a real event these entries appear as ghost teams on the leaderboard.  
**Priority:** 🟠 **P2 — Data integrity**

### 2.4 `hazardService` falls back to placeholder QR codes
**File:** `apps/api/src/services/hazardService.ts` (lines 10, 47, 76–122)  
**Note:** `getHazard` and `listHazards` return `placeholderQRCodes` when no DB record is found. A real hazard miss should 404, not silently serve fake data.  
**Priority:** 🟠 **P2 — Data integrity**

### 2.5 `rescueService` placeholder fallback for non-existent rescues
**File:** `apps/api/src/services/rescueService.ts:353`  
**Note:** Status poll returns deterministic placeholder rescue flow when no persisted rescue exists. This prevents the UI from showing a clear "no active rescue" state.  
**Priority:** 🟠 **P2 — Data integrity**

### 2.6 Location-aware QR scan validation not implemented
**File:** `apps/web/src/services/game/raceLogic.ts:43`  
**Note:** `// TODO: Implement location-aware validation when backend provides` — QR scans are currently accepted without checking whether the player is physically near the code. Backend endpoint exists but location constraint is not wired up.  
**Priority:** 🟠 **P2 — Game integrity**

---

## Priority 3 — Figma Design Parity Gaps

These are tracked sync points between the Figma design and the live app. They don't break anything in production but create UX divergence.

### 3.1 Login form missing dual-field capture (`email + full name`)
**File:** `apps/web/src/app/pages/Login.tsx:8, 78`  
**Note:** Figma shows a two-field onboarding form (email/phone + full name). Current implementation is single-field magic-link only. The post-login navigation path (→ Garage) also needs reconciliation once the form shape changes.  
**Priority:** 🟡 **P3 — UX parity**

### 3.2 Auth callback / waiting routes diverge from Figma flow
**File:** `apps/web/src/app/routes.tsx:35`  
**Note:** `/login/callback` and `/waiting-assignment` are production routes that don't exist in the simplified Figma route map. The entry flow needs reconciliation.  
**Priority:** 🟡 **P3 — UX parity**

### 3.3 Admin nested routes diverge from single-screen Figma `/admin` contract
**File:** `apps/web/src/app/routes.tsx:96`  
**Note:** App uses `tabs` (`/admin/game-control`, `/admin/teams`, etc.) while Figma treats `/admin` as a single consolidated screen. Expected to be a deliberate split, but noted as an open divergence.  
**Priority:** 🟡 **P3 — UX parity (low risk, intentional divergence likely)**

### 3.4 `Garage.tsx` keyword chips vs description-driven onboarding
**File:** `apps/web/src/app/pages/Garage.tsx:55`  
**Note:** Figma's Team Onboarding shows freeform description input with suggestion chips. Current implementation uses keyword-based generation. Needs alignment before next event.  
**Priority:** 🟡 **P3 — UX parity**

### 3.5 `GameContext` missing `Team.members` roster fields
**File:** `apps/web/src/app/context/GameContext.tsx:17`  
**Note:** `Team` interface lacks `members`, `contactMetadata`, and per-member scoring fields required by the Figma Admin player/team detail and scan-history views.  
**Priority:** 🟡 **P3 — Admin UX parity**

### 3.6 `GameContext` missing `Scan.memberId / teamId / qrCodeId`
**File:** `apps/web/src/app/context/GameContext.tsx:29`  
**Note:** `Scan` interface lacks the identifiers needed by admin scan-history views.  
**Priority:** 🟡 **P3 — Admin UX parity**

### 3.7 `GameContext` missing `qrCodes` and `gameActive` state
**File:** `apps/web/src/app/context/GameContext.tsx:51`  
**Note:** `GameState` doesn't carry QR code inventory or game-active flag expected by Admin QR inventory and race-control screens.  
**Priority:** 🟡 **P3 — Admin UX parity**

### 3.8 `GameContext` missing admin command surface
**File:** `apps/web/src/app/context/GameContext.tsx:62`  
**Note:** No admin action handlers (score adjustments, QR CRUD, game toggle, member updates) in the shared context. Admin pages call services directly as a workaround — fine for now, but context parity would simplify future work.  
**Priority:** 🟡 **P3 — Admin UX parity (low urgency given direct-service pattern)**

---

## Priority 4 — Technical Debt / Cleanup

### 4.1 `placeholderData.ts` module is still imported by production services
**File:** `apps/api/src/services/placeholderData.ts`  
**Note:** This file contains 19+ fixture objects consumed by `playerService`, `teamService`, `gameService`, `hazardService`, and `rescueService`. Once P2 items above are addressed, this file should be deleted entirely (or moved to test fixtures).  
**Priority:** 🔵 **P4 — Cleanup (dependency on P2)**

---

## Summary Table

| # | File | Category | Priority |
|---|------|----------|----------|
| 1.1 | `requireAdmin.ts:6` | Security — transitional auth header accepted | 🔴 P1 |
| 1.2 | `AdminRouteGuard.tsx:24` | Security — placeholder auth context | 🔴 P1 |
| 2.1 | `playerService.ts` | Data — fully placeholder-backed | 🟠 P2 |
| 2.2 | `teamService.ts` | Data — fully placeholder-backed | 🟠 P2 |
| 2.3 | `gameService.ts:17–147` | Data — leaderboard placeholder fallback | 🟠 P2 |
| 2.4 | `hazardService.ts:47–122` | Data — hazard lookup falls back to fixture | 🟠 P2 |
| 2.5 | `rescueService.ts:353` | Data — rescue status returns placeholder | 🟠 P2 |
| 2.6 | `raceLogic.ts:43` | Game integrity — location check not wired | 🟠 P2 |
| 3.1 | `Login.tsx:8,78` | UX — dual-field form not implemented | 🟡 P3 |
| 3.2 | `routes.tsx:35` | UX — auth callback routes diverge | 🟡 P3 |
| 3.3 | `routes.tsx:96` | UX — admin route shape diverges | 🟡 P3 |
| 3.4 | `Garage.tsx:55` | UX — keyword vs description onboarding | 🟡 P3 |
| 3.5 | `GameContext.tsx:17` | UX — Team.members missing | 🟡 P3 |
| 3.6 | `GameContext.tsx:29` | UX — Scan identifiers missing | 🟡 P3 |
| 3.7 | `GameContext.tsx:51` | UX — qrCodes/gameActive missing | 🟡 P3 |
| 3.8 | `GameContext.tsx:62` | UX — admin command handlers missing | 🟡 P3 |
| 4.1 | `placeholderData.ts` | Cleanup — remove after P2s resolved | 🔵 P4 |
