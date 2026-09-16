// ltijs DatabaseManager backed by Node's built-in SQLite (node:sqlite), replacing the default MongoDB one.
// Records are stored as JSON blobs; Mongo's TTL indexes are emulated by filtering (and pruning) on createdAt.

import { mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import { randomUUID } from 'node:crypto'
import { DatabaseSync } from 'node:sqlite'
import type {
  AccessTokenRecord,
  DatabaseManager,
  IdTokenClaims,
  IdTokenRecord,
  PlatformAttributes,
  PlatformFilter,
  PlatformRecord,
} from 'ltijs'

const NONCE_TTL_MS = 10 * 60 * 1000
const ID_TOKEN_TTL_MS = 24 * 60 * 60 * 1000

export class SqliteDatabaseManager implements DatabaseManager {
  #path: string
  #db: DatabaseSync | undefined

  constructor(path: string) {
    this.#path = path
  }

  get db(): DatabaseSync {
    if (this.#db === undefined) throw new Error('Database not connected, call listen() first')
    return this.#db
  }

  async listen() {
    if (this.#path !== ':memory:') mkdirSync(dirname(this.#path), { recursive: true })
    // Wait for another process's write lock (e.g. the register-platform CLI) instead of failing with SQLITE_BUSY.
    this.#db = new DatabaseSync(this.#path, { timeout: 5000 })
    this.#db.exec(`
      PRAGMA journal_mode = WAL;
      CREATE TABLE IF NOT EXISTS platforms (id TEXT PRIMARY KEY, data TEXT NOT NULL);
      CREATE UNIQUE INDEX IF NOT EXISTS platforms_url_client_id ON platforms (data->>'url', data->>'clientId');
      CREATE TABLE IF NOT EXISTS access_tokens (
        platform_url TEXT, client_id TEXT, scopes TEXT, data TEXT NOT NULL,
        PRIMARY KEY (platform_url, client_id, scopes)
      );
      CREATE TABLE IF NOT EXISTS id_tokens (id TEXT PRIMARY KEY, data TEXT NOT NULL, created_at INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS nonces (nonce TEXT PRIMARY KEY, created_at INTEGER NOT NULL);
    `)
  }

  async close() {
    this.#db?.close()
    this.#db = undefined
  }

  async getPlatforms(filter: PlatformFilter = {}) {
    const where: string[] = []
    const params: string[] = []
    for (const key of ['url', 'name'] as const) {
      if (filter[key] === undefined) continue
      where.push(`data->>'${key}' = ?`)
      params.push(filter[key])
    }
    if (filter.clientId !== undefined) {
      const ids = [filter.clientId].flat()
      where.push(`data->>'clientId' IN (${ids.map(() => '?').join(', ') || 'NULL'})`)
      params.push(...ids)
    }
    const sql = `SELECT id, data FROM platforms${where.length ? ` WHERE ${where.join(' AND ')}` : ''}`
    return this.db.prepare(sql).all(...params).map(toPlatform)
  }

  async getPlatformById(id: string) {
    const row = this.db.prepare('SELECT id, data FROM platforms WHERE id = ?').get(id)
    return row && toPlatform(row)
  }

  async getPlatformByUrlAndClientId(url: string, clientId: string) {
    const row = this.db
      .prepare(`SELECT id, data FROM platforms WHERE data->>'url' = ? AND data->>'clientId' = ?`)
      .get(url, clientId)
    return row && toPlatform(row)
  }

  async savePlatform(platform: PlatformAttributes) {
    const id = randomUUID()
    this.db.prepare('INSERT INTO platforms (id, data) VALUES (?, ?)').run(id, JSON.stringify(platform))
    return id
  }

  async updatePlatformById(id: string, fields: Partial<PlatformAttributes>) {
    // Single statement, so concurrent updates can't overwrite each other (a read + await + write could).
    this.db.prepare('UPDATE platforms SET data = json_patch(data, ?) WHERE id = ?').run(JSON.stringify(fields), id)
  }

  async deletePlatformById(id: string) {
    this.db.prepare('DELETE FROM platforms WHERE id = ?').run(id)
  }

  // Expiry is checked by ltijs itself (createdAt + expires_in), so no TTL is needed here.
  async getAccessToken(platformUrl: string, clientId: string, scopes: string) {
    const row = this.db
      .prepare('SELECT data FROM access_tokens WHERE platform_url = ? AND client_id = ? AND scopes = ?')
      .get(platformUrl, clientId, scopes)
    return row && (JSON.parse(row.data as string) as AccessTokenRecord)
  }

  async saveAccessToken(platformUrl: string, clientId: string, scopes: string, token: AccessTokenRecord) {
    this.db
      .prepare('INSERT OR REPLACE INTO access_tokens (platform_url, client_id, scopes, data) VALUES (?, ?, ?, ?)')
      .run(platformUrl, clientId, scopes, JSON.stringify(token))
    return JSON.stringify([platformUrl, clientId, scopes])
  }

  async getIdToken(id: string) {
    const row = this.db
      .prepare('SELECT data FROM id_tokens WHERE id = ? AND created_at > ?')
      .get(id, Date.now() - ID_TOKEN_TTL_MS)
    return row && ({ ...JSON.parse(row.data as string), id } as IdTokenRecord)
  }

  async saveIdToken(token: IdTokenClaims) {
    const id = randomUUID()
    const now = Date.now()
    this.db.prepare('DELETE FROM id_tokens WHERE created_at <= ?').run(now - ID_TOKEN_TTL_MS)
    this.db.prepare('INSERT INTO id_tokens (id, data, created_at) VALUES (?, ?, ?)').run(id, JSON.stringify(token), now)
    return id
  }

  async saveNonce(nonce: string) {
    const now = Date.now()
    this.db.prepare('DELETE FROM nonces WHERE created_at <= ?').run(now - NONCE_TTL_MS)
    this.db.prepare('INSERT OR REPLACE INTO nonces (nonce, created_at) VALUES (?, ?)').run(nonce, now)
    return nonce
  }

  async consumeNonce(nonce: string) {
    const { changes } = this.db
      .prepare('DELETE FROM nonces WHERE nonce = ? AND created_at > ?')
      .run(nonce, Date.now() - NONCE_TTL_MS)
    return changes > 0
  }
}

function toPlatform(row: Record<string, unknown>): PlatformRecord {
  return { ...JSON.parse(row.data as string), id: row.id as string }
}
