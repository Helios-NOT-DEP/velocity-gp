import type { Scan, Team } from '../context/GameContext';
import { isAdminQrCodeActiveNow } from './adminQrCodeData';
import type { AdminQrCode } from './adminViewData';
import { toSortedTeams } from './adminViewData';

export interface AdminStatisticsSnapshot {
  readonly teams: readonly Team[];
  readonly scans: readonly Scan[];
  readonly qrCodes: readonly AdminQrCode[];
  readonly now?: Date;
}

export interface AdminStatisticsTotals {
  readonly totalTeams: number;
  readonly totalPoints: number;
  readonly totalScans: number;
  readonly activePenalties: number;
}

export interface ActiveQrRow {
  readonly id: string;
  readonly name: string;
  readonly points: number;
  readonly scanCount: number;
}

export interface AdminStatisticsStateFlags {
  readonly hasNoTeams: boolean;
  readonly hasNoScans: boolean;
  readonly hasNoActiveQrCodes: boolean;
  readonly hasPartialTopTeams: boolean;
}

export interface AdminStatisticsViewModel {
  readonly totals: AdminStatisticsTotals;
  readonly topTeams: Team[];
  readonly activeQrCodes: ActiveQrRow[];
  readonly flags: AdminStatisticsStateFlags;
}

export function deriveAdminStatisticsViewModel(
  snapshot: AdminStatisticsSnapshot
): AdminStatisticsViewModel {
  const totals: AdminStatisticsTotals = {
    totalTeams: snapshot.teams.length,
    totalPoints: snapshot.teams.reduce((sum, team) => sum + team.score, 0),
    totalScans: snapshot.scans.length,
    activePenalties: snapshot.teams.filter((team) => team.inPitStop).length,
  };

  const topTeams = toSortedTeams([...snapshot.teams]).slice(0, 3);

  const now = snapshot.now ?? new Date();
  const activeQrCodes = snapshot.qrCodes
    .filter((qrCode) => isAdminQrCodeActiveNow(qrCode, now))
    .map((qrCode) => ({
      id: qrCode.id,
      name: qrCode.name,
      points: qrCode.points,
      scanCount: qrCode.scanCount,
    }));

  return {
    totals,
    topTeams,
    activeQrCodes,
    flags: {
      hasNoTeams: totals.totalTeams === 0,
      hasNoScans: totals.totalScans === 0,
      hasNoActiveQrCodes: activeQrCodes.length === 0,
      hasPartialTopTeams: topTeams.length > 0 && topTeams.length < 3,
    },
  };
}
