export type SeedDatabaseUrlSource =
  | 'SEED_DATABASE_URL'
  | 'DIRECT_DATABASE_URL'
  | 'POSTGRES_URL_NON_POOLING'
  | 'POSTGRES_URL'
  | 'POSTGRES_PRISMA_URL'
  | 'DATABASE_URL';

export interface ResolvedSeedDatabaseUrl {
  readonly source: SeedDatabaseUrlSource;
  readonly url: string;
}

const adapterSupportedProtocols = new Set<string>(['postgresql:', 'postgres:']);
const accelerateProtocol = 'prisma+postgres:';

const orderedSeedUrlSources: readonly SeedDatabaseUrlSource[] = [
  'SEED_DATABASE_URL',
  'DIRECT_DATABASE_URL',
  'POSTGRES_URL_NON_POOLING',
  'POSTGRES_URL',
  'POSTGRES_PRISMA_URL',
  'DATABASE_URL',
] as const;

function getProtocol(urlValue: string): string {
  try {
    return new URL(urlValue).protocol;
  } catch {
    return 'invalid:';
  }
}

export function resolveSeedDatabaseUrl(
  input: Partial<Record<SeedDatabaseUrlSource, string | undefined>> = process.env
): ResolvedSeedDatabaseUrl {
  const normalizedEntries = orderedSeedUrlSources
    .map((source) => ({
      source,
      url: input[source]?.trim() ?? '',
    }))
    .filter((entry) => entry.url.length > 0);

  if (normalizedEntries.length === 0) {
    throw new Error(
      'No database URL found for seeding. Set one of SEED_DATABASE_URL, DIRECT_DATABASE_URL, POSTGRES_URL_NON_POOLING, POSTGRES_URL, POSTGRES_PRISMA_URL, or DATABASE_URL.'
    );
  }

  const directEntry = normalizedEntries.find((entry) =>
    adapterSupportedProtocols.has(getProtocol(entry.url))
  );

  if (directEntry) {
    return {
      source: directEntry.source,
      url: directEntry.url,
    };
  }

  const accelerateEntry = normalizedEntries.find(
    (entry) => getProtocol(entry.url) === accelerateProtocol
  );

  if (accelerateEntry) {
    throw new Error(
      'Prisma seeding with @prisma/adapter-pg requires a direct Postgres URL (postgresql:// or postgres://). DATABASE_URL currently uses prisma+postgres://. Set SEED_DATABASE_URL or DIRECT_DATABASE_URL to a direct Postgres connection string for seeding.'
    );
  }

  const firstUnsupportedEntry = normalizedEntries[0];
  throw new Error(
    `Unsupported database URL protocol in ${firstUnsupportedEntry.source}. Expected postgresql:// or postgres:// for adapter-based seeding.`
  );
}
