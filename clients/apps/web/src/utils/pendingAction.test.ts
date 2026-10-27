import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { z } from 'zod'
import { createPendingActionStore } from './pendingAction'

const store = createPendingActionStore({
  keyPrefix: 'polar:test:v1:',
  resumeParam: 'resume_test',
  payloadSchema: z.object({ code: z.string() }),
})

describe('createPendingActionStore', () => {
  beforeEach(() => {
    sessionStorage.clear()
    vi.useFakeTimers({ toFake: ['Date'] })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns the payload once, to the same user and resource', () => {
    const actionId = store.save('resource_1', 'user_1', { code: '123456' })

    expect(actionId).not.toBeNull()
    expect(store.take(actionId!, 'resource_1', 'user_1')).toEqual({
      code: '123456',
    })
    expect(store.take(actionId!, 'resource_1', 'user_1')).toBeNull()
    expect(sessionStorage).toHaveLength(0)
  })

  it('returns nothing for a missing entry', () => {
    expect(store.take('unknown', 'resource_1', 'user_1')).toBeNull()
  })

  it.each([
    ['another user', 'resource_1', 'user_2'],
    ['another resource', 'resource_2', 'user_1'],
  ])('refuses %s, and still removes the entry', (_, resourceId, userId) => {
    const actionId = store.save('resource_1', 'user_1', { code: '123456' })!

    expect(store.take(actionId, resourceId, userId)).toBeNull()
    expect(sessionStorage).toHaveLength(0)
  })

  it.each([
    ['an expired entry', 15 * 60 * 1000 + 1],
    ['an entry from the future', -60_000 - 1],
  ])('refuses %s', (_, ageMs) => {
    const actionId = store.save('resource_1', 'user_1', { code: '123456' })!
    vi.setSystemTime(Date.now() + ageMs)

    expect(store.take(actionId, 'resource_1', 'user_1')).toBeNull()
    expect(sessionStorage).toHaveLength(0)
  })

  it('refuses a malformed entry', () => {
    sessionStorage.setItem('polar:test:v1:broken', '{not json')

    expect(store.take('broken', 'resource_1', 'user_1')).toBeNull()
    expect(sessionStorage).toHaveLength(0)
  })

  it('adds the action to the current URL as the resume path', () => {
    window.history.replaceState(null, '', '/page?token=abc')

    expect(store.getResumePath('action_1')).toBe(
      '/page?token=abc&resume_test=action_1',
    )
    window.history.replaceState(null, '', '/')
  })
})
