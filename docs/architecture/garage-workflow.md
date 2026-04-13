# Garage Workflow — Architecture & Flow

## Purpose

The Garage screen is the first screen every player sees after following their team link.
Each player writes a few words describing themselves.  Once all required teammates
have submitted, a shared team logo is generated via AI and revealed to everyone.

---

## System-Wide Flow

```mermaid
flowchart TD
    Player["🏎️ Player opens /garage"]

    A["GET /garage/team/:teamId/status\n(on mount — restores screen state\nafter refresh without re-submitting)"]
    Player --> A

    A -- "logoStatus=READY" --> REVEAL["🎉 Logo Reveal Screen"]
    A -- "logoStatus=GENERATING" --> GENSCREEN["⏳ Generating Screen\n(polls every 4 s)"]
    A -- "mySubmission.status=APPROVED\n& others still pending" --> WAIT["⏸ Waiting Screen\n(polls every 4 s)"]
    A -- "not submitted yet" --> INPUT["✏️ Input Screen\n(textarea + chip suggestions)"]

    INPUT -- "player types & submits" --> SUBMIT["POST /garage/submit"]

    SUBMIT --> MOD["moderateText()\nOpenAI /v1/moderations\nor keyword fallback"]

    MOD -- "safe=false" --> REJECT["❌ REJECTED\nShow policyMessage\nPlayer revises description"]
    REJECT -- "retry" --> INPUT

    MOD -- "safe=true" --> UPSERT["GarageSubmission.upsert\nstatus=APPROVED"]

    UPSERT --> COUNT["COUNT APPROVED\nfor this team"]

    COUNT -- "count < requiredPlayerCount" --> RETURN_WAIT["Return 200 {status:'approved'}\nteamGarageStatus.approvedCount < required"]
    RETURN_WAIT --> WAIT

    COUNT -- "count >= requiredPlayerCount" --> ATOMICFLIP["updateMany WHERE logoStatus IN\n('PENDING','FAILED')\nSET logoStatus='GENERATING'\n(concurrency guard — only one\nrequest wins this flip)"]

    ATOMICFLIP -- "count=0 (already claimed)" --> RETURN_WAIT

    ATOMICFLIP -- "count=1 (won the race)" --> COLLECT["SELECT approved descriptions\nORDER BY createdAt ASC"]

    %% Late-joiner re-generation path
    RETURN_WAIT -- "logoStatus=READY &\napprovedCount > required\n(late joiner)" --> LATEFLIP["updateMany WHERE\nlogoStatus IN ('PENDING','FAILED','READY')\nSET logoStatus='GENERATING'"]
    LATEFLIP -- "count=1" --> COLLECT
    LATEFLIP -- "count=0" --> RETURN_WAIT

    COLLECT --> N8N["generateTeamLogo()\n→ POST n8n webhook (JWT-signed HS512)\n→ OpenAI image generation\n→ upload to storage\n← returns imageUrl or imageFileName"]

    N8N -- "success\n(imageUrl or\nSTORAGE_BASE_URL + imageFileName)" --> PERSIST["UPDATE team SET\nlogoUrl=imageUrl\nlogoStatus='READY'\nlogoGeneratedAt=now()"]

    N8N -- "failure" --> FAILED["UPDATE team SET\nlogoStatus='FAILED'\n(next approved submission retries)"]

    PERSIST --> RETURN_GEN["Return 200 {status:'approved'}\nteamGarageStatus.logoStatus='READY'"]
    RETURN_GEN --> REVEAL

    WAIT -- "polls hit logoStatus='GENERATING'" --> GENSCREEN
    GENSCREEN -- "polls hit logoStatus='READY'" --> REVEAL

    REVEAL -- "player clicks 'Enter Race Hub'" --> RACEHUB["🏁 Race Hub (/race-hub)"]
```

---

## UI State Machine

