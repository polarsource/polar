import { describe, expect, it } from 'vitest'
import { getCustomerIpAddress, resolveCustomerIpAddress } from './ipAddress'

describe('getCustomerIpAddress', () => {
  it.each([
    [{ 'x-forwarded-for': '203.0.113.7, 10.0.0.1' }, '203.0.113.7'],
    [
      { 'x-forwarded-for': 'unknown', 'x-real-ip': '2001:db8::1' },
      '2001:db8::1',
    ],
    [{ 'cf-connecting-ip': '198.51.100.1' }, '198.51.100.1'],
    [{ 'x-real-ip': '256.0.0.1' }, undefined],
    [{}, undefined],
  ])('resolves %j to %s', (headers, expected) => {
    expect(getCustomerIpAddress(new Headers(headers))).toBe(expected)
  })
})

describe('resolveCustomerIpAddress', () => {
  it.each([
    [undefined, '203.0.113.7'],
    [async () => '192.0.2.10', '192.0.2.10'],
    [() => null, undefined],
    [false as const, undefined],
  ])('resolves option %s to %s', async (option, expected) => {
    expect(
      await resolveCustomerIpAddress({}, option, () => '203.0.113.7'),
    ).toBe(expected)
  })
})
