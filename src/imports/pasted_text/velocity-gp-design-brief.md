# **Figma Design Brief: Velocity GP**

**Project Overview:** Velocity GP is a mobile-first, multi-day corporate event web app. It’s a gamified scavenger hunt where teams design GenAI F1 cars, scan QR codes to earn points, avoid "Pit Stop" hazard lockouts, and seek rescues from "Helios" creator players.

**Global Art Direction & Design System:**

- **Vibe:** "Neon Velocity." Cyberpunk meets Formula 1, but clean enough for a corporate event. High contrast, sleek, and energetic.
- **Backgrounds:** Deep Navy (\#050E1D) to Dark Slate (\#0B1E3B). Glassmorphism effects for cards and overlays.
- **Typography:** 'Exo 2' (Italic, Heavy) for headers and branding. 'Inter' for highly legible body text and UI elements.
- **Color Palette:**
  - Primary: Electric Cyan (\#00D4FF) \- Used for active states, primary buttons, and futuristic borders.
  - Success: Neon Green (\#39FF14) \- Used for points gained and positive notifications.
  - Danger: Hazard Red (\#FF3939) \- Used for Pit Stop lockouts and errors.
  - Text: Slate Gray (\#94A3B8) for secondary text, White (\#F8FAFC) for primary text.
- **UI Components:** Rounded corners (8px to 12px), glowing drop-shadows (neon effect), and bottom-sheet navigation for mobile.

## **Screen 1: Mobile Passwordless Login**

**Platform:** Mobile Portrait

**Description:** A sleek, frictionless entry point.

- **Header:** Large, italicized "Velocity GP" logo with a cyan glow.
- **Content:** A glassmorphism card in the center. Inside: an input field for "Email or Cellphone", a full-width "Name" input field, and a glowing Cyan primary button that says "Send Magic Link".
- **Footer:** Subtle corporate branding. "Powered by Helios".

## **Screen 2: AI Design Studio (The Garage)**

**Platform:** Mobile Portrait

**Description:** Where teams use GenAI to create their car.

- **Header:** "The Paddock" (Exo 2 font).
- **Top Half:** A glowing, empty wireframe placeholder for a car.
- **Bottom Half:** Three text input fields labeled "Keyword 1", "Keyword 2", and "Keyword 3" (e.g., Fast, Corporate, Tiger). A large, neon-bordered button: "Generate Team Identity".
- **State Variation (Processing):** Show a shimmering, animated skeleton loader where the car will appear.
- **State Variation (Complete):** Show a photorealistic, neon-lit F1 car image, a generated team name (e.g., "Turbo Tigers"), and a "Finalize" button.

## **Screen 3: Mobile Race Hub (Active State)**

**Platform:** Mobile Portrait

**Description:** The main dashboard for scanning and tracking points.

- **Top Bar:** User's Name, Team Name, and a large "Fuel Level: 14,200" stat glowing in Neon Green.
- **Center:** A large camera viewfinder taking up 50% of the screen with a cyan scanning reticle overlay.
- **Bottom Sheet:** A scrollable "Recent Scans" feed showing point additions (+100, \+50) with timestamps.

## **Screen 4: Mobile Race Hub (Pit Stop Lockout)**

**Platform:** Mobile Portrait

**Description:** The penalty state when a team hits a Hazard.

- **Background Overlay:** The entire screen is tinted dark red. The camera viewfinder is blurred out.
- **Center Modal:** A prominent, pulsing red warning card.
  - Icon: A hazard triangle.
  - Header: "TEAM IN PIT STOP\!"
  - Text: "Your team hit a Hot Potato hazard. Scanners disabled."
  - Timer: A massive countdown timer (e.g., "14:59") in monospaced font.
- **Call to Action:** A secondary text prompt: "Find a Helios Player to bypass the timer\!"

## **Screen 5: Helios Player Profile (Creator Superpower)**

**Platform:** Mobile Portrait

**Description:** A special profile view for the "Architects" of the game.

- **Header:** User Name with a special glowing "HELIOS" badge next to it.
- **Center:** A large, high-contrast QR code centered on the screen.
- **Text:** "Superpower QR: Let penalized teams scan this to instantly clear their Pit Stop timer."
- **Bottom:** A metric showing "Teams Rescued Today: 4".

## **Screen 6: Main Stage Display Board (Leaderboard)**

**Platform:** Desktop / 16:9 TV Landscape

**Description:** A broadcast-quality leaderboard projected at the venue.

- **Layout:** Dark navy background with a subtle grid pattern.
- **Left Column (Top 3):** The top 3 teams displayed with large avatars (their GenAI cars), bold team names, and glowing scores.
- **Right Column (The Grid):** A scrolling list of teams ranked 4th through 15th.
- **Alert State:** One of the team rows in the grid should be colored solid Hazard Red with the text "IN PIT (12:00 left)" to show real-time penalties.
- **Bottom Ticker (GenAI Announcer):** A permanent, scrolling news ticker spanning the entire bottom width of the screen. Dark background, bright cyan text (e.g., "AI COMMENTARY: ⚡ The Ultras just snatched the lead from Risk Racers\! Meanwhile, Team Alpha is stuck in the pits...").

## **Screen 7: Victory Lane (Final Podium)**

**Platform:** Desktop / 16:9 TV Landscape

**Description:** The finale screen shown at the end of the 72 hours.

- **Centerpiece:** A glowing 3-tier podium (1st, 2nd, 3rd).
- **Elements:** Place the respective AI-generated F1 cars on top of each podium tier.
- **Accents:** Gold, Silver, and Bronze neon accents. Confetti particle effects in the background.
- **Side Panel:** "Event Stats: Total Scans, Total Pit Stops, MVP Player".
