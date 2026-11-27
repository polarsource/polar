import { describe, expect, it } from 'vitest'
import { getPortalSignInRedirect } from './customerPortal'

describe('getPortalSignInRedirect', () => {
  it.each([
    [undefined, '/acme/portal/'],
    ['/acme/portal/orders/123?tab=1', '/acme/portal/orders/123?tab=1'],
    ['/other/portal/', '/acme/portal/'],
    ['https://evil.com/acme/portal/', '/acme/portal/'],
    ['//evil.com/acme/portal/', '/acme/portal/'],
    ['/acme/portal/../../dashboard', '/acme/portal/'],
    ['/acme/portal/../../other/portal/', '/acme/portal/'],
    ['/acme/portal/%2e%2e/%2e%2e/dashboard', '/acme/portal/'],
    ['/acme/portal/..\\..\\dashboard', '/acme/portal/'],
  ])('%s -> %s', (returnTo, expected) => {
    expect(getPortalSignInRedirect('acme', returnTo)).toBe(expected)
  })
})
