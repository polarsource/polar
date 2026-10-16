'use client'

import { Client, schemas } from '@polar-sh/client'
import { Box } from '@polar-sh/orbit/Box'
import { BenefitGrant } from '../Benefit/BenefitGrant'
import { PortalCard, PortalCardList, PortalSection } from './PortalPrimitives'

export interface CustomerPortalGrantsSimpleProps {
  benefitGrants: schemas['CustomerBenefitGrant'][]
  api: Client
}

export const CustomerPortalGrantsSimple = ({
  api,
  benefitGrants,
}: CustomerPortalGrantsSimpleProps) => {
  return (
    <PortalSection title="Benefits">
      <PortalCardList>
        {benefitGrants.map((benefitGrant) => (
          <Box as="li" display="block" key={benefitGrant.id}>
            <PortalCard>
              <BenefitGrant
                api={api}
                benefitGrant={benefitGrant}
                allowLicenseKeyRotation={true}
              />
            </PortalCard>
          </Box>
        ))}
      </PortalCardList>
    </PortalSection>
  )
}
