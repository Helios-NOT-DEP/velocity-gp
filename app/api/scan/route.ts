import { NextRequest, NextResponse } from "next/server";
import type { ScanResult } from "@/types";

// Mock QR code registry — replace with Supabase/Prisma lookups
const MOCK_QR_CODES: Record<string, ScanResult> = {
  "demo-standard-001": {
    success: true,
    pointsEarned: 10,
    type: "STANDARD",
  },
  "demo-vip-001": {
    success: true,
    pointsEarned: 50,
    type: "VIP_EXEC",
    triviaQuestion: "What year did Formula 1 officially begin?",
    triviaAnswer: "1950",
  },
  "demo-golden-001": {
    success: true,
    pointsEarned: 100,
    type: "GOLDEN",
    triviaQuestion: "Which team has won the most F1 Constructors Championships?",
    triviaAnswer: "Ferrari",
  },
};

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { codeString } = body as { codeString?: string };

    if (!codeString || typeof codeString !== "string") {
      return NextResponse.json(
        { error: "Missing or invalid codeString." },
        { status: 400 }
      );
    }

    // TODO: Replace with real Supabase/Prisma lookup, e.g.:
    // const qrCode = await prisma.qRCode.findUnique({ where: { codeString } });
    // if (!qrCode) return NextResponse.json({ error: "QR code not found." }, { status: 404 });
    //
    // Also log the scan activity:
    // await prisma.scanActivity.create({
    //   data: { teamId, userId, qrCodeId: qrCode.id, pointsEarned: qrCode.pointsValue },
    // });
    //
    // And update the team's fuel level:
    // await prisma.team.update({
    //   where: { id: teamId },
    //   data: { fuelLevel: { increment: qrCode.pointsValue } },
    // });

    const found = MOCK_QR_CODES[codeString];

    if (!found) {
      // Unknown QR — treat as standard 5-point scan for demo purposes
      const fallback: ScanResult = {
        success: true,
        pointsEarned: 5,
        type: "STANDARD",
      };
      return NextResponse.json(fallback);
    }

    return NextResponse.json(found);
  } catch {
    return NextResponse.json(
      { error: "Failed to process scan." },
      { status: 500 }
    );
  }
}
