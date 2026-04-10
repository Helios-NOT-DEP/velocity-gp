import React from 'react';

interface Props {
  title: string;
  description: string;
  issueLinks: string[];
}

export default function AdminSectionPlaceholder({ title, description, issueLinks }: Props) {
  return (
    <section className="space-y-6">
      <div className="rounded-2xl border border-white/12 bg-gradient-to-br from-[#0B1E3B] to-[#081326] p-6 shadow-[0_20px_40px_rgba(0,0,0,0.3)]">
        <p className="text-xs uppercase tracking-[0.18em] text-cyan-300/80">Admin Section</p>
        <h2 className="mt-2 text-3xl font-semibold" style={{ fontFamily: 'var(--font-heading)' }}>
          {title}
        </h2>
        <p className="mt-4 max-w-3xl text-slate-200/85">{description}</p>
      </div>

      {/* Shared scaffold used for admin tabs that are intentionally staged for later work. */}
      <article className="rounded-2xl border border-dashed border-cyan-300/35 bg-cyan-500/5 p-5">
        <h3 className="text-lg font-medium text-cyan-100">Implementation Placeholder</h3>
        <p className="mt-2 text-slate-200/85">
          This route is part of the Admin shell foundation in issue #51 and is intentionally
          scaffolded for follow-up work.
        </p>
        <p className="mt-3 text-slate-200/85">
          Downstream backlog ownership: {issueLinks.join(', ')}.
        </p>
      </article>
    </section>
  );
}
