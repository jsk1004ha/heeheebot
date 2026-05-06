import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { createSqliteStore } from '../src/storage/sqlite-store.js';

test('SQLite 저장소는 데이터를 파일에 유지한다', async () => {
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
            level: 2
          }
        }
      };
    });
    store.close();

    const reopened = createSqliteStore(databasePath);
    const data = await reopened.load();
    reopened.close();

    assert.equal(data.guilds['guild-1'].users['user-1'].level, 2);
  } finally {
    store.close();
    await rm(directory, {
      recursive: true,
      force: true
    });
  }
});

test('기존 JSON 데이터가 있으면 빈 SQLite DB로 1회 마이그레이션한다', async () => {
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
  } finally {
    await rm(directory, {
      recursive: true,
      force: true
    });
  }
});
