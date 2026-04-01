# Velocity GP BDD: Persona 3

## The Admin (Event Organizer)

### Feature: Event & Hazard Management

_As an organizer, I need to manage the multi-day race flow, designate 'Creators', and tweak game difficulty._

#### Scenario: Creating a New QR Code from the Admin Portal

- **Given** the Admin is on the "QR Control Center" tab of the Admin Portal
- **When** the Admin clicks "Create QR"
- **And** enters a label, point value, zone, and activation window
- **And** selects "Generate"
- **Then** the System should create a unique QR identifier and render a downloadable QR asset
- **And** the QR code should appear in the QR inventory table with status "ACTIVE".

#### Scenario: Bulk Generating QR Codes for a Venue Zone

- **Given** the Admin is preparing the event floor for launch day
- **When** the Admin uploads a CSV template with zone, value, and label fields
- **And** clicks "Generate Batch"
- **Then** the System should validate each row and create QR codes for valid records
- **And** invalid rows should be returned in an error report with line-level reasons
- **And** the Admin should be able to download a zip of all generated QR assets.

#### Scenario: Disabling a Compromised or Duplicated QR Code

- **Given** the Admin identifies a leaked or duplicated QR code in circulation
- **When** the Admin toggles that QR's status from "ACTIVE" to "DISABLED"
- **Then** all future scans of that QR should be rejected
- **And** the Player should see "Code disabled by race control. Find another checkpoint."
- **And** the action should be recorded in an audit log with admin identity and timestamp.

#### Scenario: Configuring the Global "Hot Potato" Ratio

- **Given** the Admin is on the "Game Settings" tab of the Admin Dashboard
- **When** the Admin inputs "10" into the "Global Hazard Scan Ratio" field
- **And** clicks "Save Configuration"
- **Then** the System updates the configuration database
- **And** moving forward, any QR code in the venue that reaches a multiple of 10 in its global scan count (10th, 20th, 30th scan) will automatically trigger a Pit Stop penalty for the unlucky scanner.

#### Scenario: Configuring Hazard Rules Per QR Code

- **Given** the Admin is on a specific QR code's detail drawer
- **When** the Admin enables "Custom Hazard Rule"
- **And** sets a hazard ratio of 8 with a pit penalty duration of 10 minutes
- **And** clicks "Save Rule"
- **Then** the System should store the per-QR hazard policy
- **And** future scans of that QR should use the custom policy instead of the global default
- **And** the change should be reflected immediately on the Admin preview simulator.

#### Scenario: Applying a Temporary Hazard Multiplier During Peak Hours

- **Given** the Admin expects high scan traffic between 1 PM and 3 PM
- **When** the Admin creates a scheduled rule for Zone C with hazard multiplier 1.5x
- **Then** the System should automatically apply the multiplier only within the configured window
- **And** once the window ends, the hazard behavior should revert to baseline configuration.

#### Scenario: Pausing the Race for the Night

- **Given** the Admin is on the Admin Dashboard
- **And** the multi-day race is currently "Active"
- **When** the Admin clicks "PAUSE RACE (Overnight Lock)"
- **Then** the global game state should update to "Paused"
- **And** all Players' camera scanners should be disabled with a message "Race resumes tomorrow at 9 AM!"

#### Scenario: Assigning Helios Permissions

- **Given** the Admin is on the "User Management" tab of the Admin Dashboard
- **When** the Admin searches for a user by email or name
- **And** toggles the "Helios Status" switch to "ON"
- **Then** the System should update that user's record with is_helios: true
- **And** the next time that user's app refreshes, it should display their "Superpower QR" in their profile.

### Feature: Admin Game Health Dashboard

_As an organizer, I want a real-time health dashboard so I can quickly detect risk, engagement drops, and fairness anomalies during the race._

#### Scenario: Viewing Core Health Metrics in Real Time

- **Given** the Admin opens the "Game Health" dashboard
- **When** live data is available
- **Then** the dashboard should show active players, scans per minute, hazard hit rate, average pit duration, and invalid scan rate
- **And** each metric tile should display a trend indicator versus the previous 15-minute window.

#### Scenario: Alerting on Abnormal Invalid Scan Spikes

- **Given** the baseline invalid scan rate is below 3%
- **When** the invalid scan rate rises above a configured threshold (e.g., 8%) for 5 continuous minutes
- **Then** the dashboard should raise a "Potential Abuse / Signage Issue" warning
- **And** highlight the top zones and codes contributing to the spike
- **And** recommend operational actions (disable suspected code, inspect venue signage, dispatch staff).

#### Scenario: Monitoring Fairness Through Team Risk Distribution

- **Given** the race has been active for at least 30 minutes
- **When** one team's hazard-hit frequency is statistically higher than venue average
- **Then** the dashboard should flag a fairness warning
- **And** surface contributing QR codes and zones
- **And** allow the Admin to open hazard controls directly from the warning panel.
