"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Sparkles, ChevronRight, RotateCcw } from "lucide-react";
import Button from "@/components/Button";
import Card from "@/components/Card";
import type { GenerateTeamResponse } from "@/types";

export default function TeamSetupPage() {
  const router = useRouter();
  const [keywords, setKeywords] = useState(["", "", ""]);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<GenerateTeamResponse | null>(null);
  const [error, setError] = useState("");

  function updateKeyword(index: number, value: string) {
    const updated = [...keywords];
    updated[index] = value;
    setKeywords(updated);
  }

  async function handleGenerate(e: React.FormEvent) {
    e.preventDefault();
    const filled = keywords.filter((k) => k.trim());
    if (filled.length < 1) {
      setError("Enter at least one keyword.");
      return;
    }
    setLoading(true);
    setError("");
    setResult(null);

    try {
      // TODO: Replace with real OpenAI/Gemini SDK call via the route handler
      const res = await fetch("/api/ai/generate-team", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ keywords: filled }),
      });
      if (!res.ok) throw new Error("Generation failed");
      const data: GenerateTeamResponse = await res.json();
      setResult(data);

      // TODO: Persist to Supabase
      // e.g. await supabase.from("teams").upsert({ name: data.name, slogan: data.slogan, carImageUrl: data.imageUrl })
    } catch {
      setError("Failed to generate team. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  function handleStartEngines() {
    if (result) {
      sessionStorage.setItem("teamData", JSON.stringify(result));
    }
    router.push("/race");
  }

  return (
    <div className="max-w-lg mx-auto py-8 space-y-8 animate-fade-in">
      <div className="text-center">
        <h1 className="text-3xl font-black uppercase tracking-tighter text-white">
          AI Design{" "}
          <span className="text-electric-cyan text-glow-cyan">Studio</span>
        </h1>
        <p className="text-slate-text mt-2 text-sm">
          Enter 3 keywords and our AI will design your F1 car identity.
        </p>
      </div>

      {/* Keyword Form */}
      <Card>
        <form onSubmit={handleGenerate} className="space-y-4">
          <div className="space-y-3">
            {keywords.map((kw, i) => (
              <input
                key={i}
                type="text"
                value={kw}
                onChange={(e) => updateKeyword(i, e.target.value)}
                placeholder={
                  ["e.g. Fast", "e.g. Cyberpunk", "e.g. Tiger"][i]
                }
                maxLength={30}
                className="w-full bg-navy-bg border border-electric-cyan/30 rounded-lg px-4 py-3 text-white placeholder:text-slate-text/50 focus:outline-none focus:border-electric-cyan focus:ring-1 focus:ring-electric-cyan transition-colors"
              />
            ))}
          </div>

          {error && <p className="text-red-400 text-sm">{error}</p>}

          <Button
            type="submit"
            variant="cyan"
            disabled={loading}
            className="w-full gap-2"
          >
            <Sparkles className="w-4 h-4" />
            {loading ? "Generating…" : "Generate My Team"}
          </Button>
        </form>
      </Card>

      {/* Loading State */}
      {loading && (
        <div className="text-center space-y-4 animate-pulse">
          <div className="w-full h-48 bg-navy-surface rounded-xl border border-electric-cyan/20 flex items-center justify-center">
            <p className="text-electric-cyan text-glow-cyan animate-pulse text-lg font-bold">
              🤖 AI is designing your car…
            </p>
          </div>
        </div>
      )}

      {/* AI Result */}
      {result && !loading && (
        <Card className="space-y-4 animate-slide-up">
          <h2 className="text-electric-cyan text-glow-cyan text-xl font-bold text-center uppercase tracking-wide">
            {result.name}
          </h2>

          {/* Car Image */}
          <div className="relative w-full h-48 rounded-lg overflow-hidden border border-electric-cyan/20">
            <Image
              src={result.imageUrl}
              alt={`${result.name} F1 car`}
              fill
              className="object-cover"
              unoptimized
            />
          </div>

          {/* Slogan */}
          <p className="text-center text-slate-text italic text-sm">
            &ldquo;{result.slogan}&rdquo;
          </p>

          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={() => setResult(null)}
              className="flex-1 gap-1"
            >
              <RotateCcw className="w-4 h-4" /> Regenerate
            </Button>
            <Button
              variant="green"
              onClick={handleStartEngines}
              className="flex-1 gap-1"
            >
              Start Engines <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
}
