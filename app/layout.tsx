import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Velocity Grand Prix",
  description:
    "A gamified GenAI scavenger hunt — build your F1 car and race for points!",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="bg-navy-bg text-white antialiased min-h-screen">
        {/* Global nav bar */}
        <header className="border-b border-electric-cyan/20 bg-navy-surface/80 backdrop-blur-sm sticky top-0 z-50">
          <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between">
            <span className="text-electric-cyan font-bold text-lg tracking-widest uppercase text-glow-cyan">
              ⚡ Velocity GP
            </span>
            <nav className="hidden sm:flex gap-6 text-sm text-slate-text">
              <a
                href="/"
                className="hover:text-electric-cyan transition-colors"
              >
                Lobby
              </a>
              <a
                href="/race"
                className="hover:text-electric-cyan transition-colors"
              >
                Race
              </a>
              <a
                href="/leaderboard"
                className="hover:text-electric-cyan transition-colors"
              >
                Leaderboard
              </a>
              <a
                href="/admin"
                className="hover:text-electric-cyan transition-colors"
              >
                Admin
              </a>
            </nav>
          </div>
        </header>

        <main className="max-w-7xl mx-auto px-4 py-6">{children}</main>

        <footer className="border-t border-electric-cyan/10 mt-10 py-4 text-center text-slate-text text-xs">
          Velocity Grand Prix &copy; {new Date().getFullYear()} · GM Insurance
          Event
        </footer>
      </body>
    </html>
  );
}
