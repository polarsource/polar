import { schemas } from '@polar-sh/client'
import { Grid, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { Circle, KeyboardArrowDown } from '@polar-sh/orbit/icons'
import Link from 'next/link'
import { useId, useState } from 'react'
import { Change, diffItems, Line } from './diff'
import {
  fieldLabel,
  meterFields,
  plural,
  productFields,
  valueFormatter,
} from './format'

type Config = schemas['ConfigExportDocument']
type Format = (field: string, value: unknown) => string

const signs = {
  added: { glyph: '+', color: 'text-emerald-500' },
  removed: { glyph: '−', color: 'text-red-500' },
  changed: { glyph: '~', color: 'text-amber-500' },
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
  format,
}: {
  line: Line
  showLabel: boolean
  showSign: boolean
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
    >
      <span className={`font-mono font-semibold ${sign.color}`}>
        {showSign ? sign.glyph : null}
      </span>
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
        <Text
          color={line.change === 'removed' ? 'muted' : 'default'}
          lineThrough={line.change === 'removed' && showSign}
        >
          {format(
            line.field,
            line.change === 'removed' ? line.before : line.after,
          )}
        </Text>
      )}
    </Grid>
  )
}

const ItemRow = ({
  href,
  children,
}: {
  href?: string
  children: React.ReactNode
}) => {
  const row = (
    <Box
      alignItems="baseline"
      justifyContent="between"
      columnGap="l"
      px="xl"
      py="m"
      minWidth={0}
      backgroundColor={href ? { hover: 'background-card' } : undefined}
      transitionProperty="colors"
      transitionDuration="fast"
    >
      {children}
    </Box>
  )
  if (!href) return row
  return (
    <Link href={href} className="block">
      {row}
    </Link>
  )
}

const ItemName = ({
  name,
  removed = false,
  muted = false,
}: {
  name: string
  removed?: boolean
  muted?: boolean
}) => (
  <Text
    variant="body"
    color={removed || muted ? 'muted' : 'default'}
    lineThrough={removed}
    truncate
  >
    {name}
  </Text>
)

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
          columnGap="s"
          px="xl"
          py="m"
          color={{ base: 'text-secondary', hover: 'text-primary' }}
          backgroundColor={{ hover: 'background-card' }}
          transitionProperty="colors"
          transitionDuration="fast"
        >
          <Text color="inherit">
            {plural(items.length, `unchanged ${noun}`)}
          </Text>
          <Box
            as="span"
            display="flex"
            transform={expanded ? 'rotate(180deg)' : 'none'}
            transitionProperty="transform"
            transitionDuration="base"
            ease="standard"
          >
            <KeyboardArrowDown fontSize="small" />
          </Box>
        </Box>
      </button>
      {expanded ? (
        <div
          id={panelId}
          className="animate-in fade-in flex flex-col duration-150 ease-out"
        >
          {items.map((item) => (
            <Box
              key={item.external_id}
              flexDirection="column"
              borderTopWidth={1}
              borderStyle="solid"
              borderColor="border-primary"
            >
              <ItemRow href={href(item.external_id)}>
                <ItemName name={String(item[nameField])} muted />
              </ItemRow>
            </Box>
          ))}
        </div>
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
            <ItemRow href={href(key)}>
              <ItemName
                name={String(item[nameField])}
                removed={change === 'removed'}
              />
              <ChangeStatus change={change} />
            </ItemRow>
            {lines.length ? (
              <Box flexDirection="column" pb="m">
                {lines.map((line, index) => {
                  const showLabel = lines[index - 1]?.field !== line.field
                  return (
                    <DiffLine
                      key={index}
                      line={line}
                      showLabel={showLabel}
                      showSign={change === 'changed'}
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
    <div className="animate-in fade-in duration-200 ease-out">
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
        <DiffSection
          title="Meters"
          noun="meter"
          before={parentConfig?.meters.map(meterFields) ?? []}
          after={config.meters.map(meterFields)}
          nameField="name"
          href={() => undefined}
          format={format}
        />
      </Box>
    </div>
  )
}
