import { useState, useEffect } from 'react';

/**
 * Minimal example hook. Replace with real auth logic later.
 */
export function useAuth() {
  const [user, setUser] = useState(null);
  useEffect(() => {
    // placeholder: load from auth provider / localStorage
    setUser(null);
  }, []);
  return { user, setUser };
}
