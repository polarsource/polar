import { Button, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { ArrowUpRight, X } from '@polar-sh/orbit/icons'
import Link from 'next/link'
import { ReactNode, useEffect } from 'react'

// The right-hand panel beside the content. On narrow screens the same
// sections render at the end of the content instead.
export const SidebarPanel = ({ children }: { children: ReactNode }) => (
  <div className="dark:bg-polar-900 dark:border-polar-800 hidden w-[320px] shrink-0 overflow-y-auto rounded-2xl border border-gray-200 bg-white shadow-xs xl:block">
    <Box flexDirection="column">{children}</Box>
  </div>
)

export const SidebarInline = ({ children }: { children: ReactNode }) => (
  <Box
    display={{ base: 'flex', xl: 'none' }}
    flexDirection="column"
    borderTopWidth={1}
    borderStyle="solid"
    borderColor="border-secondary"
  >
    {children}
  </Box>
)

export const SidebarSection = ({
  title,
  children,
}: {
  title: string
  children: ReactNode
}) => (
  <Box
    flexDirection="column"
    gap="m"
    padding="l"
    borderBottomWidth={1}
    borderStyle="solid"
    borderColor="border-secondary"
  >
    <Text>{title}</Text>
    <Box flexDirection="column" gap="s">
      {children}
    </Box>
  </Box>
)

export const SidebarRow = ({
  label,
  value,
  detail,
  danger = false,
}: {
  label: ReactNode
  value: string
  detail?: string
  danger?: boolean
}) => (
  <Box justifyContent="between" alignItems="baseline" gap="m" minWidth={0}>
    <Box minWidth={0}>
      <Text color="muted" truncate>
        {label}
      </Text>
    </Box>
    <Box alignItems="baseline" gap="s" flexShrink={0}>
      {detail && (
        <Text color="muted" tabularNums>
          {detail}
        </Text>
      )}
      <Text color={danger ? 'danger' : undefined} tabularNums>
        {value}
      </Text>
    </Box>
  </Box>
)

// The top of a detail view, with what it shows and a way back to the totals.
export const SidebarHeader = ({
  kind,
  title,
  onClose,
}: {
  kind: string
  title: string
  onClose?: () => void
}) => {
  useEffect(() => {
    if (!onClose) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose])
  return (
    <Box
      justifyContent="between"
      alignItems="start"
      gap="m"
      padding="l"
      borderBottomWidth={1}
      borderStyle="solid"
      borderColor="border-secondary"
    >
      <Box flexDirection="column" minWidth={0}>
        <Text color="muted">{kind}</Text>
        <Text variant="heading-xxs" truncate>
          {title}
        </Text>
      </Box>
      {onClose && (
        <Button
          size="icon"
          variant="ghost"
          className="h-6 w-6 shrink-0 [&_svg]:size-3.5!"
          onClick={onClose}
          aria-label="Close"
        >
          <X />
        </Button>
      )}
    </Box>
  )
}

export const SidebarLink = ({
  href,
  children,
}: {
  href: string
  children: ReactNode
}) => (
  <Link href={href} className="hover:opacity-70">
    <Box justifyContent="between" alignItems="center">
      <Text>{children}</Text>
      <ArrowUpRight className="dark:text-polar-500 h-3.5 w-3.5 text-gray-500" />
    </Box>
  </Link>
)

// A row with a thin bar below it showing its share of a whole.
export const SidebarShareRow = ({
  label,
  share,
  value,
}: {
  label: string
  share: number
  value: string
}) => (
  <Box flexDirection="column" gap="xs" minWidth={0}>
    <SidebarRow
      label={label}
      value={value}
      detail={`${Math.round(share * 100)}%`}
    />
    <Box height={4} backgroundColor="background-card">
      <Box
        height="100%"
        width={`${Math.min(1, Math.max(0, share)) * 100}%`}
        backgroundColor="background-inverse"
      />
    </Box>
  </Box>
)
