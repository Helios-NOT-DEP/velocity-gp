import type { SubmitScanResponse } from '@velocity-gp/api-contract';

import type { ScanUiAction } from './types';

function successAction(message: string): ScanUiAction {
  return {
    feedback: {
      level: 'success',
      title: 'Scan Registered',
      message,
    },
    navigateTo: null,
    shouldResumeScanner: true,
  };
}

function warningAction(message: string, shouldResumeScanner: boolean = true): ScanUiAction {
  return {
    feedback: {
      level: 'warning',
      title: 'Scan Notice',
      message,
    },
    navigateTo: null,
    shouldResumeScanner,
  };
}

function errorAction(message: string): ScanUiAction {
  return {
    feedback: {
      level: 'error',
      title: 'Scan Blocked',
      message,
      canRetry: true,
      showGuidance: true,
    },
    navigateTo: null,
    shouldResumeScanner: false,
  };
}

export function mapScanResponseToUiAction(response: SubmitScanResponse): ScanUiAction {
  if (response.outcome === 'SAFE') {
    return successAction(`+${response.pointsAwarded} points added to your team.`);
  }

  if (response.outcome === 'HAZARD_PIT') {
    return {
      feedback: {
        level: 'warning',
        title: 'Hazard Hit',
        message: 'Your team entered pit-stop lockout. Head to Pit Stop for status updates.',
      },
      navigateTo: '/pit-stop',
      shouldResumeScanner: false,
    };
  }

  if (response.outcome === 'DUPLICATE') {
    return warningAction('This QR code was already claimed by your player profile.');
  }

  if (response.outcome === 'INVALID') {
    return warningAction('Invalid QR code. Try scanning an official Velocity GP marker.');
  }

  if (response.errorCode === 'TEAM_IN_PIT') {
    return {
      feedback: {
        level: 'warning',
        title: 'Team In Pit Stop',
        message: 'Scanner is locked while your team is in pit stop.',
      },
      navigateTo: '/pit-stop',
      shouldResumeScanner: false,
    };
  }

  if (response.errorCode === 'QR_DISABLED') {
    return errorAction('This QR code is disabled by race control.');
  }

  if (response.errorCode === 'RACE_PAUSED') {
    return errorAction('Race control is currently paused. Please try again once resumed.');
  }

  return errorAction('Scan request could not be processed. Please retry.');
}
