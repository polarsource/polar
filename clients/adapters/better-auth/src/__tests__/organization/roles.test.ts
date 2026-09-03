import { describe, expect, it } from 'vitest'
import { mapBetterAuthRoleToPolar } from '../../organization/roles'

describe('mapBetterAuthRoleToPolar', () => {
  it('maps the canonical owner to owner', () => {
    expect(
      mapBetterAuthRoleToPolar({
        role: 'member',
        isCanonicalOwner: true,
      }),
    ).toBe('owner')
  })

  it('maps an additional Better Auth owner to billing manager', () => {
    expect(
      mapBetterAuthRoleToPolar({
        role: 'owner',
        isCanonicalOwner: false,
      }),
    ).toBe('billing_manager')
  })

  it('maps an admin or multi-role admin to billing manager', () => {
    expect(
      mapBetterAuthRoleToPolar({
        role: 'member, admin',
        isCanonicalOwner: false,
      }),
    ).toBe('billing_manager')
  })

  it('maps ordinary and unknown roles to member', () => {
    expect(
      mapBetterAuthRoleToPolar({
        role: 'developer',
        isCanonicalOwner: false,
      }),
    ).toBe('member')
  })

  it('supports custom creator and billing manager roles', () => {
    expect(
      mapBetterAuthRoleToPolar(
        { role: 'founder', isCanonicalOwner: false },
        { creatorRole: 'founder' },
      ),
    ).toBe('billing_manager')

    expect(
      mapBetterAuthRoleToPolar(
        { role: 'finance', isCanonicalOwner: false },
        { billingManagerRoles: ['finance'] },
      ),
    ).toBe('billing_manager')
  })
})
