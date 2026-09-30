import { Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { ArrowRight } from 'lucide-react'

export const DocsLink = ({ href, label }: { href: string; label: string }) => (
  <a href={href}>
    <Box
      alignItems="center"
      columnGap="xs"
      color={{ base: 'text-primary', hover: 'text-secondary' }}
      transitionProperty="colors"
      transitionDuration="fast"
    >
      <Text variant="body" color="inherit">
        {label}
      </Text>
      <ArrowRight size={16} />
    </Box>
  </a>
)
