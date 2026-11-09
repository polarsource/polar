import { useIsManagedAsCode } from '@/hooks/permissions'
import { useGrantsForBenefit } from '@/hooks/queries/benefits'
import { useCatalog, useLiveCatalog } from '@/hooks/queries/catalogs'
import { DraftVersionBanner } from '@/components/Products/DraftVersionBanner'
import { schemas } from '@polar-sh/client'
import { Button, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { useRouter } from 'next/navigation'

const formatPublishedAt = (datetime: string | null | undefined) => {
  if (!datetime) return ''
  const date = new Date(datetime)
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    ...(date.getFullYear() !== new Date().getFullYear() && {
      year: 'numeric',
    }),
  })
}

const Stat = ({ label, value }: { label: string; value: string }) => (
  <Box flexDirection="column" rowGap="xs">
    <Text variant="caption" color="muted">
      {label}
    </Text>
    <Text tabularNums wrap="nowrap">
      {value}
    </Text>
  </Box>
)

export const BenefitVersionBanner = ({
  organization,
  benefit,
}: {
  organization: schemas['Organization']
  benefit: schemas['Benefit']
}) => {
  const managedAsCode = useIsManagedAsCode(organization.id)
  const { data: liveCatalog } = useLiveCatalog(organization.id, managedAsCode)
  const { data: liveVersion } = useCatalog(liveCatalog?.id)
  const { data: catalog } = useCatalog(
    managedAsCode ? benefit.catalog_id : null,
  )
  const current = liveVersion?.benefits.find(
    ({ external_id }) => external_id === benefit.external_id,
  )

  if (managedAsCode && catalog?.status === 'draft' && !benefit.is_current) {
    return (
      <DraftVersionBanner
        organization={organization}
        draftId={catalog.id}
        currentHref={
          current
            ? `/dashboard/${organization.slug}/products/benefits/${current.benefit_id}`
            : null
        }
      />
    )
  }

  if (!managedAsCode || !current || current.benefit_id === benefit.id) {
    return null
  }

  return (
    <OlderBenefitBanner
      organization={organization}
      benefit={benefit}
      liveCatalogName={liveCatalog?.name}
      currentBenefitId={current.benefit_id}
    />
  )
}

const OlderBenefitBanner = ({
  organization,
  benefit,
  liveCatalogName,
  currentBenefitId,
}: {
  organization: schemas['Organization']
  benefit: schemas['Benefit']
  liveCatalogName: string | null | undefined
  currentBenefitId: string
}) => {
  const router = useRouter()
  const { data: catalog } = useCatalog(benefit.catalog_id)
  const { data: activeGrants } = useGrantsForBenefit({
    benefitId: benefit.id,
    organizationId: organization.id,
    limit: 1,
    isGranted: true,
  })

  if (catalog?.status !== 'archived') {
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
          Customers who buy now get{' '}
          <Text as="span" color="default">
            {liveCatalogName ?? 'the current version'}
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
        <Stat
          label="Published"
          value={formatPublishedAt(catalog?.published_at)}
        />
        <Stat
          label="Active grants"
          value={activeGrants?.pagination.total_count.toLocaleString() ?? '–'}
        />
        <Button
          variant="secondary"
          onClick={() =>
            router.push(
              `/dashboard/${organization.slug}/products/benefits/${currentBenefitId}`,
            )
          }
        >
          View current version
        </Button>
      </Box>
    </Box>
  )
}
