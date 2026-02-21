"use client";

import { useState, useEffect } from "react";
import { Fuel, QrCode, Trophy } from "lucide-react";
import Button from "@/components/Button";
import Card from "@/components/Card";
import Scanner from "@/components/Scanner";
import TriviaModal from "@/components/TriviaModal";
import type { GenerateTeamResponse, ScanResult } from "@/types";

export default function RacePage() {
  const [teamData, setTeamData] = useState<GenerateTeamResponse | null>(null);
  const [fuelLevel, setFuelLevel] = useState(0);
  const [scanning, setScanning] = useState(false);
  const [trivia, setTrivia] = useState<ScanResult | null>(null);
  const [notification, setNotification] = useState<string | null>(null);

  useEffect(() => {
    // TODO: Replace with real Supabase real-time subscription
    // e.g. supabase.channel("team:...").on("postgres_changes", ...).subscribe()
    const raw = sessionStorage.getItem("teamData");
    if (raw) {
      try {
        setTeamData(JSON.parse(raw) as GenerateTeamResponse);
      } catch {
        // ignore parse errors
      }
    }
    const savedFuel = sessionStorage.getItem("fuelLevel");
    if (savedFuel) setFuelLevel(Number(savedFuel));
  }, []);

  async function handleScan(qrData: string) {
    setScanning(false);

    try {
      // Call the scan validation API
      const res = await fetch("/api/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ codeString: qrData }),
      });
      const data: ScanResult = await res.json();

      if (data.triviaQuestion) {
        // Show trivia modal before awarding points
        setTrivia(data);
      } else {
        awardPoints(data.pointsEarned);
      }
    } catch {
      showNotification("❌ Scan error — please try again.");
    }
  }

  function handleTriviaAnswer(correct: boolean) {
    if (!trivia) return;
    if (correct) {
      awardPoints(trivia.pointsEarned);
    } else {
      showNotification("❌ Wrong answer — no points this time!");
    }
    setTrivia(null);
  }

  function awardPoints(pts: number) {
    const newFuel = fuelLevel + pts;
    setFuelLevel(newFuel);
    sessionStorage.setItem("fuelLevel", String(newFuel));
    showNotification(`⚡ +${pts} Fuel added!`);
  }

  function showNotification(msg: string) {
    setNotification(msg);
    setTimeout(() => setNotification(null), 3000);
  }

  const teamName = teamData?.name ?? "Your Team";

  return (
    <div className="max-w-md mx-auto py-6 space-y-6 animate-fade-in">
      {/* Top Bar */}
      <Card className="flex items-center justify-between">
        <div>
          <p className="text-slate-text text-xs uppercase tracking-widest mb-0.5">
            Team
          </p>
          <p className="text-white font-bold text-lg">{teamName}</p>
        </div>
        <div className="flex items-center gap-2">
          <Fuel className="text-neon-green w-5 h-5" />
          <div className="text-right">
            <p className="text-slate-text text-xs uppercase tracking-widest mb-0.5">
              Fuel Level
            </p>
            <p className="text-neon-green font-black text-2xl text-glow-green">
              {fuelLevel}
            </p>
          </div>
        </div>
      </Card>

      {/* Fuel bar */}
      <div className="w-full bg-navy-surface rounded-full h-3 border border-electric-cyan/20 overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-electric-cyan to-neon-green transition-all duration-700"
          style={{ width: `${Math.min(fuelLevel, 100)}%` }}
        />
      </div>

      {/* Notification */}
      {notification && (
        <div className="bg-neon-green/10 border border-neon-green/40 rounded-lg px-4 py-3 text-neon-green font-semibold text-center animate-slide-up text-glow-green">
          {notification}
        </div>
      )}

      {/* Main Scan Action */}
      {!scanning ? (
        <div className="text-center space-y-4">
          <p className="text-slate-text text-sm">
            Find a QR code around the venue and scan it to earn fuel points!
          </p>
          <Button
            variant="cyan"
            onClick={() => setScanning(true)}
            className="w-full text-lg py-5 gap-3"
          >
            <QrCode className="w-6 h-6" />
            Scan QR Code
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          <Scanner onScan={handleScan} />
          <Button
            variant="outline"
            onClick={() => setScanning(false)}
            className="w-full"
          >
            Cancel
          </Button>
        </div>
      )}

      {/* Trivia Modal */}
      {trivia && (
        <TriviaModal
          question={trivia.triviaQuestion!}
          answer={trivia.triviaAnswer!}
          pointsValue={trivia.pointsEarned}
          onClose={(correct) => handleTriviaAnswer(correct)}
        />
      )}

      {/* Quick nav */}
      <div className="flex justify-center pt-4">
        <a
          href="/leaderboard"
          className="flex items-center gap-2 text-slate-text hover:text-electric-cyan transition-colors text-sm"
        >
          <Trophy className="w-4 h-4" /> View Leaderboard
        </a>
      </div>
    </div>
  );
}
