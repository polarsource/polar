import { Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { Circle } from 'lucide-react'

export type ReviewFilter = 'attention' | 'skipped' | 'all'

type Tone = 'warning' | 'danger' | null

const OPTIONS: { value: ReviewFilter; label: string; tone: Tone }[] = [
  { value: 'attention', label: 'Needs attention', tone: 'warning' },
  { value: 'skipped', label: "Won't import", tone: 'danger' },
  { value: 'all', label: 'All rows', tone: null },
]

export const EMPTY_MESSAGES: Record<ReviewFilter, string> = {
  attention: 'Nothing needs attention. Everything here is ready to import.',
  skipped: 'Nothing is staying on Stripe.',
  all: 'No records to show.',
}

const DOT_COLOR = {
  warning: 'text-warning',
  danger: 'text-danger',
} as const

interface Props {
  value: ReviewFilter
  onChange: (filter: ReviewFilter) => void
}

export function ReviewStatusTabs({ value, onChange }: Props) {
  return (
    <Box
      alignItems="center"
      columnGap="xs"
      padding="xs"
      borderRadius="full"
      backgroundColor="background-secondary"
    >
      {OPTIONS.map((option) => {
        const active = option.value === value
        return (
          <Box
            key={option.value}
            role="tab"
            tabIndex={0}
            aria-selected={active}
            alignItems="center"
            columnGap="xs"
            paddingHorizontal="m"
            paddingVertical="xs"
            borderRadius="full"
            cursor={{ hover: 'pointer' }}
            backgroundColor={active ? 'background-primary' : undefined}
            boxShadow={active ? 's' : undefined}
            onClick={() => onChange(option.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault()
                onChange(option.value)
              }
            }}
          >
            {option.tone && (
              <Box color={DOT_COLOR[option.tone]} alignItems="center">
                <Circle size={8} fill="currentColor" strokeWidth={0} />
              </Box>
            )}
            <Text
              variant="caption"
              color={active ? (option.tone ?? 'default') : 'muted'}
            >
              {option.label}
            </Text>
          </Box>
        )
      })}
    </Box>
  )
}
