'use client'

import { CustomerEmailsBlock } from '@/components/Void/settings/CustomerEmailsBlock'
import { DangerBlock } from '@/components/Void/settings/DangerBlock'
import { EmbedBlock } from '@/components/Void/settings/EmbedBlock'
import { FeaturesBlock } from '@/components/Void/settings/FeaturesBlock'
import { PaymentsBlock } from '@/components/Void/settings/PaymentsBlock'
import { PortalBlock } from '@/components/Void/settings/PortalBlock'
import { ProfileBlock } from '@/components/Void/settings/ProfileBlock'
import { SubscriptionsBlock } from '@/components/Void/settings/SubscriptionsBlock'
import { UserNotificationsBlock } from '@/components/Void/settings/UserNotificationsBlock'
import { VoidSection } from '@/components/Void/VoidSection'
import { OrganizationContext } from '@/providers/maintainerOrganization'
import { Box } from '@polar-sh/orbit/Box'
import { useContext } from 'react'

export default function ClientPage() {
  const { organization } = useContext(OrganizationContext)

  return (
    <Box as="main" flexDirection="column" paddingTop="xl" flexGrow={1}>
      <VoidSection flush label="Settings" meta="General">
        <Box flexDirection="column" rowGap="4xl" maxWidth={720}>
          <ProfileBlock organization={organization} />
          <PaymentsBlock organization={organization} />
          <SubscriptionsBlock organization={organization} />
          <PortalBlock organization={organization} />
          <EmbedBlock organization={organization} />
          <CustomerEmailsBlock organization={organization} />
          <UserNotificationsBlock organization={organization} />
          <FeaturesBlock organization={organization} />
          <DangerBlock />
        </Box>
      </VoidSection>
    </Box>
  )
}
