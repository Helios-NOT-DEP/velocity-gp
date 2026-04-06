import React from 'react';
import { ShieldOff } from 'lucide-react';

export default function ForbiddenAdminAccess() {
  return (
    <main
      className="min-h-screen bg-[#040A16] text-white flex items-center justify-center p-6"
      style={{ fontFamily: 'var(--font-body)' }}
    >
      <section className="w-full max-w-lg rounded-2xl border border-red-500/40 bg-red-950/25 p-8 shadow-[0_0_40px_rgba(239,68,68,0.2)]">
        <div className="mb-4 inline-flex h-14 w-14 items-center justify-center rounded-xl bg-red-500/20 text-red-300">
          <ShieldOff className="h-8 w-8" />
        </div>
        <h1 className="text-3xl font-semibold mb-2" style={{ fontFamily: 'var(--font-heading)' }}>
          Admin Access Required
        </h1>
        <p className="text-red-100/80">
          Your account is authenticated but does not have organizer access for the Admin Portal.
        </p>
      </section>
    </main>
  );
}
