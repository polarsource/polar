import type { models, Polar } from '../../sdk'
import type { MemberIdentifier } from './utils'

export const findBenefitGrant = async (
  sdk: Polar,
  identifier: MemberIdentifier,
  benefitId: string,
): Promise<models.BenefitGrant | undefined> => {
  const customerId =
    'customer_id' in identifier
      ? identifier.customer_id
      : (await sdk.customers.getExternal(identifier.external_customer_id)).id

  for await (const grant of sdk.benefits.iterGrants(benefitId, {
    customer_id: customerId,
    is_granted: true,
  })) {
    if (
      identifier.member_id !== undefined
        ? grant.member_id === identifier.member_id
        : identifier.external_member_id !== undefined
          ? grant.member?.external_id === identifier.external_member_id
          : true
    ) {
      return grant
    }
  }
  return undefined
}
