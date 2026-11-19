import { DraftVersionBanner } from '@/components/Products/DraftVersionBanner'
import { formatPublishedAt } from '@/components/Products/ProductPage/ProductVersionBanner'
import { useIsManagedAsCode } from '@/hooks/permissions'
import { useCatalog, useLiveCatalog } from '@/hooks/queries/catalogs'
import { useMeters } from '@/hooks/queries/meters'
import { schemas } from '@polar-sh/client'
import { Button, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { useRouter } from 'next/navigation'

export const MeterVersionBanner = ({
  organization,
  meter,
}: {
  organization: schemas['Organization']
  meter: schemas['Meter']
}) => {
  const managedAsCode = useIsManagedAsCode(organization.id)
  const { data: catalog } = useCatalog(managedAsCode ? meter.catalog_id : null)

  if (
    !catalog ||
    meter.is_current ||
    !meter.external_id ||
    (catalog.status !== 'draft' && catalog.status !== 'archived')
  ) {
    return null
  }

  return (
    <NonCurrentMeterBanner
      organization={organization}
      externalId={meter.external_id}
      catalog={catalog}
    />
  )
}

const NonCurrentMeterBanner = ({
  organization,
  externalId,
  catalog,
}: {
  organization: schemas['Organization']
  externalId: string
  catalog: schemas['Catalog']
}) => {
  const router = useRouter()
  const { data: liveCatalog } = useLiveCatalog(organization.id, true)
  const { data: currentMeters } = useMeters(organization.id, {
    external_id: externalId,
    catalog_status: 'live',
    is_archived: false,
    limit: 1,
  })
  const current = currentMeters?.items[0]
  const currentHref = current
    ? `/dashboard/${organization.slug}/products/meters/${current.id}`
    : null

  if (catalog.status === 'draft') {
    return (
      <DraftVersionBanner
        organization={organization}
        draftId={catalog.id}
        currentHref={currentHref}
      />
    )
  }

  if (!currentHref) {
    return null
  }

  return (
    <Box
      flexDirection={{ base: 'column', md: 'row' }}
      alignItems={{ base: 'start', md: 'center' }}
      justifyContent="between"
      columnGap="2xl"
      rowGap="l"
      paddingVertical="l"
      paddingHorizontal="xl"
      borderRadius="l"
      borderWidth={1}
      borderStyle="solid"
      borderColor="border-primary"
    >
      <Box flexDirection="column" rowGap="xs" minWidth={0}>
        <Text variant="title">You&apos;re viewing an older version</Text>
        <Text color="muted">
          New checkouts use{' '}
          <Text as="span" color="default">
            {liveCatalog?.name ?? 'the current version'}
          </Text>
          .
        </Text>
      </Box>
      <Box
        alignItems="center"
        flexWrap="wrap"
        columnGap="2xl"
        rowGap="l"
        flexShrink={0}
      >
        <Box flexDirection="column" rowGap="xs">
          <Text variant="caption" color="muted">
            Published
          </Text>
          <Text tabularNums wrap="nowrap">
            {formatPublishedAt(catalog.published_at)}
          </Text>
        </Box>
        <Button variant="secondary" onClick={() => router.push(currentHref)}>
          View current version
        </Button>
      </Box>
    </Box>
  )
}
