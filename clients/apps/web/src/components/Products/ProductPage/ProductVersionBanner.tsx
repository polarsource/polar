import { useIsManagedAsCode } from '@/hooks/permissions'
import { useCatalog, useLiveCatalog } from '@/hooks/queries/catalogs'
import { useProducts } from '@/hooks/queries/products'
import { useSubscriptions } from '@/hooks/queries/subscriptions'
import { schemas } from '@polar-sh/client'
import { Button, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { useRouter } from 'next/navigation'

export const formatPublishedAt = (datetime: string | null) => {
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

export const ProductVersionBanner = ({
  organization,
  product,
}: {
  organization: schemas['Organization']
  product: schemas['Product']
}) => {
  const managedAsCode = useIsManagedAsCode(organization.id)
  const { data: catalog } = useCatalog(
    managedAsCode ? product.catalog_id : null,
  )

  if (catalog?.status !== 'archived' || !product.external_id) {
    return null
  }

  return (
    <OlderVersionBanner
      organization={organization}
      externalId={product.external_id}
      productId={product.id}
      publishedAt={catalog.published_at}
    />
  )
}

const OlderVersionBanner = ({
  organization,
  externalId,
  productId,
  publishedAt,
}: {
  organization: schemas['Organization']
  externalId: string
  productId: string
  publishedAt: string | null
}) => {
  const router = useRouter()
  const { data: liveCatalog } = useLiveCatalog(organization.id, true)
  const { data: currentProducts } = useProducts(organization.id, {
    external_id: externalId,
    limit: 1,
  })
  const { data: subscriptions } = useSubscriptions(organization.id, {
    product_id: productId,
    status: ['active', 'trialing'],
    limit: 1,
  })
  const current = currentProducts?.items[0]

  if (!current) {
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
        <Stat label="Published" value={formatPublishedAt(publishedAt)} />
        <Stat
          label="Subscriptions"
          value={subscriptions?.pagination.total_count.toLocaleString() ?? '–'}
        />
        <Button
          variant="secondary"
          onClick={() =>
            router.push(
              `/dashboard/${organization.slug}/products/${current.id}`,
            )
          }
        >
          View current version
        </Button>
      </Box>
    </Box>
  )
}
