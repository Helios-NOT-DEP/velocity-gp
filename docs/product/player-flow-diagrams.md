# Player Sequence Diagrams

This document shows how the Velocity GP application should behave for player actions using Mermaid sequence diagrams only. The persona BDD specs are the behavior source of truth, and current route/API names are included where they already exist in the app.

## Source References

- [Velocity GP BDD Specifications](./Velocity%20GP%20BDD%20Specifications.md)
- [Persona 1: Player Event Attendee](./persona/player-event-attendee.md)
- [Persona 2: Helios Player App Creator](./persona/helios-player-app-creator.md)
- [Persona 4: System Backend Sync](./persona/system-backend-sync.md)

## 1. Logging In and Authentication

``` mermaid
sequenceDiagram
  autonumber
  actor Player
  participant LoginUI as Login Screen<br/>Current route '/'
  participant AuthClient as Auth Client / Session Layer
  participant BFF as Velocity GP BFF/API
  participant AuthProvider as Magic-Link Provider
  participant Store as Player + Team Store
  participant GarageUI as Garage<br/>Current route '/garage'
  participant RaceHubUI as Race Hub<br/>Current route '/race-hub'

  Player->>LoginUI: Enter work email, personal contact, and full name
  Player->>LoginUI: Submit login/sign-up form

  alt Intended passwordless flow from BDD
    LoginUI->>AuthClient: Request magic link for player identity
    AuthClient->>BFF: Create authentication request and player lookup
    BFF->>Store: Find/create player and inspect team assignment + team status
    BFF->>AuthProvider: Send secure magic link to provided channel
    AuthProvider-->>Player: Deliver magic link
    LoginUI-->>Player: Show "Check your messages for your secure access link!"
    Player->>AuthProvider: Open secure magic link
    AuthProvider->>AuthClient: Exchange token / establish authenticated session
    AuthClient->>BFF: Fetch player profile and team assignment
    BFF->>Store: Load player, team membership, and activation state

    alt Player is first teammate and team identity is not activated
      BFF-->>AuthClient: Return player session + requires team setup
      AuthClient-->>GarageUI: Redirect to AI Design Studio
      GarageUI-->>Player: Show team creation flow
    else Player's team already active
      BFF-->>AuthClient: Return player session + active team
      AuthClient-->>RaceHubUI: Show 5-second "Welcome to the Paddock" handoff, then Race Hub
      RaceHubUI-->>Player: Show scanner, score, rank, and team identity
    end
  else Current local demo flow in React
    LoginUI->>LoginUI: Call GameContext.login(name, email)
    LoginUI->>AuthClient: Track auth_login_submitted analytics event
    LoginUI-->>GarageUI: Navigate directly to '/garage'
    GarageUI-->>Player: Show AI Design Studio immediately
  end
```

## 2. Creating and Activating a Team in the Garage

```mermaid
sequenceDiagram
  autonumber
  actor Player
  actor Teammates
  participant GarageUI as Garage / AI Design Studio<br/>Current route '/garage'
  participant Policy as Policy Safety Filter
  participant GenAI as GenAI Design Service
  participant BFF as Velocity GP BFF/API
  participant Store as Team + Player Store
  participant RaceHubUI as Race Hub<br/>Current route '/race-hub'

  Player->>GarageUI: Enter words describing themselves
  Player->>GarageUI: Submit self-description for team logo generation

  alt Intended production behavior
    GarageUI->>Policy: Validate player self-description terms
    alt Description terms violate policy
      Policy-->>GarageUI: Reject unsafe terms
      GarageUI-->>Player: Show "Inappropriate terms detected. Please try again."
    else Description terms are allowed
      Policy-->>GarageUI: Approve self-description submission
      GarageUI->>BFF: Save player description for the player's assigned team
      BFF->>Store: Persist player description against playerId + teamId
      BFF->>Store: Check whether every member of the preassigned team has submitted a description

      alt Not all teammates have submitted yet
        Store-->>BFF: Return team pending member descriptions
        BFF-->>GarageUI: Return waiting-for-teammates status
        GarageUI-->>Player: Show "Waiting for teammates" state with submitted/self-description confirmation
        Teammates->>GarageUI: Log in and submit their own self-descriptions
      else All teammates have submitted
        Store-->>BFF: Return all teammate descriptions + predefined team name
        BFF->>GenAI: Generate one team logo from all member descriptions and the auto-assigned team name
        GenAI-->>BFF: Return generated team logo asset
        BFF->>Store: Save generated logo and mark team identity ready/ACTIVE
        Store-->>BFF: Return activated team state
        BFF-->>GarageUI: Return team name + generated logo + activation status
        GarageUI-->>Player: Show completed team identity using predefined team name and generated logo
        GarageUI-->>RaceHubUI: Navigate to Race Hub
        RaceHubUI-->>Player: Show team score, rank, scanner, and recent activity
      end
    end
  else Current local demo behavior
    GarageUI->>GarageUI: Wait 2.5s, compose team name from local keywords, use static Unsplash car image
    Player->>GarageUI: Click "Continue to Race"
    GarageUI->>GarageUI: Call GameContext.createTeam(teamName, carImage, keywords)
    GarageUI-->>RaceHubUI: Navigate to '/race-hub'
  end
```

