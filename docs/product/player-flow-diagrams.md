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
  participant Scanner as QR Scanner
  participant BFF as Velocity GP BFF/API
  participant Rules as Scan + Hazard Rule Engine
  participant Store as QR Claim + Score Store
  participant Leaderboard as Leaderboard Projection<br/>Current route '/leaderboard'

  Player->>RaceHubUI: Tap "Scan QR Code"
  RaceHubUI->>Scanner: Decode QR payload
  Scanner-->>RaceHubUI: Return scanned qrCode

  alt Intended production behavior for a safe, recognized, unclaimed scan
    RaceHubUI->>BFF: POST /api/hazards/scan<br/>playerId, eventId, qrCode
    BFF->>Rules: Evaluate scan eligibility and hazard policy
    Rules->>Store: Load player team status, prior claim record, QR metadata, global scan count
    Store-->>Rules: Return team ACTIVE, QR recognized, not yet claimed by this player
    Rules->>Rules: Resolve per-QR hazard ratio first, else global ratio
    Rules->>Rules: Compute (current_scan_count + 1) % effective_hazard_ratio

    alt Modulo result is not 0
      Rules->>Store: Persist player claim, increment global scan count, add QR point value to team fuel score
      Store-->>Rules: Return updated team score, rank impact, and claim status
      Rules-->>BFF: Return safe-scan success response
      BFF-->>RaceHubUI: Return updated score/team state
      RaceHubUI-->>Player: Show neon-green "Success" overlay
      RaceHubUI-->>Player: Append scan to recent activity and refresh points/rank
      RaceHubUI->>Leaderboard: Reflect new score in ranking view
    else Modulo result is 0
      Rules-->>BFF: Return hazard outcome instead of points
      BFF-->>RaceHubUI: Route to Pit Stop sequence
    end
  else Current local demo behavior
    RaceHubUI->>RaceHubUI: Randomly award 50 or 100 points if Math.random() does not trigger hazard
    RaceHubUI->>RaceHubUI: Call GameContext.addScan(points)
    RaceHubUI-->>Player: Update Total Points card and Recent Activity list locally
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
  participant Teammates as Other Team Devices
  participant PitStopUI as Pit Stop<br/>Current route '/pit-stop'

  Player->>RaceHubUI: Scan a QR code while team status is ACTIVE
  RaceHubUI->>Scanner: Decode venue QR payload
  Scanner-->>RaceHubUI: Return qrCode

  alt Intended production behavior when a hazard is triggered
    RaceHubUI->>BFF: POST /api/hazards/scan or POST /api/events/:eventId/players/:playerId/hazard-status
    BFF->>Rules: Evaluate effective hazard ratio and scan counter
    Rules->>Store: Load QR-specific ratio override, global ratio fallback, and current global scan count
    Store-->>Rules: Return policy inputs and current_scan_count = 14
    Rules->>Rules: Compute (14 + 1) % 15 = 0
    Rules->>Store: Persist hazard encounter, set team status IN_PIT, set pitStopExpiresAt = now + 15 minutes
    Store-->>Rules: Return updated penalty state
    Rules-->>Teammates: Push scanner-disabled update and shared countdown
    Rules-->>BFF: Return hazard penalty result
    BFF-->>RaceHubUI: Return IN_PIT state + lockout expiry
    RaceHubUI-->>Player: Show red flashing "HAZARD HIT!" overlay
    RaceHubUI-->>PitStopUI: Navigate to '/pit-stop'
    PitStopUI-->>Player: Show "PIT STOP PENALTY", countdown timer, and Helios rescue instructions
  else Current local demo behavior
    RaceHubUI->>RaceHubUI: Randomly set isHazard = Math.random() > 0.85
    RaceHubUI->>RaceHubUI: Call GameContext.triggerPitStop(currentTeam.id, 900)
    RaceHubUI-->>PitStopUI: Navigate to '/pit-stop'
    PitStopUI-->>Player: Show local countdown generated by GameContext interval
  end
```

## 5. Scanning an Invalid or Duplicate QR Code

```mermaid
sequenceDiagram
  autonumber
  actor Player
  participant RaceHubUI as Race Hub<br/>Current route '/race-hub'
  participant Scanner as QR Scanner
  participant BFF as Velocity GP BFF/API
  participant Rules as Scan Validation Rules
  participant Store as QR Claim + Player Risk Store
  participant AdminDash as Admin Dashboard

  Player->>RaceHubUI: Scan a QR code
  RaceHubUI->>Scanner: Decode QR payload
  Scanner-->>RaceHubUI: Return qrCode
  RaceHubUI->>BFF: POST /api/hazards/scan<br/>playerId, eventId, qrCode
  BFF->>Rules: Validate QR recognition and claim eligibility
  Rules->>Store: Lookup QR code and player claim history

  alt QR code is not recognized
    Store-->>Rules: No matching QR record
    Rules->>Store: Deduct 1 team point and mark player "Flagged for Review"
    Rules-->>AdminDash: Surface invalid-scan signal for organizer review
    Rules-->>BFF: Return recognized=false + penalty details
    BFF-->>RaceHubUI: Return invalid-scan response
    RaceHubUI-->>Player: Show warning and updated fuel score
  else QR code is recognized but already claimed by this player
    Store-->>Rules: Existing claim found for playerId + hazardId
    Rules-->>BFF: Reject duplicate claim with 0 points awarded
    BFF-->>RaceHubUI: Return "Already Claimed" style response
    RaceHubUI-->>Player: Show duplicate-scan feedback and keep score unchanged
  else QR code is valid and unclaimed
    Store-->>Rules: QR recognized and no player claim exists
    Rules-->>BFF: Continue into safe-scan or hazard evaluation flow
    BFF-->>RaceHubUI: Return next outcome
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

  Note over PlayerApp,Store: Current React demo decrements pitStopTimeLeft in GameContext on the client every second, but the BDD system expects backend-owned expiry plus WebSocket updates.
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
- `RaceHub` currently resolves safe scans vs hazards randomly in local state; the BDD flow expects backend recognition, modulo-based hazard checks, and per-player claim enforcement.
- `PitStop` currently clears penalties with a local demo button; the BDD flow expects backend Helios rescue validation, self-rescue rejection, and cooldown handling.
- `HeliosProfile` currently enables Helios mode on page visit; the BDD flow expects role assignment to be controlled by event/admin rules.
- `Leaderboard` and `VictoryLane` currently derive most results from `GameContext`; the BDD flow expects backend-backed standings and event completion data.

## Diagram Reading Notes

- Every section is a Mermaid `sequenceDiagram` focused on one player action or one system reaction.
- `alt` branches separate intended BDD behavior from current local demo behavior where the implementation is still mocked.
- Route names and API paths are written exactly as they currently appear in the React router and BFF route contracts when available.
