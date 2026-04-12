import { useEffect, useState } from 'react';

/**
 * Transitional auth hook retained for legacy component compatibility.
 *
 * New route guards and session flows should prefer `services/auth` helpers.
 */
export function useAuth() {
  const [user, setUser] = useState(null);

  useEffect(() => {
    // Placeholder hydration path; intentionally no-op until Auth.js provider lands.
    setUser(null);
  }, []);

  return { user, setUser };
}
