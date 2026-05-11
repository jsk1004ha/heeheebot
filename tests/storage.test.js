import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import test from 'node:test';
import { createSqliteStore } from '../src/storage/sqlite-store.js';

test('SQLite 저장소는 데이터를 SQL 행으로 파일에 유지한다', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'heeheebot-sqlite-'));
  const databasePath = join(directory, 'profiles.sqlite');
  const store = createSqliteStore(databasePath);

  try {
    await store.update((data) => {
      data.guilds['guild-1'] = {
        users: {
          'user-1': {
            userId: 'user-1',
            username: '테스터',
            level: 2,
            tags: ['alpha', 'beta'],
            settings: {
              enabled: true,
              memo: null
            }
          }
        }
      };
    });
    store.close();

    const reopened = createSqliteStore(databasePath);
    const data = await reopened.load();
    reopened.close();

    assert.equal(data.guilds['guild-1'].users['user-1'].level, 2);
    assert.deepEqual(data.guilds['guild-1'].users['user-1'].tags, ['alpha', 'beta']);
    assert.equal(data.guilds['guild-1'].users['user-1'].settings.enabled, true);
    assert.equal(data.guilds['guild-1'].users['user-1'].settings.memo, null);

    const inspector = new DatabaseSync(databasePath);
    try {
      assert.equal(getLegacyStateValue(inspector), null);
      assert.ok(countRows(inspector, 'bot_state_nodes') > 10);
    } finally {
      inspector.close();
    }
  } finally {
    store.close();
    await rm(directory, {
      recursive: true,
      force: true
    });
  }
});

test('기존 SQLite 내부 단일 JSON 상태를 SQL 행으로 자동 마이그레이션한다', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'heeheebot-sqlite-blob-migrate-'));
  const databasePath = join(directory, 'profiles.sqlite');
  const legacyData = {
    guilds: {
      'guild-1': {
        users: {
          'user-1': {
            userId: 'user-1',
            username: '기존SQLite유저',
            level: 7,
            flags: [true, false, null]
          }
        }
      }
    }
  };

  try {
    const legacyDatabase = new DatabaseSync(databasePath);
    legacyDatabase.exec(`
      CREATE TABLE bot_state (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at INTEGER NOT NULL
      )
    `);
    legacyDatabase
      .prepare('INSERT INTO bot_state (key, value, updated_at) VALUES (?, ?, ?)')
      .run('state', `${JSON.stringify(legacyData, null, 2)}\n`, Date.now());
    legacyDatabase.close();

    const store = createSqliteStore(databasePath);
    const data = await store.load();
    store.close();

    assert.equal(data.guilds['guild-1'].users['user-1'].username, '기존SQLite유저');
    assert.equal(data.guilds['guild-1'].users['user-1'].level, 7);
    assert.deepEqual(data.guilds['guild-1'].users['user-1'].flags, [true, false, null]);

    const inspector = new DatabaseSync(databasePath);
    try {
      assert.equal(getLegacyStateValue(inspector), null);
      assert.ok(countRows(inspector, 'bot_state_nodes') > 10);
    } finally {
      inspector.close();
    }
  } finally {
    await rm(directory, {
      recursive: true,
      force: true
    });
  }
});

test('기존 JSON 파일 데이터가 있으면 빈 SQLite DB로 SQL 행 마이그레이션한다', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'heeheebot-json-migrate-'));
  const databasePath = join(directory, 'profiles.sqlite');
  const jsonPath = join(directory, 'legacy', 'profiles.json');
  const legacyData = {
    guilds: {
      'guild-1': {
        users: {
          'user-1': {
            userId: 'user-1',
            username: '기존유저',
            level: 3
          }
        }
      }
    }
  };

  try {
    await mkdir(dirname(jsonPath), { recursive: true });
    await writeFile(jsonPath, `${JSON.stringify(legacyData, null, 2)}\n`, 'utf8');

    const store = createSqliteStore(databasePath, {
      migrateFromJsonPath: jsonPath
    });
    const data = await store.load();
    store.close();

    assert.equal(data.guilds['guild-1'].users['user-1'].username, '기존유저');
    assert.equal(data.guilds['guild-1'].users['user-1'].level, 3);

    const inspector = new DatabaseSync(databasePath);
    try {
      assert.equal(getLegacyStateValue(inspector), null);
      assert.ok(countRows(inspector, 'bot_state_nodes') > 5);
    } finally {
      inspector.close();
    }
  } finally {
    await rm(directory, {
      recursive: true,
      force: true
    });
  }
});


