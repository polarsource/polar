'use client'

import { DashboardBody } from '@/components/Layout/DashboardLayout'
import { useCatalog, useCatalogConfig } from '@/hooks/queries/catalogs'
import { schemas } from '@polar-sh/client'
import { Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { PublishedAt } from '../PublishedAt'
import { VersionDiff } from './VersionDiff'

type Organization = schemas['Organization']

const statusLabel = {
  live: 'Current',
  archived: 'Archived',
  draft: 'Draft',
} as const

const Dot = () => (
  <Text as="span" color="muted">
    ·
  </Text>
)

export default function VersionPage({
  organization,
  catalogId,
}: {
  organization: Organization
  catalogId: string
}) {
  const { data: catalog, error } = useCatalog(catalogId)
  const { data: parent } = useCatalog(catalog?.parent_id)
  const { data: exported } = useCatalogConfig(organization.id, catalog?.id)
  const { data: parentExported } = useCatalogConfig(
    organization.id,
    catalog?.parent_id,
  )

  if (error || (catalog && catalog.organization_id !== organization.id)) {
    notFound()
  }
  if (!catalog) {
    return <DashboardBody title={null} />
  }

  const versionsPath = `/dashboard/${organization.slug}/products/versions`
  const diffReady = exported && (!catalog.parent_id || parentExported)
  // Removed items link to their copy in the parent version
  const catalogs = parent ? [parent, catalog] : [catalog]
  const productIds = new Map(
    catalogs.flatMap(({ products }) =>
      products.map((row) => [row.external_id, row.product_id]),
    ),
  )
  const benefitIds = new Map(
    catalogs.flatMap(({ benefits }) =>
      benefits.map((row) => [row.external_id, row.benefit_id]),
    ),
  )
  const productsPath = `/dashboard/${organization.slug}/products`

  return (
    <DashboardBody
      title={null}
      header={
        <Box flexDirection="column" rowGap="xs" minWidth={0}>
          <Link href={versionsPath}>
            <Box
              as="span"
              color={{ base: 'text-secondary', hover: 'text-primary' }}
              transitionProperty="colors"
              transitionDuration="fast"
            >
              <Text as="span" color="inherit">
                ← Versions
              </Text>
            </Box>
          </Link>
          <Box alignItems="center" columnGap="l" minWidth={0}>
            <Text variant="heading-xs" as="h1" truncate>
              {catalog.name ?? 'Untitled'}
            </Text>
          </Box>
          <Box alignItems="baseline" columnGap="s" flexWrap="wrap">
            <Text color="muted">{statusLabel[catalog.status]}</Text>
            <Dot />
            <Text color="muted">
              {catalog.published_at ? (
                <>
                  Published <PublishedAt catalog={catalog} />
                </>
              ) : (
                'Not published'
              )}
            </Text>
            {parent ? (
              <>
                <Dot />
                <Text color="muted">Based on</Text>
                <Link href={`${versionsPath}/${parent.id}`}>
                  <Box
                    as="span"
                    color={{ base: 'text-primary', hover: 'text-secondary' }}
                    transitionProperty="colors"
                    transitionDuration="fast"
                  >
                    <Text as="span" color="inherit">
                      {parent.name ?? 'Untitled'}
                    </Text>
                  </Box>
                </Link>
              </>
            ) : null}
          </Box>
        </Box>
      }
    >
      <Box flexDirection="column" minWidth={0}>
        {diffReady ? (
          <VersionDiff
            config={exported.config}
            parentConfig={parentExported?.config}
            productHref={(externalId) => {
              const id = productIds.get(externalId)
              return id ? `${productsPath}/${id}` : undefined
            }}
            benefitHref={(externalId) => {
              const id = benefitIds.get(externalId)
              return id ? `${productsPath}/benefits/${id}` : undefined
            }}
          />
        ) : null}
      </Box>
    </DashboardBody>
  )
}
