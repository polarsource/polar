import { SkeletonBar } from '@/components/Events/EventDetailSkeleton'
import { HistogramBar } from '@/components/Events/HistogramBar'
import { useElementWidth } from '@/components/Events/useElementWidth'
import {
  Button,
  Text,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { ArrowUpRight, X } from '@polar-sh/orbit/icons'
import Link from 'next/link'
import { ReactNode } from 'react'

export const CostPanelShell = ({
  title,
  subtitle,
  href,
  hrefLabel,
  actions,
  onClose,
  children,
}: {
  title: ReactNode
  subtitle?: string | null
  href?: string
  hrefLabel?: string
  actions?: ReactNode
  onClose: () => void
  children: ReactNode
}) => (
  <div className="dark:bg-polar-900 dark:border-polar-800 fixed inset-0 z-50 flex flex-col overflow-y-auto bg-white lg:static lg:z-auto lg:w-[400px] lg:shrink-0 lg:rounded-2xl lg:border lg:border-gray-200 lg:shadow-xs">
    <Box
      alignItems="start"
      justifyContent="between"
      gap="s"
      paddingLeft="l"
      paddingRight="m"
      paddingVertical="m"
    >
      <Box flexDirection="column" minWidth={0}>
        {title !== null ? (
          <Text truncate>{title}</Text>
        ) : (
          <Box height={20} alignItems="center">
            <SkeletonBar width={140} />
          </Box>
        )}
        {subtitle && (
          <Text color="muted" truncate>
            {subtitle}
          </Text>
        )}
      </Box>
      <Box alignItems="center" gap="xs" flexShrink={0} marginTop="-xs">
        {actions}
        {href && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Link
                href={href}
                aria-label={hrefLabel}
                className="dark:hover:bg-polar-700 flex h-7 w-7 items-center justify-center rounded-full text-black transition-colors hover:bg-gray-200 dark:text-white"
              >
                <ArrowUpRight className="h-4 w-4" />
              </Link>
            </TooltipTrigger>
            <TooltipContent>{hrefLabel}</TooltipContent>
          </Tooltip>
        )}
        <Button
          size="icon"
          variant="ghost"
          className="h-7 w-7"
          aria-label="Close"
          title="Close"
          onClick={onClose}
        >
          <X className="h-4 w-4" />
        </Button>
      </Box>
    </Box>
    {children}
  </div>
)

export const CostPanelSection = ({
  title,
  caption,
  action,
  children,
}: {
  title?: string
  caption?: string
  action?: ReactNode
  children: ReactNode
}) => (
  <Box
    flexDirection="column"
    gap="s"
    paddingHorizontal="l"
    paddingVertical="m"
    borderTopWidth={1}
    borderStyle="solid"
    borderColor="border-secondary"
  >
    {title && (
      <Box alignItems="center" justifyContent="between" minHeight={24}>
        <Box alignItems="baseline" gap="s" minWidth={0}>
          <Text>{title}</Text>
          {caption && (
            <Text color="muted" truncate>
              {caption}
            </Text>
          )}
        </Box>
        {action}
      </Box>
    )}
    {children}
  </Box>
)

export const CostFact = ({
  label,
  value,
}: {
  label: string
  value: ReactNode
}) => (
  <Box justifyContent="between" alignItems="baseline" gap="m" minHeight={28}>
    <Text color="muted">{label}</Text>
    <Text tabularNums truncate>
      {value ?? '—'}
    </Text>
  </Box>
)

// Whole-pixel slots keep every gap the same width; fractional flex widths
// round each edge separately and leave gaps of 0 to 2px.
export const CostMiniChart = ({ values }: { values: number[] }) => {
  const max = Math.max(1, ...values)
  const [measureRef, width] = useElementWidth<HTMLDivElement>()
  const slot = values.length > 0 ? width / values.length : 0
  const gap = slot >= 6 ? 2 : 1
  const edge = (index: number) => Math.floor(index * slot)
  const isMeasured = Math.floor(slot) - gap >= 1

  return (
    <div ref={measureRef}>
      <Box
        height={48}
        alignItems="end"
        borderBottomWidth={1}
        borderStyle="solid"
        borderColor="border-primary"
      >
        {isMeasured &&
          values.map((value, index) => (
            <Box
              key={index}
              height="100%"
              alignItems="end"
              flexShrink={0}
              width={edge(index + 1) - edge(index)}
            >
              <HistogramBar
                value={value}
                max={max}
                index={index}
                total={values.length}
                state="idle"
                highlighted={false}
                width={edge(index + 1) - edge(index) - gap}
              />
            </Box>
          ))}
      </Box>
    </div>
  )
}

export const eventCostCents = (metadata: Record<string, unknown>) => {
  const cost = metadata._cost as { amount?: string | number } | undefined
  return cost?.amount !== undefined ? Number(cost.amount) : null
}

const FACT_WIDTHS = [64, 40, 48, 56, 52, 60]

// Holds the shape of the chart and figure rows while the stats load.
export const CostFactsSkeleton = ({ rows }: { rows: number }) => (
  <CostPanelSection>
    <Box flexDirection="column" aria-busy="true">
      <SkeletonBar width="100%" height={48} />
      <Box flexDirection="column" paddingTop="s">
        {FACT_WIDTHS.slice(0, rows).map((width, index) => (
          <Box
            key={index}
            alignItems="center"
            justifyContent="between"
            minHeight={28}
          >
            <SkeletonBar width={width} />
            <SkeletonBar width={width + 16} />
          </Box>
        ))}
      </Box>
    </Box>
  </CostPanelSection>
)

const ROW_WIDTHS = [96, 72, 112, 80, 88]

export const CostListSkeleton = () => (
  <CostPanelSection>
    <Box flexDirection="column" aria-busy="true">
      <Box alignItems="center" minHeight={24}>
        <SkeletonBar width={96} />
      </Box>
      {ROW_WIDTHS.map((width, index) => (
        <Box key={index} alignItems="center" gap="m" minHeight={32}>
          <SkeletonBar width={88} />
          <Box flexGrow={1}>
            <SkeletonBar width={width} />
          </Box>
          <SkeletonBar width={56} />
        </Box>
      ))}
    </Box>
  </CostPanelSection>
)
