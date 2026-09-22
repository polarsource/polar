import { createVoid, IDENTITY_HEADER, VoidError } from '@void/sdk'
import { afterAll, describe, expect, it } from 'vitest'
import { ambientLesson } from './ambient'
import { config } from './identities'

/** No request is ever made: every call here is answered from the client's own context. */
const client = createVoid(config, { apiUrl: 'http://127.0.0.1:1', token: 't' })
const other = createVoid(config, { apiUrl: 'http://127.0.0.1:1', token: 't' })

afterAll(async () => {
  await Promise.all([client.dispose(), other.dispose()])
})

describe('ambient chapter', () => {
  it('has no actor outside a run', () => {
    expect(client.ambient()).toBeUndefined()
    expect(() => client.current()).toThrow(VoidError)
    expect(() => client.current()).toThrow(/no identity in scope/)
  })

  it('nests and restores, and keeps concurrent runs apart', async () => {
    await client.as('alice').run(
      async () => {
        expect(client.ambient()).toEqual({
          id: 'alice',
          tags: { feature: 'chat' },
        })
        await client.as('nightly').run(async () => {
          expect(client.current().id).toBe('nightly')
        })
        expect(client.current().id).toBe('alice')
        expect(other.ambient()).toBeUndefined()
      },
      { feature: 'chat' },
    )
    const seen = await Promise.all([
      client.as('alice').run(async () => {
        await new Promise((r) => setTimeout(r, 5))
        return client.current().id
      }),
      client.as('bob').run(() => client.current().id),
    ])
    expect(seen).toEqual(['alice', 'bob'])
  })

  it('carries the identity in one header', () => {
    expect(client.as('alice').headers()).toEqual({ [IDENTITY_HEADER]: 'alice' })
    expect(client.from({ [IDENTITY_HEADER]: 'alice' }).id).toBe('alice')
    expect(client.from(new Headers({ [IDENTITY_HEADER]: 'bob' })).id).toBe(
      'bob',
    )
    expect(() => client.from({})).toThrow(VoidError)
  })

  it('names the real header in the code it shows', () => {
    const shown = ambientLesson.steps.find((s) => s.id === 'headers')!.code!
    expect(shown).toContain(IDENTITY_HEADER)
  })
})
