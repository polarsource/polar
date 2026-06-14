import { Box } from '@polar-sh/orbit/Box'
import {
  Text,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@polar-sh/orbit'
import { type ReactNode } from 'react'
import { getGeneratedProps, propSourceUrl } from '@/lib/props-data'

export interface PropRow {
  name: string
  type: string
  default?: string
  description?: ReactNode
  required?: boolean
}

// Types longer than this are truncated in the chip and revealed in full on
// hover, so long unions don't blow out the row.
const TYPE_MAX = 32

interface ResolvedRow extends PropRow {
  source?: { path: string; line: number }
}

function Chip({ children }: { children: ReactNode }) {
  return (
    <Box
      as="span"
      display="inline-flex"
      alignItems="center"
      columnGap="xs"
      paddingHorizontal="s"
      paddingVertical="xs"
      borderRadius="s"
      backgroundColor="background-card"
    >
      {children}
    </Box>
  )
}

// The chip links to its definition source on GitHub when known. The <a> (or
// the bare Box) is a single ref-forwarding element, so it works as a Radix
// TooltipTrigger via asChild — a wrapper component would drop the ref/handlers
// and the trigger would render empty on the client.
function TypeChip({
  type,
  source,
}: {
  type: string
  source?: { path: string; line: number }
}) {
  const isLong = type.length > TYPE_MAX
  const label = isLong ? `${type.slice(0, TYPE_MAX - 1).trimEnd()}…` : type
  const chip = (
    <Box
      as="span"
      display="inline-flex"
      alignItems="center"
      paddingHorizontal="s"
      paddingVertical="xs"
      borderRadius="s"
      backgroundColor="background-card"
    >
      <Text monospace color="accent" as="span">
        {label}
      </Text>
    </Box>
  )

  const trigger = source ? (
    <a
      href={propSourceUrl(source)}
      target="_blank"
      rel="noreferrer"
      title="View definition on GitHub"
    >
      {chip}
    </a>
  ) : (
    chip
  )

  if (!isLong) {
    return trigger
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>{trigger}</TooltipTrigger>
      <TooltipContent>
        <Box maxWidth={360}>
          <Text monospace color="inherit" wrap="pretty">
            {type}
          </Text>
        </Box>
      </TooltipContent>
    </Tooltip>
  )
}

// Merge each curated row with the AST-extracted data (type/required/default/
// source win when present), so the displayed types stay in sync with source.
function resolveRows(rows: PropRow[], slug?: string): ResolvedRow[] {
  if (!slug) return rows
  const generated = getGeneratedProps(slug)
  return rows.map((row) => {
    const gen = generated.get(row.name)
    if (!gen) return row
    return {
      ...row,
      type: gen.type,
      required: row.required ?? gen.required,
      default: row.default ?? gen.default,
      source: gen.source,
    }
  })
}

export function PropsTable({ rows, slug }: { rows: PropRow[]; slug?: string }) {
  const resolved = resolveRows(rows, slug)

  return (
    <TooltipProvider delayDuration={150}>
      <Box
        flexDirection="column"
        borderBottomWidth={1}
        borderStyle="solid"
        borderColor="border-primary"
      >
        {resolved.map((row) => (
          <Box
            key={row.name}
            flexDirection="column"
            rowGap="m"
            paddingVertical="l"
            borderTopWidth={1}
            borderStyle="solid"
            borderColor="border-primary"
          >
            <Box alignItems="center" columnGap="s" flexWrap="wrap">
              <Text monospace color="default">
                {row.name}
              </Text>
              <TypeChip type={row.type} source={row.source} />
              {row.default !== undefined && (
                <Chip>
                  <Text monospace color="default" as="span">
                    {`default: ${row.default}`}
                  </Text>
                </Chip>
              )}
              {row.required && (
                <Text monospace color="danger">
                  required
                </Text>
              )}
            </Box>
            {row.description && (
              <Text variant="default" color="muted">
                {row.description}
              </Text>
            )}
          </Box>
        ))}
      </Box>
    </TooltipProvider>
  )
}