```mermaid
stateDiagram-v2
    [*] --> LOADING : mount
    LOADING --> INPUT : status fetch succeeds\n(not yet submitted)
    LOADING --> WAITING : status fetch succeeds\n(submitted, others pending)
    LOADING --> GENERATING : status fetch succeeds\n(logoStatus=GENERATING)
    LOADING --> LOGO_REVEAL : status fetch succeeds\n(logoStatus=READY)
    LOADING --> INPUT : status fetch fails\n(graceful fallback)

    INPUT --> SUBMITTING : player clicks Submit
    SUBMITTING --> REJECTED : policyMessage in response
    SUBMITTING --> WAITING : approved, others pending
    SUBMITTING --> GENERATING : approved, quota met\nlogoStatus=GENERATING
    SUBMITTING --> LOGO_REVEAL : approved, logo already READY
    SUBMITTING --> ERROR : network / 5xx

    REJECTED --> INPUT : player revises text

    ERROR --> INPUT : player retries

    WAITING --> GENERATING : poll detects GENERATING
    GENERATING --> LOGO_REVEAL : poll detects READY

    LOGO_REVEAL --> [*] : navigate to /race-hub
```

---

## Module Map

```
packages/api-contract/
  src/contracts/garage.ts          ← shared TypeScript types (GarageSubmitRequest, TeamGarageStatus, …)
  src/schemas/garageSchemas.ts     ← Zod validation schemas consumed by API validate() middleware

apps/api/
  prisma/schema.prisma             ← GarageSubmission model + Team garage fields
  src/config/env.ts                ← Garage env vars: N8N_IMAGE_API_URL, N8N_IMAGE_API_KEY,
                                     OPENAI_API_KEY, GARAGE_REQUIRED_PLAYER_COUNT
  src/services/moderationService.ts  ← OpenAI /v1/moderations call (keyword fallback in dev)
  src/services/garageService.ts      ← core business logic: submit, quota check, logo trigger
  src/services/n8nService.ts         ← n8n webhook client for logo generation (JWT-signed, dev fallback)
  src/routes/garage.ts               ← POST /garage/submit,  GET /garage/team/:id/status
  src/routes/index.ts                ← garageRouter registered here

apps/web/
  src/hooks/usePlayerSession.ts         ← reads playerId/teamId/eventId from auth session (dev fallback)
  src/services/garage/garageService.ts  ← typed HTTP wrappers (submit, getTeamStatus)
  src/app/pages/Garage.tsx              ← UI state machine + render branches
```

---

## Database Tables Involved

| Table | Purpose |
|---|---|
| `Team` | Holds `requiredPlayerCount`, `logoUrl`, `logoStatus`, `logoGeneratedAt` |
| `GarageSubmission` | One row per (player, team) — `APPROVED` rows count toward quota. Tracks `moderatedAt` timestamp for audit. |
| `Player` | Looked up for `totalMembers` count |
| `Event` | FK on GarageSubmission |

---

## Concurrency Note

Two players submitting at the same millisecond could both see `approvedCount >= requiredPlayerCount`.
The logo generation race is resolved by a conditional `updateMany` that only flips `logoStatus` from
`PENDING|FAILED → GENERATING` (or `PENDING|FAILED|READY → GENERATING` for late-joiner re-generation).
Prisma returns `count` of updated rows — only the winner (`count=1`) proceeds to call n8n.  The loser
exits silently.  The winner's n8n call is dispatched via `setImmediate()` (fire-and-forget) and runs
to completion, setting `logoStatus=READY`; subsequent polls on either player's client will see the result.

---

## Re-generation on Late Joiners

`triggerLogoGeneration` always collects **all current APPROVED descriptions** before building the
prompt, not just the one that just came in.  This means:

- When Player 3 submits after Player 1 & 2 already have a logo, a new generation is fired.
- The new logo includes all three descriptions.
- Both old and new players see the updated logo on their next poll.

This is intentional and matches the spec requirement:
> "once a new member joins the new logo needs to be generated and updated on the team pic"
