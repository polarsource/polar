'use client'

import { schemas } from '@polar-sh/client'
import {
  Pill,
  Text,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { Check, Copy } from '@polar-sh/orbit/icons'
import FormattedDateTime from '@polar-sh/ui/components/atoms/FormattedDateTime'
import PolarTimeAgo from '@polar-sh/ui/components/atoms/PolarTimeAgo'
import { useEffect, useState } from 'react'
import type { Summary } from './diff'

const WEEK_MS = 7 * 24 * 60 * 60 * 1000

export const PublishedAt = ({ catalog }: { catalog: schemas['Catalog'] }) => {
  const [now] = useState(() => Date.now())
  const datetime = catalog.published_at ?? catalog.created_at

  if (now - new Date(datetime).getTime() >= WEEK_MS) {
    return <FormattedDateTime datetime={datetime} />
  }

  return (
    <Tooltip delayDuration={150}>
      <TooltipTrigger asChild>
        <span>
          <PolarTimeAgo date={new Date(datetime)} />
        </span>
      </TooltipTrigger>
      <TooltipContent>
        <FormattedDateTime datetime={datetime} resolution="time" />
      </TooltipContent>
    </Tooltip>
  )
}

export const HashChip = ({ hash }: { hash: string }) => {
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!copied) return
    const timeout = setTimeout(() => setCopied(false), 1200)
    return () => clearTimeout(timeout)
  }, [copied])

  return (
    <button
      type="button"
      aria-label={copied ? 'Copied' : 'Copy version hash'}
      onClick={(event) => {
        event.stopPropagation()
        navigator.clipboard.writeText(hash).then(() => setCopied(true))
      }}
    >
      <Box
        as="span"
        display="inline-flex"
        alignItems="center"
        columnGap="xs"
        paddingHorizontal="s"
        paddingVertical="xs"
        borderRadius="s"
        backgroundColor="background-secondary"
        color={{ base: 'text-secondary', hover: 'text-primary' }}
        transitionProperty="colors"
        transitionDuration="fast"
      >
        <Text as="span" variant="caption" color="inherit" monospace>
          {hash.slice(0, 7)}
        </Text>
        {copied ? <Check size={12} /> : <Copy size={12} />}
      </Box>
    </button>
  )
}

export const CurrentBadge = () => (
  <Box
    as="span"
    display="inline-flex"
    paddingHorizontal="s"
    paddingVertical="xs"
    borderRadius="full"
    backgroundColor="background-inverse"
    flexShrink={0}
  >
    <Text as="span" variant="caption" color="inverse">
      Current
    </Text>
  </Box>
)

export const Pulse = ({ width, height }: { width: number; height: number }) => (
  <span className="animate-pulse">
    <Box
      as="span"
      display="inline-flex"
      width={width}
      height={height}
      borderRadius="full"
      backgroundColor="background-secondary"
    />
  </span>
)

export const SummaryPills = ({
  summary,
  initial,
}: {
  summary: Summary | undefined
  initial: boolean
}) => {
  if (!summary) return <Pulse width={88} height={20} />
  const total =
    summary.added + summary.changed + summary.removed + summary.unchanged
  if (initial) {
    return (
      <Text as="span" variant="caption" color="muted">
        {total} {total === 1 ? 'product' : 'products'}
      </Text>
    )
  }
  return (
    <Box alignItems="center" columnGap="s" flexShrink={0}>
      {summary.added > 0 ? (
        <Pill color="green">+{summary.added} added</Pill>
      ) : null}
      {summary.changed > 0 ? (
        <Pill color="blue">~{summary.changed} changed</Pill>
      ) : null}
      {summary.removed > 0 ? (
        <Pill color="red">−{summary.removed} removed</Pill>
      ) : null}
      {summary.unchanged > 0 ? (
        <Text as="span" variant="caption" color="muted">
          {summary.unchanged} unchanged
        </Text>
      ) : null}
    </Box>
  )
}

export const Rail = ({
  current,
  isFirst,
  isLast,
}: {
  current: boolean
  isFirst: boolean
  isLast: boolean
}) => (
  <Box position="relative">
    {!isFirst ? (
      <Box
        position="absolute"
        left={13}
        top={0}
        height={22}
        borderLeftWidth={2}
        borderStyle="solid"
        borderColor="border-primary"
      />
    ) : null}
    {!isLast ? (
      <Box
        position="absolute"
        left={13}
        top={34}
        bottom="-l"
        borderLeftWidth={2}
        borderStyle="solid"
        borderColor="border-primary"
      />
    ) : null}
    <Box
      position="absolute"
      left={8}
      top={22}
      width={12}
      height={12}
      borderRadius="full"
      zIndex={1}
      backgroundColor={current ? 'background-inverse' : 'background-card'}
      borderWidth={current ? 0 : 2}
      borderStyle="solid"
      borderColor="border-primary"
    />
  </Box>
)
