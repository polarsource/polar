import {
  useCatalog,
  useLiveCatalog,
  useRemovedCatalogItems,
} from '@/hooks/queries/catalogs'
import { useProducts } from '@/hooks/queries/products'
import { useSubscriptions } from '@/hooks/queries/subscriptions'
import { schemas } from '@polar-sh/client'
import { Button, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { DraftVersionBanner } from '../DraftVersionBanner'

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
  const managedAsCode =
    organization.feature_settings?.config_as_code_enabled ?? false
  const { data: catalog } = useCatalog(
    managedAsCode ? product.catalog_id : null,
  )

  if (!product.external_id) {
    return null
  }

  if (catalog?.status === 'draft' && !product.is_current) {
    return (
      <DraftProductBanner
        organization={organization}
        externalId={product.external_id}
        draftId={catalog.id}
      />
    )
  }

  if (product.is_current || catalog?.status !== 'archived') {
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

const DraftProductBanner = ({
  organization,
  externalId,
  draftId,
}: {
  organization: schemas['Organization']
  externalId: string
  draftId: string
}) => {
  const { data: currentProducts } = useProducts(organization.id, {
    external_id: externalId,
    catalog_status: 'live',
    limit: 1,
  })
  const current = currentProducts?.items[0]

  return (
    <DraftVersionBanner
      organization={organization}
      resource="product"
      draftId={draftId}
      currentHref={
        current
          ? `/dashboard/${organization.slug}/products/${current.id}`
          : null
      }
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
    catalog_status: 'live',
    limit: 1,
  })
  const { data: subscriptions } = useSubscriptions(organization.id, {
    product_id: productId,
    status: ['active', 'trialing'],
    limit: 1,
  })
  const current = currentProducts?.items[0]

  if (!current) {
    return currentProducts ? (
      <RemovedItemBanner
        organization={organization}
        resource="product"
        externalId={externalId}
      />
    ) : null
  }

  return (
    <BannerFrame>
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
    </BannerFrame>
  )
}

const removedCopy = {
  product: "New customers can't buy it.",
  benefit: "New customers don't get it.",
  meter: "New subscriptions don't bill it.",
} as const

export const RemovedItemBanner = ({
  organization,
  resource,
  externalId,
}: {
  organization: schemas['Organization']
  resource: schemas['RemovedCatalogItemResource']
  externalId: string
}) => {
  const router = useRouter()
  const { data: removedItems } = useRemovedCatalogItems(organization.id)
  const item = removedItems?.find(
    (removed) =>
      removed.resource === resource && removed.external_id === externalId,
  )
  if (!item) {
    return null
  }
  const removedIn = item.removed_in_catalog
  return (
    <BannerFrame>
      <Box flexDirection="column" rowGap="xs" minWidth={0}>
        <Text variant="title">This {resource} has been removed</Text>
        <Text color="muted">
          Removed in{' '}
          <Text as="span" color="default">
            <Link
              href={`/dashboard/${organization.slug}/products/versions/${removedIn.id}`}
              className="hover:underline hover:decoration-current/30 hover:underline-offset-4"
            >
              {removedIn.name ?? 'Untitled'}
            </Link>
          </Text>
          . {removedCopy[resource]}
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
          label="Removed"
          value={formatPublishedAt(removedIn.published_at)}
        />
        <Stat label="Customers" value={item.customers_count.toLocaleString()} />
        <Button
          variant="secondary"
          onClick={() =>
            router.push(
              `/dashboard/${organization.slug}/products/versions?tab=removed`,
            )
          }
        >
          View removed {resource}s
        </Button>
      </Box>
    </BannerFrame>
  )
}

const BannerFrame = ({ children }: { children: React.ReactNode }) => (
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
    {children}
  </Box>
)
