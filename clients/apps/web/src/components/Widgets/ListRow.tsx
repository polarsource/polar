import { Box } from '@polar-sh/orbit/Box'
import Link from 'next/link'
import { PropsWithChildren } from 'react'

export const ListRow = ({
  href,
  children,
}: PropsWithChildren<{ href?: string }>) => {
  const row = (
    <Box
      alignItems="baseline"
      justifyContent="between"
      columnGap="m"
      paddingVertical="s"
      borderTopWidth={1}
      borderStyle="solid"
      borderColor="border-secondary"
    >
      {children}
    </Box>
  )

  return href ? (
    <Link href={href} className="hover:opacity-60">
      {row}
    </Link>
  ) : (
    row
  )
}
