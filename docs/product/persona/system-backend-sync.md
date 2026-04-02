# Velocity GP BDD: Persona 4

## The System (Backend / Sync)

### Feature: Logic & State Enforcement

_The system must strictly enforce team assignments, statuses, and hazard ratios during every scan._

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
