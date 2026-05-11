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
      writeSqlState(JSON.parse(raw));
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
      writeSqlState(migrated);
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

  function writeSqlState(data) {
    const normalizedData = toJsonCompatibleData(data);
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

  async function load() {
    initialize();

    const state = loadSqlState();
    if (!state.found) return structuredClone(initialData);

    return state.data;
  }

  async function save(data) {
    initialize();

    database.exec('BEGIN IMMEDIATE');
    try {
      writeSqlState(data);
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
        const state = loadSqlState();
        const data = state.found ? state.data : structuredClone(initialData);
        const result = await mutator(data);
        writeSqlState(data);
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
