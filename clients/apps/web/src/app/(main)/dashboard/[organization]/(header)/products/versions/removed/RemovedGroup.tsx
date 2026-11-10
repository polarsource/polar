import { schemas } from '@polar-sh/client'
import { Grid, Status, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import Link from 'next/link'

type Item = schemas['RemovedCatalogItem']

const COLUMNS =
  'minmax(0, 2fr) minmax(0, 2fr) minmax(0, 1fr) minmax(0, 1fr) 160px 96px'

const Row = ({
  children,
  header,
}: {
  children: React.ReactNode
  header?: boolean
}) => (
  <Grid
    templateColumns={COLUMNS}
    columnGap="l"
    alignItems="center"
    px="xl"
    py={header ? 's' : 'm'}
    borderTopWidth={header ? 0 : 1}
    borderStyle="solid"
    borderColor="border-primary"
  >
    {children}
  </Grid>
)

const Customers = ({ item }: { item: Item }) =>
  item.status === 'deprecated' ? (
    <Box alignItems="center" columnGap="s">
      <Status status="Deprecated" color="yellow" size="small" />
      <Text color="muted">{item.customers_count}</Text>
    </Box>
  ) : (
    <Box>
      <Status status="Removed" color="gray" size="small" />
    </Box>
  )

export const RemovedGroup = ({
  title,
  hint,
  items,
  versionName,
  href,
}: {
  title: string
  hint: string
  items: Item[]
  versionName: (catalogId: string) => string
  href: (item: Item) => string
}) => {
  if (!items.length) return null

  return (
    <Box as="section" flexDirection="column" rowGap="m">
      <Box alignItems="baseline" justifyContent="between" columnGap="l">
        <Text variant="heading-xxs" as="h2">
          {title}
        </Text>
        <Text variant="caption" color="muted">
          {hint}
        </Text>
      </Box>
      <Box
        flexDirection="column"
        borderRadius="l"
        borderWidth={1}
        borderStyle="solid"
        borderColor="border-primary"
        overflow="hidden"
      >
        <Row header>
          {['Name', 'Key', 'In versions', 'Removed in', 'Customers'].map(
            (label) => (
              <Text key={label} variant="caption" color="muted">
                {label}
              </Text>
            ),
          )}
        </Row>
        {items.map((item) => {
          const first = versionName(item.first_catalog_id)
          const last = versionName(item.last_catalog_id)
          return (
            <Row key={item.external_id}>
              <Text truncate>{item.name}</Text>
              <Text monospace color="muted" truncate>
                {item.external_id}
              </Text>
              <Text truncate>{first === last ? last : `${first}–${last}`}</Text>
              <Text truncate>{versionName(item.removed_in_catalog_id)}</Text>
              <Customers item={item} />
              <Link href={href(item)}>
                <Box
                  as="span"
                  display="flex"
                  justifyContent="end"
                  color={{ base: 'text-primary', hover: 'text-secondary' }}
                  transitionProperty="colors"
                  transitionDuration="fast"
                >
                  <Text as="span" color="inherit" truncate>
                    Open {last} →
                  </Text>
                </Box>
              </Link>
            </Row>
          )
        })}
      </Box>
    </Box>
  )
}
