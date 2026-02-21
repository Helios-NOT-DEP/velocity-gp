"use client";

import { useState, useEffect } from "react";
import { Trophy, Tv2, Zap } from "lucide-react";
import Card from "@/components/Card";
import type { LeaderboardEntry } from "@/types";

// Mock leaderboard data — replace with Supabase real-time subscription
const MOCK_TEAMS: LeaderboardEntry[] = [
  { id: "1", name: "Turbo Tigers", fuelLevel: 320 },
  { id: "2", name: "Neon Phantoms", fuelLevel: 285 },
  { id: "3", name: "Iron Circuit", fuelLevel: 260 },
  { id: "4", name: "Volt Storm", fuelLevel: 195 },
  { id: "5", name: "Cyber Blaze", fuelLevel: 140 },
  { id: "6", name: "Quantum Rush", fuelLevel: 95 },
];

const RANK_STYLES: Record<
  number,
  { border: string; text: string; badge: string; glow: string }
> = {
  1: {
    border: "border-yellow-400/60",
    text: "text-yellow-300",
    badge: "🥇",
    glow: "shadow-[0_0_20px_rgba(250,204,21,0.3)]",
  },
  2: {
    border: "border-slate-400/60",
    text: "text-slate-300",
    badge: "🥈",
    glow: "shadow-[0_0_12px_rgba(148,163,184,0.2)]",
  },
  3: {
    border: "border-amber-600/60",
    text: "text-amber-500",
    badge: "🥉",
    glow: "shadow-[0_0_12px_rgba(217,119,6,0.2)]",
  },
};

export default function LeaderboardPage() {
  const [teams, setTeams] = useState<LeaderboardEntry[]>(MOCK_TEAMS);
  const [commentary, setCommentary] = useState(
    "The race is heating up — Turbo Tigers pulling ahead in sector 3! 🔥"
  );

  useEffect(() => {
    // TODO: Replace with real Supabase real-time subscription
    // e.g.:
    // const channel = supabase
    //   .channel("public:teams")
    //   .on(
    //     "postgres_changes",
    //     { event: "UPDATE", schema: "public", table: "teams" },
    //     (payload) => {
    //       setTeams((prev) =>
    //         prev.map((t) => (t.id === payload.new.id ? { ...t, fuelLevel: payload.new.fuelLevel } : t))
    //           .sort((a, b) => b.fuelLevel - a.fuelLevel)
    //       );
    //     }
    //   )
    //   .subscribe();
    // return () => { supabase.removeChannel(channel); };

    // Mock: sort teams on mount
    setTeams([...MOCK_TEAMS].sort((a, b) => b.fuelLevel - a.fuelLevel));
  }, []);

  const maxFuel = teams[0]?.fuelLevel ?? 1;

  return (
    <div className="max-w-3xl mx-auto py-8 space-y-8 animate-fade-in">
      {/* Header */}
      <div className="text-center space-y-2">
        <div className="flex items-center justify-center gap-2">
          <Trophy className="text-yellow-400 w-8 h-8" />
          <h1 className="text-4xl font-black uppercase tracking-tighter text-white">
            Live{" "}
            <span className="text-electric-cyan text-glow-cyan">
              Leaderboard
            </span>
          </h1>
          <Trophy className="text-yellow-400 w-8 h-8" />
        </div>
        <p className="text-slate-text text-sm tracking-widest uppercase">
          Real-time standings · GM Insurance Grand Prix
        </p>
      </div>

      {/* Rankings */}
      <div className="space-y-3">
        {teams.map((team, index) => {
          const rank = index + 1;
          const style = RANK_STYLES[rank] ?? {
            border: "border-electric-cyan/20",
            text: "text-white",
            badge: `#${rank}`,
            glow: "",
          };
          const barWidth = Math.round((team.fuelLevel / maxFuel) * 100);

          return (
            <Card
              key={team.id}
              className={`border ${style.border} ${style.glow} transition-all duration-500`}
            >
              <div className="flex items-center gap-4">
                {/* Rank badge */}
                <span className="text-2xl w-10 text-center shrink-0">
                  {style.badge}
                </span>

                {/* Team info */}
                <div className="flex-1 min-w-0">
                  <p className={`font-bold text-lg truncate ${style.text}`}>
                    {team.name}
                  </p>
                  {/* Progress bar */}
                  <div className="mt-1.5 bg-navy-bg rounded-full h-2 overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-electric-cyan to-neon-green transition-all duration-700"
                      style={{ width: `${barWidth}%` }}
                    />
                  </div>
                </div>

                {/* Fuel score */}
                <div className="flex items-center gap-1 shrink-0">
                  <Zap className="text-neon-green w-4 h-4" />
                  <span className="text-neon-green font-black text-xl text-glow-green">
                    {team.fuelLevel}
                  </span>
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      {/* Live Commentary */}
      <Card className="border border-electric-cyan/30">
        <div className="flex items-center gap-2 mb-3">
          <Tv2 className="text-electric-cyan w-5 h-5" />
          <h2 className="text-electric-cyan font-bold uppercase tracking-wide text-sm">
            Live Commentary
          </h2>
          <span className="ml-auto flex items-center gap-1 text-xs text-neon-green">
            <span className="w-2 h-2 rounded-full bg-neon-green animate-pulse inline-block" />
            LIVE
          </span>
        </div>
        <p className="text-slate-text text-sm leading-relaxed">{commentary}</p>
        {/* TODO: Populate commentary via AI analysis of race events */}
        {/* e.g. fetch("/api/ai/commentary") and stream the response */}
        <textarea
          value={commentary}
          onChange={(e) => setCommentary(e.target.value)}
          rows={3}
          className="mt-3 w-full bg-navy-bg border border-electric-cyan/20 rounded-lg px-3 py-2 text-white text-sm resize-none focus:outline-none focus:border-electric-cyan"
          placeholder="Admin: Type live commentary here…"
        />
      </Card>
    </div>
  );
}
