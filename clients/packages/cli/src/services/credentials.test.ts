import { expect, test } from 'bun:test'
import { Effect, Redacted, Schema } from 'effect'
import { Session } from '../schemas/Auth'
import { decodeSession } from './credentials'

test.each([null, undefined])(
  'normalizes missing keyring value %s',
  async (value) => {
    expect(await Effect.runPromise(decodeSession(value))).toBeUndefined()
  },
)

test('round-trips versioned sessions with redacted credentials', async () => {
  const session: Session = {
    version: 1,
    accessToken: Redacted.make('access-secret'),
    refreshToken: Redacted.make('refresh-secret'),
    expiresAt: 123,
    scopes: ['organizations:read'],
    organization: { id: 'org', name: 'Name', slug: 'name' },
  }
  const encoded = await Effect.runPromise(
    Schema.encodeEffect(Schema.fromJsonString(Session))(session),
  )
  const decoded = await Effect.runPromise(decodeSession(encoded))
  expect(Redacted.value(decoded!.accessToken)).toBe('access-secret')
  expect(Redacted.value(decoded!.refreshToken!)).toBe('refresh-secret')
  expect(decoded?.organization).toEqual(session.organization)
  expect(JSON.stringify(decoded)).not.toContain('secret')
})

test.each([
  '',
  '{invalid',
  '{"version":2,"accessToken":"secret"}',
  '{"version":1}',
])('rejects corrupt records without exposing their contents', async (value) => {
  const result = await Effect.runPromise(
    decodeSession(value).pipe(Effect.result),
  )
  expect(result._tag).toBe('Failure')
  if (result._tag === 'Failure') {
    expect(result.failure.message).toContain('corrupt or unsupported')
    expect(JSON.stringify(result.failure)).not.toContain('secret')
  }
})
