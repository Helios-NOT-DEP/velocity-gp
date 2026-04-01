/**
 * Tiny API client wrapper to centralize fetch logic.
 */
export async function apiClient(path: string, opts: RequestInit = {}): Promise<any> {
  const base = import.meta.env.VITE_API_BASE ?? '';
  const res = await fetch(base + path, opts);
  if (!res.ok) throw new Error(`API ${res.status}: ${await res.text()}`);
  return res.json();
}
