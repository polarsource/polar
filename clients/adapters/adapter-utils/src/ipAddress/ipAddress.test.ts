import { describe, expect, it } from 'vitest'
import { getCustomerIpAddress } from './ipAddress'

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
