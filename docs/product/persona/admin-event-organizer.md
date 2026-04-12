# Velocity GP BDD: Persona 3

## The Admin (Event Organizer)

### Feature: Admin Operations Console

_As an organizer, I need a single operational console to control the live race, manage scoring assets, inspect teams and players, and monitor event health from one place._

#### Scenario: Navigating the Admin Console by Operational Section

- **Given** the Admin opens the `/admin` route
- **When** the Admin views the console
- **Then** the interface should expose distinct sections for **Game Control**, **QR Codes**, **Teams**, **Players**, and **Statistics**
- **And** the active section should remain visually clear on both mobile and desktop layouts.

#### Scenario: Viewing the Global Race Status at a Glance

- **Given** the Admin is on the "Game Control" section
- **When** the console loads current race state
- **Then** the header should display whether the race is currently `ACTIVE` or `PAUSED`
- **And** the quick summary should show total teams, active penalties, and total QR codes.

#### Scenario: Pausing or Resuming the Entire Race

- **Given** the Admin is on the "Game Control" section
- **When** the Admin toggles the primary race-state control
- **Then** the global game state should switch between `ACTIVE` and `PAUSED`
- **And** the UI should explain whether scanning is enabled or disabled for all teams.

#### Scenario: Resetting All Team Scores with Confirmation

- **Given** the Admin is on the "Game Control" section
- **When** the Admin selects "Reset All Scores"
- **Then** the console should require an explicit confirmation step before applying the reset
- **And** only after confirmation should every team's score return to zero.

### Feature: QR Code Operations

_As an organizer, I need to create and manage the QR scoring assets used during the event._

#### Scenario: Creating a New QR Code from the Admin Portal

- **Given** the Admin is on the "QR Codes" section
- **When** the Admin enters a QR code label, point value, zone, and optional activation window
- **And** clicks "Generate QR Code"
- **Then** the System should create a unique QR scoring asset
- **And** the console should render a scannable QR preview card for that asset
- **And** the new QR code should appear in the QR code grid with status `ACTIVE`.

#### Scenario: Downloading a Generated QR Asset

- **Given** a QR code is visible in the "QR Codes" section
- **When** the Admin selects "Download" on that QR card
- **Then** the portal should download the generated QR asset
- **And** the downloaded code should represent the same playable payload used by race scanners.

#### Scenario: Reviewing QR Code Performance in the Grid

- **Given** QR codes already exist in the system
- **When** the Admin views the "QR Codes" section
- **Then** each QR card should show the QR's name, point value, active status, and scan count
- **And** the Admin should be able to distinguish enabled and disabled codes visually.

#### Scenario: Disabling a Compromised or Duplicated QR Code

- **Given** the Admin identifies a leaked or duplicated QR code in circulation
- **When** the Admin disables that QR code from its QR card
- **Then** the QR code should switch from `ACTIVE` to `DISABLED`
- **And** future player scans of that code should be rejected
- **And** the console should visibly reflect that the code is no longer active.

#### Scenario: Re-enabling a Previously Disabled QR Code

- **Given** a QR code is currently `DISABLED`
- **When** the Admin enables that QR code from its QR card
- **Then** the QR code should return to `ACTIVE`
- **And** it should once again be eligible for player scanning.

#### Scenario: Deleting an Obsolete QR Code

- **Given** a QR code should no longer be used in the event
- **When** the Admin deletes the QR code from its QR card
- **Then** the QR asset should be removed from the admin grid
- **And** it should no longer participate in future scoring activity.

### Feature: Team Operations

_As an organizer, I need to inspect and intervene on team performance and penalty state during the race._

#### Scenario: Browsing Teams in Ranked Order

- **Given** the Admin is on the "Teams" section
- **When** the team list loads
- **Then** teams should be presented in score-ranked order
- **And** each team row should show rank, team name, score, member count, and whether the team is currently racing or in a pit stop.

#### Scenario: Opening a Team Detail View

- **Given** the Admin is reviewing teams
- **When** the Admin selects a specific team from the ranked list
- **Then** the console should open a detailed team view
- **And** that view should show the team's score, rank, keywords, pit-stop state, and member roster.

#### Scenario: Adjusting a Team Score Manually

- **Given** the Admin is viewing a specific team's detail view
- **When** the Admin edits and saves that team's score
- **Then** the team's score should update immediately
- **And** the team's leaderboard position should reflect the new value.

#### Scenario: Triggering a Manual Pit Stop for a Team

- **Given** the Admin is viewing a specific team's detail view
- **And** the team is not currently in a pit stop
- **When** the Admin triggers a pit stop manually
- **Then** that team should enter the `IN_PIT` state
- **And** the team detail should display the active pit-stop timer.

#### Scenario: Clearing an Active Pit Stop for a Team

- **Given** the Admin is viewing a specific team's detail view
- **And** the team is currently in a pit stop
- **When** the Admin clears the penalty manually
- **Then** the team should return to the active race state
- **And** the pit-stop timer should be removed from the team view.

#### Scenario: Removing a Team from the Event

- **Given** the Admin is viewing a specific team's detail view
- **When** the Admin deletes the team
- **Then** the team should be removed from the ranked team list
- **And** the admin console should no longer show that team in active event operations.

### Feature: Player Directory and Detail Review

_As an organizer, I need player-level visibility so I can audit participation, contact information, and scoring history._

#### Scenario: Browsing Players Across All Teams

- **Given** the Admin is on the "Players" section
- **When** the player directory loads
- **Then** players should be shown in score-ranked order across all teams
- **And** each player row should show player name, team affiliation, and individual score.

#### Scenario: Opening a Player Detail View

- **Given** the Admin is reviewing the player directory
- **When** the Admin selects a specific player
- **Then** the console should open a player detail view
- **And** that view should show the player's global rank, team rank, joined date, team affiliation, and individual score.

#### Scenario: Reviewing Player Contact Information

- **Given** the Admin is on a player's detail view
- **When** the player has contact data on file
- **Then** the console should show the player's email address and phone number
- **And** missing optional contact data should be displayed clearly rather than omitted silently.

#### Scenario: Editing Player Contact Information

- **Given** the Admin is on a player's detail view
- **When** the Admin edits and saves that player's email address or phone number
- **Then** the player record should update immediately in the admin console
- **And** the revised contact information should persist as the latest player contact record.

#### Scenario: Reviewing a Player's Scan History

- **Given** the Admin is on a player's detail view
- **When** scan history exists for that player
- **Then** the console should show a chronological list of the QR codes that player scanned
- **And** each entry should include the QR name, timestamp, and points awarded.

### Feature: Statistics and Event Summary

_As an organizer, I want an event summary view that highlights the live competition picture and major operational counts._

#### Scenario: Viewing Core Event Totals

- **Given** the Admin opens the "Statistics" section
- **When** current event data is available
- **Then** the summary cards should show total teams, total points scored, total scans, and active penalties.

#### Scenario: Viewing the Current Top Teams

- **Given** the Admin opens the "Statistics" section
- **When** team ranking data is available
- **Then** the interface should highlight the top three teams prominently
- **And** each top-team card should show the team name and current score.

#### Scenario: Reviewing Active QR Codes from the Statistics View

- **Given** the Admin opens the "Statistics" section
- **When** QR code data is available
- **Then** the section should show the currently active QR codes
- **And** each row should display the QR's name, scan count, and point value.
