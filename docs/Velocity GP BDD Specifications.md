# **Velocity GP: Master BDD Specifications (v8.1)**

**Project:** Velocity GP (Multi-Day Endurance Event)

**Status:** Complete \- Admin Portal Expansion (QR Ops + Hazard Controls + Health Metrics)

**Date:** March 2026

## **Persona 1: The Player (Event Attendee)**

### **Feature: Passwordless Player Authentication**

_As an attendee, I want a frictionless login to join the multi-day event without remembering a password._

**Scenario: Requesting a Magic Link**

- **Given** the Player is on the public Sign Up page (/signup)
- **When** the Player enters their email work email address
- **And** Personal email or cellphone number and full name
- **And** the Player clicks "Submit"
- **Then** the system should send a secure Magic Link via the provided channel
- **And** the UI should display a confirmation: "Check your messages for your secure access link\!"

**Scenario: Authenticating via Magic Link**

- **Given** the Player has received the Magic Link
- **When** the Player clicks the secure link
- **Then** the Player should be authenticated
- **And** the System should check if the Player is already assigned to a team
- **And** the Player should be redirected to either the **AI Design Studio** (if first on team) or **Race Hub** (if team is already setup).

### **Feature: AI Design Studio (The Garage)**

_As a Player, I want to establish our team's identity using GenAI so that we have a unique F1-style presence._

**Scenario: Custom Design Generation & Policy Check (First Joiner)**

- **Given** the first Player to join a team arrives at the AI Design Studio (/team-setup)
- **And** the Player chooses to provide custom keywords (e.g., "Fast, Corporate, Tiger")
- **When** the Player clicks "Generate Design"
- **Then** the System should check the keywords against a "Policy Safety Filter"
- **And If** keywords violate policy, display "Inappropriate terms detected. Please try again."
- **And If** keywords are safe, the System should show an "AI Processing" animation
- **Then** the screen should display a newly generated Car Image and Team Slogan
- **And** the Player can choose to "Finalize" to make the team "ACTIVE".

**Scenario: Subsequent Players Joining a Setup Team**

- **Given** a Player joins a team that has already been "Activated" by a teammate
- **When** they complete their login
- **Then** they should be shown a 5-second "Welcome to the Paddock" screen featuring their team's custom car and name
- **And** they should be automatically redirected to the **Main Race Hub**.

### **Feature: Scavenger Hunt & The "Hot Potato" Hazard**

_The core game loop involving point collection, global QR code hazard ratios, and anti-cheat mechanics._

**Scenario: Successful Point Scan (Safe Scan)**

- **Given** the Player is on the Main Race Hub (/race)
- **And** the Player's team status is "ACTIVE"
- **And** the target QR code has currently been scanned globally X times
- **When** the Player scans the QR code
- **And** the System determines this scan does **NOT** hit the global Hazard Ratio for this specific code
- **Then** the app should display a "Success" neon-green overlay
- **And** the team's "Fuel Level" should increase by the QR code's point value
- **And** the QR code should be marked as "Claimed" for that specific Player.

**Scenario: The Pit Stop Penalty (The "Hot Potato" Explosion)**

- **Given** the global Hazard Ratio is set to trigger on every 15th scan of any QR code
- **And** a specific QR code in the venue has been safely scanned 14 times globally
- **When** the Player scans that specific QR code (triggering the 15th global scan)
- **Then** the app should display a red flashing "HAZARD HIT\!" overlay
- **And** the system applies a Hazard Penalty instead of awarding points
- **And** the team status should change to "IN_PIT" for all members
- **And** a global lockout timer (e.g., 15 minutes) should begin for the entire team, disabling their scanners.

**Scenario: Seeking Rescue from a Helios Member**

- **Given** my team is "IN_PIT"
- **When** I locate a member of the **Helios Team** (the app creators)
- **And** that Helios member is **NOT** on my own team
- **And** I scan their "Superpower QR"
- **Then** my team's status should immediately revert to "ACTIVE"
- **And** the lockout timer should vanish for all my teammates.

**Scenario: Attempting a Self-Rescue (Invalid)**

- **Given** my team is "IN_PIT"
- **And** one of my teammates has Helios status
- **When** I or any other teammate scans our own Helios member's Superpower QR
- **Then** the app should display an error: "Internal Override Forbidden\! You cannot rescue your own crew. Find another architect\!"
- **And** the team status remains "IN_PIT".

**Scenario: Anti-Cheat / Invalid Scans**

- **Given** a Player attempts to scan a QR code
- **When** the scanned code is not recognized by the Velocity GP system
- **Then** the team's Fuel Level should decrease by 1 point
- **And** the user record should be marked with a "Flagged for Review" status in the Admin Dashboard.

## **Persona 2: The Helios Player (App Creator / Player)**

### **Feature: The Creator Superpower**

_As an app creator, I possess the ability to 'repair' other teams, but my powers are neutralized for my own team to maintain competitive integrity._

**Scenario: Helping a Rival Team**

