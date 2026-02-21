import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const { password } = (await req.json()) as { password?: string };

    // TODO: Replace with a proper auth provider (NextAuth, Supabase Auth, etc.)
    // The admin password is read from a server-side environment variable
    // (no NEXT_PUBLIC_ prefix) so it is never exposed to the browser.
    const adminPassword = process.env.ADMIN_PASSWORD ?? "velocity2024";

    if (!password || password !== adminPassword) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }
}
