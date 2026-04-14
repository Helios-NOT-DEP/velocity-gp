import React, { useEffect, useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router';
import { BarChart3, LogOut, QrCode, Settings, User, Users } from 'lucide-react';
import { adminSections } from '../admin/sections';
import {
  AUTH_SESSION_UPDATED_EVENT,
  anonymousSession,
  getSession,
  type AuthSession,
} from '@/services/auth';

function desktopNavClassName(isActive: boolean) {
  if (isActive) {
    return "flex items-center gap-2 px-6 py-4 border-b-2 border-[#00D4FF] text-[#00D4FF] transition-colors whitespace-nowrap font-['DM_Sans']";
  }

  return "flex items-center gap-2 px-6 py-4 border-b-2 border-transparent text-gray-400 hover:text-white transition-colors whitespace-nowrap font-['DM_Sans']";
}

export default function AdminLayout() {
  const navigate = useNavigate();
  const [session, setSession] = useState<AuthSession>(anonymousSession);

  useEffect(() => {
    let active = true;
    const refreshSession = async () => {
      const next = await getSession();
      if (!active) {
        return;
      }
      setSession(next);
    };

    void refreshSession();
    const onSessionUpdated = () => {
      void refreshSession();
    };

    globalThis.addEventListener(AUTH_SESSION_UPDATED_EVENT, onSessionUpdated);
    return () => {
      active = false;
      globalThis.removeEventListener(AUTH_SESSION_UPDATED_EVENT, onSessionUpdated);
    };
  }, []);

  const canSwitchToPlayer =
    session.capabilities?.admin === true && session.capabilities?.player === true;

  // Mobile nav is defined separately from desktop labels to keep short text/icon pairs.
  const mobileNav = [
    { path: '/admin/game-control', label: 'Control', icon: Settings },
    { path: '/admin/qr-codes', label: 'QR', icon: QrCode },
    { path: '/admin/teams', label: 'Teams', icon: Users },
    { path: '/admin/players', label: 'Players', icon: User },
    { path: '/admin/statistics', label: 'Stats', icon: BarChart3 },
  ];

  return (
    <div
      className="min-h-screen bg-black text-white pb-20 md:pb-0"
      style={{ fontFamily: 'var(--font-body)' }}
    >
      <header className="border-b border-gray-800 bg-gradient-to-r from-[#0B1E3B] to-black sticky top-0 z-40">
        <div className="mx-auto max-w-7xl px-4 py-4 md:px-6 md:py-6">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 md:gap-4 min-w-0">
              <Settings className="w-6 h-6 md:w-8 md:h-8 text-[#00D4FF] flex-shrink-0" />
              <div className="min-w-0">
                <h1 className="font-['Space_Grotesk'] text-lg md:text-3xl tracking-tight truncate">
                  ADMIN
                </h1>
                <p className="text-gray-400 text-xs md:text-sm hidden sm:block">
                  Velocity GP Game Management
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <div className="px-2 md:px-4 py-1 md:py-2 rounded-lg font-mono text-xs md:text-sm whitespace-nowrap bg-[#39FF14]/20 text-[#39FF14] border border-[#39FF14]/30">
                ACTIVE
              </div>
              <button
                type="button"
                onClick={() => navigate('/logout')}
                title="Sign out"
                className="flex items-center gap-1.5 rounded-lg border border-gray-700 px-2 md:px-3 py-1 md:py-2 text-xs text-gray-400 hover:border-red-500/60 hover:text-red-400 transition-colors"
              >
                <LogOut className="w-4 h-4" />
                <span className="hidden sm:inline">Sign out</span>
              </button>
            </div>
          </div>
          {canSwitchToPlayer && (
            <div className="mt-3 flex justify-end">
              <button
                onClick={() => navigate('/race')}
                className="rounded-full border border-blue-400/40 bg-[#0B1E3B]/90 px-3 py-1 text-xs font-semibold text-blue-200"
              >
                Switch to Player
              </button>
            </div>
          )}
        </div>
      </header>

      {/* Desktop sticky section tabs mirror admin route children and remain visible while scrolling. */}
      <div className="hidden md:block border-b border-gray-800 bg-black/50 sticky top-[88px] z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <nav className="flex gap-2 overflow-x-auto" aria-label="Admin sections">
            {adminSections.map((section) => (
              <NavLink
                key={section.id}
                to={section.path}
                className={({ isActive }) => desktopNavClassName(isActive)}
              >
                {section.id === 'game-control' && <Settings className="w-5 h-5" />}
                {section.id === 'qr-codes' && <QrCode className="w-5 h-5" />}
                {section.id === 'teams' && <Users className="w-5 h-5" />}
                {section.id === 'players' && <User className="w-5 h-5" />}
                {section.id === 'statistics' && <BarChart3 className="w-5 h-5" />}
                {section.label}
              </NavLink>
            ))}
          </nav>
        </div>
      </div>

      <main className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
        <Outlet />
      </main>

      {/* Mobile admin routes use a fixed bottom nav to match the player shell navigation model. */}
      <nav
        className="md:hidden fixed bottom-0 left-0 right-0 bg-black border-t border-gray-800 z-50"
        aria-label="Admin sections mobile"
      >
        <div className="grid grid-cols-5 gap-0.5 p-1.5">
          {mobileNav.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) => {
                return `flex flex-col items-center gap-0.5 py-2 px-1 rounded-lg transition-colors ${
                  isActive ? 'bg-[#00D4FF]/20 text-[#00D4FF]' : 'text-gray-400 active:bg-gray-800'
                }`;
              }}
            >
              <item.icon className="w-5 h-5" />
              <span className="text-[10px] font-['DM_Sans']">{item.label}</span>
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
}
