import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

const DEFAULT_DATA = Object.freeze({
  guilds: {}
});

const STATE_KEY = 'state';

export function createSqliteStore(databasePath, options = {}) {
  const {
    initialData = DEFAULT_DATA,
    migrateFromJsonPath = null
  } = options;

  let database = null;
  let queue = Promise.resolve();

  function initialize() {
    if (database) return database;

    if (databasePath !== ':memory:') {
      mkdirSync(dirname(databasePath), { recursive: true });
    }

    database = new DatabaseSync(databasePath);
    database.exec(`
      CREATE TABLE IF NOT EXISTS bot_state (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at INTEGER NOT NULL
      )
    `);

    migrateJsonDataIfNeeded();
    return database;
  }

  function migrateJsonDataIfNeeded() {
    if (!migrateFromJsonPath || !existsSync(migrateFromJsonPath)) return;
    if (loadRawState()) return;

    const migrated = JSON.parse(readFileSync(migrateFromJsonPath, 'utf8'));
    saveRawState(migrated);
  }

  function loadRawState() {
    return database
      .prepare('SELECT value FROM bot_state WHERE key = ?')
      .get(STATE_KEY)?.value;
  }

  function saveRawState(data) {
    database
      .prepare(`
        INSERT INTO bot_state (key, value, updated_at)
        VALUES (?, ?, ?)
        ON CONFLICT(key) DO UPDATE SET
          value = excluded.value,
          updated_at = excluded.updated_at
      `)
      .run(STATE_KEY, `${JSON.stringify(data, null, 2)}\n`, Date.now());
  }

  async function load() {
    initialize();

    const raw = loadRawState();
    if (!raw) return structuredClone(initialData);

    return JSON.parse(raw);
  }

  async function save(data) {
    initialize();

    database.exec('BEGIN IMMEDIATE');
    try {
      saveRawState(data);
      database.exec('COMMIT');
    } catch (error) {
      database.exec('ROLLBACK');
      throw error;
    }
  }

  async function update(mutator) {
    const job = queue.then(async () => {
      initialize();
      database.exec('BEGIN IMMEDIATE');

      try {
        const raw = loadRawState();
        const data = raw ? JSON.parse(raw) : structuredClone(initialData);
        const result = await mutator(data);
        saveRawState(data);
        database.exec('COMMIT');
        return result;
      } catch (error) {
        database.exec('ROLLBACK');
        throw error;
      }
    });

    queue = job.catch(() => {});
    return job;
  }

  function close() {
    if (!database) return;
    database.close();
    database = null;
  }

  return {
    load,
    save,
    update,
    close
  };
}