- **Given** I am a Helios Player
- **And** a member of a different team scans my Superpower QR
- **When** the transaction is processed
- **Then** their penalty is cleared
- **And** I receive a "Rescue Log" notification on my device
- **And** **No points** are added to my personal or team score (maintaining fairness).

**Scenario: Power Cooldown**

- **Given** I have just rescued a team
- **When** another penalized team attempts to scan my Superpower QR within 3 minutes
- **Then** their app should display: "Pit Crew Overheated\! \[My Name\] is busy. Try again in 2 mins."

**Scenario: Being Stuck with the Crew**

- **Given** I am a Helios Player on "Team Alpha"
- **And** my teammate triggers a "Hot Potato" Hazard
- **When** "Team Alpha" enters the Pit Stop
- **Then** I am also locked out from scanning
- **And** I cannot use my own QR code to clear the penalty for my team
- **And** I must physically find another Helios Player in the venue to rescue us.

## **Persona 3: The Admin (Event Organizer)**

### **Feature: Event & Hazard Management**

_As an organizer, I need to manage the multi-day race flow, designate 'Creators', and tweak game difficulty._

**Scenario: Creating a New QR Code from the Admin Portal**

- **Given** the Admin is on the "QR Control Center" tab of the Admin Portal
- **When** the Admin clicks "Create QR"
- **And** enters a label, point value, zone, and activation window
- **And** selects "Generate"
- **Then** the System should create a unique QR identifier and render a downloadable QR asset
- **And** the QR code should appear in the QR inventory table with status "ACTIVE".

**Scenario: Bulk Generating QR Codes for a Venue Zone**

- **Given** the Admin is preparing the event floor for launch day
- **When** the Admin uploads a CSV template with zone, value, and label fields
- **And** clicks "Generate Batch"
- **Then** the System should validate each row and create QR codes for valid records
- **And** invalid rows should be returned in an error report with line-level reasons
- **And** the Admin should be able to download a zip of all generated QR assets.

**Scenario: Disabling a Compromised or Duplicated QR Code**

- **Given** the Admin identifies a leaked or duplicated QR code in circulation
- **When** the Admin toggles that QR's status from "ACTIVE" to "DISABLED"
- **Then** all future scans of that QR should be rejected
- **And** the Player should see "Code disabled by race control. Find another checkpoint."
- **And** the action should be recorded in an audit log with admin identity and timestamp.

**Scenario: Configuring the Global "Hot Potato" Ratio**

- **Given** the Admin is on the "Game Settings" tab of the Admin Dashboard
- **When** the Admin inputs "10" into the "Global Hazard Scan Ratio" field
- **And** clicks "Save Configuration"
- **Then** the System updates the configuration database
- **And** moving forward, any QR code in the venue that reaches a multiple of 10 in its global scan count (10th, 20th, 30th scan) will automatically trigger a Pit Stop penalty for the unlucky scanner.

**Scenario: Configuring Hazard Rules Per QR Code**

- **Given** the Admin is on a specific QR code's detail drawer
- **When** the Admin enables "Custom Hazard Rule"
- **And** sets a hazard ratio of 8 with a pit penalty duration of 10 minutes
- **And** clicks "Save Rule"
- **Then** the System should store the per-QR hazard policy
- **And** future scans of that QR should use the custom policy instead of the global default
- **And** the change should be reflected immediately on the Admin preview simulator.

**Scenario: Applying a Temporary Hazard Multiplier During Peak Hours**

- **Given** the Admin expects high scan traffic between 1 PM and 3 PM
- **When** the Admin creates a scheduled rule for Zone C with hazard multiplier 1.5x
- **Then** the System should automatically apply the multiplier only within the configured window
- **And** once the window ends, the hazard behavior should revert to baseline configuration.

**Scenario: Pausing the Race for the Night**

- **Given** the Admin is on the Admin Dashboard
- **And** the multi-day race is currently "Active"
- **When** the Admin clicks "PAUSE RACE (Overnight Lock)"
- **Then** the global game state should update to "Paused"
- **And** all Players' camera scanners should be disabled with a message "Race resumes tomorrow at 9 AM\!"

**Scenario: Assigning Helios Permissions**

- **Given** the Admin is on the "User Management" tab of the Admin Dashboard
- **When** the Admin searches for a user by email or name
- **And** toggles the "Helios Status" switch to "ON"
- **Then** the System should update that user's record with is_helios: true
- **And** the next time that user's app refreshes, it should display their "Superpower QR" in their profile.

### **Feature: Admin Game Health Dashboard**

_As an organizer, I want a real-time health dashboard so I can quickly detect risk, engagement drops, and fairness anomalies during the race._

**Scenario: Viewing Core Health Metrics in Real Time**

- **Given** the Admin opens the "Game Health" dashboard
- **When** live data is available
- **Then** the dashboard should show active players, scans per minute, hazard hit rate, average pit duration, and invalid scan rate
- **And** each metric tile should display a trend indicator versus the previous 15-minute window.

**Scenario: Alerting on Abnormal Invalid Scan Spikes**

