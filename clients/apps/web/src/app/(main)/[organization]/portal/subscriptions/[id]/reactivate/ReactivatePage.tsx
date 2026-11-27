'use client'

import { PortalBackLink } from '@/components/CustomerPortal/PortalPrimitives'
import { ReactivateSubscription } from '@/components/CustomerPortal/ReactivateSubscription/ReactivateSubscription'
import { createClientSideAPI } from '@/utils/client'
import { schemas } from '@polar-sh/client'
import { Avatar, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { useSearchParams } from 'next/navigation'
import { PoweredByPolar } from '../../../PortalShell'

const ReactivatePage = ({
  organization,
  subscription,
  order,
  customerSessionToken,
}: {
  organization: schemas['CustomerOrganization']
  subscription: schemas['CustomerSubscription']
  order: schemas['CustomerOrder'] | null
  customerSessionToken: string
}) => {
  const searchParams = useSearchParams()
  const api = createClientSideAPI(customerSessionToken)
  return (
    <Box
      minHeight="100vh"
      width="100%"
      justifyContent="center"
      backgroundColor="background-secondary"
      paddingHorizontal="l"
      paddingVertical={{ base: '2xl', md: '5xl' }}
    >
      <Box width="100%" maxWidth={540} flexDirection="column" rowGap="2xl">
        <Box flexDirection="column" rowGap="xl">
          <PortalBackLink
            href={`/${organization.slug}/portal/subscriptions/${subscription.id}?${searchParams.toString()}`}
          >
            Back to customer portal
          </PortalBackLink>
          <Box alignItems="center" columnGap="m">
            <Avatar
              className="h-8 w-8 flex-none text-xs"
              avatar_url={organization.avatar_url}
              name={organization.name}
            />
            <Text variant="heading-xxs" as="span">
              {organization.name}
            </Text>
          </Box>
        </Box>
        <ReactivateSubscription
          api={api}
          subscription={subscription}
          order={order}
        />
        <Box justifyContent="center">
          <PoweredByPolar />
        </Box>
      </Box>
    </Box>
  )
}

export default ReactivatePage
