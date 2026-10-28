'use client'

import { DashboardBody } from '@/components/Layout/DashboardLayout'
import ProductPriceLabel from '@/components/Products/ProductPriceLabel'
import { toast } from '@/components/Toast/use-toast'
import { useSafeCopy } from '@/hooks/clipboard'
import { useCatalog } from '@/hooks/queries/catalogs'
import { useSelectedProducts } from '@/hooks/queries/products'
import { useSubscriptions } from '@/hooks/queries/subscriptions'
import { schemas } from '@polar-sh/client'
import {
  Button,
  Grid,
  List,
  ListItem,
  Text,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import {
  ArrowBackOutlined,
  Check,
  ChevronDown,
  ChevronUp,
  Copy,
} from '@polar-sh/orbit/icons'
import FormattedDateTime from '@polar-sh/ui/components/atoms/FormattedDateTime'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ReactNode, useEffect, useMemo, useState } from 'react'
import { CopyHashButton, CurrentBadge, PublishedAt } from '../VersionsPage'

type CatalogVersion = schemas['CatalogVersion']

const shortHash = (catalog: { version_hash: string | null }) =>
  catalog.version_hash?.slice(0, 7) ?? 'Untitled'

const plural = (count: number, noun: string) =>
  `${count} ${count === 1 ? noun : `${noun}s`}`

const VersionLink = ({
  version,
  versionsPath,
  direction,
  children,
}: {
  version: CatalogVersion | undefined
  versionsPath: string
  direction: 'Newer' | 'Older'
  children: ReactNode
}) => {
  if (!version) {
    return (
      <Button
        size="icon"
        variant="secondary"
        aria-label={`${direction} version`}
        disabled
      >
        {children}
      </Button>
    )
  }
  const label = `${direction} · ${version.name ?? shortHash(version)}`
  return (
    <Tooltip delayDuration={150}>
      <TooltipTrigger asChild>
        <Link href={`${versionsPath}/${version.id}`} aria-label={label}>
          <Button size="icon" variant="secondary" tabIndex={-1}>
            {children}
          </Button>
        </Link>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  )
}

const LiveWindow = ({
  catalog,
  next,
}: {
  catalog: CatalogVersion
  next: CatalogVersion | undefined
}) => {
  if (!catalog.published_at) return 'Draft'
  if (!next?.published_at) {
    return (
      <>
        Published{' '}
        <Text as="span" color="default">
          <PublishedAt catalog={catalog} />
        </Text>
      </>
    )
  }
  return (
    <Text as="span" color="default">
      <FormattedDateTime datetime={catalog.published_at} /> –{' '}
      <FormattedDateTime datetime={next.published_at} />
    </Text>
  )
}

const Section = ({
  title,
  aside,
  children,
}: {
  title: string
  aside?: string
  children: ReactNode
}) => (
  <Box flexDirection="column" rowGap="m">
    <Box alignItems="baseline" justifyContent="between">
      <Text variant="heading-xxs">{title}</Text>
      {aside ? <Text color="muted">{aside}</Text> : null}
    </Box>
    {children}
  </Box>
)

const PullCommand = ({ command }: { command: string }) => {
  const [copied, setCopied] = useState(false)
  const safeCopy = useSafeCopy(toast)

  useEffect(() => {
    if (!copied) return
    const timeout = setTimeout(() => setCopied(false), 1200)
    return () => clearTimeout(timeout)
  }, [copied])

  return (
    <button
      type="button"
      aria-label={copied ? 'Copied' : 'Copy pull command'}
      className="self-start"
      onClick={() => void safeCopy(command).then(() => setCopied(true))}
    >
      <Box
        as="span"
        display="flex"
        alignItems="center"
        columnGap="s"
        paddingHorizontal="l"
        color={{ base: 'text-secondary', hover: 'text-primary' }}
        transitionProperty="colors"
        transitionDuration="fast"
      >
        <Text as="span" color="inherit" monospace>
          <Text as="span" color="disabled" monospace>
            ${' '}
          </Text>
          {command}
        </Text>
        {copied ? <Check size={14} /> : <Copy size={14} />}
      </Box>
    </button>
  )
}

