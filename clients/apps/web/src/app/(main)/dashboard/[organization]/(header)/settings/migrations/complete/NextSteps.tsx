import { Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { ArrowUpRight } from 'lucide-react'
import Link from 'next/link'
import { NEXT_STEPS } from './completeCopy'

export function NextSteps({
  organizationSlug,
  compact = false,
}: {
  organizationSlug: string
  compact?: boolean
}) {
  return (
    <Box flexDirection="column" rowGap="m">
      <Text variant="heading-xxs" as="h3">
        What to do next
      </Text>
      <Box as="ol" flexDirection="column" rowGap={compact ? 'm' : 'l'}>
        {NEXT_STEPS.map((step, index) => (
          <Box as="li" key={step.key} display="flex" columnGap="m">
            <Box
              flexShrink={0}
              width={22}
              height={22}
              borderRadius="full"
              borderWidth={1}
              borderStyle="solid"
              borderColor="border-primary"
              alignItems="center"
              justifyContent="center"
            >
              <Text variant="caption" color="muted" tabularNums>
                {index + 1}
              </Text>
            </Box>
            <Box flexDirection="column" rowGap="xs" minWidth={0}>
              <Text>{step.title}</Text>
              {!compact && (
                <Text variant="caption" color="muted">
                  {step.description}
                </Text>
              )}
              {step.href && step.linkLabel && (
                <Link href={step.href(organizationSlug)}>
                  <Box
                    as="span"
                    display="inline-flex"
                    alignItems="center"
                    columnGap="xs"
                    color={{ base: 'text-secondary', hover: 'text-primary' }}
                  >
                    <Text variant="caption" color="inherit">
                      {step.linkLabel}
                    </Text>
                    <ArrowUpRight size={12} />
                  </Box>
                </Link>
              )}
            </Box>
          </Box>
        ))}
      </Box>
    </Box>
  )
}
