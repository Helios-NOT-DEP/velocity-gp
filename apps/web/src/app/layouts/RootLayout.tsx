import React from 'react';
import { Outlet } from 'react-router';
import BottomNav from '../components/ui/BottomNav';

export default function RootLayout() {
  return (
    <>
      {/* Reserve bottom padding so page content is not hidden behind fixed mobile nav. */}
      <div className="min-h-screen pb-24">
        <Outlet />
      </div>
      {/* Shared player navigation for race-hub/pit-stop/leaderboard/profile routes. */}
      <BottomNav />
    </>
  );
}
