import { schemas } from '@polar-sh/client'
import { Grid, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import {
  Circle,
  KeyboardArrowDown,
  KeyboardArrowUp,
} from '@polar-sh/orbit/icons'
import Link from 'next/link'
import { useId, useState } from 'react'
import { Change, diffItems, Line } from './diff'
import { fieldLabel, plural, productFields, valueFormatter } from './format'

type Config = schemas['ConfigExportDocument']
type Format = (field: string, value: unknown) => string

const signs = {
  added: { glyph: '+', color: 'success' },
  removed: { glyph: '−', color: 'danger' },
  changed: { glyph: '~', color: 'warning' },
} as const

const changeStatus = {
  added: { label: 'New', color: 'text-success' },
  changed: { label: 'Changed', color: 'text-warning' },
  removed: { label: 'Removed', color: 'text-danger' },
} as const

const ChangeStatus = ({ change }: { change: Change }) => (
  <Box alignItems="center" columnGap="s" flexShrink={0}>
    <Box as="span" display="flex" color={changeStatus[change].color}>
      <Circle size={8} fill="currentColor" strokeWidth={0} />
    </Box>
    <Text>{changeStatus[change].label}</Text>
  </Box>
)

const DiffLine = ({
  line,
  showLabel,
  showSign,
  spaced,
  format,
}: {
  line: Line
  showLabel: boolean
  showSign: boolean
  spaced: boolean
  format: Format
}) => {
  const sign = signs[line.change]
  return (
    <Grid
      templateColumns="16px 128px minmax(0, 1fr)"
      columnGap="m"
      alignItems="baseline"
      px="xl"
      py="xs"
      mt={spaced ? 's' : 'none'}
    >
      <Text monospace weight="semibold" color={sign.color}>
        {showSign ? sign.glyph : null}
      </Text>
      <Text color="muted" truncate>
        {showLabel ? fieldLabel(line.field) : null}
      </Text>
      {line.change === 'changed' ? (
        <Box alignItems="baseline" columnGap="s" minWidth={0} flexWrap="wrap">
          <Text color="muted" lineThrough>
            {format(line.field, line.before)}
          </Text>
          <Text color="muted">→</Text>
          <Text>{format(line.field, line.after)}</Text>
        </Box>
      ) : (
        <Text>
          {format(
            line.field,
            line.change === 'removed' ? line.before : line.after,
          )}
        </Text>
      )}
    </Grid>
  )
}

const ItemName = ({
  name,
  href,
  removed = false,
}: {
  name: string
  href?: string
  removed?: boolean
}) => {
  const text = (
    <Text
      variant="body"
      color={removed ? 'muted' : 'default'}
      lineThrough={removed}
      truncate
    >
      {name}
    </Text>
  )
  if (!href) return text
  return (
    <Link href={href}>
      <Box
        as="span"
        display="flex"
        minWidth={0}
        color={{ base: 'text-primary', hover: 'text-secondary' }}
        transitionProperty="colors"
        transitionDuration="fast"
      >
        {text}
      </Box>
    </Link>
  )
}

const UnchangedItems = <T extends { external_id: string }>({
  items,
  noun,
  nameField,
  href,
  bordered,
}: {
  items: T[]
  noun: string
  nameField: keyof T & string
  href: (externalId: string) => string | undefined
  bordered: boolean
}) => {
  const [expanded, setExpanded] = useState(false)
  const panelId = useId()
  return (
    <Box
      flexDirection="column"
      borderTopWidth={bordered ? 1 : 0}
      borderStyle="solid"
      borderColor="border-primary"
    >
      <button
        type="button"
        className="w-full cursor-pointer text-left"
        aria-expanded={expanded}
        aria-controls={panelId}
        onClick={() => setExpanded((open) => !open)}
      >
        <Box
          as="span"
          display="flex"
          alignItems="center"
          justifyContent="between"
          columnGap="l"
          px="xl"
          py="m"
          color={{ base: 'text-tertiary', hover: 'text-primary' }}
          backgroundColor={{ hover: 'background-secondary' }}
          transitionProperty="colors"
          transitionDuration="fast"
        >
          <Text color="muted">{plural(items.length, `unchanged ${noun}`)}</Text>
          {expanded ? (
            <KeyboardArrowUp fontSize="small" />
          ) : (
            <KeyboardArrowDown fontSize="small" />
          )}
        </Box>
      </button>
      {expanded ? (
        <Box
          id={panelId}
          flexDirection="column"
          py="s"
          borderTopWidth={1}
          borderStyle="solid"
          borderColor="border-primary"
        >
          {items.map((item) => (
            <Box key={item.external_id} px="xl" py="xs" minWidth={0}>
              <ItemName
                name={String(item[nameField])}
                href={href(item.external_id)}
              />
            </Box>
          ))}
        </Box>
      ) : null}
    </Box>
  )
}

const DiffSection = <T extends { external_id: string }>({
  title,
  noun,
  before,
  after,
  nameField,
  href,
  format,
}: {
  title: string
  noun: string
  before: T[]
  after: T[]
  nameField: keyof T & string
  href: (externalId: string) => string | undefined
  format: Format
}) => {
  const { entries, unchanged } = diffItems(before, after, nameField)
  if (!entries.length && !unchanged.length) return null

  return (
    <Box as="section" flexDirection="column" rowGap="m">
      <Text variant="heading-xxs" as="h2">
        {title}
      </Text>
      <Box
        flexDirection="column"
        borderRadius="l"
        borderWidth={1}
        borderStyle="solid"
        borderColor="border-primary"
        overflow="hidden"
      >
        {entries.map(({ key, item, change, lines }, entryIndex) => (
          <Box
            key={key}
            flexDirection="column"
            borderTopWidth={entryIndex ? 1 : 0}
            borderStyle="solid"
            borderColor="border-primary"
          >
            <Box
              alignItems="baseline"
              justifyContent="between"
              columnGap="l"
              px="xl"
              py="m"
            >
              <ItemName
                name={String(item[nameField])}
                href={href(key)}
                removed={change === 'removed'}
              />
              <ChangeStatus change={change} />
            </Box>
            {lines.length ? (
              <Box
                flexDirection="column"
                py="s"
                borderTopWidth={1}
                borderStyle="solid"
                borderColor="border-primary"
              >
                {lines.map((line, index) => {
                  const showLabel = lines[index - 1]?.field !== line.field
                  return (
                    <DiffLine
                      key={index}
                      line={line}
                      showLabel={showLabel}
                      showSign={change === 'changed'}
                      spaced={showLabel && index > 0}
                      format={format}
                    />
                  )
                })}
              </Box>
            ) : null}
          </Box>
        ))}
        {unchanged.length ? (
          <UnchangedItems
            items={unchanged}
            noun={noun}
            nameField={nameField}
            href={href}
            bordered={entries.length > 0}
          />
        ) : null}
      </Box>
    </Box>
  )
}

export const VersionDiff = ({
  config,
  parentConfig,
  productHref,
  benefitHref,
}: {
  config: Config
  parentConfig?: Config
  productHref: (externalId: string) => string | undefined
  benefitHref: (externalId: string) => string | undefined
}) => {
  const format = valueFormatter(
    parentConfig ? [parentConfig, config] : [config],
  )

  return (
    <Box flexDirection="column" rowGap="2xl">
      <DiffSection
        title="Products"
        noun="product"
        before={parentConfig?.products.map(productFields) ?? []}
        after={config.products.map(productFields)}
        nameField="name"
        href={productHref}
        format={format}
      />
      <DiffSection
        title="Benefits"
        noun="benefit"
        before={parentConfig?.benefits ?? []}
        after={config.benefits}
        nameField="description"
        href={benefitHref}
        format={format}
      />
    </Box>
  )
}