## 3. Scanning a Safe QR Code and Earning Points

```mermaid
sequenceDiagram
  autonumber
  actor Player
  participant RaceHubUI as Race Hub<br/>Current route '/race-hub'
  participant Identity as Scan Identity Resolver<br/>Session email + seeded mapping
  participant Browser as Browser Camera APIs
  participant Scanner as QR Scanner
  participant BFF as Velocity GP BFF/API
  participant Rules as Scan + Hazard Rule Engine
  participant Store as QR Claim + Score Store
  participant Leaderboard as Leaderboard Projection<br/>Current route '/leaderboard'

  Player->>RaceHubUI: Tap "Start Camera Scan"
  RaceHubUI->>Identity: Resolve scan identity from session email
  Identity->>BFF: GET /events/current
  BFF-->>Identity: Return active event id
  Identity-->>RaceHubUI: Return resolved {eventId, playerId, teamId}
  Note over RaceHubUI,Identity: If unmapped/event mismatch/event unavailable, scan submit is blocked and camera guidance is shown.

  RaceHubUI->>Browser: Request rear camera (getUserMedia facingMode=environment)
  Browser-->>RaceHubUI: Stream granted
  RaceHubUI->>Scanner: Decode video frames (BarcodeDetector, jsQR fallback)
  Scanner-->>RaceHubUI: Return QR payload candidate
  RaceHubUI->>RaceHubUI: Dedupe/throttle repeated payload frames
  RaceHubUI->>BFF: POST /events/:eventId/scans<br/>{ playerId, qrPayload }
  BFF->>Rules: Evaluate scan eligibility and hazard policy
  Rules->>Store: Load team status, QR metadata, claim history, and global scan count
  Store-->>Rules: Team ACTIVE, QR valid, unclaimed by player
  Rules->>Rules: Resolve hazard decision (weight override first, ratio fallback)

  alt Hazard is not triggered
    Rules->>Store: Persist claim, increment scan counter, add QR value to team score
    Store-->>Rules: Return updated team score/state
    Rules-->>BFF: Return SAFE response
    BFF-->>RaceHubUI: SAFE + points/team state
    RaceHubUI->>RaceHubUI: applyScanOutcome(response)
    RaceHubUI-->>Player: Show "Scan Registered" + append recent activity
    RaceHubUI->>Leaderboard: Reflect rank/score updates in leaderboard view
  else Hazard is triggered
    Rules-->>BFF: Return HAZARD_PIT response
    BFF-->>RaceHubUI: Return pit-stop penalty payload
    RaceHubUI-->>Player: Show hazard feedback and route to Pit Stop flow
  end
```

## 4. Hitting a Hazard and Entering Pit Stop

