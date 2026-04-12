import type { SubmitScanResponse } from '@velocity-gp/api-contract';

export type ScannerState =
  | 'idle'
  | 'requesting_permission'
  | 'ready'
  | 'decoding'
  | 'submitting'
  | 'permission_denied'
  | 'unsupported'
  | 'error';

export type ScanFeedbackLevel = 'info' | 'success' | 'warning' | 'error';

export interface ScanFeedback {
  readonly level: ScanFeedbackLevel;
  readonly title: string;
  readonly message: string;
  readonly canRetry?: boolean;
  readonly showGuidance?: boolean;
}

export interface ScanUiAction {
  readonly feedback: ScanFeedback;
  // Navigation side effects are explicit so scanner page can centralize route transitions.
  readonly navigateTo: '/pit-stop' | null;
  readonly shouldResumeScanner: boolean;
}

export interface ScanIdentity {
  readonly eventId: string;
  readonly playerId: string;
  readonly teamId: string;
  readonly teamName: string;
  readonly email: string;
}

export type ScanIdentityResolution =
  | {
      readonly status: 'resolved';
      readonly identity: ScanIdentity;
    }
  | {
      readonly status: 'unmapped';
      readonly message: string;
    }
  | {
      readonly status: 'event_mismatch';
      readonly message: string;
      readonly expectedEventId: string;
      readonly currentEventId: string;
    }
  | {
      readonly status: 'event_unavailable';
      readonly message: string;
    };

export interface ScanSubmissionResult {
  readonly response: SubmitScanResponse;
  readonly scannedPayload: string;
}