const Subscribers = ({
  organizationId,
  productId,
}: {
  organizationId: string
  productId: string
}) => {
  const { data } = useSubscriptions(organizationId, {
    product_id: productId,
    status: ['active', 'trialing'],
    limit: 1,
  })
  const count = data?.pagination.total_count
  if (count === undefined) return null
  return (
    <Text color={count ? 'default' : 'muted'} align="right">
      {plural(count, 'subscriber')}
    </Text>
  )
}

export default function VersionPage({
  organization,
  catalogId,
}: {
  organization: schemas['Organization']
  catalogId: string
}) {
  const { data: catalog, error } = useCatalog(catalogId)
  const { data: previous, isLoading: previousLoading } = useCatalog(
    catalog?.previous_id,
  )
  const { data: next, isLoading: nextLoading } = useCatalog(catalog?.next_id)
  const rows = catalog?.products ?? []
  const { data: products } = useSelectedProducts(
    rows.map(({ product_id }) => product_id),
    true,
  )
  const productsById = useMemo(
    () => new Map(products?.map((product) => [product.id, product])),
    [products],
  )

  if (error) notFound()
  if (!catalog || previousLoading || nextLoading) {
    return <DashboardBody title={null} />
  }

  const versionsPath = `/dashboard/${organization.slug}/products/versions`
  const currency = organization.default_presentment_currency
  const pullCommand =
    catalog.status === 'live'
      ? `polar config pull --org ${organization.slug}`
      : `polar config pull --org ${organization.slug} --version ${catalog.version_hash?.slice(0, 7) ?? catalog.id}`
  const showBenefits = rows.some(
    ({ product_id }) => productsById.get(product_id)?.benefits.length,
  )

  return (
    <DashboardBody
      title={
        <Box flexDirection="column" rowGap="l" minWidth={0}>
          <Box alignItems="center" columnGap="l" minWidth={0}>
            <Link href={versionsPath} aria-label="All versions">
              <Box
                as="span"
                display="flex"
                color={{ base: 'text-tertiary', hover: 'text-primary' }}
                transitionProperty="colors"
                transitionDuration="fast"
              >
                <ArrowBackOutlined fontSize="small" />
              </Box>
            </Link>
            <Text variant="heading-xs" as="h1" truncate>
              {catalog.name ?? `Version ${shortHash(catalog)}`}
            </Text>
          </Box>
          <Box alignItems="center" columnGap="m" flexWrap="wrap">
            {catalog.version_hash ? (
              <CopyHashButton hash={catalog.version_hash} />
            ) : null}
            <Text color="muted">
              <LiveWindow catalog={catalog} next={next} />
            </Text>
            {catalog.status === 'live' ? <CurrentBadge /> : null}
          </Box>
        </Box>
      }
      header={
        <Box columnGap="s">
          <VersionLink
            version={next}
            versionsPath={versionsPath}
            direction="Newer"
          >
            <ChevronUp size={16} />
          </VersionLink>
          <VersionLink
            version={previous}
            versionsPath={versionsPath}
            direction="Older"
          >
            <ChevronDown size={16} />
          </VersionLink>
        </Box>
      }
    >
      <Box flexDirection="column" rowGap="2xl">
        <Section
          title="Products"
          aside={plural(catalog.products.length, 'product')}
        >
          <List size="small">
            {rows.map((row) => {
              const product = productsById.get(row.product_id)
              return (
                <Link
                  key={row.external_id}
                  href={`/dashboard/${organization.slug}/products/${row.product_id}`}
                >
                  <ListItem className="px-6 py-5">
                    <Grid
                      templateColumns={`160px minmax(0, 1fr) auto ${showBenefits ? '96px ' : ''}176px`}
                      columnGap="xl"
                      alignItems="center"
                      width="100%"
                    >
                      <Text color="muted" monospace truncate>
                        {row.external_id}
                      </Text>
                      <Text truncate>{product?.name}</Text>
                      <Text>
                        {product ? (
                          <ProductPriceLabel
                            product={product}
                            currency={currency}
                          />
                        ) : null}
                      </Text>
                      {showBenefits ? (
                        <Text color="muted" align="right">
                          {product?.benefits.length
                            ? plural(product.benefits.length, 'benefit')
                            : null}
                        </Text>
                      ) : null}
                      <Subscribers
                        organizationId={organization.id}
                        productId={row.product_id}
                      />
                    </Grid>
                  </ListItem>
                </Link>
              )
            })}
          </List>
        </Section>
        <PullCommand command={pullCommand} />
      </Box>
    </DashboardBody>
  )
}
