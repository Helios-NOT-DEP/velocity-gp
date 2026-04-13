# Velocity GP BDD: Persona 1

## The Player (Event Attendee)

### Feature: Passwordless Player Authentication

_As an attendee, I want a frictionless login to join the multi-day event without remembering a password._

#### Scenario: Requesting a Magic Link

- **Given** the Player is on the public login entry route (/)
- **And** `/signup` remains a supported legacy alias that redirects to `/`
- **When** the Player enters their work email address
- **And** Personal email or cellphone number and full name
- **And** the Player clicks "Submit"
- **Then** the system should send a secure Magic Link via the provided channel
- **And** the UI should display a confirmation: "Check your messages for your secure access link!"

#### Scenario: Authenticating via Magic Link

- **Given** the Player has received the Magic Link
- **When** the Player clicks the secure link
- **Then** the Player should be authenticated
- **And** the System should check if the Player is already assigned to a team
- **And** the Player should be redirected to either the **AI Design Studio** (if their team's shared logo is still pending) or **Race Hub** (if their team identity is already active).

### Feature: AI Design Studio (The Garage)

_As a Player, I want our team's logo to be generated from every teammate's self-description and our assigned team name so that the final identity represents the whole team._

#### Scenario: Submitting My Self-Description for Team Logo Generation

- **Given** a Player logs in for the first time and arrives at the AI Design Studio (/team-setup)
- **And** the Player belongs to a preassigned team with an auto-created team name
- **When** the Player enters words that describe themself
- **And** the Player submits their self-description
- **Then** the System should check the submitted words against a "Policy Safety Filter"
- **And If** the words violate policy, display "Inappropriate terms detected. Please try again."
- **And If** the words are safe, save the Player's self-description to the team's pending logo inputs
- **And** the UI should show whether the team is still waiting for more teammate descriptions or ready to generate the final logo.

#### Scenario: Generating the Shared Team Logo After All Teammates Submit

- **Given** every Player on a preassigned team has logged in and submitted a policy-approved self-description
- **When** the final teammate's self-description is saved
- **Then** the System should show an "AI Processing" animation
- **And** generate a single shared team logo using all teammate descriptions and the team's preassigned name
- **And** display the generated Team Logo with the preassigned Team Name
- **And** the team status should change to "ACTIVE"
- **And** all Players on that team should be routed to the **Main Race Hub**.

#### Scenario: Subsequent Players Joining an Already Active Team

- **Given** a Player joins a team that already has a generated logo and status "ACTIVE"
- **When** they complete their login
- **Then** they should be shown a 5-second "Welcome to the Paddock" screen featuring their team's generated logo and preassigned team name
- **And** they should be automatically redirected to the **Main Race Hub**.

### Feature: Scavenger Hunt & The "Hot Potato" Hazard

_The core game loop involving point collection, global QR code hazard ratios, and anti-cheat mechanics._

#### Scenario: Successful Point Scan (Safe Scan)

- **Given** the Player is on the Main Race Hub (/race)
- **And** the Player's team status is "ACTIVE"
- **And** the target QR code has currently been scanned globally X times
- **When** the Player scans the QR code
- **And** the System determines this scan does **NOT** hit the global Hazard Ratio for this specific code
- **Then** the app should display a "Success" neon-green overlay
- **And** the team's "Fuel Level" should increase by the QR code's point value
- **And** the QR code should be marked as "Claimed" for that specific Player.

#### Scenario: The Pit Stop Penalty (The "Hot Potato" Explosion)

- **Given** the global Hazard Ratio is set to trigger on every 15th scan of any QR code
- **And** a specific QR code in the venue has been safely scanned 14 times globally
- **When** the Player scans that specific QR code (triggering the 15th global scan)
- **Then** the app should display a red flashing "HAZARD HIT!" overlay
- **And** the system applies a Hazard Penalty instead of awarding points
- **And** the team status should change to "IN_PIT" for all members
- **And** a global lockout timer (e.g., 15 minutes) should begin for the entire team, disabling their scanners.

Implementation note (current):

- Pit-stop countdown is derived from backend `pitStopExpiresAt` and periodically refreshed from session-backed player identity.
- Team scanner lockout is enforced server-side; teammate clients reflect lockout state from backend identity sync.
- Full push-based realtime fanout is planned separately; current behavior is backend-authoritative sync with periodic refresh.

#### Scenario: Seeking Rescue from a Helios Member

- **Given** my team is "IN_PIT"
- **When** I locate a member of the **Helios Team** (the app creators)
- **And** that Helios member is **NOT** on my own team
- **And** I scan their "Superpower QR"
- **Then** my team's status should immediately revert to "ACTIVE"
- **And** the lockout timer should vanish for all my teammates.

#### Scenario: Attempting a Self-Rescue (Invalid)

- **Given** my team is "IN_PIT"
- **And** one of my teammates has Helios status
- **When** I or any other teammate scans our own Helios member's Superpower QR
- **Then** the app should display an error: "Internal Override Forbidden! You cannot rescue your own crew. Find another architect!"
- **And** the team status remains "IN_PIT".

#### Scenario: Anti-Cheat / Invalid Scans

- **Given** a Player attempts to scan a QR code
- **When** the scanned code is not recognized by the Velocity GP system
- **Then** the team's Fuel Level should decrease by 1 point
- **And** the user record should be marked with a "Flagged for Review" status in the Admin Dashboard.
