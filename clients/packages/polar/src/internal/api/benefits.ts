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

export const assertBenefitDeployed = async (
  sdk: Polar,
  externalId: string,
): Promise<void> => {
  let matches = 0
  for await (const benefit of sdk.benefits.iterList({})) {
    if (benefit.external_id === externalId) matches += 1
  }
  if (matches > 1) {
    throw new Error(
      `Benefit external ID ${JSON.stringify(externalId)} is ambiguous. Use an organization-scoped token.`,
    )
  }
  if (matches === 0) {
    throw new Error(
      `Benefit ${JSON.stringify(externalId)} is not deployed in this environment.`,
    )
  }
}
