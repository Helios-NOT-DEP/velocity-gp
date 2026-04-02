# Velocity GP BDD: Persona 1

## The Player (Event Attendee)

### Feature: Passwordless Player Authentication

_As an attendee, I want a frictionless login to join the multi-day event without remembering a password._

#### Scenario: Requesting a Magic Link

- **Given** the Player is on the public Sign Up page (/signup)
- **When** the Player enters their email work email address
- **And** Personal email or cellphone number and full name
- **And** the Player clicks "Submit"
- **Then** the system should send a secure Magic Link via the provided channel
- **And** the UI should display a confirmation: "Check your messages for your secure access link!"

#### Scenario: Authenticating via Magic Link

- **Given** the Player has received the Magic Link
- **When** the Player clicks the secure link
- **Then** the Player should be authenticated
- **And** the System should check if the Player is already assigned to a team
- **And** the Player should be redirected to either the **AI Design Studio** (if first on team) or **Race Hub** (if team is already setup).

### Feature: AI Design Studio (The Garage)

_As a Player, I want to establish our team's identity using GenAI so that we have a unique F1-style presence._

#### Scenario: Custom Design Generation & Policy Check (First Joiner)

- **Given** the first Player to join a team arrives at the AI Design Studio (/team-setup)
- **And** the Player chooses to provide custom keywords (e.g., "Fast, Corporate, Tiger")
- **When** the Player clicks "Generate Design"
- **Then** the System should check the keywords against a "Policy Safety Filter"
- **And If** keywords violate policy, display "Inappropriate terms detected. Please try again."
- **And If** keywords are safe, the System should show an "AI Processing" animation
- **Then** the screen should display a newly generated Car Image and Team Slogan
- **And** the Player can choose to "Finalize" to make the team "ACTIVE".

#### Scenario: Subsequent Players Joining a Setup Team

- **Given** a Player joins a team that has already been "Activated" by a teammate
- **When** they complete their login
- **Then** they should be shown a 5-second "Welcome to the Paddock" screen featuring their team's custom car and name
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
