import React from 'react';
import { Outlet } from 'react-router';
import BottomNav from '../components/ui/BottomNav';

export default function RootLayout() {
  return (
    <>
      <div className="min-h-screen pb-24">
        <Outlet />
      </div>
      <BottomNav />
    </>
  );
}