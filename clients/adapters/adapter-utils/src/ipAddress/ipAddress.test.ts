import { describe, expect, it } from 'vitest'
import { resolveCustomerIpAddress } from './ipAddress'

describe('resolveCustomerIpAddress', () => {
  it.each([
    [{ 'x-forwarded-for': '203.0.113.7, 10.0.0.1' }, '203.0.113.7'],
    [
      { 'x-forwarded-for': 'unknown', 'x-real-ip': '2001:db8::1' },
      '2001:db8::1',
    ],
    [{ 'cf-connecting-ip': '198.51.100.1' }, '198.51.100.1'],
    [{ 'x-real-ip': '256.0.0.1' }, undefined],
    [{}, undefined],
  ])('resolves headers %j to %s', async (headers, expected) => {
    expect(
      await resolveCustomerIpAddress({}, new Headers(headers), undefined),
    ).toBe(expected)
  })

  it.each([
    [() => '192.0.2.10', '192.0.2.10'],
    [() => 'not-an-ip', undefined],
    [false as const, undefined],
  ])('resolves with resolver %s to %s', async (resolver, expected) => {
    const headers = new Headers({ 'x-forwarded-for': '203.0.113.7' })
    expect(await resolveCustomerIpAddress({}, headers, resolver)).toBe(expected)
  })
})