```mermaid
sequenceDiagram
  autonumber
  actor Player
  participant RaceHubUI as Race Hub<br/>Current route '/race-hub'
  participant Scanner as QR Scanner
  participant BFF as Velocity GP BFF/API
  participant Rules as Hazard Rule Engine
  participant Store as Team + Hazard Store
  participant PitStopUI as Pit Stop<br/>Current route '/pit-stop'

  Player->>RaceHubUI: Scan a QR code while team status is ACTIVE
  RaceHubUI->>Scanner: Decode venue QR payload
  Scanner-->>RaceHubUI: Return qrCode

  RaceHubUI->>BFF: POST /events/:eventId/scans<br/>{ playerId, qrPayload }
  BFF->>Rules: Run pre-checks and hazard decision logic
  Rules->>Store: Load race control state, team status, QR status, claim history, and counters
  Store-->>Rules: Return policy inputs for hazard decision

  alt QR has hazardWeightOverride (0..100)
    Rules->>Rules: 0 => never hazard, 100 => always hazard
    Rules->>Rules: 1..99 => crypto.randomInt(100) < hazardWeightOverride
  else QR uses ratio fallback
    Rules->>Rules: Use hazardRatioOverride or globalHazardRatio
    Rules->>Rules: Trigger hazard when globalScanCountAfter % hazardRatioUsed == 0
  end

  alt Hazard triggered
    Rules->>Store: Persist hazard encounter, set team status IN_PIT, set pitStopExpiresAt = now + 15 minutes
    Store-->>Rules: Return updated penalty state
    Rules-->>BFF: Return hazard penalty result
    BFF-->>RaceHubUI: Return IN_PIT state + lockout expiry
    RaceHubUI->>RaceHubUI: applyScanOutcome(response) to update pit-stop state
    RaceHubUI-->>Player: Show "Hazard Hit" feedback
    RaceHubUI-->>PitStopUI: Navigate to '/pit-stop'
    PitStopUI-->>Player: Show "PIT STOP PENALTY", countdown timer, and Helios rescue instructions
  else Hazard not triggered
    Rules-->>BFF: Return SAFE response
    BFF-->>RaceHubUI: Continue normal score update flow
  end
```

## 5. Scanning an Invalid, Duplicate, or Blocked QR Code

```mermaid
sequenceDiagram
  autonumber
  actor Player
  participant RaceHubUI as Race Hub<br/>Current route '/race-hub'
  participant Scanner as QR Scanner
  participant BFF as Velocity GP BFF/API
  participant Rules as Scan Validation Rules
  participant Store as QR Claim + Player Risk Store
  participant PitStopUI as Pit Stop<br/>Current route '/pit-stop'

  Player->>RaceHubUI: Scan a QR code
  RaceHubUI->>Scanner: Decode QR payload
  Scanner-->>RaceHubUI: Return qrPayload
  RaceHubUI->>BFF: POST /events/:eventId/scans<br/>{ playerId, qrPayload }
  BFF->>Rules: Validate QR recognition and claim eligibility
  Rules->>Store: Lookup QR code, team state, race control state, and claim history

  alt QR code is not recognized
    Store-->>Rules: No matching QR record
    Rules->>Store: Apply configured invalid-scan penalty and mark player flaggedForReview
    Rules-->>BFF: Return INVALID + QR_NOT_FOUND
    BFF-->>RaceHubUI: Return invalid-scan response
    RaceHubUI-->>Player: Show invalid QR warning and keep scanner active
  else QR code is recognized but already claimed by this player
    Store-->>Rules: Existing claim found for playerId + qrCodeId
    Rules-->>BFF: Return DUPLICATE + ALREADY_CLAIMED
    BFF-->>RaceHubUI: Return duplicate response
    RaceHubUI-->>Player: Show duplicate-scan feedback and keep score unchanged
  else Scan is blocked because team is in pit
    Store-->>Rules: Team status is IN_PIT
    Rules-->>BFF: Return BLOCKED + TEAM_IN_PIT
    BFF-->>RaceHubUI: Return blocked response
    RaceHubUI-->>PitStopUI: Navigate to '/pit-stop'
    PitStopUI-->>Player: Show pit-stop lockout state
  else Scan is blocked by race control or QR disabled
    Store-->>Rules: raceControlState = PAUSED or qrCode.enabled = false
    Rules-->>BFF: Return BLOCKED + RACE_PAUSED/QR_DISABLED
    BFF-->>RaceHubUI: Return blocked response
    RaceHubUI-->>Player: Show blocked messaging with retry + camera help guidance
  else QR code is valid and unclaimed (continues to section 3/4)
    Store-->>Rules: QR recognized, team ACTIVE, no player claim exists
    Rules-->>BFF: Continue into SAFE/HAZARD decision flow
    BFF-->>RaceHubUI: Return SAFE or HAZARD_PIT response
  end
```

