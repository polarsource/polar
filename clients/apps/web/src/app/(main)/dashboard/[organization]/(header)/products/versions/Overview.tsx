'use client'

import { schemas } from '@polar-sh/client'
import { Button, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { useRouter } from 'next/navigation'
import { History } from './history'
import { counts, kinds } from './VersionsTab'

export const Overview = ({
  organization,
  history,
}: {
  organization: schemas['Organization']
  history: History
}) => {
  const router = useRouter()
  const draftIndex = history.versions.findIndex(
    ({ catalog }) => catalog.status === 'draft',
  )
  if (draftIndex === -1) return null
  const count = counts(history, draftIndex)

  return (
    <Box
      flexDirection={{ base: 'column', md: 'row' }}
      alignItems={{ base: 'start', md: 'center' }}
      justifyContent="between"
      columnGap="2xl"
      rowGap="l"
      paddingVertical="l"
      paddingHorizontal="xl"
      borderRadius="l"
      borderWidth={1}
      borderStyle="solid"
      borderColor="border-primary"
    >
      <Box flexDirection="column" rowGap="xs" minWidth={0}>
        <span className="text-base">Unpublished changes</span>
        <Box columnGap="m">
          {kinds
            .filter(({ change }) => count[change])
            .map(({ change, glyph, color }) => (
              <Box key={change} as="span" color={color}>
                <Text as="span" color="inherit" tabularNums>
                  <span className="font-mono">
                    {glyph}
                    {count[change]}
                  </span>{' '}
                  {change}
                </Text>
              </Box>
            ))}
        </Box>
      </Box>
      <Button
        variant="secondary"
        onClick={() =>
          router.push(
            `/dashboard/${organization.slug}/products/versions/${history.versions[draftIndex].catalog.id}`,
          )
        }
      >
        Review changes
      </Button>
    </Box>
  )
}
