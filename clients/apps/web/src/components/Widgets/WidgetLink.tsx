import { Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { ArrowRight } from '@polar-sh/orbit/icons'
import Link from 'next/link'

export const WidgetLink = ({ href }: { href: string }) => (
  <Link href={href} className="hover:opacity-60">
    <Box alignItems="center" columnGap="xs" color="text-secondary">
      <Text color="muted">View all</Text>
      <ArrowRight className="h-3.5 w-3.5" />
    </Box>
  </Link>
)
