# Velocity GP BDD: Persona 2

## The Helios Player (App Creator / Player)

### Feature: The Creator Superpower

_As an app creator, I possess the ability to 'repair' other teams, but my powers are neutralized for my own team to maintain competitive integrity._

#### Scenario: Helping a Rival Team

- **Given** I am a Helios Player
- **And** a member of a different team scans my Superpower QR
- **When** the transaction is processed
- **Then** their penalty is cleared
- **And** I receive a "Rescue Log" notification on my device
- **And** **No points** are added to my personal or team score (maintaining fairness).

#### Scenario: Power Cooldown

- **Given** I have just rescued a team
- **When** another penalized team attempts to scan my Superpower QR within 3 minutes
- **Then** their app should display: "Pit Crew Overheated! [My Name] is busy. Try again in 2 mins."

#### Scenario: Being Stuck with the Crew

- **Given** I am a Helios Player on "Team Alpha"
- **And** my teammate triggers a "Hot Potato" Hazard
- **When** "Team Alpha" enters the Pit Stop
- **Then** I am also locked out from scanning
- **And** I cannot use my own QR code to clear the penalty for my team
- **And** I must physically find another Helios Player in the venue to rescue us.
