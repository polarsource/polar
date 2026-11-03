import type { models, Polar } from '../../sdk'
import type { MemberIdentifier } from './utils'

export const findBenefitGrant = async (
  sdk: Polar,
  identifier: MemberIdentifier,
  externalBenefitId: string,
): Promise<models.BenefitGrant | undefined> => {
  const { items } = await sdk.benefitGrants.list({
    ...identifier,
    external_benefit_id: externalBenefitId,
    is_granted: true,
    limit: 1,
  })
  return items[0]
}
