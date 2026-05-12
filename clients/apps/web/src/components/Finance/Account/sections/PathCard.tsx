'use client'

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
  docsUrl?: string
}

export const PathCard = ({
  title,
  description,
  href,
  onClick,
  recommended,
  docsUrl,
}: PathCardProps) => {
  const inner = (
    <>
      <Box
        display="flex"
        alignItems="center"
        justifyContent="between"
        columnGap="s"
      >
        <Text variant="default">{title}</Text>
        {recommended && <Pill color="blue">Recommended</Pill>}
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

  return (
    <Box
      as="article"
      display="flex"
      flexDirection="column"
      borderRadius="m"
      borderWidth={1}
      borderStyle="solid"
      borderColor="border-primary"
      backgroundColor={{ hover: 'background-card' }}
    >
      {href ? (
        <Link
          href={href}
          className="flex flex-col gap-y-2 p-5 focus:outline-none"
        >
          {inner}
        </Link>
      ) : (
        <button
          type="button"
          onClick={onClick}
          className="flex cursor-pointer flex-col gap-y-2 p-4 text-left focus:outline-none"
        >
          {inner}
        </button>
      )}
    </Box>
  )
}
