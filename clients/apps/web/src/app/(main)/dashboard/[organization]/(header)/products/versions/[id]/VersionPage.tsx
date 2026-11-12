'use client'

import { DashboardBody } from '@/components/Layout/DashboardLayout'
import { PublishDraftButton } from '@/components/Products/PublishDraftButton'
import { useCatalog, useCatalogConfig } from '@/hooks/queries/catalogs'
import { schemas } from '@polar-sh/client'
import { Grid, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Fragment } from 'react'
import { PublishedAt } from '../PublishedAt'
import { VersionDiff } from './VersionDiff'
import { fieldLabel, settingsFields } from './format'
import { VersionTitle } from './VersionTitle'

type Organization = schemas['Organization']
type Catalog = schemas['Catalog']

const statusLabel = {
  live: 'Current',
  archived: 'Archived',
  draft: 'Draft',
} as const

const Field = ({
  label,
  first = false,
  children,
}: {
  label: string
  first?: boolean
  children: React.ReactNode
}) => (
  <Box
    flexDirection="column"
    rowGap="xs"
    pt={first ? 'none' : 'l'}
    borderTopWidth={first ? 0 : 1}
    borderStyle="solid"
    borderColor="border-primary"
  >
    <Text color="muted">{label}</Text>
    <Text>{children}</Text>
  </Box>
)

type SettingChange = { field: string; before: string; after: string }

const SettingsChanges = ({ changes }: { changes: SettingChange[] }) => (
  <Box as="section" flexDirection="column" rowGap="m">
    <Text variant="heading-xxs" as="h2">
      Organization settings
    </Text>
    <Grid
      templateColumns="max-content minmax(0, 1fr)"
      columnGap="2xl"
      rowGap="s"
      alignItems="baseline"
      borderRadius="l"
      backgroundColor="background-card"
      px="xl"
      py="l"
    >
      {changes.map(({ field, before, after }) => (
        <Fragment key={field}>
          <Text color="muted">{fieldLabel(field)}</Text>
          <Box alignItems="baseline" columnGap="s" flexWrap="wrap">
            <Text color="muted" lineThrough>
              {before}
            </Text>
            <Text color="muted">→</Text>
            <Text>{after}</Text>
          </Box>
        </Fragment>
      ))}
    </Grid>
  </Box>
)

const VersionDetails = ({
  catalog,
  parent,
  versionsPath,
  settings,
}: {
  catalog: Catalog
  parent?: Catalog
  versionsPath: string
  settings?: Record<string, string>
}) => (
  <Box as="aside" flexDirection="column" rowGap="l">
    <Field label="Status" first>
      {statusLabel[catalog.status]}
    </Field>
    <Field label="Published">
      {catalog.published_at ? (
        <PublishedAt catalog={catalog} />
      ) : (
        'Not published'
      )}
    </Field>
    {parent ? (
      <Field label="Based on">
        <Link href={`${versionsPath}/${parent.id}`}>
          {parent.name ?? 'Untitled'}
        </Link>
      </Field>
    ) : null}
    {settings
      ? Object.entries(settings).map(([field, value]) => (
          <Field key={field} label={fieldLabel(field)}>
            {value}
          </Field>
        ))
      : null}
  </Box>
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
  const settings: Record<string, string> | undefined =
    exported && settingsFields(exported.config.settings)
  const settingsBefore: Record<string, string> | undefined =
    catalog.status === 'draft'
      ? settingsFields({
          payments: {
            currency: organization.default_presentment_currency,
            tax: organization.default_tax_behavior,
          },
        })
      : undefined
  const settingsChanges: SettingChange[] =
    settings && settingsBefore
      ? Object.entries(settings)
          .filter(([field, value]) => settingsBefore[field] !== value)
          .map(([field, after]) => ({
            field,
            before: settingsBefore[field],
            after,
          }))
      : []
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
  const meterIds = new Map(
    catalogs.flatMap(({ meters }) =>
      meters.map((row) => [row.external_id, row.meter_id]),
    ),
  )
  const productsPath = `/dashboard/${organization.slug}/products`

  return (
    <DashboardBody
      title={null}
      header={
        <>
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
              <VersionTitle catalog={catalog} />
            </Box>
          </Box>
          {catalog.status === 'draft' ? (
            <PublishDraftButton catalogId={catalog.id} />
          ) : null}
        </>
      }
    >
      <Box
        flexDirection={{ base: 'column', md: 'row' }}
        alignItems="start"
        columnGap="3xl"
        rowGap="2xl"
      >
        <Box
          flexDirection="column"
          rowGap="2xl"
          flex={3}
          minWidth={0}
          width="100%"
        >
          {settingsChanges.length ? (
            <SettingsChanges changes={settingsChanges} />
          ) : null}
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
              meterHref={(externalId) => {
                const id = meterIds.get(externalId)
                return id ? `${productsPath}/meters/${id}` : undefined
              }}
            />
          ) : null}
        </Box>
        <Box flexDirection="column" flex={1} minWidth={0} width="100%">
          <VersionDetails
            catalog={catalog}
            parent={parent}
            versionsPath={versionsPath}
            settings={settings}
          />
        </Box>
      </Box>
    </DashboardBody>
  )
}
