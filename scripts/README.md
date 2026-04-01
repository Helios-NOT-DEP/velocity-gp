# Scripts

Automation scripts for development and deployment.

## Available Scripts

### `seed.ts`
Populate development database with initial data.

```bash
npx ts-node scripts/seed.ts
```

Creates:
- Sample event (Velocity GP 2026)
- Sample teams and players
- Hazards and races for testing

### `generate-types.ts`
Regenerate TypeScript types from Prisma schema.

```bash
npx ts-node scripts/generate-types.ts
```

Also runs automatically when Prisma schema changes.
