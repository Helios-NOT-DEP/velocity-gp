export type QrPayloadClassification =
  | {
      readonly kind: 'gameplay';
      readonly payload: string;
    }
  | {
      readonly kind: 'trusted_url';
      readonly payload: string;
      readonly url: string;
    }
  | {
      readonly kind: 'untrusted_url';
      readonly payload: string;
      readonly url: string | null;
      readonly reason:
        | 'invalid_url'
        | 'unsupported_protocol'
        | 'missing_trusted_origin'
        | 'origin_mismatch';
      readonly message: string;
    };

function isUrlLikePayload(payload: string): boolean {
  return /^(?:[a-z][a-z\d+.-]*:|\/\/)/i.test(payload);
}

function normalizeOrigin(origin: string | null | undefined): string | null {
  if (!origin) {
    return null;
  }

  try {
    return new URL(origin).origin;
  } catch {
    return null;
  }
}

export function getTrustedQrRedirectOrigin(): string | null {
  return normalizeOrigin(import.meta.env.VITE_FRONTEND_MAGIC_LINK_ORIGIN);
}

export function classifyQrPayload(
  rawPayload: string,
  trustedOrigin: string | null | undefined
): QrPayloadClassification {
  const payload = rawPayload.trim();
  const normalizedTrustedOrigin = normalizeOrigin(trustedOrigin);

  if (!isUrlLikePayload(payload)) {
    return {
      kind: 'gameplay',
      payload,
    };
  }

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(payload);
  } catch {
    return {
      kind: 'untrusted_url',
      payload,
      url: null,
      reason: 'invalid_url',
      message: 'Scanned QR code looks like a link, but the URL is malformed.',
    };
  }

  if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
    return {
      kind: 'untrusted_url',
      payload,
      url: parsedUrl.toString(),
      reason: 'unsupported_protocol',
      message: 'Only HTTP and HTTPS QR links can be opened from Race Hub.',
    };
  }

  if (!normalizedTrustedOrigin) {
    return {
      kind: 'untrusted_url',
      payload,
      url: parsedUrl.toString(),
      reason: 'missing_trusted_origin',
      message:
        'QR link redirects are unavailable because the trusted app domain is not configured.',
    };
  }

  if (parsedUrl.origin !== normalizedTrustedOrigin) {
    return {
      kind: 'untrusted_url',
      payload,
      url: parsedUrl.toString(),
      reason: 'origin_mismatch',
      message: `Only QR links from ${normalizedTrustedOrigin} can redirect from Race Hub.`,
    };
  }

  return {
    kind: 'trusted_url',
    payload,
    url: parsedUrl.toString(),
  };
}

export function redirectToTrustedQrUrl(url: string): void {
  globalThis.location.assign(url);
}
