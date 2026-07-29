'use client'

import { useOrganizationEmbedStatus } from '@/hooks/queries'
import { useHasPermission } from '@/hooks/permissions'
import { schemas } from '@polar-sh/client'
import { Alert } from '@polar-sh/orbit'
import { useRouter } from 'next/navigation'

interface EmbedHostsBannerProps {
  organization: schemas['Organization']
}

export const EmbedHostsBanner = ({ organization }: EmbedHostsBannerProps) => {
  const router = useRouter()
  // Embed hosts live in organization settings, so only admins can act.
  const canManageOrganization = useHasPermission(
    organization.id,
    'organization:manage',
  )

  const { data } = useOrganizationEmbedStatus(
    organization.id,
    canManageOrganization,
  )

  if (!data?.has_embedded || data.embed_hosts.length > 0) {
    return null
  }

  return (
    <Alert
      variant="warning"
      title="Add your embed hosts"
      description={
        <>
          {data.embed_hosts_enforced
            ? 'Your checkout is embedded on at least one site, and no hosts are listed, so those checkouts are not opening.'
            : 'Your checkout is embedded on at least one site. Nothing breaks today, but a host you leave out will stop opening your checkout once we enforce the list.'}{' '}
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
  )
}
