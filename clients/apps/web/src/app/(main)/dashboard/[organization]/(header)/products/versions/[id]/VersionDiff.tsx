import { schemas } from '@polar-sh/client'
import { Grid, Status, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { ChevronDown } from '@polar-sh/orbit/icons'
import Link from 'next/link'
import { useId, useState } from 'react'
import {
  Change,
  CollapsedLine,
  collapseUnchanged,
  diffItems,
  Line,
} from './diff'
import {
  customFieldFields,
  fieldLabel,
  isListField,
  meterFields,
  plural,
  productFields,
  valueFormatter,
} from './format'

type Config = schemas['ConfigExportDocument']
// Each side reads ids against its own config, so a meter whose unit changed keeps its old scale on the before side
type Format = Record<
  'before' | 'after',
  (field: string, value: unknown) => string
>

const signs: Partial<Record<string, { glyph: string; color: string }>> = {
  added: { glyph: '+', color: 'text-emerald-500' },
  removed: { glyph: '−', color: 'text-red-500' },
  changed: { glyph: '~', color: 'text-amber-500' },
}

const changeStatus = {
  added: { status: 'Added', color: 'green' },
  changed: { status: 'Changed', color: 'yellow' },
  removed: { status: 'Removed', color: 'red' },
} as const

const ChangeStatus = ({ change }: { change: Change }) => (
  <Box flexShrink={0}>
    <Status {...changeStatus[change]} />
  </Box>
)

const DiffLine = ({
  line,
  startsField,
  first = false,
  format,
  expanded = false,
  onToggle,
}: {
  line: Line | CollapsedLine
  startsField: boolean
  first?: boolean
  format: Format
  expanded?: boolean
  onToggle?: () => void
}) => {
  const sign = signs[line.change]
  return (
    <Grid
      templateColumns="16px 128px minmax(0, 1fr)"
      columnGap="m"
      alignItems="baseline"
      px="xl"
      py="xs"
      borderTopWidth={startsField ? 1 : 0}
      borderStyle="solid"
      borderColor={first ? 'border-primary' : 'border-secondary'}
    >
      <span className={`font-mono font-semibold ${sign?.color ?? ''}`}>
        {sign?.glyph}
      </span>
      <Text color="muted" truncate>
        {line.change !== 'collapsed' || startsField
          ? fieldLabel(line.field)
          : null}
      </Text>
      {line.change === 'collapsed' ? (
        <button
          type="button"
          aria-expanded={expanded}
          onClick={onToggle}
          className="w-fit cursor-pointer text-left"
        >
          <Box
            as="span"
            color={{ base: 'text-secondary', hover: 'text-primary' }}
            transitionProperty="colors"
            transitionDuration="fast"
          >
            <Text as="span" color="inherit">
              {expanded ? 'Hide' : 'Show'}{' '}
              {plural(
                line.lines.length,
                `unchanged ${fieldLabel(line.field).toLowerCase()}`,
              )}
              <ToggleChevron expanded={expanded} />
            </Text>
          </Box>
        </button>
      ) : line.change === 'changed' ? (
        <Box alignItems="baseline" columnGap="s" minWidth={0} flexWrap="wrap">
          <Text color="muted">{format.before(line.field, line.before)}</Text>
          <Text color="muted">→</Text>
          <Text>{format.after(line.field, line.after)}</Text>
        </Box>
      ) : (
        <Text color={line.change === 'added' ? 'default' : 'muted'}>
          {line.change === 'removed'
            ? format.before(line.field, line.before)
            : format.after(line.field, line.after)}
        </Text>
      )}
    </Grid>
  )
}

const ToggleChevron = ({ expanded }: { expanded: boolean }) => (
  <span className="ml-1 inline-block align-middle">
    <Box
      as="span"
      display="block"
      color="text-tertiary"
      transform={expanded ? 'rotate(180deg)' : 'none'}
      transitionProperty="transform"
      transitionDuration="fast"
      ease="standard"
    >
      <ChevronDown size={14} strokeWidth={1.5} aria-hidden className="block" />
    </Box>
  </span>
)

const Expandable = ({
  expanded,
  id,
  children,
}: {
  expanded: boolean
  id?: string
  children: React.ReactNode
}) => (
  <div
    id={id}
    inert={!expanded}
    className={`grid transition-[grid-template-rows] duration-[120ms] ease-[cubic-bezier(0.2,0,0,1)] motion-reduce:transition-none ${expanded ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}
  >
    <Box
      flexDirection="column"
      minHeight={0}
      overflow="hidden"
      opacity={expanded ? 1 : 0}
      transitionProperty="opacity"
      transitionDuration="fast"
      ease="decelerate"
    >
      {children}
    </Box>
  </div>
)

const CollapsedLines = ({
  line,
  startsField,
  first,
  format,
}: {
  line: CollapsedLine
  startsField: boolean
  first: boolean
  format: Format
}) => {
  const [expanded, setExpanded] = useState(false)
  return (
    <>
      <DiffLine
        line={line}
        startsField={startsField}
        first={first}
        format={format}
        expanded={expanded}
        onToggle={() => setExpanded((open) => !open)}
      />
      <Expandable expanded={expanded}>
        {line.lines.map((unchanged, index) => (
          <DiffLine
            key={index}
            line={unchanged}
            startsField={false}
            format={format}
          />
        ))}
      </Expandable>
    </>
  )
}

const ItemRow = ({ children }: { children: React.ReactNode }) => (
  <Box
    alignItems="baseline"
    justifyContent="between"
    columnGap="l"
    px="xl"
    py="m"
    minWidth={0}
  >
    {children}
  </Box>
)

const ItemName = ({
  name,
  href,
  removed = false,
  muted = false,
}: {
  name: string
  href?: string
  removed?: boolean
  muted?: boolean
}) => (
  <Text
    variant="body"
    color={removed || muted ? 'muted' : 'default'}
    lineThrough={removed}
    truncate
  >
    {href ? (
      <Link
        href={href}
        className="hover:underline hover:decoration-current/30 hover:underline-offset-4"
      >
        {name}
      </Link>
    ) : (
      name
    )}
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
  href?: (externalId: string) => string | undefined
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
          <Text as="span" color="inherit">
            {plural(items.length, `unchanged ${noun}`)}
            <ToggleChevron expanded={expanded} />
          </Text>
        </Box>
      </button>
      <Expandable expanded={expanded} id={panelId}>
        {items.map((item) => (
          <Box
            key={item.external_id}
            flexDirection="column"
            borderTopWidth={1}
            borderStyle="solid"
            borderColor="border-secondary"
          >
            <ItemRow>
              <ItemName
                name={String(item[nameField])}
                href={href?.(item.external_id)}
                muted
              />
            </ItemRow>
          </Box>
        ))}
      </Expandable>
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
  href?: (externalId: string) => string | undefined
  format: Format
}) => {
  const { entries, unchanged } = diffItems(before, after, nameField)
  if (!entries.length && !unchanged.length) return null

  return (
    <Box as="section" flexDirection="column" rowGap="m">
      <Text variant="heading-xxs" as="h2">
        {title}
      </Text>
      <Box flexDirection="column" rowGap="m">
        {entries.map(({ key, item, change, lines }) => (
          <Box
            key={key}
            flexDirection="column"
            borderRadius="l"
            borderWidth={1}
            borderStyle="solid"
            borderColor="border-primary"
            overflow="hidden"
          >
            <ItemRow>
              <ItemName
                name={String(item[nameField])}
                href={href?.(key)}
                removed={change === 'removed'}
              />
              <ChangeStatus change={change} />
            </ItemRow>
            {lines.length ? (
              <Box flexDirection="column" pb="xs">
                {collapseUnchanged(lines, isListField).map(
                  (line, index, rows) => {
                    const startsField = rows[index - 1]?.field !== line.field
                    return line.change === 'collapsed' ? (
                      <CollapsedLines
                        key={index}
                        line={line}
                        startsField={startsField}
                        first={index === 0}
                        format={format}
                      />
                    ) : (
                      <DiffLine
                        key={index}
                        line={line}
                        startsField={startsField}
                        first={index === 0}
                        format={format}
                      />
                    )
                  },
                )}
              </Box>
            ) : null}
          </Box>
        ))}
        {unchanged.length ? (
          <Box
            flexDirection="column"
            borderRadius="l"
            borderWidth={1}
            borderStyle="solid"
            borderColor="border-primary"
            overflow="hidden"
          >
            <UnchangedItems
              items={unchanged}
              noun={noun}
              nameField={nameField}
              href={href}
              bordered={false}
            />
          </Box>
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
  meterHref,
}: {
  config: Config
  parentConfig?: Config
  productHref: (externalId: string) => string | undefined
  benefitHref: (externalId: string) => string | undefined
  meterHref: (externalId: string) => string | undefined
}) => {
  const format = {
    before: valueFormatter(parentConfig ? [config, parentConfig] : [config]),
    after: valueFormatter(parentConfig ? [parentConfig, config] : [config]),
  }

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
          href={meterHref}
          format={format}
        />
        <DiffSection
          title="Custom fields"
          noun="custom field"
          before={parentConfig?.custom_fields?.map(customFieldFields) ?? []}
          after={config.custom_fields?.map(customFieldFields) ?? []}
          nameField="name"
          format={format}
        />
      </Box>
    </div>
  )
}
