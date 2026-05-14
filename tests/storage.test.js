import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import test from 'node:test';
import { createSqliteStore } from '../src/storage/sqlite-store.js';

test('SQLite 저장소는 데이터를 정규화 테이블로 파일에 유지한다', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'heeheebot-sqlite-'));
  const databasePath = join(directory, 'profiles.sqlite');
  const store = createSqliteStore(databasePath);

  try {
    await store.update((data) => {
      data.accounts = {
        users: {
          'user-1': {
            userId: 'user-1',
            username: '통합계정',
            createdAt: 100
          }
        },
        guilds: {
          'guild-1': {
            users: {
              'user-1': {
                userId: 'user-1',
                lastSeenAt: 200
              }
            }
          }
        }
      };
      data.wordle = {
        sessions: {
          '2026-05-11': {
            'user-1': {
              status: 'playing',
              guesses: []
            }
          }
        }
      };
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
        },
        fishing: {
          users: {
            'user-1': {
              rodLevel: 3,
              caught: ['carp']
            }
          },
          linkedUsers: {
            'user-1': true
          }
        },
        community: {
          dailyMission: {
            progress: 4
          }
        }
      };
    });
    store.close();

    const reopened = createSqliteStore(databasePath);
    const data = await reopened.load();
    reopened.close();

    assert.equal(data.accounts.users['user-1'].username, '통합계정');
    assert.equal(data.wordle.sessions['2026-05-11']['user-1'].status, 'playing');
    assert.equal(data.guilds['guild-1'].users['user-1'].level, 2);
    assert.deepEqual(data.guilds['guild-1'].users['user-1'].tags, ['alpha', 'beta']);
    assert.equal(data.guilds['guild-1'].users['user-1'].settings.enabled, true);
    assert.equal(data.guilds['guild-1'].users['user-1'].settings.memo, null);
    assert.equal(data.guilds['guild-1'].fishing.users['user-1'].rodLevel, 3);
    assert.equal(data.guilds['guild-1'].fishing.linkedUsers['user-1'], true);

    const inspector = new DatabaseSync(databasePath);
    try {
      assert.equal(getLegacyStateValue(inspector), null);
      assert.equal(tableExists(inspector, 'bot_state_nodes'), false);
      assert.equal(countRows(inspector, 'bot_root_state'), 1);
      assert.equal(countRows(inspector, 'bot_global_features'), 2);
      assert.equal(countRows(inspector, 'bot_global_feature_users'), 1);
      assert.equal(countRows(inspector, 'bot_guilds'), 1);
      assert.equal(countRows(inspector, 'bot_guild_users'), 1);
      assert.equal(countRows(inspector, 'bot_guild_features'), 2);
      assert.equal(countRows(inspector, 'bot_guild_feature_users'), 1);
      assert.equal(countRows(inspector, 'bot_account_profiles'), 1);
      assert.equal(countRows(inspector, 'bot_account_guild_memberships'), 1);
      assert.equal(getMetadata(inspector, 'schema_version'), '4');
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

test('기존 SQLite 내부 단일 JSON 상태를 정규화 테이블로 자동 마이그레이션한다', async () => {
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
      assert.equal(countRows(inspector, 'bot_guilds'), 1);
      assert.equal(countRows(inspector, 'bot_guild_users'), 1);
      assert.ok(Number(getMetadata(inspector, 'legacy_bot_state_migrated_at')) > 0);
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

test('기존 JSON 파일 데이터가 있으면 빈 SQLite DB로 정규화 마이그레이션한다', async () => {
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
      assert.equal(countRows(inspector, 'bot_guild_users'), 1);
      assert.ok(Number(getMetadata(inspector, 'legacy_json_file_migrated_at')) > 0);
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

test('기존 bot_state_nodes 행 저장소를 정규화 테이블로 자동 마이그레이션한다', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'heeheebot-node-migrate-'));
  const databasePath = join(directory, 'profiles.sqlite');
  const legacyData = {
    accounts: {
      users: {
        'user-1': {
          username: '노드통합'
        }
      }
    },
    guilds: {
      'guild-1': {
        users: {
          'user-1': {
            username: '노드유저',
            level: 9
          }
        },
        fishing: {
          users: {
            'user-1': {
              rodLevel: 5
            }
          }
        }
      }
    }
  };

  try {
    createLegacyNodeDatabase(databasePath, legacyData);

    const store = createSqliteStore(databasePath);
    const data = await store.load();
    store.close();

    assert.equal(data.accounts.users['user-1'].username, '노드통합');
    assert.equal(data.guilds['guild-1'].users['user-1'].level, 9);
    assert.equal(data.guilds['guild-1'].fishing.users['user-1'].rodLevel, 5);

    const inspector = new DatabaseSync(databasePath);
    try {
      assert.ok(countRows(inspector, 'bot_state_nodes') > 0);
      assert.equal(countRows(inspector, 'bot_global_feature_users'), 1);
      assert.equal(countRows(inspector, 'bot_guild_users'), 1);
      assert.equal(countRows(inspector, 'bot_guild_feature_users'), 1);
      assert.equal(countRows(inspector, 'bot_account_profiles'), 1);
      assert.ok(Number(getMetadata(inspector, 'legacy_bot_state_nodes_migrated_at')) > 0);
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

test('기존 v3 정규화 DB는 계정 고속 조회 테이블로 자동 이전된다', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'heeheebot-v3-hot-migrate-'));
  const databasePath = join(directory, 'profiles.sqlite');

  try {
    createLegacyNormalizedV3Database(databasePath, {
      accounts: {
        users: {
          'user-1': {
            userId: 'user-1',
            username: 'v3유저',
            level: 4,
            xp: 12,
            totalXp: 345,
            balance: 678,
            createdAt: 111
          }
        },
        guilds: {
          'guild-1': {
            users: {
              'user-1': {
                userId: 'user-1',
                username: 'v3유저',
                linkedAt: 222,
                lastSeenAt: 333
              }
            }
          }
        }
      }
    });

    const store = createSqliteStore(databasePath);
    const data = await store.load();
    const profile = await store.getAccountProfile('user-1');
    store.close();

    assert.equal(data.accounts.users['user-1'].username, 'v3유저');
    assert.equal(profile.balance, 678);

    const inspector = new DatabaseSync(databasePath);
    try {
      assert.equal(countRows(inspector, 'bot_account_profiles'), 1);
      assert.equal(countRows(inspector, 'bot_account_guild_memberships'), 1);
      assert.equal(getAccountProfileColumn(inspector, 'user-1', 'level'), 4);
      assert.equal(getAccountProfileColumn(inspector, 'user-1', 'balance'), 678);
      assert.equal(getMetadata(inspector, 'schema_version'), '4');
      assert.ok(Number(getMetadata(inspector, 'hot_account_projection_migrated_at')) > 0);
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

test('계정 fast-path API는 전체 상태 재직렬화 없이 계정 row와 로드 결과를 갱신한다', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'heeheebot-account-fast-path-'));
  const databasePath = join(directory, 'profiles.sqlite');
  const store = createSqliteStore(databasePath);
  const originalNow = Date.now;

  try {
    Date.now = () => 1_000;
    await store.save({
      accounts: {
        users: {
          'user-1': {
            userId: 'user-1',
            username: '느린유저',
            level: 1,
            xp: 0,
            totalXp: 0,
            balance: 0,
            createdAt: 100
          },
          'user-2': {
            userId: 'user-2',
            username: '유지유저',
            level: 2,
            xp: 5,
            totalXp: 50,
            balance: 10,
            createdAt: 200
          }
        },
        guilds: {
          'guild-1': {
            users: {
              'user-1': {
                userId: 'user-1',
                username: '느린유저',
                linkedAt: 100,
                lastSeenAt: 100
              }
            }
          }
        }
      },
      guilds: {}
    });

    Date.now = () => 2_000;
    const result = await store.updateAccountProfile({
      guildId: 'guild-2',
      userId: 'user-1',
      username: '빠른유저',
      now: 2_000
    }, (profile) => {
      profile.username = '빠른유저';
      profile.balance = 500;
      return { balance: profile.balance };
    });

    assert.deepEqual(result, { balance: 500 });
    assert.equal((await store.getAccountProfile('user-1')).balance, 500);

    const data = await store.load();
    assert.equal(data.accounts.users['user-1'].username, '빠른유저');
    assert.equal(data.accounts.users['user-1'].balance, 500);
    assert.equal(data.accounts.guilds['guild-2'].users['user-1'].lastSeenAt, 2_000);

    const inspector = new DatabaseSync(databasePath);
    try {
      assert.equal(getUpdatedAt(inspector, 'bot_account_profiles', 'user_id = ?', ['user-1']), 2_000);
      assert.equal(getUpdatedAt(inspector, 'bot_account_profiles', 'user_id = ?', ['user-2']), 1_000);
      assert.equal(getUpdatedAt(inspector, 'bot_global_feature_users', 'feature_key = ? AND user_id = ?', ['accounts', 'user-1']), 2_000);
      assert.equal(countRows(inspector, 'bot_account_guild_memberships'), 2);
    } finally {
      inspector.close();
    }
  } finally {
    Date.now = originalNow;
    store.close();
    await rm(directory, {
      recursive: true,
      force: true
    });
  }
});

test('계정 저장소는 safe integer 초과 골드를 JSON 원본에 정확히 보존한다', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'heeheebot-account-big-money-'));
  const databasePath = join(directory, 'profiles.sqlite');
  const store = createSqliteStore(databasePath);
  const hugeBalance = '900719925474099200001';

  try {
    await store.save({
      accounts: {
        users: {
          'user-big': {
            userId: 'user-big',
            username: '거대잔액',
            level: 1,
            xp: 0,
            totalXp: 0,
            balance: hugeBalance,
            createdAt: 100
          }
        },
        guilds: {}
      },
      guilds: {}
    });

    const profile = await store.getAccountProfile('user-big');
    assert.equal(profile.balance, hugeBalance);

    const data = await store.load();
    assert.equal(data.accounts.users['user-big'].balance, hugeBalance);

    const inspector = new DatabaseSync(databasePath);
    try {
      assert.equal(getAccountProfileColumn(inspector, 'user-big', 'balance'), Number.MAX_SAFE_INTEGER);
      const rawProfile = inspector
        .prepare('SELECT profile_json FROM bot_account_profiles WHERE user_id = ?')
        .get('user-big')
        .profile_json;
      assert.equal(JSON.parse(rawProfile).balance, hugeBalance);
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

test('SQLite 정규화 저장소는 루트 falsy JSON 값도 빈 DB로 오인하지 않는다', async () => {
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

      const inspector = new DatabaseSync(databasePath);
      try {
        assert.equal(countRows(inspector, 'bot_root_state'), 1);
        assert.equal(countRows(inspector, 'bot_guilds'), 0);
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
  }
});

test('SQLite 저장소 load/view 스냅샷은 캐시 원본을 오염시키지 않는다', async () => {
  const store = createSqliteStore(':memory:');

  try {
    await store.save({
      guilds: {
        'guild-1': {
          users: {
            'user-1': {
              level: 1
            }
          }
        }
      }
    });

    const loaded = await store.load();
    loaded.guilds['guild-1'].users['user-1'].level = 99;

    const viewResult = await store.view((data) => {
      data.guilds['guild-1'].users['user-1'].level = 50;
      return data.guilds['guild-1'].users['user-1'].level;
    });
    const reloaded = await store.load();

    assert.equal(viewResult, 50);
    assert.equal(reloaded.guilds['guild-1'].users['user-1'].level, 1);
  } finally {
    store.close();
  }
});

test('SQLite 저장소 update 실패는 메모리 캐시와 DB를 되돌린다', async () => {
  const store = createSqliteStore(':memory:');

  try {
    await store.save({
      guilds: {
        'guild-1': {
          users: {
            'user-1': {
              level: 1
            }
          }
        }
      }
    });

    await assert.rejects(
      () => store.update((data) => {
        data.guilds['guild-1'].users['user-1'].level = 99;
        throw new Error('boom');
      }),
      /boom/
    );

    const data = await store.load();
    assert.equal(data.guilds['guild-1'].users['user-1'].level, 1);
  } finally {
    store.close();
  }
});

test('SQLite 정규화 저장소는 변경된 행만 갱신하고 그대로인 row는 유지한다', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'heeheebot-sqlite-delta-'));
  const databasePath = join(directory, 'profiles.sqlite');
  const store = createSqliteStore(databasePath);
  const originalNow = Date.now;

  try {
    Date.now = () => 1_000;
    await store.save({
      guilds: {
        'guild-1': {
          users: {
            'user-1': {
              level: 1
            },
            'user-2': {
              level: 2
            }
          }
        }
      }
    });

    Date.now = () => 2_000;
    await store.update((data) => {
      data.guilds['guild-1'].users['user-1'].level = 10;
    });

    const inspector = new DatabaseSync(databasePath);
    try {
      assert.equal(getUpdatedAt(inspector, 'bot_guild_users', 'guild_id = ? AND user_id = ?', ['guild-1', 'user-1']), 2_000);
      assert.equal(getUpdatedAt(inspector, 'bot_guild_users', 'guild_id = ? AND user_id = ?', ['guild-1', 'user-2']), 1_000);
      assert.equal(getUpdatedAt(inspector, 'bot_guilds', 'guild_id = ?', ['guild-1']), 1_000);
    } finally {
      inspector.close();
    }
  } finally {
    Date.now = originalNow;
    store.close();
    await rm(directory, {
      recursive: true,
      force: true
    });
  }
});

test('기존 SQLite 단일 JSON의 루트 falsy 값도 정규화 테이블로 보존한다', async () => {
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
        assert.equal(countRows(inspector, 'bot_root_state'), 1);
        assert.equal(countRows(inspector, 'bot_global_features'), 0);
        assert.equal(countRows(inspector, 'bot_guilds'), 0);
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

test('SQLite 저장소는 손상된 legacy sparse array 행을 마이그레이션 중 거부한다', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'heeheebot-sparse-sqlite-'));
  const databasePath = join(directory, 'profiles.sqlite');

  try {
    const database = new DatabaseSync(databasePath);
    try {
      createLegacyNodeSchema(database);
      const insert = database.prepare(`
        INSERT INTO bot_state_nodes (
          path,
          parent_path,
          node_key,
          node_type,
          text_value,
          number_value,
          boolean_value,
          updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);
      insert.run('', null, null, 'array', null, null, null, 1);
      insert.run('/1000000000', '', '1000000000', 'string', 'heap-risk', null, null, 1);
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

function tableExists(database, tableName) {
  return Boolean(database
    .prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?")
    .get(tableName));
}

function getLegacyStateValue(database) {
  if (!tableExists(database, 'bot_state')) return null;

  return database
    .prepare('SELECT value FROM bot_state WHERE key = ?')
    .get('state')?.value ?? null;
}

function getMetadata(database, key) {
  return database
    .prepare('SELECT value FROM bot_storage_metadata WHERE key = ?')
    .get(key)?.value ?? null;
}

function getUpdatedAt(database, tableName, whereClause, params) {
  return database
    .prepare(`SELECT updated_at FROM ${tableName} WHERE ${whereClause}`)
    .get(...params)
    .updated_at;
}

function getAccountProfileColumn(database, userId, column) {
  return database
    .prepare(`SELECT ${column} FROM bot_account_profiles WHERE user_id = ?`)
    .get(userId)?.[column] ?? null;
}

function createLegacyNormalizedV3Database(databasePath, data) {
  const database = new DatabaseSync(databasePath);
  try {
    database.exec(`
      CREATE TABLE bot_storage_metadata (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at INTEGER NOT NULL
      );

      CREATE TABLE bot_root_state (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        root_type TEXT NOT NULL CHECK (root_type IN ('object', 'array', 'string', 'number', 'boolean', 'null')),
        root_json TEXT,
        has_guilds INTEGER NOT NULL DEFAULT 0 CHECK (has_guilds IN (0, 1)),
        updated_at INTEGER NOT NULL
      );

      CREATE TABLE bot_global_features (
        feature_key TEXT PRIMARY KEY,
        state_json TEXT NOT NULL,
        has_users INTEGER NOT NULL DEFAULT 0 CHECK (has_users IN (0, 1)),
        updated_at INTEGER NOT NULL
      );

      CREATE TABLE bot_global_feature_users (
        feature_key TEXT NOT NULL,
        user_id TEXT NOT NULL,
        profile_json TEXT NOT NULL,
        updated_at INTEGER NOT NULL,
        PRIMARY KEY (feature_key, user_id)
      );

      CREATE TABLE bot_guilds (
        guild_id TEXT PRIMARY KEY,
        state_json TEXT NOT NULL,
        has_users INTEGER NOT NULL DEFAULT 0 CHECK (has_users IN (0, 1)),
        updated_at INTEGER NOT NULL
      );

      CREATE TABLE bot_guild_users (
        guild_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        profile_json TEXT NOT NULL,
        updated_at INTEGER NOT NULL,
        PRIMARY KEY (guild_id, user_id)
      );

      CREATE TABLE bot_guild_features (
        guild_id TEXT NOT NULL,
        feature_key TEXT NOT NULL,
        state_json TEXT NOT NULL,
        has_users INTEGER NOT NULL DEFAULT 0 CHECK (has_users IN (0, 1)),
        updated_at INTEGER NOT NULL,
        PRIMARY KEY (guild_id, feature_key)
      );

      CREATE TABLE bot_guild_feature_users (
        guild_id TEXT NOT NULL,
        feature_key TEXT NOT NULL,
        user_id TEXT NOT NULL,
        profile_json TEXT NOT NULL,
        updated_at INTEGER NOT NULL,
        PRIMARY KEY (guild_id, feature_key, user_id)
      );
    `);
    database
      .prepare('INSERT INTO bot_storage_metadata (key, value, updated_at) VALUES (?, ?, ?)')
      .run('schema_version', '3', 123);
    database
      .prepare('INSERT INTO bot_root_state (id, root_type, root_json, has_guilds, updated_at) VALUES (?, ?, ?, ?, ?)')
      .run(1, 'object', null, 0, 123);
    const accountState = { ...(data.accounts ?? {}) };
    const users = accountState.users ?? {};
    delete accountState.users;
    database
      .prepare('INSERT INTO bot_global_features (feature_key, state_json, has_users, updated_at) VALUES (?, ?, ?, ?)')
      .run('accounts', JSON.stringify(accountState), 1, 123);
    for (const [userId, profile] of Object.entries(users)) {
      database
        .prepare('INSERT INTO bot_global_feature_users (feature_key, user_id, profile_json, updated_at) VALUES (?, ?, ?, ?)')
        .run('accounts', userId, JSON.stringify(profile), 123);
    }
  } finally {
    database.close();
  }
}

function createLegacyNodeDatabase(databasePath, data) {
  const database = new DatabaseSync(databasePath);
  try {
    createLegacyNodeSchema(database);
    const insert = database.prepare(`
      INSERT INTO bot_state_nodes (
        path,
        parent_path,
        node_key,
        node_type,
        text_value,
        number_value,
        boolean_value,
        updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    serializeLegacyNode(data, {
      path: '',
      parentPath: null,
      nodeKey: null,
      insert,
      now: 123
    });
  } finally {
    database.close();
  }
}

function createLegacyNodeSchema(database) {
  database.exec(`
    CREATE TABLE bot_state_nodes (
      path TEXT PRIMARY KEY,
      parent_path TEXT,
      node_key TEXT,
      node_type TEXT NOT NULL CHECK (node_type IN ('object', 'array', 'string', 'number', 'boolean', 'null')),
      text_value TEXT,
      number_value REAL,
      boolean_value INTEGER CHECK (boolean_value IN (0, 1) OR boolean_value IS NULL),
      updated_at INTEGER NOT NULL
    )
  `);
}

function serializeLegacyNode(value, {
  path,
  parentPath,
  nodeKey,
  insert,
  now
}) {
  const nodeType = getLegacyNodeType(value);
  insert.run(
    path,
    parentPath,
    nodeKey,
    nodeType,
    nodeType === 'string' ? value : null,
    nodeType === 'number' ? value : null,
    nodeType === 'boolean' ? Number(value) : null,
    now
  );

  if (nodeType === 'array') {
    value.forEach((item, index) => {
      const childKey = String(index);
      serializeLegacyNode(item, {
        path: joinPointerPath(path, childKey),
        parentPath: path,
        nodeKey: childKey,
        insert,
        now
      });
    });
    return;
  }

  if (nodeType === 'object') {
    for (const [childKey, childValue] of Object.entries(value)) {
      serializeLegacyNode(childValue, {
        path: joinPointerPath(path, childKey),
        parentPath: path,
        nodeKey: childKey,
        insert,
        now
      });
    }
  }
}

function getLegacyNodeType(value) {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  return typeof value;
}

function joinPointerPath(parentPath, key) {
  const segment = String(key)
    .replaceAll('~', '~0')
    .replaceAll('/', '~1');

  return parentPath ? `${parentPath}/${segment}` : `/${segment}`;
}
