import { Box } from '@polar-sh/orbit/Box'
import Link from 'next/link'
import { PropsWithChildren, type ReactNode } from 'react'

export const ListRow = ({
  href,
  trailing,
  children,
}: PropsWithChildren<{
  href?: string
  // Shown at the end of the row, outside its link, so it can hold controls
  // of its own.
  trailing?: ReactNode
}>) => (
  <Box
    alignItems="baseline"
    justifyContent="between"
    columnGap="m"
    paddingVertical="s"
    borderTopWidth={1}
    borderStyle="solid"
    borderColor="border-secondary"
  >
    {href ? (
      <Link href={href} className="flex min-w-0 flex-1 hover:opacity-60">
        {children}
      </Link>
    ) : (
      children
    )}
    {trailing}
  </Box>
)