## 6. Rescuing a Team With a Helios Superpower QR

```mermaid
sequenceDiagram
  autonumber
  actor Player
  participant PitStopUI as Pit Stop<br/>Current route '/pit-stop'
  participant HeliosQR as Helios Player's Superpower QR
  participant HeliosDevice as Helios Player Device<br/>Current route '/helios'
  participant BFF as Velocity GP BFF/API
  participant Rules as Rescue Validation Rules
  participant Store as Team + Rescue Store
  participant Teammates as Penalized Team Devices
  participant RaceHubUI as Race Hub<br/>Current route '/race-hub'

  PitStopUI-->>Player: Show timer and instruct player to find a Helios member
  Player->>HeliosQR: Scan Superpower QR from another player

  alt Intended production rescue flow
    PitStopUI->>BFF: POST /api/rescue/initiate<br/>playerId, eventId, heliosQrId
    BFF->>Rules: Validate team conflict, target team status, and Helios cooldown
    Rules->>Store: Load scanner team, Helios team, rescue cooldown, and IN_PIT state

    alt Scanner team is not currently IN_PIT
      Store-->>Rules: Team is ACTIVE
      Rules-->>BFF: Reject rescue because no active pit penalty exists
      BFF-->>PitStopUI: Return no-op/error response
      PitStopUI-->>Player: Keep normal race state unchanged
    else Helios rescuer belongs to the same team
      Store-->>Rules: scanner.team_id == helios.team_id
      Rules-->>BFF: Reject with SELF_RESCUE_FORBIDDEN
      BFF-->>PitStopUI: Return conflict-of-interest error
      PitStopUI-->>Player: Show "Internal Override Forbidden! You cannot rescue your own crew. Find another architect!"
    else Helios rescuer is still cooling down
      Store-->>Rules: Helios cooldown window still active
      Rules-->>BFF: Reject with retry-after duration
      BFF-->>PitStopUI: Return cooldown response
      PitStopUI-->>Player: Show "Pit Crew Overheated! [Name] is busy. Try again in 2 mins."
    else Rescue is valid
      Store-->>Rules: Different team, Helios available, scanner team IN_PIT
      Rules->>Store: Mark rescue IN_PROGRESS then COMPLETED, clear pitStopExpiresAt, set team status ACTIVE
      Rules->>Store: Write Helios rescue-log entry without awarding Helios points
      Rules-->>Teammates: Push "team ACTIVE / scanner enabled" update to all penalized teammates
      Rules-->>HeliosDevice: Push rescue-log notification
      Rules-->>BFF: Return COMPLETED rescue response
      BFF-->>PitStopUI: Return rescue success and cleared timer
      PitStopUI-->>RaceHubUI: Navigate back to Race Hub
      RaceHubUI-->>Player: Scanner unlocked and race resumes immediately
    end
  else Current local demo rescue flow
    PitStopUI->>PitStopUI: Click "Scan Helios QR (Demo)"
    PitStopUI->>PitStopUI: Call GameContext.clearPitStop(currentTeam.id)
    PitStopUI-->>RaceHubUI: Navigate to '/race-hub'
  end
```

## 7. Auto-Releasing a Team When the Pit Stop Timer Expires

```mermaid
sequenceDiagram
  autonumber
  participant Scheduler as Backend Timer / Scheduler
  participant Rules as Team State Rules
  participant Store as Team Store
  participant PlayerApp as Penalized Player App<br/>Pit Stop route '/pit-stop'
  participant Teammates as Other Penalized Team Devices
  participant RaceHubUI as Race Hub<br/>Current route '/race-hub'

  Scheduler->>Rules: Check teams with status IN_PIT and pitStopExpiresAt
  Rules->>Store: Query teams where server time >= pitStopExpiresAt
  Store-->>Rules: Return expired pit-stop teams

  loop For each expired team
    Rules->>Store: Update team status to ACTIVE and clear pitStopExpiresAt
    Store-->>Rules: Confirm scanner unlock state
    Rules-->>PlayerApp: Push timer-cleared / scanner-enabled update
    Rules-->>Teammates: Push same unlock update to every teammate device
  end

  PlayerApp-->>RaceHubUI: Transition from Pit Stop back to Race Hub
  RaceHubUI-->>PlayerApp: Show scanner, current score, and current rank

  Note over PlayerApp,Store: Current app still decrements pitStopTimeLeft in GameContext on the client every second after scan responses seed pitStopExpiresAt; backend-owned realtime unlock push is not yet wired in the web client.
```

