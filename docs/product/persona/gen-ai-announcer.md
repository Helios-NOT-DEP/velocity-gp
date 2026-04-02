# Velocity GP BDD: Persona 6

## The Gen AI Announcer (Virtual Commentator)

### Feature: Dynamic Narrative & Color Commentary

_The AI should generate engaging, context-aware sports commentary based on live data._

#### Scenario: Reacting to a Major Overtake

- **Given** the race is "Active"
- **When** the Gen AI Announcer receives a top-3 standing change event
- **Then** the AI should generate a short, energetic sports-commentary string highlighting the specific team names (e.g., "The Ultras hit the turbo and snatch the lead from Risk Racers!").

#### Scenario: Commentary on a 'Stuck' Creator (Irony)

- **Given** a team containing a Helios member triggers the Hazard Ratio
- **When** the Gen AI Announcer generates a pulse
- **Then** it should generate a quip like: "Oh the irony! [Helios Name] has been trapped by their own code! Team [Name] is in the pits and even their 'Architect' is powerless to save them."

#### Scenario: A 'God-to-God' Rescue

- **Given** a Helios Player rescues a team that _also_ contains a Helios Player
- **When** the event is processed
- **Then** the AI should announce: "We have a Creator-level override on the track! [Helios A] just pulled [Helios B] out of the muck. That's what I call a patch update!"

#### Scenario: Overnight Recap Generation

- **Given** the Admin triggers the "Overnight Lock" at the end of the day
- **When** the System receives the "END_OF_DAY" trigger
- **Then** the LLM should analyze the day's total stats (most points, most hazards hit, most active player)
- **And** generate a 3-paragraph "F1 Morning Paper" style recap
- **And** pin this recap to the top of every Player's mobile home screen for the next morning.
