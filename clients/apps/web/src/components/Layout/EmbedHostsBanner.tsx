'use client'

import { useOrganizationEmbedStatus } from '@/hooks/queries'
import { schemas } from '@polar-sh/client'
import { Alert } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { useRouter } from 'next/navigation'
import React from 'react'

interface EmbedHostsBannerProps {
  organization: schemas['Organization']
}

const EmbedHostsBanner: React.FC<EmbedHostsBannerProps> = ({
  organization,
}) => {
  const router = useRouter()
  const { data } = useOrganizationEmbedStatus(organization.id)

  if (!data?.has_embedded || data.embed_hosts.length > 0) {
    return null
  }

  return (
    <Box paddingHorizontal="l" paddingTop="l">
      <Alert
        variant="warning"
        title="Add your embed hosts"
        description={
          <>
            {data.embed_hosts_enforced
              ? 'Your checkout is embedded on at least one site, and no hosts are listed, so those checkouts are not opening.'
              : 'Your checkout is embedded on at least one site. List the hosts allowed to embed it, or those checkouts will stop opening.'}{' '}
            <a
              href="https://polar.sh/docs/features/checkout/embed#embed-hosts"
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium underline hover:no-underline"
            >
              How to write a host
            </a>
          </>
        }
        actions={[
          {
            text: 'Open settings',
            onClick: () =>
              router.push(`/dashboard/${organization.slug}/settings#embedding`),
          },
        ]}
      />
    </Box>
  )
}

export default EmbedHostsBanner
