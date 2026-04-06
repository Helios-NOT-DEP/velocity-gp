export interface AdminSection {
  id: 'game-control' | 'qr-codes' | 'teams' | 'players' | 'statistics';
  label: string;
  path: string;
  description: string;
  issueLinks: string[];
}

export const adminSections: AdminSection[] = [
  {
    id: 'game-control',
    label: 'Game Control',
    path: '/admin/game-control',
    description:
      'Global race operations, pause/resume workflows, and organizer controls for live event orchestration.',
    issueLinks: ['#25', '#26'],
  },
  {
    id: 'qr-codes',
    label: 'QR Codes',
    path: '/admin/qr-codes',
    description:
      'QR inventory lifecycle including creation, activation windows, and operator download workflows.',
    issueLinks: ['#23'],
  },
  {
    id: 'teams',
    label: 'Teams',
    path: '/admin/teams',
    description:
      'Team ranking visibility, penalties, and intervention tools for race administrators.',
    issueLinks: ['#51'],
  },
  {
    id: 'players',
    label: 'Players',
    path: '/admin/players',
    description:
      'Player directory controls for profile review, contact updates, and score audit context.',
    issueLinks: ['#51'],
  },
  {
    id: 'statistics',
    label: 'Statistics',
    path: '/admin/statistics',
    description: 'Event totals and race summary analytics aligned to admin-facing reporting needs.',
    issueLinks: ['#35'],
  },
];

export const adminDefaultSection = adminSections[0];
