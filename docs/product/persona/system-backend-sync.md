# Velocity GP BDD: Persona 4

## The System (Backend / Sync)

### Feature: Logic & State Enforcement

_The system must strictly enforce team assignments, statuses, and hazard ratios during every scan._

#### Scenario: Persisting Teammate Self-Descriptions for Team Logo Generation

- **Given** a Player submits words describing themself in the AI Design Studio
- **When** the System receives the self-description for that Player's assigned team
- **Then** the System should validate the terms against the Policy Safety Filter
- **And If** the terms violate policy, reject the submission and do not count it toward team completion
- **And If** the terms are safe, persist the self-description for that Player and team
- **And** recalculate whether all teammates on that preassigned team have submitted approved descriptions.

#### Scenario: Generating a Shared Team Logo Once All Teammates Have Submitted

- **Given** a preassigned team has an auto-created team name
- **And** every member of that team has submitted an approved self-description
- **When** the final required self-description is saved
- **Then** the System should generate one shared Team Logo from all teammate descriptions and the preassigned team name
- **And** persist the generated Team Logo as the team's shared identity
- **And** transition the team status to "ACTIVE"
- **And** make the updated team identity available to all team members for routing into the Main Race Hub.

#### Scenario: Evaluating the "Hot Potato" Modulo

- **Given** a scan request is received for QR Code UUID-XYZ
- **When** the System reads the total global scan count for UUID-XYZ and resolves that code's effective hazard policy
- **Then** the System must calculate (current_scan_count + 1) % effective_hazard_ratio
- **And If** the result is 0, the System must trigger the IN_PIT penalty transaction.

#### Scenario: Hazard Policy Resolution Precedence

- **Given** both a global hazard ratio and a per-QR custom rule are configured
- **When** a scan request arrives for that QR code
- **Then** the System must prioritize the per-QR custom rule over the global default
- **And If** no per-QR rule exists, the System should fall back to the global hazard configuration.

#### Scenario: Conflict of Interest Check (Rescue Validation)

- **Given** a scan request for a "Superpower QR" is received
- **When** the System checks the team_id for both the Scanner and Scannee
- **Then** the System must verify scanner.team_id != scannee.team_id
- **And If** the IDs match, reject the transaction with a SELF_RESCUE_FORBIDDEN code.

#### Scenario: Auto-Releasing a team from the Pit Stop

- **Given** Team Alpha is currently "IN_PIT"
- **When** the server time surpasses Team Alpha's pitStopExpiresAt timestamp
- **Then** the System should automatically update Team Alpha's status to "ACTIVE"
- **And** push a WebSocket update to all Team Alpha devices to re-enable their scanners.
