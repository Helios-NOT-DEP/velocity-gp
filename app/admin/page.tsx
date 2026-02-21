"use client";

import { useState } from "react";
import { v4 as uuidv4 } from "uuid";
import { QRCodeSVG } from "qrcode.react";
import { Download, Plus, Shield, Trash2 } from "lucide-react";
import Button from "@/components/Button";
import Card from "@/components/Card";
import type { QRCodeConfig } from "@/types";

// Simple mock auth — replace with real auth (NextAuth, Supabase Auth, etc.)
const ADMIN_PASSWORD = "velocity2024";

export default function AdminPage() {
  const [authenticated, setAuthenticated] = useState(false);
  const [password, setPassword] = useState("");
  const [authError, setAuthError] = useState("");

  // QR code form state
  const [qrCodes, setQrCodes] = useState<QRCodeConfig[]>([]);
  const [form, setForm] = useState<Omit<QRCodeConfig, "id" | "codeString">>({
    type: "STANDARD",
    pointsValue: 10,
    triviaQuestion: "",
    triviaAnswer: "",
  });

  function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    if (password === ADMIN_PASSWORD) {
      setAuthenticated(true);
      setAuthError("");
    } else {
      setAuthError("Incorrect password.");
    }
  }

  function generateQRCode() {
    const newCode: QRCodeConfig = {
      ...form,
      id: uuidv4(),
      codeString: uuidv4(),
    };
    setQrCodes((prev) => [newCode, ...prev]);
    // TODO: Persist to Supabase
    // e.g. await supabase.from("qr_codes").insert(newCode)
  }

  function removeQRCode(id: string) {
    setQrCodes((prev) => prev.filter((qr) => qr.id !== id));
  }

  function downloadQRCode(codeString: string, name: string) {
    const svgEl = document.getElementById(`qr-${codeString}`);
    if (!svgEl) return;
    const svgData = new XMLSerializer().serializeToString(svgEl);
    const svgBlob = new Blob([svgData], {
      type: "image/svg+xml;charset=utf-8",
    });
    const url = URL.createObjectURL(svgBlob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `qr-${name}.svg`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (!authenticated) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] animate-fade-in">
        <Card className="w-full max-w-sm space-y-4">
          <div className="flex items-center gap-2 justify-center mb-2">
            <Shield className="text-electric-cyan w-6 h-6" />
            <h1 className="text-xl font-bold text-white">Admin Access</h1>
          </div>
          <form onSubmit={handleLogin} className="space-y-4">
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter admin password"
              className="w-full bg-navy-bg border border-electric-cyan/30 rounded-lg px-4 py-3 text-white placeholder:text-slate-text/50 focus:outline-none focus:border-electric-cyan focus:ring-1 focus:ring-electric-cyan"
            />
            {authError && (
              <p className="text-red-400 text-sm">{authError}</p>
            )}
            <Button type="submit" variant="cyan" className="w-full">
              Unlock Dashboard
            </Button>
          </form>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto py-8 space-y-8 animate-fade-in">
      <div className="flex items-center gap-3">
        <Shield className="text-electric-cyan w-7 h-7" />
        <h1 className="text-3xl font-black uppercase tracking-tighter text-white">
          Admin{" "}
          <span className="text-electric-cyan text-glow-cyan">Dashboard</span>
        </h1>
      </div>

      {/* QR Code Generator */}
      <Card>
        <h2 className="text-white font-bold text-lg mb-4">
          Generate QR Code
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-slate-text text-sm mb-1">
              Code Type
            </label>
            <select
              value={form.type}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  type: e.target.value as QRCodeConfig["type"],
                }))
              }
              className="w-full bg-navy-bg border border-electric-cyan/30 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-electric-cyan"
            >
              <option value="STANDARD">Standard</option>
              <option value="VIP_EXEC">VIP Executive</option>
              <option value="GOLDEN">Golden</option>
            </select>
          </div>

          <div>
            <label className="block text-slate-text text-sm mb-1">
              Points Value
            </label>
            <input
              type="number"
              min={1}
              max={1000}
              value={form.pointsValue}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  pointsValue: Number(e.target.value),
                }))
              }
              className="w-full bg-navy-bg border border-electric-cyan/30 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-electric-cyan"
            />
          </div>

          <div className="sm:col-span-2">
            <label className="block text-slate-text text-sm mb-1">
              Trivia Question (optional)
            </label>
            <input
              type="text"
              value={form.triviaQuestion}
              onChange={(e) =>
                setForm((f) => ({ ...f, triviaQuestion: e.target.value }))
              }
              placeholder="e.g. What year did Formula 1 begin?"
              className="w-full bg-navy-bg border border-electric-cyan/30 rounded-lg px-4 py-3 text-white placeholder:text-slate-text/50 focus:outline-none focus:border-electric-cyan"
            />
          </div>

          <div className="sm:col-span-2">
            <label className="block text-slate-text text-sm mb-1">
              Trivia Answer (optional)
            </label>
            <input
              type="text"
              value={form.triviaAnswer}
              onChange={(e) =>
                setForm((f) => ({ ...f, triviaAnswer: e.target.value }))
              }
              placeholder="e.g. 1950"
              className="w-full bg-navy-bg border border-electric-cyan/30 rounded-lg px-4 py-3 text-white placeholder:text-slate-text/50 focus:outline-none focus:border-electric-cyan"
            />
          </div>
        </div>

        <Button
          variant="cyan"
          onClick={generateQRCode}
          className="mt-4 gap-2"
        >
          <Plus className="w-4 h-4" /> Create QR Code
        </Button>
      </Card>

      {/* Generated Codes */}
      {qrCodes.length > 0 && (
        <div>
          <h2 className="text-white font-bold text-lg mb-4">
            Generated Codes ({qrCodes.length})
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {qrCodes.map((qr) => (
              <Card key={qr.id} className="space-y-3">
                {/* QR Code SVG */}
                <div className="flex justify-center bg-white rounded-lg p-3">
                  <QRCodeSVG
                    id={`qr-${qr.codeString}`}
                    value={qr.codeString}
                    size={160}
                    level="H"
                    includeMargin
                  />
                </div>

                {/* Metadata */}
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span className="text-slate-text">Type</span>
                    <span
                      className={
                        qr.type === "GOLDEN"
                          ? "text-yellow-400"
                          : qr.type === "VIP_EXEC"
                            ? "text-electric-cyan"
                            : "text-white"
                      }
                    >
                      {qr.type}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-text">Points</span>
                    <span className="text-neon-green font-bold">
                      +{qr.pointsValue}
                    </span>
                  </div>
                  {qr.triviaQuestion && (
                    <p className="text-slate-text text-xs truncate">
                      Q: {qr.triviaQuestion}
                    </p>
                  )}
                </div>

                {/* Actions */}
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={() =>
                      downloadQRCode(
                        qr.codeString,
                        `${qr.type}-${qr.pointsValue}pts`
                      )
                    }
                    className="flex-1 gap-1 text-xs py-2"
                  >
                    <Download className="w-3 h-3" /> Download
                  </Button>
                  <button
                    onClick={() => removeQRCode(qr.id)}
                    className="text-red-400 hover:text-red-300 transition-colors p-2"
                    aria-label="Remove QR code"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
