'use client'

import { Alert, Button, Status, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { KeyboardEvent, ReactNode } from 'react'
import { PrototypeVariant } from './model'

export type ResolutionPresentation = PrototypeVariant

export interface ResolutionChoiceOption {
  id: string
  label: string
  selected: boolean
  recommended?: boolean
  onSelect: () => void
}

function nextRadioIndex(
  key: string,
  current: number,
  length: number,
): number | null {
  if (key === 'ArrowRight' || key === 'ArrowDown') {
    return (current + 1) % length
  }
  if (key === 'ArrowLeft' || key === 'ArrowUp') {
    return (current - 1 + length) % length
  }
  if (key === 'Home') {
    return 0
  }
  if (key === 'End') {
    return length - 1
  }
  return null
}

function handleRadioKeyDown(
  event: KeyboardEvent<HTMLButtonElement>,
  index: number,
  options: ResolutionChoiceOption[],
) {
  const next = nextRadioIndex(event.key, index, options.length)
  if (next === null) {
    return
  }
  event.preventDefault()
  options[next].onSelect()
  const radios =
    event.currentTarget.parentElement?.querySelectorAll<HTMLElement>(
      '[role="radio"]',
    )
  radios?.[next]?.focus()
}

export function FactLine({ label, value }: { label: string; value: string }) {
  return (
    <Box flexDirection="column" rowGap="xs" minWidth={0}>
      <Text variant="caption" color="muted">
        {label}
      </Text>
      <Text variant="body">{value}</Text>
    </Box>
  )
}

export function ComparePanel({
  title,
  children,
  compact,
}: {
  title: string
  children: ReactNode
  compact?: boolean
}) {
  return (
    <Box
      flexDirection="column"
      rowGap={compact ? 's' : 'm'}
      padding={compact ? 'm' : 'l'}
      borderRadius="m"
      borderWidth={1}
      borderStyle="solid"
      borderColor="border-secondary"
      backgroundColor="background-secondary"
      flex={1}
      minWidth={0}
    >
      <Text variant="label">{title}</Text>
      {children}
    </Box>
  )
}

export function ResolutionChoiceGroup({
  label,
  options,
  compact,
}: {
  label: string
  options: ResolutionChoiceOption[]
  compact?: boolean
}) {
  const selectedIndex = options.findIndex((option) => option.selected)
  return (
    <Box
      role="radiogroup"
      aria-label={label}
      flexDirection="column"
      rowGap={compact ? 'xs' : 's'}
    >
      {options.map((option, index) => (
        <Button
          key={option.id}
          type="button"
          role="radio"
          aria-checked={option.selected}
          tabIndex={
            option.selected || (selectedIndex === -1 && index === 0) ? 0 : -1
          }
          variant={option.selected ? 'default' : 'secondary'}
          size={compact ? 'sm' : 'default'}
          onClick={option.onSelect}
          onKeyDown={(event) => handleRadioKeyDown(event, index, options)}
          fullWidth
        >
          {option.recommended
            ? `Polar recommends · ${option.label}`
            : option.label}
        </Button>
      ))}
    </Box>
  )
}

export function SelectedImpact({
  label,
  impact,
  compact,
}: {
  label: string | null
  impact: string | null
  compact?: boolean
}) {
  if (!label || !impact) {
    return (
      <Text variant="caption" color="muted">
        No choice selected yet. Pick an option above to continue.
      </Text>
    )
  }

  return (
    <Alert
      variant="info"
      title={compact ? label : `Selected: ${label}`}
      description={impact}
    />
  )
}

export function ResolverFrame({
  presentation,
  resolved,
  eyebrow,
  headline,
  context,
  children,
}: {
  presentation: ResolutionPresentation
  resolved: boolean
  eyebrow: string
  headline: string
  context: string
  children: ReactNode
}) {
  const compact = presentation === 'tower' || presentation === 'current'
  const padding = compact ? 'l' : 'xl'
  const gap = compact ? 'm' : 'l'

  return (
    <Box
      as="section"
      flexDirection="column"
      rowGap={gap}
      padding={padding}
      borderRadius="l"
      borderWidth={1}
      borderStyle="solid"
      borderColor={resolved ? 'border-primary' : 'border-warning'}
      backgroundColor={resolved ? 'background-card' : 'background-warning'}
      aria-label={`${eyebrow}: ${headline}`}
    >
      <Box alignItems="center" justifyContent="between" gap="s" flexWrap="wrap">
        <Text variant="caption" color="muted">
          {eyebrow}
        </Text>
        <Status
          status={resolved ? 'Resolved' : 'Needs decision'}
          color={resolved ? 'green' : 'yellow'}
          size="small"
        />
      </Box>
      <Box flexDirection="column" rowGap="xs">
        <Text variant={compact ? 'body' : 'heading-xs'} as="h3">
          {headline}
        </Text>
        <Text variant="caption" color="muted" wrap="pretty">
          {context}
        </Text>
      </Box>
      {children}
    </Box>
  )
}