test('SQLite SQL 행 저장소는 루트 falsy JSON 값도 빈 DB로 오인하지 않는다', async () => {
  const cases = [false, 0, '', null];

  for (const value of cases) {
    const directory = await mkdtemp(join(tmpdir(), 'heeheebot-falsy-root-'));
    const databasePath = join(directory, 'profiles.sqlite');
    const store = createSqliteStore(databasePath);

    try {
      await store.save(value);
      store.close();

      const reopened = createSqliteStore(databasePath);
      const data = await reopened.load();
      reopened.close();

      assert.equal(data, value);
    } finally {
      store.close();
      await rm(directory, {
        recursive: true,
        force: true
      });
    }
  }
});

test('기존 SQLite 단일 JSON의 루트 falsy 값도 SQL 행으로 보존한다', async () => {
  const cases = [false, 0, '', null];

  for (const value of cases) {
    const directory = await mkdtemp(join(tmpdir(), 'heeheebot-falsy-blob-migrate-'));
    const databasePath = join(directory, 'profiles.sqlite');

    try {
      const legacyDatabase = new DatabaseSync(databasePath);
      legacyDatabase.exec(`
        CREATE TABLE bot_state (
          key TEXT PRIMARY KEY,
          value TEXT NOT NULL,
          updated_at INTEGER NOT NULL
        )
      `);
      legacyDatabase
        .prepare('INSERT INTO bot_state (key, value, updated_at) VALUES (?, ?, ?)')
        .run('state', JSON.stringify(value), Date.now());
      legacyDatabase.close();

      const store = createSqliteStore(databasePath);
      const data = await store.load();
      store.close();

      assert.equal(data, value);

      const inspector = new DatabaseSync(databasePath);
      try {
        assert.equal(getLegacyStateValue(inspector), null);
        assert.equal(countRows(inspector, 'bot_state_nodes'), 1);
      } finally {
        inspector.close();
      }
    } finally {
      await rm(directory, {
        recursive: true,
        force: true
      });
    }
  }
});

test('SQLite 저장소는 거대한 sparse array를 만들지 않고 거부한다', async () => {
  const store = createSqliteStore(':memory:');
  const sparse = [];
  sparse[1_000_000_000] = 'heap-risk';

  try {
    await assert.rejects(
      () => store.save({ sparse }),
      /sparse array at <root>\.sparse/
    );
  } finally {
    store.close();
  }
});

test('SQLite 저장소는 손상된 sparse array 행을 로드 중 거부한다', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'heeheebot-sparse-sqlite-'));
  const databasePath = join(directory, 'profiles.sqlite');
  const store = createSqliteStore(databasePath);

  try {
    await store.save(['safe']);
    store.close();

    const database = new DatabaseSync(databasePath);
    try {
      database
        .prepare("UPDATE bot_state_nodes SET path = ?, node_key = ? WHERE parent_path = '' AND node_key = '0'")
        .run('/1000000000', '1000000000');
    } finally {
      database.close();
    }

    const reopened = createSqliteStore(databasePath);
    await assert.rejects(
      () => reopened.load(),
      /SQLite state array is sparse or out of order/
    );
    reopened.close();
  } finally {
    store.close();
    await rm(directory, {
      recursive: true,
      force: true
    });
  }
});

function countRows(database, tableName) {
  return database
    .prepare(`SELECT COUNT(*) AS count FROM ${tableName}`)
    .get().count;
}

function getLegacyStateValue(database) {
  const table = database
    .prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'bot_state'")
    .get();

  if (!table) return null;

  return database
    .prepare('SELECT value FROM bot_state WHERE key = ?')
    .get('state')?.value ?? null;
}
