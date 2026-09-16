import assert from 'node:assert/strict'
import { test } from 'node:test'
import { IdTokenValidationMethod } from 'ltijs'
import { SqliteDatabaseManager } from './sqlite-database-manager.ts'

test('SqliteDatabaseManager', async () => {
  const db = new SqliteDatabaseManager(':memory:')
  await db.listen()
  const platform = {
    url: 'https://moodle', clientId: 'a', name: 'M', authenticationEndpoint: 'x', accessTokenEndpoint: 'y',
    idTokenValidation: { method: IdTokenValidationMethod.JwkSet, key: 'k' }, active: true, keys: { public: 'p', private: 's' },
  }
  const id = await db.savePlatform(platform)
  await db.savePlatform({ ...platform, clientId: 'b' })
  await assert.rejects(db.savePlatform(platform)) // url + clientId unique
  assert.equal((await db.getPlatforms({ clientId: ['a', 'b'] })).length, 2)
  assert.equal((await db.getPlatforms({ url: 'https://moodle', clientId: [] })).length, 0)
  await Promise.all([db.updatePlatformById(id, { active: false }), db.updatePlatformById(id, { name: 'N' })])
  assert.deepEqual(await db.getPlatformByUrlAndClientId('https://moodle', 'a'), { ...platform, active: false, name: 'N', id })
  await db.deletePlatformById(id)
  assert.equal(await db.getPlatformById(id), undefined)

  await db.saveNonce('n')
  assert.equal(await db.consumeNonce('n'), true)
  assert.equal(await db.consumeNonce('n'), false)

  const tokenId = await db.saveIdToken({ iss: 'i' } as any)
  assert.equal((await db.getIdToken(tokenId))?.iss, 'i')
  await db.close()
})
