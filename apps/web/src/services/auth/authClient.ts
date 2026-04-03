import { apiClient } from '../api';

export interface AuthCredentials {
  email: string;
  callbackUrl?: string;
}

export interface AuthPlayerContext {
  playerId: string | null;
  eventId: string | null;
  teamId: string | null;
  hasTeam: boolean;
}

export interface AuthUser {
  id: string;
  email: string;
  name: string | null;
  image: string | null;
  player: AuthPlayerContext;
}

export interface AuthSession {
  isAuthenticated: boolean;
  expires: string | null;
  user: AuthUser | null;
}

interface CsrfResponse {
  csrfToken: string;
}

interface RedirectResponse {
  url?: string;
}

const authBaseUrl = import.meta.env.VITE_AUTH_URL || 'http://localhost:4000';

function getDefaultCallbackUrl(): string {
  if (import.meta.env.VITE_AUTH_CALLBACK_URL) {
    return import.meta.env.VITE_AUTH_CALLBACK_URL;
  }

  if (typeof window !== 'undefined') {
    return `${window.location.origin}/garage`;
  }

  return 'http://localhost:5173/garage';
}

async function getCsrfToken(): Promise<string> {
  const response = await fetch(new URL('/auth/csrf', authBaseUrl), {
    credentials: 'include',
  });

  if (!response.ok) {
    throw new Error('Unable to initialize authentication.');
  }

  const payload = (await response.json()) as CsrfResponse;

  if (!payload.csrfToken) {
    throw new Error('Authentication CSRF token was not returned.');
  }

  return payload.csrfToken;
}

async function postAuthAction(path: string, body: URLSearchParams): Promise<RedirectResponse> {
  const response = await fetch(new URL(path, authBaseUrl), {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'X-Auth-Return-Redirect': '1',
    },
    body,
  });

  if (!response.ok) {
    throw new Error('Authentication request failed.');
  }

  return (await response.json()) as RedirectResponse;
}

export async function signIn(credentials: AuthCredentials): Promise<void> {
  const csrfToken = await getCsrfToken();
  const body = new URLSearchParams({
    csrfToken,
    email: credentials.email,
    callbackUrl: credentials.callbackUrl || getDefaultCallbackUrl(),
  });

  await postAuthAction('/auth/signin/sendgrid', body);
}

export async function signOut(callbackUrl?: string): Promise<void> {
  const csrfToken = await getCsrfToken();
  const body = new URLSearchParams({
    csrfToken,
    callbackUrl:
      callbackUrl || (typeof window !== 'undefined' ? window.location.origin : 'http://localhost:5173'),
  });

  await postAuthAction('/auth/signout', body);
}

export async function getSession(): Promise<AuthSession | null> {
  const response = await apiClient.get<AuthSession>('/auth/session');

  if (!response.ok) {
    return null;
  }

  return response.data;
}

export async function sendVerificationEmail(email: string): Promise<void> {
  await signIn({ email });
}
