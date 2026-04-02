# Velocity GP BDD: Persona 5

## The Display Board (Venue Visuals)

### Feature: Live Venue Information Radiator

_The venue display should highlight the race energy, the struggle of the Pit Stop, and the intervention of the Creators._

#### Scenario: Real-Time Leaderboard Overtake

- **Given** the Display Board is active in the venue
- **When** Team Alpha passes Team Beta in points
- **Then** the UI should use a "Roll-up" animation for Team Alpha's fuel score
- **And** Team Alpha's row should physically slide above Team Beta with a "Swoosh" animation and flash neon-green.

#### Scenario: Visualizing a Team entering the Pit Stop

- **Given** a team is on the Display Board
- **When** they are the unlucky player to trigger a QR code's Hazard Ratio
- **Then** the Display Board should instantly flash the screen edges red
- **And** the team's row should turn red
- **And** a live countdown timer (e.g., "14:59") should appear next to their name.

#### Scenario: Announcing a Creator Intervention

- **Given** a Helios Player rescues a team from the Pit Stop
- **Then** a "REPAIRS COMPLETE" alert should flash on the board
- **And** it should display: "[Helios Name] has cleared the track for Team [Rescued Team Name]!"
