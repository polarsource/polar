import { Grid, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import Link from 'next/link'
import { ComponentProps, ReactNode } from 'react'

const BAR_STAGGER_MS = 40

export interface MonthlyBar {
  key: string
  label: string
  value: number | null
  formatted: string
  highlighted?: boolean
  href?: string
}

// A flex-grow below 1 takes only that share of the free space, so each bar's
// length is its value relative to the largest value on its side of zero.
const Bar = ({
  share,
  index,
  highlighted,
  negative,
}: {
  share: number
  index: number
  highlighted: boolean
  negative: boolean
}) => (
  <div
    className={`motion-safe:animate-bar-grow-x flex ${negative ? 'origin-right' : 'origin-left'}`}
    style={{
      flexGrow: share,
      flexBasis: 0,
      minWidth: 2,
      animationDelay: `${index * BAR_STAGGER_MS}ms`,
    }}
  >
    <Box
      flex={1}
      color={negative ? 'text-danger' : 'text-primary'}
      opacity={highlighted || negative ? 1 : 0.4}
    >
      <div className="w-full bg-current" />
    </Box>
  </div>
)

// Same hairline-divided rows as the list widgets, split into grid cells so the
// label and value columns line up across months.
const Row = (props: ComponentProps<typeof Box>) => (
  <Box
    alignItems="center"
    paddingVertical="s"
    borderTopWidth={1}
    borderStyle="solid"
    borderColor="border-secondary"
    {...props}
  />
)

// Each month spans the three columns as a subgrid, so a whole row can be one
// link while its cells still line up with the other months.
const MonthRow = ({ href, children }: { href?: string; children: ReactNode }) =>
  href ? (
    <Link
      href={href}
      className="col-span-3 grid grid-cols-subgrid hover:opacity-60"
    >
      {children}
    </Link>
  ) : (
    <div className="col-span-3 grid grid-cols-subgrid">{children}</div>
  )

export const MonthlyBars = ({
  bars,
  loading,
  max,
}: {
  bars: MonthlyBar[]
  loading?: boolean
  max?: number
}) => {
  const values = bars.map((bar) => bar.value ?? 0)
  const high = max ?? Math.max(0, ...values)
  const low = Math.min(0, ...values)

  return (
    <Grid templateColumns="auto minmax(0, 1fr) auto">
      {bars.toReversed().map((bar, index) => {
        const value = loading ? 0 : (bar.value ?? 0)
        const highlighted = bar.highlighted ?? false
        const labelColor = highlighted ? 'default' : 'muted'

        return (
          <MonthRow key={bar.key} href={bar.href}>
            <Row>
              <Text color={labelColor}>{bar.label}</Text>
            </Row>
            <Row paddingHorizontal="l">
              <Box
                flex={1}
                height={4}
                alignItems="stretch"
                backgroundColor="background-card"
              >
                {low < 0 && (
                  <Box flexGrow={-low} flexBasis={0} justifyContent="end">
                    {value < 0 && (
                      <Bar
                        share={value / low}
                        index={index}
                        highlighted={highlighted}
                        negative
                      />
                    )}
                  </Box>
                )}
                <Box flexGrow={low < 0 ? high : 1} flexBasis={0}>
                  {value > 0 && (
                    <Bar
                      share={value / high}
                      index={index}
                      highlighted={highlighted}
                      negative={false}
                    />
                  )}
                </Box>
              </Box>
            </Row>
            <Row justifyContent="end">
              <Text
                color={(bar.value ?? 0) < 0 ? 'danger' : labelColor}
                tabularNums
              >
                {loading ? '–' : bar.formatted}
              </Text>
            </Row>
          </MonthRow>
        )
      })}
    </Grid>
  )
}
