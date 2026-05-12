'use client'

import { schemas } from '@polar-sh/client'
import { Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import Pill from '@polar-sh/ui/components/atoms/Pill'
import { ExternalLinkIcon } from 'lucide-react'
import Link from 'next/link'

export interface PathCardProps {
  title: string
  description: string
  href?: string
  onClick?: () => void
  recommended?: boolean
  required?: boolean
  status?: schemas['OrganizationReviewCheckStatus']
  docsUrl?: string
  extra?: React.ReactNode
}

export const PathCard = ({
  title,
  description,
  href,
  onClick,
  recommended,
  required,
  status,
  docsUrl,
  extra,
}: PathCardProps) => {
  const badge =
    status === 'passed' ? (
      <Pill color="green">Completed</Pill>
    ) : status === 'failed' ? (
      <Box
        display="inline-flex"
        alignItems="center"
        paddingHorizontal="s"
        paddingVertical="xs"
        borderRadius="full"
        backgroundColor="background-danger"
        color="text-danger"
      >
        <Text variant="label" color="inherit">
          Failed
        </Text>
      </Box>
    ) : status === 'warning' ? (
      <Box
        display="inline-flex"
        alignItems="center"
        paddingHorizontal="s"
        paddingVertical="xs"
        borderRadius="full"
        backgroundColor="background-warning"
        color="text-warning"
      >
        <Text variant="label" color="inherit">
          Warning
        </Text>
      </Box>
    ) : required ? (
      <Pill color="gray">Required</Pill>
    ) : recommended ? (
      <Pill color="blue">Recommended</Pill>
    ) : null

  const inner = (
    <>
      <Box
        display="flex"
        alignItems="center"
        justifyContent="between"
        columnGap="s"
      >
        <Text variant="default">{title}</Text>
        {badge}
      </Box>
      <Text variant="caption" color="muted">
        {description}
        {docsUrl && (
          <>
            {' '}
            <a
              href={docsUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="dark:text-polar-300 dark:hover:text-polar-100 inline-flex items-baseline gap-x-1 text-gray-700 underline underline-offset-2 hover:text-gray-900"
            >
              Learn more
              <ExternalLinkIcon className="h-3 w-3 translate-y-0.5" />
            </a>
          </>
        )}
      </Text>
    </>
  )

  const headerWithPadding = (
    <Box display="flex" flexDirection="column" rowGap="s" padding="l">
      {inner}
    </Box>
  )

  const interactive = !!href || !!onClick

  return (
    <Box
      as="article"
      display="flex"
      flexDirection="column"
      borderRadius="m"
      borderWidth={1}
      borderStyle="solid"
      borderColor="border-primary"
      backgroundColor={interactive ? { hover: 'background-card' } : undefined}
      overflow="hidden"
    >
      {href ? (
        <Link href={href} className="flex flex-col focus:outline-none">
          {headerWithPadding}
          {extra}
        </Link>
      ) : onClick ? (
        <button
          type="button"
          onClick={onClick}
          className="flex cursor-pointer flex-col text-left focus:outline-none"
        >
          {headerWithPadding}
          {extra}
        </button>
      ) : (
        <>
          {headerWithPadding}
          {extra}
        </>
      )}
    </Box>
  )
}
