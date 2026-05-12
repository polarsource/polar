'use client'

import { schemas } from '@polar-sh/client'
import { Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import Pill from '@polar-sh/ui/components/atoms/Pill'
import { ExternalLinkIcon } from 'lucide-react'
import Link from 'next/link'
import type { ReactNode } from 'react'

export interface PathCardProps {
  title: string
  description: string
  href?: string
  onClick?: () => void
  recommended?: boolean
  required?: boolean
  status?: schemas['OrganizationReviewCheckStatus']
  docsUrl?: string
  extra?: ReactNode
}

interface BadgeProps {
  status?: schemas['OrganizationReviewCheckStatus']
  required?: boolean
  recommended?: boolean
}

const Badge = ({ status, required, recommended }: BadgeProps) => {
  if (status === 'passed') return <Pill color="green">Completed</Pill>
  if (status === 'failed') {
    return (
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
    )
  }
  if (status === 'warning') {
    return (
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
    )
  }
  if (required) return <Pill color="gray">Required</Pill>
  if (recommended) return <Pill color="blue">Recommended</Pill>
  return null
}

interface InnerProps {
  title: string
  description: string
  docsUrl?: string
  status?: schemas['OrganizationReviewCheckStatus']
  required?: boolean
  recommended?: boolean
}

const Inner = ({
  title,
  description,
  docsUrl,
  status,
  required,
  recommended,
}: InnerProps) => (
  <>
    <Box
      display="flex"
      alignItems="center"
      justifyContent="between"
      columnGap="s"
    >
      <Text variant="default">{title}</Text>
      <Badge status={status} required={required} recommended={recommended} />
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

const Header = ({ children }: { children: ReactNode }) => (
  <Box display="flex" flexDirection="column" rowGap="s" padding="l">
    {children}
  </Box>
)

interface ContentProps {
  href?: string
  onClick?: () => void
  children: ReactNode
}

const Content = ({ href, onClick, children }: ContentProps) => {
  if (href) {
    return (
      <Link href={href} className="flex flex-col focus:outline-none">
        {children}
      </Link>
    )
  }
  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className="flex cursor-pointer flex-col text-left focus:outline-none"
      >
        {children}
      </button>
    )
  }
  return children
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
      <Content href={href} onClick={onClick}>
        <Header>
          <Inner
            title={title}
            description={description}
            docsUrl={docsUrl}
            status={status}
            required={required}
            recommended={recommended}
          />
        </Header>
        {extra}
      </Content>
    </Box>
  )
}
