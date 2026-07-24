'use client'

import { Client, schemas } from '@polar-sh/client'
import { List, ListItem, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { BenefitGrant } from '../Benefit/BenefitGrant'

export interface CustomerPortalGrantsSimpleProps {
  benefitGrants: schemas['CustomerBenefitGrant'][]
  api: Client
}

export const CustomerPortalGrantsSimple = ({
  api,
  benefitGrants,
}: CustomerPortalGrantsSimpleProps) => {
  return (
    <Box width="100%" flexDirection="column" rowGap="l">
      <Text variant="heading-xs" as="h3">
        Benefit grants
      </Text>
      <List>
        {benefitGrants?.map((benefitGrant) => (
          <ListItem
            key={benefitGrant.id}
            className="py-6 hover:bg-transparent dark:hover:bg-transparent"
          >
            <BenefitGrant api={api} benefitGrant={benefitGrant} />
          </ListItem>
        ))}
      </List>
    </Box>
  )
}
