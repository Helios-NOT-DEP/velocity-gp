import { Link } from 'react-router';

export default function WaitingAssignment() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-black px-6">
      <div className="w-full max-w-md rounded-2xl border border-yellow-700/60 bg-yellow-900/20 p-8 text-center">
        <h1 className="text-2xl font-bold text-yellow-200 mb-3">Team Assignment Pending</h1>
        <p className="text-yellow-100/90 mb-6">
          Your account is recognized, but you are not currently assigned to a team for this event.
          Please contact an organizer.
        </p>
        <Link
          to="/"
          className="inline-block rounded-lg bg-yellow-500 px-4 py-2 text-sm font-semibold text-black hover:bg-yellow-400"
        >
          Back to Login
        </Link>
      </div>
    </div>
  );
}
