import { describe, expect, it, vi } from 'vitest'
import {
  getIpAddressFromHeaders,
  isValidIpAddress,
  resolveCustomerIpAddress,
} from './ipAddress'

describe('isValidIpAddress', () => {
  it.each(['203.0.113.7', '0.0.0.0', '2001:db8::1', '::1', '::ffff:192.0.2.1'])(
    'accepts %s',
    (value) => {
      expect(isValidIpAddress(value)).toBe(true)
    },
  )

  it.each([
    '',
    'unknown',
    '256.0.0.1',
    '1.2.3',
    '01.2.3.4',
    '2001:db8::1::1',
    '203.0.113.7, 10.0.0.1',
    'localhost',
  ])('rejects %j', (value) => {
    expect(isValidIpAddress(value)).toBe(false)
  })
})

describe('getIpAddressFromHeaders', () => {
  it('uses the first x-forwarded-for entry', () => {
    expect(
      getIpAddressFromHeaders(
        new Headers({
          'x-forwarded-for': ' 203.0.113.7 , 10.0.0.1',
          'x-real-ip': '198.51.100.1',
        }),
      ),
    ).toBe('203.0.113.7')
  })

  it.each([
    [{ 'x-real-ip': '198.51.100.1' }, '198.51.100.1'],
    [{ 'cf-connecting-ip': '2001:db8::1' }, '2001:db8::1'],
    [
      { 'x-forwarded-for': 'unknown', 'x-real-ip': '198.51.100.1' },
      '198.51.100.1',
    ],
    [{ 'x-forwarded-for': 'unknown' }, undefined],
    [{}, undefined],
  ])('resolves %j to %s', (headers, expected) => {
    expect(getIpAddressFromHeaders(new Headers(headers))).toBe(expected)
  })
})

describe('resolveCustomerIpAddress', () => {
  const request = { id: 'request' }
  const headers = new Headers({ 'x-forwarded-for': '203.0.113.7' })

  it('resolves from headers by default', async () => {
    expect(await resolveCustomerIpAddress(request, headers, undefined)).toBe(
      '203.0.113.7',
    )
  })

  it('returns undefined when disabled', async () => {
    expect(
      await resolveCustomerIpAddress(request, headers, false),
    ).toBeUndefined()
  })

  it('uses a custom resolver with the request', async () => {
    const resolver = vi.fn().mockResolvedValue('192.0.2.10')

    expect(await resolveCustomerIpAddress(request, headers, resolver)).toBe(
      '192.0.2.10',
    )
    expect(resolver).toHaveBeenCalledWith(request)
  })

  it.each(['not-an-ip', '', null, undefined])(
    'omits invalid resolver value %j',
    async (value) => {
      expect(
        await resolveCustomerIpAddress(request, headers, () => value),
      ).toBeUndefined()
    },
  )
})
