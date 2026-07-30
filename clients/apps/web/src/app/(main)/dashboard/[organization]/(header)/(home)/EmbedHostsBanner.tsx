'use client'

import { useHasPermission } from '@/hooks/permissions'
import { useOrganizationEmbedStatus } from '@/hooks/queries'
import { useDismissed } from '@/hooks/useDismissed'
import { schemas } from '@polar-sh/client'
import { Alert } from '@polar-sh/orbit'
import { useRouter } from 'next/navigation'

interface EmbedHostsBannerProps {
  organization: schemas['Organization']
}

const NO_HOSTS: schemas['OrganizationUncoveredHost'][] = []

// Identifies the set of hosts, so a dismissal covers the ones seen at the time
// and a host discovered later brings the banner back.
const fingerprint = (hosts: string[]): string => {
  const joined = [...hosts].sort().join(',')
  let hash = 2166136261
  for (let i = 0; i < joined.length; i++) {
    hash ^= joined.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  return (hash >>> 0).toString(36)
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

  const uncovered = data?.uncovered_hosts ?? NO_HOSTS
  const { isDismissed, dismiss } = useDismissed(
    `embed_hosts_uncovered:${organization.id}:${fingerprint(
      uncovered.map((host) => host.host),
    )}`,
  )

  const openSettings = () =>
    router.push(`/dashboard/${organization.slug}/settings#embedding`)

  if (!data?.has_embedded) {
    return null
  }

  if (data.embed_hosts.length === 0) {
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
        actions={[{ text: 'Open settings', onClick: openSettings }]}
      />
    )
  }

  if (uncovered.length === 0 || isDismissed) {
    return null
  }

  return (
    <Alert
      variant="warning"
      title={
        uncovered.length === 1
          ? '1 host is missing from your embed hosts'
          : `${uncovered.length} hosts are missing from your embed hosts`
      }
      description={
        data.embed_hosts_enforced
          ? 'Your checkout has been embedded from hosts your list does not allow, so those checkouts are not opening.'
          : 'Your checkout has been embedded from hosts your list does not allow. Those checkouts will stop opening once we enforce the list.'
      }
      onDismiss={dismiss}
      actions={[{ text: 'Review hosts', onClick: openSettings }]}
    />
  )
}
