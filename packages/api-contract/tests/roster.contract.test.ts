import { describe, expect, it } from 'vitest';
import { adminEndpoints } from '../src/endpoints.js';
import {
  adminRosterListQuerySchema,
  resolveAdminPlayerReviewFlagSchema,
  rosterImportApplySchema,
  rosterImportPreviewSchema,
  updateRosterAssignmentSchema,
} from '../src/schemas/rosterSchemas.js';

describe('roster contract', () => {
  it('builds admin roster endpoint paths', () => {
    expect(adminEndpoints.listRoster('event-1')).toBe('/admin/events/event-1/roster');
    expect(adminEndpoints.listRosterTeams('event-1')).toBe('/admin/events/event-1/roster/teams');
    expect(adminEndpoints.updateRosterAssignment('event-1', 'player-1')).toBe(
      '/admin/events/event-1/roster/players/player-1/assignment'
    );
    expect(adminEndpoints.resolvePlayerReviewFlag('event-1', 'player-1')).toBe(
      '/admin/events/event-1/players/player-1/review-flag'
    );
    expect(adminEndpoints.previewRosterImport('event-1')).toBe(
      '/admin/events/event-1/roster/import/preview'
    );
    expect(adminEndpoints.applyRosterImport('event-1')).toBe(
      '/admin/events/event-1/roster/import/apply'
    );
  });

  it('validates roster list query filters', () => {
    const valid = adminRosterListQuerySchema.safeParse({
      q: 'lina',
      assignmentStatus: 'UNASSIGNED',
      isFlaggedForReview: 'true',
      teamId: 'team-1',
      limit: '25',
      cursor: 'cursor-1',
    });

    expect(valid.success).toBe(true);
    if (!valid.success) {
      throw new Error('Expected query schema to parse valid filters.');
    }

    expect(valid.data.limit).toBe(25);
    expect(valid.data.isFlaggedForReview).toBe(true);

    const invalidAssignment = adminRosterListQuerySchema.safeParse({
      assignmentStatus: 'UNKNOWN',
    });

    expect(invalidAssignment.success).toBe(false);
  });

  it('validates import preview/apply payloads and assignment updates', () => {
    const previewValid = rosterImportPreviewSchema.safeParse({
      rows: [
        {
          workEmail: 'player@velocitygp.dev',
          displayName: 'Player One',
          phoneE164: '+15551234567',
          teamName: 'Apex',
        },
      ],
    });

    expect(previewValid.success).toBe(true);

    const previewInvalid = rosterImportPreviewSchema.safeParse({
      rows: [
        {
          workEmail: 'player@velocitygp.dev',
          displayName: 'Player One',
          phoneE164: '+15551234567',
          teamName: 'Apex',
        },
      ],
    });

    expect(previewInvalid.success).toBe(true);

    const applyValid = rosterImportApplySchema.safeParse({
      rows: [
        {
          workEmail: 'two@velocitygp.dev',
          displayName: 'Player Two',
          phoneE164: '+15551234568',
          teamName: 'Apex',
        },
      ],
    });

    expect(applyValid.success).toBe(true);

    const assignmentValid = updateRosterAssignmentSchema.safeParse({
      teamId: null,
      reason: 'Manual override',
    });
    expect(assignmentValid.success).toBe(true);

    const assignmentInvalid = updateRosterAssignmentSchema.safeParse({
      reason: 'x',
    });
    expect(assignmentInvalid.success).toBe(false);

    const resolveValid = resolveAdminPlayerReviewFlagSchema.safeParse({
      decision: 'APPROVED',
      reason: 'Reviewed scan history and confirmed accidental scan.',
    });
    expect(resolveValid.success).toBe(true);

    const resolveInvalid = resolveAdminPlayerReviewFlagSchema.safeParse({
      decision: 'INVALID_DECISION',
      reason: 'x',
    });
    expect(resolveInvalid.success).toBe(false);
  });
});
