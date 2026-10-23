import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';

// Vitest runs with the repository root as its working directory (see vitest.config.ts),
// so the migration can be read from the filesystem even under the jsdom environment.
const MIGRATION_PATH = path.resolve(
  process.cwd(),
  'pb_migrations/1817000000_widen_organization_user_objects.js',
);

const COLLECTION_NAME = 'organization_users';
const FIELD_NAME = 'objects';
const FIELD_ID = 'relation2988100851';

interface MigrationField {
  id: string;
  name: string;
  maxSelect: number;
}

interface MigrationCollection {
  fields: {
    getByName: (name: string) => MigrationField | null;
  };
}

interface MigrationApp {
  findCollectionByNameOrId: (nameOrId: string) => MigrationCollection;
  save: (collection: MigrationCollection) => void;
}

type MigrationFn = (app: MigrationApp) => unknown;

/**
 * Executes the migration file with a fake `migrate` global and returns the
 * callbacks it registered. This runs the real migration code, not a copy.
 */
function loadMigration(): { up: MigrationFn; down: MigrationFn } {
  const source = readFileSync(MIGRATION_PATH, 'utf8');
  const callbacks: MigrationFn[] = [];

  const migrate = (up: MigrationFn, down: MigrationFn) => {
    callbacks.push(up, down);
  };

  new Function('migrate', source)(migrate);

  const [up, down] = callbacks;
  if (!up || !down) {
    throw new Error('Migration must register both an up and a down callback');
  }

  return { up, down };
}

function createApp({ withField = true }: { withField?: boolean } = {}) {
  const field: MigrationField = { id: FIELD_ID, name: FIELD_NAME, maxSelect: 10 };
  const collection: MigrationCollection = {
    fields: {
      getByName: vi.fn((name: string) => (withField && name === FIELD_NAME ? field : null)),
    },
  };
  const save = vi.fn();
  const app: MigrationApp = {
    findCollectionByNameOrId: vi.fn(() => collection),
    save,
  };

  return { app, collection, field, save };
}

describe('organization_users.objects maxSelect migration', () => {
  it('raises maxSelect to 100 on up and saves the collection', () => {
    const { up } = loadMigration();
    const { app, collection, field, save } = createApp();

    up(app);

    expect(field.maxSelect).toBe(100);
    expect(save).toHaveBeenCalledWith(collection);
  });

  it('keeps the original field id so existing selections stay attached', () => {
    const { up } = loadMigration();
    const { app, field } = createApp();

    up(app);

    expect(field.id).toBe(FIELD_ID);
  });

  it('targets the organization_users collection by name', () => {
    const { up } = loadMigration();
    const { app } = createApp();

    up(app);

    expect(app.findCollectionByNameOrId).toHaveBeenCalledWith(COLLECTION_NAME);
  });

  it('restores maxSelect 10 on down', () => {
    const { down } = loadMigration();
    const { app, collection, field, save } = createApp();
    field.maxSelect = 100;

    down(app);

    expect(field.maxSelect).toBe(10);
    expect(save).toHaveBeenCalledWith(collection);
  });

  it('allows multi-select values (maxSelect must stay greater than 1)', () => {
    const { up } = loadMigration();
    const { app, field } = createApp();

    up(app);

    expect(field.maxSelect).toBeGreaterThan(1);
  });

  it('fails loudly when the objects field is missing', () => {
    const { up } = loadMigration();
    const { app } = createApp({ withField: false });

    expect(() => up(app)).toThrow(/objects/);
  });
});
