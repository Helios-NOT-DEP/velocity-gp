"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Zap, Flag } from "lucide-react";
import Button from "@/components/Button";
import Card from "@/components/Card";

export default function LobbyPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleJoin(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setError("Please enter your name to join.");
      return;
    }
    setLoading(true);
    setError("");

    // TODO: Replace with real Supabase user creation / team assignment
    // e.g. const { data } = await supabase.from("users").insert({ name }).select().single()
    await new Promise((r) => setTimeout(r, 800)); // mock delay

    // Store player name in sessionStorage for now
    sessionStorage.setItem("playerName", name.trim());
    router.push("/team-setup");
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-[80vh] gap-8 animate-fade-in">
      {/* Hero / Logo */}
      <div className="text-center space-y-3">
        <div className="flex items-center justify-center gap-2 mb-4">
          <Zap className="text-electric-cyan w-10 h-10 text-glow-cyan" />
          <h1 className="text-5xl sm:text-6xl font-black tracking-tighter text-white uppercase">
            Velocity
            <span className="text-electric-cyan text-glow-cyan"> GP</span>
          </h1>
          <Flag className="text-neon-green w-10 h-10 text-glow-green" />
        </div>
        <p className="text-slate-text text-lg sm:text-xl max-w-md mx-auto">
          Build your AI-powered F1 car. Hunt QR codes. Dominate the leaderboard.
        </p>
        <p className="text-electric-cyan/70 text-sm tracking-widest uppercase">
          GM Insurance Grand Prix — Corporate Edition
        </p>
      </div>

      {/* Join Form */}
      <Card className="w-full max-w-sm">
        <h2 className="text-xl font-bold text-white mb-6 text-center">
          Enter the Paddock
        </h2>
        <form onSubmit={handleJoin} className="space-y-4">
          <div>
            <label
              htmlFor="playerName"
              className="block text-sm text-slate-text mb-1"
            >
              Your Name
            </label>
            <input
              id="playerName"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Lewis Hamilton"
              maxLength={50}
              className="w-full bg-navy-bg border border-electric-cyan/30 rounded-lg px-4 py-3 text-white placeholder:text-slate-text/50 focus:outline-none focus:border-electric-cyan focus:ring-1 focus:ring-electric-cyan transition-colors"
            />
            {error && (
              <p className="text-red-400 text-sm mt-1">{error}</p>
            )}
          </div>

          <Button
            type="submit"
            variant="cyan"
            disabled={loading}
            className="w-full"
          >
            {loading ? "Joining…" : "🏎️ Join the Paddock"}
          </Button>
        </form>
      </Card>

      {/* Quick links */}
      <div className="flex gap-4 text-sm text-slate-text">
        <a
          href="/leaderboard"
          className="hover:text-electric-cyan transition-colors underline underline-offset-2"
        >
          View Leaderboard
        </a>
        <span>·</span>
        <a
          href="/admin"
          className="hover:text-electric-cyan transition-colors underline underline-offset-2"
        >
          Admin Panel
        </a>
      </div>
    </div>
  );
}