## 8. Opening the Leaderboard and Victory Lane

```mermaid
sequenceDiagram
  autonumber
  actor Player
  participant RaceHubUI as Race Hub<br/>Current route '/race-hub'
  participant BottomNav as Bottom Nav
  participant LeaderboardUI as Leaderboard<br/>Current route '/leaderboard'
  participant VictoryLaneUI as Victory Lane<br/>Current route '/victory-lane'
  participant BFF as Velocity GP BFF/API
  participant Store as Team + Event Store

  Player->>BottomNav: Open leaderboard
  BottomNav-->>LeaderboardUI: Navigate to '/leaderboard'

  alt Intended server-backed rankings
    LeaderboardUI->>BFF: GET /api/events/:eventId/leaderboard
    BFF->>Store: Load team standings, scores, ranks, and IN_PIT statuses
    Store-->>BFF: Return ordered leaderboard entries
    BFF-->>LeaderboardUI: Return rank, teamName, score, memberCount, and status metadata
    LeaderboardUI-->>Player: Show live timing board, intervals, pit indicators, and commentary
  else Current local demo rankings
    LeaderboardUI->>LeaderboardUI: Sort GameContext.teams in descending score order
    LeaderboardUI-->>Player: Render local leaderboard and synthetic commentary ticker
  end

  Player->>LeaderboardUI: Open Victory Lane
  LeaderboardUI-->>VictoryLaneUI: Navigate to '/victory-lane'

  alt Event is complete
    VictoryLaneUI->>BFF: Fetch final team standings and event summary
    BFF->>Store: Load podium top 3, total scans, pit-stop count, and MVP player
    Store-->>BFF: Return final event results
    BFF-->>VictoryLaneUI: Return championship summary
    VictoryLaneUI-->>Player: Show podium, final points, MVP, total scans, and Pit Stops
  else Current local demo behavior
    VictoryLaneUI->>VictoryLaneUI: Derive top 3 from GameContext.teams, hardcode totalPitStops and MVP, launch confetti
    VictoryLaneUI-->>Player: Show podium and summary cards
  end

  Player->>LeaderboardUI: Back to Race Hub if event is still active
  LeaderboardUI-->>RaceHubUI: Navigate to '/race-hub'
```

## Current Implementation Gaps

- `Login` currently jumps straight to `/garage`; the BDD flow expects magic-link authentication and team-state-based routing.
- `Garage` currently lets one player locally generate/finalize a team identity; the updated target flow collects every teammate's self-description first, then generates one team logo from all descriptions plus the preassigned team name.
- `RaceHub` now submits real scans to `POST /events/:eventId/scans`, but scan identity is still bridged by client-side seeded email mapping (no backend player-session bootstrap endpoint yet).
- Camera fallback in `RaceHub` is guidance + retry only; manual payload entry and image-upload fallback are intentionally not implemented in v1.
- `PitStop` currently clears penalties with a local demo button; the BDD flow expects backend Helios rescue validation, self-rescue rejection, and cooldown handling.
- `HeliosProfile` currently enables Helios mode on page visit; the BDD flow expects role assignment to be controlled by event/admin rules.
- `Leaderboard` and `VictoryLane` currently derive most results from `GameContext`; the BDD flow expects backend-backed standings and event completion data.

## Diagram Reading Notes

- Every section is a Mermaid `sequenceDiagram` focused on one player action or one system reaction.
- `alt` branches separate intended BDD behavior from current local demo behavior where the implementation is still mocked.
- Route names and API paths are written exactly as they currently appear in the React router and BFF route contracts when available.
