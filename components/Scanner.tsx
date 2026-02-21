"use client";

import { useEffect, useRef, useState } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { Camera, AlertCircle } from "lucide-react";

interface ScannerProps {
  onScan: (data: string) => void;
}

export default function Scanner({ onScan }: ScannerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [started, setStarted] = useState(false);

  useEffect(() => {
    const elementId = "qr-reader";

    async function startScanner() {
      try {
        // TODO: For a Supabase-backed scan, you may want to call onScan
        //       only after server-side validation in /api/scan
        const scanner = new Html5Qrcode(elementId);
        scannerRef.current = scanner;

        await scanner.start(
          { facingMode: "environment" },
          {
            fps: 10,
            qrbox: { width: 250, height: 250 },
          },
          (decodedText) => {
            onScan(decodedText);
            // Stop after first successful scan
            scanner.stop().catch(() => {});
          },
          () => {
            // Scan failure callbacks are expected — ignore
          }
        );
        setStarted(true);
      } catch (err) {
        const msg =
          err instanceof Error ? err.message : "Camera access denied.";
        setError(msg);
      }
    }

    startScanner();

    return () => {
      if (scannerRef.current) {
        scannerRef.current.stop().catch(() => {});
        scannerRef.current = null;
      }
    };
  }, [onScan]);

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 bg-navy-surface rounded-xl border border-red-500/40 p-8 text-center">
        <AlertCircle className="text-red-400 w-8 h-8" />
        <p className="text-red-400 font-semibold">Camera Error</p>
        <p className="text-slate-text text-sm">{error}</p>
        <p className="text-slate-text text-xs">
          Please allow camera access and try again.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {!started && (
        <div className="flex items-center justify-center gap-2 text-electric-cyan text-sm animate-pulse">
          <Camera className="w-4 h-4" />
          <span>Starting camera…</span>
        </div>
      )}
      {/* html5-qrcode mounts its own UI into this div */}
      <div
        id="qr-reader"
        ref={containerRef}
        className="w-full rounded-xl overflow-hidden border border-electric-cyan/30"
      />
    </div>
  );
}
