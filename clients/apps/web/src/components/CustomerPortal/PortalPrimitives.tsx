import ArrowBackOutlined from '@mui/icons-material/ArrowBackOutlined'
import { Text } from '@polar-sh/orbit'
import { Box, type BoxProps } from '@polar-sh/orbit/Box'
import Link from 'next/link'
import type { ReactNode } from 'react'
import { twMerge } from 'tailwind-merge'

type PortalTextTone = 'primary' | 'secondary' | 'tertiary' | 'danger'

export const PortalText = ({
  tone = 'primary',
  block = false,
  className,
  children,
}: {
  tone?: PortalTextTone
  block?: boolean
  className?: string
  children?: ReactNode
}) => (
  <Box
    as="span"
    color={`text-${tone}`}
    display={block ? 'block' : 'inline'}
    minWidth={block ? 0 : undefined}
  >
    <span className={twMerge(block && 'block', className)}>{children}</span>
  </Box>
)

export const PortalPageHeader = ({
  title,
  description,
  actions,
}: {
  title: ReactNode
  description?: ReactNode
  actions?: ReactNode
}) => (
  <Box
    flexDirection={{ base: 'column', sm: 'row' }}
    alignItems={{ base: 'start', sm: 'end' }}
    justifyContent="between"
    rowGap="l"
    columnGap="xl"
  >
    <Box flexDirection="column" minWidth={0}>
      <Text variant="heading-s" as="h1" wrap="balance">
        {title}
      </Text>
      {description ? (
        <Text variant="heading-s" as="p" color="muted" wrap="balance">
          {description}
        </Text>
      ) : null}
    </Box>
    {actions ? (
      <Box alignItems="center" columnGap="s" flexShrink={0}>
        {actions}
      </Box>
    ) : null}
  </Box>
)

export const PortalSection = ({
  title,
  description,
  actions,
  children,
}: {
  title: ReactNode
  description?: ReactNode
  actions?: ReactNode
  children?: ReactNode
}) => (
  <Box as="section" flexDirection="column" rowGap="l">
    <Box
      alignItems={{ base: 'start', sm: 'center' }}
      flexDirection={{ base: 'column', sm: 'row' }}
      justifyContent="between"
      rowGap="m"
      columnGap="l"
    >
      <Box flexDirection="column" rowGap="xs" minWidth={0}>
        <Text variant="heading-xxs" as="h2">
          {title}
        </Text>
        {description ? (
          <PortalText tone="secondary" className="text-sm">
            {description}
          </PortalText>
        ) : null}
      </Box>
      {actions ? (
        <Box alignItems="center" columnGap="s" flexShrink={0}>
          {actions}
        </Box>
      ) : null}
    </Box>
    {children}
  </Box>
)

export const PortalCard = ({ children, ...props }: BoxProps) => (
  <Box
    flexDirection="column"
    rowGap="l"
    padding={{ base: 'l', md: 'xl' }}
    borderRadius="l"
    borderWidth={1}
    borderStyle="solid"
    borderColor="border-primary"
    backgroundColor="background-primary"
    {...props}
  >
    {children}
  </Box>
)

export const PortalCardList = ({ children }: { children: ReactNode }) => (
  <Box as="ul" flexDirection="column" rowGap="s">
    {children}
  </Box>
)

export const PortalListItem = ({
  title,
  subtitle,
  meta,
  actions,
  onClick,
}: {
  title: ReactNode
  subtitle?: ReactNode
  meta?: ReactNode
  actions?: ReactNode
  onClick?: () => void
}) => (
  <Box
    as="li"
    display="flex"
    flexDirection={{ base: 'column', sm: 'row' }}
    alignItems={{ base: 'stretch', sm: 'center' }}
    justifyContent="between"
    rowGap="m"
    columnGap="l"
    paddingHorizontal={{ base: 'l', md: 'xl' }}
    paddingVertical="l"
    borderRadius="l"
    borderWidth={1}
    borderStyle="solid"
    borderColor="border-primary"
    backgroundColor={
      onClick
        ? { base: 'background-primary', hover: 'background-secondary' }
        : 'background-primary'
    }
    cursor={onClick ? 'pointer' : undefined}
    transitionProperty="colors"
    transitionDuration="fast"
    onClick={onClick}
  >
    <Box flexDirection="column" rowGap="xs" minWidth={0}>
      <PortalText block className="truncate">
        {title}
      </PortalText>
      {subtitle ? (
        <PortalText tone="secondary" block className="text-sm">
          {subtitle}
        </PortalText>
      ) : null}
    </Box>
    {meta || actions ? (
      <Box
        alignItems="center"
        justifyContent={{ base: 'between', sm: 'end' }}
        columnGap="l"
        flexShrink={0}
      >
        {meta}
        {actions ? (
          <Box
            alignItems="center"
            columnGap="s"
            onClick={(e) => e.stopPropagation()}
          >
            {actions}
          </Box>
        ) : null}
      </Box>
    ) : null}
  </Box>
)

export const PortalRow = ({
  label,
  value,
  emphasis = false,
}: {
  label: ReactNode
  value: ReactNode
  emphasis?: boolean
}) => (
  <Box justifyContent="between" alignItems="baseline" columnGap="l">
    <PortalText
      tone={emphasis ? 'primary' : 'secondary'}
      block
      className={twMerge('truncate', emphasis ? 'text-base' : 'text-sm')}
    >
      {label}
    </PortalText>
    <PortalText
      className={twMerge(
        'text-right tabular-nums',
        emphasis ? 'text-base' : 'text-sm',
      )}
    >
      {value ?? '—'}
    </PortalText>
  </Box>
)

export const PortalRows = ({ children }: { children: ReactNode }) => (
  <Box flexDirection="column" rowGap="s">
    {children}
  </Box>
)

export const PortalDivider = () => (
  <Box
    borderTopWidth={1}
    borderStyle="solid"
    borderColor="border-primary"
    width="100%"
  />
)

export const PortalEmptyState = ({
  title,
  description,
  actions,
}: {
  title: ReactNode
  description?: ReactNode
  actions?: ReactNode
}) => (
  <Box
    flexDirection="column"
    alignItems="center"
    justifyContent="center"
    textAlign="center"
    rowGap="xs"
    paddingVertical="3xl"
    paddingHorizontal="xl"
    borderRadius="l"
    borderWidth={1}
    borderStyle="dashed"
    borderColor="border-primary"
  >
    <Box as="span" color="text-primary">
      {title}
    </Box>
    {description ? (
      <PortalText tone="secondary" className="text-sm">
        {description}
      </PortalText>
    ) : null}
    {actions ? (
      <Box marginTop="l" columnGap="s">
        {actions}
      </Box>
    ) : null}
  </Box>
)

export const PortalBackLink = ({
  href,
  children,
}: {
  href: string
  children: ReactNode
}) => (
  <Link href={href} className="self-start text-sm">
    <Box
      as="span"
      display="inline-flex"
      alignItems="center"
      columnGap="xs"
      color={{ base: 'text-secondary', hover: 'text-primary' }}
      transitionProperty="colors"
      transitionDuration="fast"
    >
      <ArrowBackOutlined fontSize="inherit" />
      {children}
    </Box>
  </Link>
)
