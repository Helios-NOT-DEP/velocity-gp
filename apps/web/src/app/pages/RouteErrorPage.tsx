import React from 'react';
import { AlertTriangle, Home, RotateCcw } from 'lucide-react';
import { isRouteErrorResponse, Link, useNavigate, useRouteError } from 'react-router';

type ErrorDetails = {
  statusCode: number;
  title: string;
  message: string;
};

function toErrorDetails(routeError: unknown): ErrorDetails {
  if (isRouteErrorResponse(routeError)) {
    const fallbackMessage =
      routeError.status === 404
        ? 'The route you requested does not exist in this race build.'
        : 'An unexpected route error occurred while loading this screen.';

    return {
      statusCode: routeError.status,
      title: routeError.statusText || 'Route Error',
      message:
        typeof routeError.data === 'string' && routeError.data.trim().length > 0
          ? routeError.data
          : fallbackMessage,
    };
  }

  if (routeError instanceof Error) {
    return {
      statusCode: 500,
      title: 'Application Error',
      message: routeError.message || 'An unexpected application error occurred.',
    };
  }

  return {
    statusCode: 500,
    title: 'Unexpected Error',
    message: 'An unknown error occurred. Please try again.',
  };
}

type RouteErrorPageProps = {
  statusCode?: number;
  title?: string;
  message?: string;
};

function RouteErrorSurface({ statusCode, title, message }: RouteErrorPageProps) {
  const navigate = useNavigate();

  return (
    <main
      className="relative min-h-screen overflow-hidden bg-[#040A16] px-6 py-10 text-white"
      style={{ fontFamily: 'var(--font-body)' }}
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(59,130,246,0.22),transparent_55%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_bottom,rgba(249,115,22,0.15),transparent_45%)]" />

      <section className="relative mx-auto flex min-h-[80vh] w-full max-w-xl items-center justify-center">
        <article className="w-full rounded-3xl border border-blue-400/25 bg-[#0B1E3B]/80 p-8 shadow-[0_0_48px_rgba(59,130,246,0.18)] backdrop-blur-sm">
          <div className="mb-4 inline-flex h-14 w-14 items-center justify-center rounded-xl border border-orange-400/40 bg-orange-500/15 text-orange-300">
            <AlertTriangle className="h-7 w-7" />
          </div>

          <p className="mb-2 text-xs uppercase tracking-[0.22em] text-blue-200/80">
            Velocity GP Error
          </p>
          <h1 className="mb-2 text-3xl font-semibold" style={{ fontFamily: 'var(--font-heading)' }}>
            {statusCode} · {title}
          </h1>
          <p className="mb-8 text-sm leading-6 text-blue-100/85">{message}</p>

          <div className="flex flex-wrap gap-3">
            <Link
              to="/"
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#3B82F6] to-[#F97316] px-4 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90"
            >
              <Home className="h-4 w-4" />
              Back to Login
            </Link>

            <button
              type="button"
              onClick={() => navigate(-1)}
              className="inline-flex items-center gap-2 rounded-xl border border-blue-300/30 bg-[#040A16]/70 px-4 py-2.5 text-sm font-semibold text-blue-100 transition-colors hover:border-blue-200/50 hover:text-white"
            >
              <RotateCcw className="h-4 w-4" />
              Go Back
            </button>
          </div>
        </article>
      </section>
    </main>
  );
}

export default function RouteErrorPage() {
  const routeError = useRouteError();
  const details = toErrorDetails(routeError);

  return <RouteErrorSurface {...details} />;
}

export function NotFoundRoutePage() {
  return (
    <RouteErrorSurface
      statusCode={404}
      title="Track Not Found"
      message="This route is off the race map. Check the URL or head back to the garage entrypoint."
    />
  );
}
