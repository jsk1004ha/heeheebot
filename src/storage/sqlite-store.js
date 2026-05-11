import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

const DEFAULT_DATA = Object.freeze({
  guilds: {}
});

const LEGACY_STATE_KEY = 'state';
const SCHEMA_VERSION = 3;
const ROOT_STATE_ID = 1;
const JSON_TYPES = new Set(['object', 'array', 'string', 'number', 'boolean', 'null']);
const EMPTY_SQL_STATE = Object.freeze({ found: false, data: null });
const UNLOADED_CACHE = Symbol('unloaded-cache');

export function createSqliteStore(databasePath, options = {}) {
  const {
    initialData = DEFAULT_DATA,
    migrateFromJsonPath = null
  } = options;

  let database = null;
  let queue = Promise.resolve();
  let cachedData = UNLOADED_CACHE;
  let cachedStatePersisted = false;

  function initialize() {
    if (database) return database;

    if (databasePath !== ':memory:') {
      mkdirSync(dirname(databasePath), { recursive: true });
    }

    database = new DatabaseSync(databasePath);
    database.exec('PRAGMA foreign_keys = ON');
    createNormalizedSchema();
    migrateLegacyNodeRowsIfNeeded();
    migrateLegacySqliteBlobIfNeeded();
    migrateJsonFileIfNeeded();
    saveMetadata('schema_version', String(SCHEMA_VERSION));
    return database;
  }

  function createNormalizedSchema() {
    database.exec(`
      CREATE TABLE IF NOT EXISTS bot_storage_metadata (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS bot_root_state (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        root_type TEXT NOT NULL CHECK (root_type IN ('object', 'array', 'string', 'number', 'boolean', 'null')),
        root_json TEXT,
        has_guilds INTEGER NOT NULL DEFAULT 0 CHECK (has_guilds IN (0, 1)),
        updated_at INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS bot_global_features (
        feature_key TEXT PRIMARY KEY,
        state_json TEXT NOT NULL,
        has_users INTEGER NOT NULL DEFAULT 0 CHECK (has_users IN (0, 1)),
        updated_at INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS bot_global_feature_users (
        feature_key TEXT NOT NULL,
        user_id TEXT NOT NULL,
        profile_json TEXT NOT NULL,
        updated_at INTEGER NOT NULL,
        PRIMARY KEY (feature_key, user_id),
        FOREIGN KEY (feature_key) REFERENCES bot_global_features(feature_key) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS bot_guilds (
        guild_id TEXT PRIMARY KEY,
        state_json TEXT NOT NULL,
        has_users INTEGER NOT NULL DEFAULT 0 CHECK (has_users IN (0, 1)),
        updated_at INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS bot_guild_users (
        guild_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        profile_json TEXT NOT NULL,
        updated_at INTEGER NOT NULL,
        PRIMARY KEY (guild_id, user_id),
        FOREIGN KEY (guild_id) REFERENCES bot_guilds(guild_id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS bot_guild_features (
        guild_id TEXT NOT NULL,
        feature_key TEXT NOT NULL,
        state_json TEXT NOT NULL,
        has_users INTEGER NOT NULL DEFAULT 0 CHECK (has_users IN (0, 1)),
        updated_at INTEGER NOT NULL,
        PRIMARY KEY (guild_id, feature_key),
        FOREIGN KEY (guild_id) REFERENCES bot_guilds(guild_id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS bot_guild_feature_users (
        guild_id TEXT NOT NULL,
        feature_key TEXT NOT NULL,
        user_id TEXT NOT NULL,
        profile_json TEXT NOT NULL,
        updated_at INTEGER NOT NULL,
        PRIMARY KEY (guild_id, feature_key, user_id),
        FOREIGN KEY (guild_id, feature_key) REFERENCES bot_guild_features(guild_id, feature_key) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_bot_global_feature_users_user
        ON bot_global_feature_users(user_id);

      CREATE INDEX IF NOT EXISTS idx_bot_guild_users_user
        ON bot_guild_users(user_id);

      CREATE INDEX IF NOT EXISTS idx_bot_guild_feature_users_user
        ON bot_guild_feature_users(user_id);
    `);
  }

  function migrateLegacyNodeRowsIfNeeded() {
    if (hasNormalizedState() || !tableExists('bot_state_nodes') || !hasLegacyNodeState()) return;

    const legacy = loadLegacyNodeState();
    if (!legacy.found) return;

    database.exec('BEGIN IMMEDIATE');
    try {
      cachedData = writeNormalizedState(legacy.data);
      cachedStatePersisted = true;
      saveMetadata('legacy_bot_state_nodes_migrated_at', String(Date.now()));
      database.exec('COMMIT');
    } catch (error) {
      database.exec('ROLLBACK');
      throw error;
    }
  }

  function migrateLegacySqliteBlobIfNeeded() {
    if (hasNormalizedState() || !tableExists('bot_state')) return;

    const raw = database
      .prepare('SELECT value FROM bot_state WHERE key = ?')
      .get(LEGACY_STATE_KEY)?.value;

    if (!raw) return;

    database.exec('BEGIN IMMEDIATE');
    try {
      cachedData = writeNormalizedState(JSON.parse(raw));
      cachedStatePersisted = true;
      database
        .prepare('DELETE FROM bot_state WHERE key = ?')
        .run(LEGACY_STATE_KEY);
      saveMetadata('legacy_bot_state_migrated_at', String(Date.now()));
      database.exec('COMMIT');
    } catch (error) {
      database.exec('ROLLBACK');
      throw error;
    }
  }

  function migrateJsonFileIfNeeded() {
    if (!migrateFromJsonPath || !existsSync(migrateFromJsonPath) || hasNormalizedState()) return;

    const migrated = JSON.parse(readFileSync(migrateFromJsonPath, 'utf8'));

    database.exec('BEGIN IMMEDIATE');
    try {
      cachedData = writeNormalizedState(migrated);
      cachedStatePersisted = true;
      saveMetadata('legacy_json_file_migrated_at', String(Date.now()));
      database.exec('COMMIT');
    } catch (error) {
      database.exec('ROLLBACK');
      throw error;
    }
  }

  function tableExists(tableName) {
    return Boolean(database
      .prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?")
      .get(tableName));
  }

  function hasNormalizedState() {
    return Boolean(database
      .prepare('SELECT 1 FROM bot_root_state WHERE id = ?')
      .get(ROOT_STATE_ID));
  }

  function hasLegacyNodeState() {
    return Boolean(database
      .prepare('SELECT 1 FROM bot_state_nodes LIMIT 1')
      .get());
  }

  function saveMetadata(key, value) {
    database
      .prepare(`
        INSERT INTO bot_storage_metadata (key, value, updated_at)
        VALUES (?, ?, ?)
        ON CONFLICT(key) DO UPDATE SET
          value = excluded.value,
          updated_at = excluded.updated_at
      `)
      .run(key, value, Date.now());
  }

  function loadNormalizedState() {
    const root = database
      .prepare(`
        SELECT root_type, root_json, has_guilds
        FROM bot_root_state
        WHERE id = ?
      `)
      .get(ROOT_STATE_ID);

    if (!root) return EMPTY_SQL_STATE;

    if (!JSON_TYPES.has(root.root_type)) {
      throw new Error(`Unsupported SQLite root state type: ${root.root_type}`);
    }

    if (root.root_type !== 'object') {
      return {
        found: true,
        data: parseJsonValue(root.root_json, '<root>')
      };
    }

    const data = {};
    loadGlobalFeaturesInto(data);
    loadGuildsInto(data, root.has_guilds === 1);

    return {
      found: true,
      data
    };
  }

  function loadGlobalFeaturesInto(data) {
    const featureRows = database
      .prepare(`
        SELECT feature_key, state_json, has_users
        FROM bot_global_features
        ORDER BY feature_key
      `)
      .all();

    for (const row of featureRows) {
      const value = parseJsonValue(row.state_json, `global feature ${row.feature_key}`);
      if (row.has_users === 1) {
        assertPlainObject(value, `global feature ${row.feature_key}`);
        value.users = {};
      }
      data[row.feature_key] = value;
    }

    const userRows = database
      .prepare(`
        SELECT feature_key, user_id, profile_json
        FROM bot_global_feature_users
        ORDER BY feature_key, user_id
      `)
      .all();

    for (const row of userRows) {
      const feature = data[row.feature_key];
      assertPlainObject(feature, `global feature ${row.feature_key}`);
      if (!isPlainObject(feature.users)) feature.users = {};
      feature.users[row.user_id] = parseJsonValue(
        row.profile_json,
        `global feature ${row.feature_key} user ${row.user_id}`
      );
    }
  }

  function loadGuildsInto(data, hasGuilds) {
    const guildRows = database
      .prepare(`
        SELECT guild_id, state_json, has_users
        FROM bot_guilds
        ORDER BY guild_id
      `)
      .all();

    if (!hasGuilds && guildRows.length === 0) return;

    data.guilds = {};
    for (const row of guildRows) {
      const value = parseJsonValue(row.state_json, `guild ${row.guild_id}`);
      if (row.has_users === 1) {
        assertPlainObject(value, `guild ${row.guild_id}`);
        value.users = {};
      }
      data.guilds[row.guild_id] = value;
    }

    const userRows = database
      .prepare(`
        SELECT guild_id, user_id, profile_json
        FROM bot_guild_users
        ORDER BY guild_id, user_id
      `)
      .all();

    for (const row of userRows) {
      const guild = data.guilds[row.guild_id];
      assertPlainObject(guild, `guild ${row.guild_id}`);
      if (!isPlainObject(guild.users)) guild.users = {};
      guild.users[row.user_id] = parseJsonValue(
        row.profile_json,
        `guild ${row.guild_id} user ${row.user_id}`
      );
    }

    const featureRows = database
      .prepare(`
        SELECT guild_id, feature_key, state_json, has_users
        FROM bot_guild_features
        ORDER BY guild_id, feature_key
      `)
      .all();

    for (const row of featureRows) {
      const guild = data.guilds[row.guild_id];
      assertPlainObject(guild, `guild ${row.guild_id}`);
      const feature = parseJsonValue(
        row.state_json,
        `guild ${row.guild_id} feature ${row.feature_key}`
      );
      if (row.has_users === 1) {
        assertPlainObject(feature, `guild ${row.guild_id} feature ${row.feature_key}`);
        feature.users = {};
      }
      guild[row.feature_key] = feature;
    }

    const featureUserRows = database
      .prepare(`
        SELECT guild_id, feature_key, user_id, profile_json
        FROM bot_guild_feature_users
        ORDER BY guild_id, feature_key, user_id
      `)
      .all();

    for (const row of featureUserRows) {
      const guild = data.guilds[row.guild_id];
      assertPlainObject(guild, `guild ${row.guild_id}`);
      const feature = guild[row.feature_key];
      assertPlainObject(feature, `guild ${row.guild_id} feature ${row.feature_key}`);
      if (!isPlainObject(feature.users)) feature.users = {};
      feature.users[row.user_id] = parseJsonValue(
        row.profile_json,
        `guild ${row.guild_id} feature ${row.feature_key} user ${row.user_id}`
      );
    }
  }

  function loadLegacyNodeState() {
    const rows = database
      .prepare(`
        SELECT path, parent_path, node_key, node_type, text_value, number_value, boolean_value
        FROM bot_state_nodes
        ORDER BY
          CASE WHEN parent_path IS NULL THEN 0 ELSE 1 END,
          length(path),
          path
      `)
      .all();

    if (rows.length === 0) return EMPTY_SQL_STATE;

    const nodes = new Map(rows.map((row) => [row.path, row]));
    const children = new Map();

    for (const row of rows) {
      if (row.parent_path === null) continue;
      const bucket = children.get(row.parent_path) ?? [];
      bucket.push(row);
      children.set(row.parent_path, bucket);
    }

    return {
      found: true,
      data: deserializeLegacyNode('', nodes, children)
    };
  }

  function getCachedData() {
    if (cachedData !== UNLOADED_CACHE) return cachedData;

    const state = loadNormalizedState();
    cachedData = state.found ? state.data : structuredClone(initialData);
    cachedStatePersisted = state.found;
    return cachedData;
  }

  function writeNormalizedState(data) {
    const normalizedData = toJsonCompatibleData(data);
    const nextRows = collectNormalizedRows(normalizedData);

    if (cachedData !== UNLOADED_CACHE && cachedStatePersisted) {
      writeNormalizedStateDelta(nextRows, collectNormalizedRows(cachedData));
    } else {
      writeNormalizedStateFull(nextRows);
    }

    return normalizedData;
  }

  function writeNormalizedStateFull(rows) {
    deleteAllNormalizedRows();
    insertRootRow(rows.root, Date.now());
    insertRows(rows);
  }

  function writeNormalizedStateDelta(nextRows, previousRows) {
    const now = Date.now();

    deleteMissingRows(previousRows.globalFeatureUsers, nextRows.globalFeatureUsers, deleteGlobalFeatureUserRow());
    deleteMissingRows(previousRows.guildFeatureUsers, nextRows.guildFeatureUsers, deleteGuildFeatureUserRow());
    deleteMissingRows(previousRows.guildFeatures, nextRows.guildFeatures, deleteGuildFeatureRow());
    deleteMissingRows(previousRows.guildUsers, nextRows.guildUsers, deleteGuildUserRow());
    deleteMissingRows(previousRows.guilds, nextRows.guilds, deleteGuildRow());
    deleteMissingRows(previousRows.globalFeatures, nextRows.globalFeatures, deleteGlobalFeatureRow());

    if (!rootRowsEqual(nextRows.root, previousRows.root)) {
      upsertRootRow(nextRows.root, now);
    }

    upsertChangedRows(nextRows.globalFeatures, previousRows.globalFeatures, upsertGlobalFeatureRow(), bindGlobalFeatureRow, now);
    upsertChangedRows(nextRows.guilds, previousRows.guilds, upsertGuildRow(), bindGuildRow, now);
    upsertChangedRows(nextRows.globalFeatureUsers, previousRows.globalFeatureUsers, upsertGlobalFeatureUserRow(), bindGlobalFeatureUserRow, now);
    upsertChangedRows(nextRows.guildUsers, previousRows.guildUsers, upsertGuildUserRow(), bindGuildUserRow, now);
    upsertChangedRows(nextRows.guildFeatures, previousRows.guildFeatures, upsertGuildFeatureRow(), bindGuildFeatureRow, now);
    upsertChangedRows(nextRows.guildFeatureUsers, previousRows.guildFeatureUsers, upsertGuildFeatureUserRow(), bindGuildFeatureUserRow, now);
  }

  function deleteAllNormalizedRows() {
    database.prepare('DELETE FROM bot_guild_feature_users').run();
    database.prepare('DELETE FROM bot_guild_features').run();
    database.prepare('DELETE FROM bot_guild_users').run();
    database.prepare('DELETE FROM bot_guilds').run();
    database.prepare('DELETE FROM bot_global_feature_users').run();
    database.prepare('DELETE FROM bot_global_features').run();
    database.prepare('DELETE FROM bot_root_state').run();
  }

  function insertRows(rows) {
    const now = Date.now();
    const globalFeature = insertGlobalFeatureRow();
    const globalFeatureUser = insertGlobalFeatureUserRow();
    const guild = insertGuildRow();
    const guildUser = insertGuildUserRow();
    const guildFeature = insertGuildFeatureRow();
    const guildFeatureUser = insertGuildFeatureUserRow();

    for (const row of rows.globalFeatures.values()) globalFeature.run(...bindGlobalFeatureRow(row, now));
    for (const row of rows.guilds.values()) guild.run(...bindGuildRow(row, now));
    for (const row of rows.globalFeatureUsers.values()) globalFeatureUser.run(...bindGlobalFeatureUserRow(row, now));
    for (const row of rows.guildUsers.values()) guildUser.run(...bindGuildUserRow(row, now));
    for (const row of rows.guildFeatures.values()) guildFeature.run(...bindGuildFeatureRow(row, now));
    for (const row of rows.guildFeatureUsers.values()) guildFeatureUser.run(...bindGuildFeatureUserRow(row, now));
  }

  function insertRootRow(row, now) {
    database
      .prepare(`
        INSERT INTO bot_root_state (id, root_type, root_json, has_guilds, updated_at)
        VALUES (?, ?, ?, ?, ?)
      `)
      .run(ROOT_STATE_ID, row.rootType, row.rootJson, row.hasGuilds, now);
  }

  function upsertRootRow(row, now) {
    database
      .prepare(`
        INSERT INTO bot_root_state (id, root_type, root_json, has_guilds, updated_at)
        VALUES (?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          root_type = excluded.root_type,
          root_json = excluded.root_json,
          has_guilds = excluded.has_guilds,
          updated_at = excluded.updated_at
      `)
      .run(ROOT_STATE_ID, row.rootType, row.rootJson, row.hasGuilds, now);
  }

  function insertGlobalFeatureRow() {
    return database.prepare(`
      INSERT INTO bot_global_features (feature_key, state_json, has_users, updated_at)
      VALUES (?, ?, ?, ?)
    `);
  }

  function upsertGlobalFeatureRow() {
    return database.prepare(`
      INSERT INTO bot_global_features (feature_key, state_json, has_users, updated_at)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(feature_key) DO UPDATE SET
        state_json = excluded.state_json,
        has_users = excluded.has_users,
        updated_at = excluded.updated_at
    `);
  }

  function insertGlobalFeatureUserRow() {
    return database.prepare(`
      INSERT INTO bot_global_feature_users (feature_key, user_id, profile_json, updated_at)
      VALUES (?, ?, ?, ?)
    `);
  }

  function upsertGlobalFeatureUserRow() {
    return database.prepare(`
      INSERT INTO bot_global_feature_users (feature_key, user_id, profile_json, updated_at)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(feature_key, user_id) DO UPDATE SET
        profile_json = excluded.profile_json,
        updated_at = excluded.updated_at
    `);
  }

  function insertGuildRow() {
    return database.prepare(`
      INSERT INTO bot_guilds (guild_id, state_json, has_users, updated_at)
      VALUES (?, ?, ?, ?)
    `);
  }

  function upsertGuildRow() {
    return database.prepare(`
      INSERT INTO bot_guilds (guild_id, state_json, has_users, updated_at)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(guild_id) DO UPDATE SET
        state_json = excluded.state_json,
        has_users = excluded.has_users,
        updated_at = excluded.updated_at
    `);
  }

  function insertGuildUserRow() {
    return database.prepare(`
      INSERT INTO bot_guild_users (guild_id, user_id, profile_json, updated_at)
      VALUES (?, ?, ?, ?)
    `);
  }

  function upsertGuildUserRow() {
    return database.prepare(`
      INSERT INTO bot_guild_users (guild_id, user_id, profile_json, updated_at)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(guild_id, user_id) DO UPDATE SET
        profile_json = excluded.profile_json,
        updated_at = excluded.updated_at
    `);
  }

  function insertGuildFeatureRow() {
    return database.prepare(`
      INSERT INTO bot_guild_features (guild_id, feature_key, state_json, has_users, updated_at)
      VALUES (?, ?, ?, ?, ?)
    `);
  }

  function upsertGuildFeatureRow() {
    return database.prepare(`
      INSERT INTO bot_guild_features (guild_id, feature_key, state_json, has_users, updated_at)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(guild_id, feature_key) DO UPDATE SET
        state_json = excluded.state_json,
        has_users = excluded.has_users,
        updated_at = excluded.updated_at
    `);
  }

  function insertGuildFeatureUserRow() {
    return database.prepare(`
      INSERT INTO bot_guild_feature_users (guild_id, feature_key, user_id, profile_json, updated_at)
      VALUES (?, ?, ?, ?, ?)
    `);
  }

  function upsertGuildFeatureUserRow() {
    return database.prepare(`
      INSERT INTO bot_guild_feature_users (guild_id, feature_key, user_id, profile_json, updated_at)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(guild_id, feature_key, user_id) DO UPDATE SET
        profile_json = excluded.profile_json,
        updated_at = excluded.updated_at
    `);
  }

  function deleteGlobalFeatureRow() {
    return database.prepare('DELETE FROM bot_global_features WHERE feature_key = ?');
  }

  function deleteGlobalFeatureUserRow() {
    return database.prepare('DELETE FROM bot_global_feature_users WHERE feature_key = ? AND user_id = ?');
  }

  function deleteGuildRow() {
    return database.prepare('DELETE FROM bot_guilds WHERE guild_id = ?');
  }

  function deleteGuildUserRow() {
    return database.prepare('DELETE FROM bot_guild_users WHERE guild_id = ? AND user_id = ?');
  }

  function deleteGuildFeatureRow() {
    return database.prepare('DELETE FROM bot_guild_features WHERE guild_id = ? AND feature_key = ?');
  }

  function deleteGuildFeatureUserRow() {
    return database.prepare('DELETE FROM bot_guild_feature_users WHERE guild_id = ? AND feature_key = ? AND user_id = ?');
  }

  async function load() {
    return queue.then(() => {
      initialize();
      return structuredClone(getCachedData());
    });
  }

  async function view(mutator) {
    return queue.then(() => {
      initialize();
      return mutator(structuredClone(getCachedData()));
    });
  }

  async function save(data) {
    const job = queue.then(async () => {
      initialize();

      database.exec('BEGIN IMMEDIATE');
      try {
        const normalizedData = writeNormalizedState(data);
        database.exec('COMMIT');
        cachedData = normalizedData;
        cachedStatePersisted = true;
      } catch (error) {
        database.exec('ROLLBACK');
        throw error;
      }
    });

    queue = job.catch(() => {});
    return job;
  }

  async function update(mutator) {
    const job = queue.then(async () => {
      initialize();
      database.exec('BEGIN IMMEDIATE');

      try {
        const data = structuredClone(getCachedData());
        const result = await mutator(data);
        const normalizedData = writeNormalizedState(data);
        database.exec('COMMIT');
        cachedData = normalizedData;
        cachedStatePersisted = true;
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
    cachedData = UNLOADED_CACHE;
    cachedStatePersisted = false;
  }

  return {
    load,
    view,
    save,
    update,
    close
  };
}

function collectNormalizedRows(value) {
  const rootType = getJsonType(value);
  const rows = {
    root: {
      rootType,
      rootJson: rootType === 'object' ? null : serializeJsonValue(value),
      hasGuilds: 0
    },
    globalFeatures: new Map(),
    globalFeatureUsers: new Map(),
    guilds: new Map(),
    guildUsers: new Map(),
    guildFeatures: new Map(),
    guildFeatureUsers: new Map()
  };

  if (rootType !== 'object') return rows;

  for (const [key, childValue] of Object.entries(value)) {
    if (key === 'guilds' && isPlainObject(childValue)) {
      rows.root.hasGuilds = 1;
      collectGuildRows(rows, childValue);
      continue;
    }

    collectGlobalFeatureRows(rows, key, childValue);
  }

  return rows;
}

function collectGlobalFeatureRows(rows, featureKey, featureValue) {
  const split = splitUsers(featureValue);
  rows.globalFeatures.set(featureKey, {
    featureKey,
    stateJson: serializeJsonValue(split.state),
    hasUsers: split.hasUsers ? 1 : 0
  });

  if (!split.hasUsers) return;

  for (const [userId, profile] of Object.entries(split.users)) {
    rows.globalFeatureUsers.set(compoundKey(featureKey, userId), {
      featureKey,
      userId,
      profileJson: serializeJsonValue(profile)
    });
  }
}

function collectGuildRows(rows, guilds) {
  for (const [guildId, guildValue] of Object.entries(guilds)) {
    if (!isPlainObject(guildValue)) {
      rows.guilds.set(guildId, {
        guildId,
        stateJson: serializeJsonValue(guildValue),
        hasUsers: 0
      });
      continue;
    }

    let hasUsers = 0;
    for (const [featureKey, featureValue] of Object.entries(guildValue)) {
      if (featureKey === 'users' && isPlainObject(featureValue)) {
        hasUsers = 1;
        for (const [userId, profile] of Object.entries(featureValue)) {
          rows.guildUsers.set(compoundKey(guildId, userId), {
            guildId,
            userId,
            profileJson: serializeJsonValue(profile)
          });
        }
        continue;
      }

      collectGuildFeatureRows(rows, guildId, featureKey, featureValue);
    }

    rows.guilds.set(guildId, {
      guildId,
      stateJson: '{}',
      hasUsers
    });
  }
}

function collectGuildFeatureRows(rows, guildId, featureKey, featureValue) {
  const split = splitUsers(featureValue);
  rows.guildFeatures.set(compoundKey(guildId, featureKey), {
    guildId,
    featureKey,
    stateJson: serializeJsonValue(split.state),
    hasUsers: split.hasUsers ? 1 : 0
  });

  if (!split.hasUsers) return;

  for (const [userId, profile] of Object.entries(split.users)) {
    rows.guildFeatureUsers.set(compoundKey(guildId, featureKey, userId), {
      guildId,
      featureKey,
      userId,
      profileJson: serializeJsonValue(profile)
    });
  }
}

function splitUsers(value) {
  if (!isPlainObject(value) || !isPlainObject(value.users)) {
    return {
      state: value,
      users: null,
      hasUsers: false
    };
  }

  const state = { ...value };
  const users = state.users;
  delete state.users;
  return {
    state,
    users,
    hasUsers: true
  };
}

function deleteMissingRows(previousRows, nextRows, statement) {
  for (const [key, previousRow] of previousRows.entries()) {
    if (!nextRows.has(key)) statement.run(...bindDeleteRow(previousRow));
  }
}

function upsertChangedRows(nextRows, previousRows, statement, bindRow, now) {
  for (const [key, row] of nextRows.entries()) {
    if (normalizedRowsEqual(row, previousRows.get(key))) continue;
    statement.run(...bindRow(row, now));
  }
}

function bindDeleteRow(row) {
  if ('userId' in row && 'featureKey' in row && 'guildId' in row) return [row.guildId, row.featureKey, row.userId];
  if ('featureKey' in row && 'userId' in row) return [row.featureKey, row.userId];
  if ('featureKey' in row && 'guildId' in row) return [row.guildId, row.featureKey];
  if ('userId' in row && 'guildId' in row) return [row.guildId, row.userId];
  if ('guildId' in row) return [row.guildId];
  if ('featureKey' in row) return [row.featureKey];
  throw new Error('Unknown normalized row key shape.');
}

function bindGlobalFeatureRow(row, now) {
  return [row.featureKey, row.stateJson, row.hasUsers, now];
}

function bindGlobalFeatureUserRow(row, now) {
  return [row.featureKey, row.userId, row.profileJson, now];
}

function bindGuildRow(row, now) {
  return [row.guildId, row.stateJson, row.hasUsers, now];
}

function bindGuildUserRow(row, now) {
  return [row.guildId, row.userId, row.profileJson, now];
}

function bindGuildFeatureRow(row, now) {
  return [row.guildId, row.featureKey, row.stateJson, row.hasUsers, now];
}

function bindGuildFeatureUserRow(row, now) {
  return [row.guildId, row.featureKey, row.userId, row.profileJson, now];
}

function rootRowsEqual(left, right) {
  return left?.rootType === right?.rootType
    && left?.rootJson === right?.rootJson
    && left?.hasGuilds === right?.hasGuilds;
}

function normalizedRowsEqual(left, right) {
  if (!left || !right) return false;
  return JSON.stringify(left) === JSON.stringify(right);
}

function deserializeLegacyNode(path, nodes, children) {
  const row = nodes.get(path);

  if (!row) {
    throw new Error(`SQLite state is missing node at path: ${path || '<root>'}`);
  }

  if (!JSON_TYPES.has(row.node_type)) {
    throw new Error(`Unsupported SQLite state node type: ${row.node_type}`);
  }

  switch (row.node_type) {
    case 'object':
      return Object.fromEntries((children.get(path) ?? [])
        .map((child) => [child.node_key, deserializeLegacyNode(child.path, nodes, children)]));

    case 'array': {
      const sortedChildren = [...(children.get(path) ?? [])].sort(compareArrayNodeKeys);
      const array = [];
      for (let index = 0; index < sortedChildren.length; index += 1) {
        const child = sortedChildren[index];
        const childIndex = Number(child.node_key);
        if (!Number.isSafeInteger(childIndex) || childIndex !== index) {
          throw new Error(`SQLite state array is sparse or out of order at path: ${path || '<root>'}.`);
        }
        array.push(deserializeLegacyNode(child.path, nodes, children));
      }
      return array;
    }

    case 'string':
      return row.text_value ?? '';

    case 'number':
      return Number(row.number_value);

    case 'boolean':
      return row.boolean_value === 1;

    case 'null':
      return null;

    default:
      throw new Error(`Unsupported SQLite state node type: ${row.node_type}`);
  }
}

function compareArrayNodeKeys(left, right) {
  return Number(left.node_key) - Number(right.node_key);
}

function assertDenseArray(value, path) {
  const indexKeys = Object.keys(value).filter(isArrayIndexKey);

  if (indexKeys.length !== value.length) {
    throw new Error(`SQLite store state contains a sparse array at ${path}.`);
  }
}

function isArrayIndexKey(key) {
  if (!/^(0|[1-9]\d*)$/.test(key)) return false;
  const index = Number(key);
  return Number.isSafeInteger(index) && index >= 0 && index < 2 ** 32 - 1;
}

function toJsonCompatibleData(data) {
  return normalizeJsonCompatibleValue(data, '<root>');
}

function normalizeJsonCompatibleValue(value, path) {
  if (value === null) return null;

  if (Array.isArray(value)) {
    assertDenseArray(value, path);

    const normalized = [];
    for (let index = 0; index < value.length; index += 1) {
      normalized.push(normalizeJsonCompatibleValue(value[index], `${path}[${index}]`));
    }
    return normalized;
  }

  switch (typeof value) {
    case 'string':
    case 'boolean':
      return value;

    case 'number':
      if (!Number.isFinite(value)) {
        throw new Error(`SQLite store state contains a non-finite number at ${path}.`);
      }
      return value;

    case 'object': {
      const normalized = {};
      for (const [key, childValue] of Object.entries(value)) {
        normalized[key] = normalizeJsonCompatibleValue(childValue, `${path}.${key}`);
      }
      return normalized;
    }

    default:
      throw new Error(`SQLite store state contains unsupported value type ${typeof value} at ${path}.`);
  }
}

function getJsonType(value) {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';

  const type = typeof value;
  if (JSON_TYPES.has(type)) return type;

  throw new Error(`Unsupported SQLite state value type: ${type}`);
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function assertPlainObject(value, label) {
  if (!isPlainObject(value)) {
    throw new Error(`SQLite normalized state expected object at ${label}.`);
  }
}

function serializeJsonValue(value) {
  return JSON.stringify(value);
}

function parseJsonValue(value, label) {
  try {
    return JSON.parse(value);
  } catch (error) {
    throw new Error(`SQLite normalized state contains invalid JSON at ${label}: ${error.message}`);
  }
}

function compoundKey(...parts) {
  return parts.map((part) => String(part).replaceAll('\\', '\\\\').replaceAll('\u0000', '\\0')).join('\u0000');
}
