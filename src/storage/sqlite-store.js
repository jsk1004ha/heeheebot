import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

const DEFAULT_DATA = Object.freeze({
  guilds: {}
});

const LEGACY_STATE_KEY = 'state';
const SCHEMA_VERSION = 2;
const NODE_TYPES = new Set(['object', 'array', 'string', 'number', 'boolean', 'null']);
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
    database.exec(`
      CREATE TABLE IF NOT EXISTS bot_storage_metadata (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS bot_state_nodes (
        path TEXT PRIMARY KEY,
        parent_path TEXT,
        node_key TEXT,
        node_type TEXT NOT NULL CHECK (node_type IN ('object', 'array', 'string', 'number', 'boolean', 'null')),
        text_value TEXT,
        number_value REAL,
        boolean_value INTEGER CHECK (boolean_value IN (0, 1) OR boolean_value IS NULL),
        updated_at INTEGER NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_bot_state_nodes_parent
        ON bot_state_nodes(parent_path);
    `);

    saveMetadata('schema_version', String(SCHEMA_VERSION));
    migrateLegacySqliteBlobIfNeeded();
    migrateJsonFileIfNeeded();
    return database;
  }

  function migrateLegacySqliteBlobIfNeeded() {
    if (hasSqlState() || !tableExists('bot_state')) return;

    const raw = database
      .prepare('SELECT value FROM bot_state WHERE key = ?')
      .get(LEGACY_STATE_KEY)?.value;

    if (!raw) return;

    database.exec('BEGIN IMMEDIATE');
    try {
      cachedData = writeSqlState(JSON.parse(raw));
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
    if (!migrateFromJsonPath || !existsSync(migrateFromJsonPath) || hasSqlState()) return;

    const migrated = JSON.parse(readFileSync(migrateFromJsonPath, 'utf8'));

    database.exec('BEGIN IMMEDIATE');
    try {
      cachedData = writeSqlState(migrated);
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

  function hasSqlState() {
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

  function loadSqlState() {
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
      data: deserializeNode('', nodes, children)
    };
  }

  function getCachedData() {
    if (cachedData !== UNLOADED_CACHE) return cachedData;

    const state = loadSqlState();
    cachedData = state.found ? state.data : structuredClone(initialData);
    cachedStatePersisted = state.found;
    return cachedData;
  }

  function writeSqlState(data) {
    const normalizedData = toJsonCompatibleData(data);

    if (cachedData !== UNLOADED_CACHE && cachedStatePersisted) {
      writeSqlStateDelta(normalizedData, cachedData);
    } else {
      writeSqlStateFull(normalizedData);
    }

    return normalizedData;
  }

  function writeSqlStateFull(normalizedData) {
    const now = Date.now();
    const insertNode = database.prepare(`
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

    database.prepare('DELETE FROM bot_state_nodes').run();
    serializeNode(normalizedData, {
      path: '',
      parentPath: null,
      nodeKey: null,
      now,
      insertNode
    });
  }

  function writeSqlStateDelta(nextData, previousData) {
    const now = Date.now();
    const previousRows = collectSerializedRows(previousData);
    const nextRows = collectSerializedRows(nextData);
    const deleteNode = database.prepare('DELETE FROM bot_state_nodes WHERE path = ?');
    const upsertNode = database.prepare(`
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
      ON CONFLICT(path) DO UPDATE SET
        parent_path = excluded.parent_path,
        node_key = excluded.node_key,
        node_type = excluded.node_type,
        text_value = excluded.text_value,
        number_value = excluded.number_value,
        boolean_value = excluded.boolean_value,
        updated_at = excluded.updated_at
    `);

    for (const path of previousRows.keys()) {
      if (!nextRows.has(path)) {
        deleteNode.run(path);
      }
    }

    for (const [path, row] of nextRows.entries()) {
      if (serializedRowsEqual(row, previousRows.get(path))) continue;

      upsertNode.run(
        row.path,
        row.parentPath,
        row.nodeKey,
        row.nodeType,
        row.textValue,
        row.numberValue,
        row.booleanValue,
        now
      );
    }
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
        const normalizedData = writeSqlState(data);
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
        const normalizedData = writeSqlState(data);
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

function collectSerializedRows(value) {
  const rows = new Map();
  collectSerializedNode(value, {
    path: '',
    parentPath: null,
    nodeKey: null,
    rows
  });
  return rows;
}

function collectSerializedNode(value, {
  path,
  parentPath,
  nodeKey,
  rows
}) {
  const nodeType = getNodeType(value);
  rows.set(path, {
    path,
    parentPath,
    nodeKey,
    nodeType,
    textValue: nodeType === 'string' ? value : null,
    numberValue: nodeType === 'number' ? value : null,
    booleanValue: nodeType === 'boolean' ? Number(value) : null
  });

  if (nodeType === 'array') {
    value.forEach((item, index) => {
      const childKey = String(index);
      collectSerializedNode(item, {
        path: joinPointerPath(path, childKey),
        parentPath: path,
        nodeKey: childKey,
        rows
      });
    });
    return;
  }

  if (nodeType === 'object') {
    for (const [childKey, childValue] of Object.entries(value)) {
      collectSerializedNode(childValue, {
        path: joinPointerPath(path, childKey),
        parentPath: path,
        nodeKey: childKey,
        rows
      });
    }
  }
}

function serializedRowsEqual(left, right) {
  if (!left || !right) return false;
  return left.parentPath === right.parentPath
    && left.nodeKey === right.nodeKey
    && left.nodeType === right.nodeType
    && left.textValue === right.textValue
    && left.numberValue === right.numberValue
    && left.booleanValue === right.booleanValue;
}

function serializeNode(value, {
  path,
  parentPath,
  nodeKey,
  now,
  insertNode
}) {
  const nodeType = getNodeType(value);

  insertNode.run(
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
      serializeNode(item, {
        path: joinPointerPath(path, childKey),
        parentPath: path,
        nodeKey: childKey,
        now,
        insertNode
      });
    });
    return;
  }

  if (nodeType === 'object') {
    for (const [childKey, childValue] of Object.entries(value)) {
      serializeNode(childValue, {
        path: joinPointerPath(path, childKey),
        parentPath: path,
        nodeKey: childKey,
        now,
        insertNode
      });
    }
  }
}

function deserializeNode(path, nodes, children) {
  const row = nodes.get(path);

  if (!row) {
    throw new Error(`SQLite state is missing node at path: ${path || '<root>'}`);
  }

  if (!NODE_TYPES.has(row.node_type)) {
    throw new Error(`Unsupported SQLite state node type: ${row.node_type}`);
  }

  switch (row.node_type) {
    case 'object':
      return Object.fromEntries((children.get(path) ?? [])
        .map((child) => [child.node_key, deserializeNode(child.path, nodes, children)]));

    case 'array': {
      const sortedChildren = [...(children.get(path) ?? [])].sort(compareArrayNodeKeys);
      const array = [];
      for (let index = 0; index < sortedChildren.length; index += 1) {
        const child = sortedChildren[index];
        const childIndex = Number(child.node_key);
        if (!Number.isSafeInteger(childIndex) || childIndex !== index) {
          throw new Error(`SQLite state array is sparse or out of order at path: ${path || '<root>'}.`);
        }
        array.push(deserializeNode(child.path, nodes, children));
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

function getNodeType(value) {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';

  const type = typeof value;
  if (type === 'object' || type === 'string' || type === 'number' || type === 'boolean') {
    return type;
  }

  throw new Error(`Unsupported SQLite state value type: ${type}`);
}

function joinPointerPath(parentPath, key) {
  const segment = String(key)
    .replaceAll('~', '~0')
    .replaceAll('/', '~1');

  return parentPath ? `${parentPath}/${segment}` : `/${segment}`;
}