- **Given** the baseline invalid scan rate is below 3%
- **When** the invalid scan rate rises above a configured threshold (e.g., 8%) for 5 continuous minutes
- **Then** the dashboard should raise a "Potential Abuse / Signage Issue" warning
- **And** highlight the top zones and codes contributing to the spike
- **And** recommend operational actions (disable suspected code, inspect venue signage, dispatch staff).

**Scenario: Monitoring Fairness Through Team Risk Distribution**

- **Given** the race has been active for at least 30 minutes
- **When** one team's hazard-hit frequency is statistically higher than venue average
- **Then** the dashboard should flag a fairness warning
- **And** surface contributing QR codes and zones
- **And** allow the Admin to open hazard controls directly from the warning panel.

## **Persona 4: The System (Backend / Sync)**

### **Feature: Logic & State Enforcement**

_The system must strictly enforce team assignments, statuses, and hazard ratios during every scan._

**Scenario: Evaluating the "Hot Potato" Modulo**

- **Given** a scan request is received for QR Code UUID-XYZ
- **When** the System reads the total global scan count for UUID-XYZ and resolves that code's effective hazard policy
- **Then** the System must calculate (current_scan_count \+ 1\) % effective_hazard_ratio
- **And If** the result is 0, the System must trigger the IN_PIT penalty transaction.

**Scenario: Hazard Policy Resolution Precedence**

- **Given** both a global hazard ratio and a per-QR custom rule are configured
- **When** a scan request arrives for that QR code
- **Then** the System must prioritize the per-QR custom rule over the global default
- **And If** no per-QR rule exists, the System should fall back to the global hazard configuration.

**Scenario: Conflict of Interest Check (Rescue Validation)**

- **Given** a scan request for a "Superpower QR" is received
- **When** the System checks the team_id for both the Scanner and Scannee
- **Then** the System must verify scanner.team_id \!= scannee.team_id
- **And If** the IDs match, reject the transaction with a SELF_RESCUE_FORBIDDEN code.

**Scenario: Auto-Releasing a team from the Pit Stop**

- **Given** Team Alpha is currently "IN_PIT"
- **When** the server time surpasses Team Alpha's pitStopExpiresAt timestamp
- **Then** the System should automatically update Team Alpha's status to "ACTIVE"
- **And** push a WebSocket update to all Team Alpha devices to re-enable their scanners.

## **Persona 5: The Display Board (Venue Visuals)**

### **Feature: Live Venue Information Radiator**

_The venue display should highlight the race energy, the struggle of the Pit Stop, and the intervention of the Creators._

**Scenario: Real-Time Leaderboard Overtake**

- **Given** the Display Board is active in the venue
- **When** Team Alpha passes Team Beta in points
- **Then** the UI should use a "Roll-up" animation for Team Alpha's fuel score
- **And** Team Alpha's row should physically slide above Team Beta with a "Swoosh" animation and flash neon-green.

**Scenario: Visualizing a Team entering the Pit Stop**

- **Given** a team is on the Display Board
- **When** they are the unlucky player to trigger a QR code's Hazard Ratio
- **Then** the Display Board should instantly flash the screen edges red
- **And** the team's row should turn red
- **And** a live countdown timer (e.g., "14:59") should appear next to their name.

**Scenario: Announcing a Creator Intervention**

- **Given** a Helios Player rescues a team from the Pit Stop
- **Then** a "REPAIRS COMPLETE" alert should flash on the board
- **And** it should display: "\[Helios Name\] has cleared the track for Team \[Rescued Team Name\]\!"

## **Persona 6: The Gen AI Announcer (Virtual Commentator)**

### **Feature: Dynamic Narrative & Color Commentary**

_The AI should generate engaging, context-aware sports commentary based on live data._

**Scenario: Reacting to a Major Overtake**

- **Given** the race is "Active"
- **When** the Gen AI Announcer receives a top-3 standing change event
- **Then** the AI should generate a short, energetic sports-commentary string highlighting the specific team names (e.g., "The Ultras hit the turbo and snatch the lead from Risk Racers\!").

**Scenario: Commentary on a 'Stuck' Creator (Irony)**

- **Given** a team containing a Helios member triggers the Hazard Ratio
- **When** the Gen AI Announcer generates a pulse
- **Then** it should generate a quip like: "Oh the irony\! \[Helios Name\] has been trapped by their own code\! Team \[Name\] is in the pits and even their 'Architect' is powerless to save them."

**Scenario: A 'God-to-God' Rescue**

- **Given** a Helios Player rescues a team that _also_ contains a Helios Player
- **When** the event is processed
- **Then** the AI should announce: "We have a Creator-level override on the track\! \[Helios A\] just pulled \[Helios B\] out of the muck. That's what I call a patch update\!"

**Scenario: Overnight Recap Generation**

- **Given** the Admin triggers the "Overnight Lock" at the end of the day
- **When** the System receives the "END_OF_DAY" trigger
- **Then** the LLM should analyze the day's total stats (most points, most hazards hit, most active player)
- **And** generate a 3-paragraph "F1 Morning Paper" style recap
- **And** pin this recap to the top of every Player's mobile home screen for the next morning.
