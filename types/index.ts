// ─── Core Data Model Types ───────────────────────────────────────────────────

export type UserRole = "player" | "admin";

export interface User {
  id: string;
  name: string;
  teamId: string;
  role: UserRole;
  createdAt: string;
}

export type QRCodeType = "STANDARD" | "VIP_EXEC" | "GOLDEN";

export interface Team {
  id: string;
  name: string;
  /** URL of the AI-generated car image */
  carImageUrl: string;
  /** AI-generated team slogan */
  slogan: string;
  /** Running points total */
  fuelLevel: number;
  createdAt: string;
}

export interface QRCode {
  id: string;
  codeString: string;
  type: QRCodeType;
  pointsValue: number;
  triviaQuestion?: string;
  triviaAnswer?: string;
}

export interface ScanActivity {
  id: string;
  teamId: string;
  userId: string;
  qrCodeId: string;
  pointsEarned: number;
  timestamp: string;
}

// ─── API Response Types ───────────────────────────────────────────────────────

export interface GenerateTeamResponse {
  name: string;
  slogan: string;
  imageUrl: string;
}

export interface ScanResult {
  success: boolean;
  pointsEarned: number;
  type: QRCodeType;
  triviaQuestion?: string;
  triviaAnswer?: string;
  message?: string;
}

// ─── UI-specific Types ────────────────────────────────────────────────────────

export interface LeaderboardEntry {
  id: string;
  name: string;
  fuelLevel: number;
}

export interface QRCodeConfig {
  id: string;
  codeString: string;
  type: QRCodeType;
  pointsValue: number;
  triviaQuestion: string;
  triviaAnswer: string;
}
