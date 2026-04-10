export const AUTH_SESSION_COOKIE_NAME = 'velocitygp_session';

/**
 * Extracts bearer token value from an Authorization header.
 */
function parseBearerToken(authorizationHeaderValue: string | undefined): string | null {
  if (!authorizationHeaderValue) {
    return null;
  }

  const [scheme, token] = authorizationHeaderValue.trim().split(/\s+/);
  if (!scheme || !token || scheme.toLowerCase() !== 'bearer') {
    return null;
  }

  return token;
}

/**
 * Parses a cookie value from the Cookie request header.
 */
function parseCookieValue(cookieHeaderValue: string | undefined, name: string): string | null {
  if (!cookieHeaderValue) {
    return null;
  }

  const cookiePairs = cookieHeaderValue.split(';');
  for (const cookiePair of cookiePairs) {
    const [cookieName, ...cookieValueParts] = cookiePair.split('=');
    if (!cookieName || cookieValueParts.length === 0) {
      continue;
    }

    if (cookieName.trim() !== name) {
      continue;
    }

    try {
      return decodeURIComponent(cookieValueParts.join('=').trim());
    } catch {
      return cookieValueParts.join('=').trim();
    }
  }

  return null;
}

/**
 * Resolves session token from Authorization header first, then auth cookie.
 */
export function resolveSessionToken(
  authorizationHeaderValue: string | undefined,
  cookieHeaderValue: string | undefined
): string | null {
  return (
    parseBearerToken(authorizationHeaderValue) ??
    parseCookieValue(cookieHeaderValue, AUTH_SESSION_COOKIE_NAME)
  );
}
