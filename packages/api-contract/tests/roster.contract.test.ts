import { describe, expect, it } from 'vitest';
import { adminEndpoints } from '../src/endpoints.js';
import {
  adminRosterListQuerySchema,
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
      teamId: 'team-1',
      limit: '25',
      cursor: 'cursor-1',
    });

    expect(valid.success).toBe(true);
    if (!valid.success) {
      throw new Error('Expected query schema to parse valid filters.');
    }

    expect(valid.data.limit).toBe(25);

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
          phoneE164: '555-123-4567',
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
  });
});
