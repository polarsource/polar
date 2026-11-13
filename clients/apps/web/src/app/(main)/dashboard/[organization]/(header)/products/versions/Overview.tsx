'use client'

import { schemas } from '@polar-sh/client'
import { Button, Pill, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { useRouter } from 'next/navigation'
import { kinds } from './VersionsTab'

export const Overview = ({
  organization,
  catalogs,
}: {
  organization: schemas['Organization']
  catalogs: schemas['Catalog'][]
}) => {
  const router = useRouter()
  const draft = catalogs.find(({ status }) => status === 'draft')
  if (!draft) return null

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
        <Box alignItems="center" columnGap="s" minWidth={0}>
          <span className="truncate text-base">
            {draft.name ?? 'Unpublished changes'}
          </span>
          {draft.name ? <Pill color="gray">Draft</Pill> : null}
        </Box>
        <Box columnGap="m">
          {kinds
            .filter(({ change }) => draft.changes?.[`${change}_count`])
            .map(({ change, glyph, color }) => (
              <Box key={change} as="span" color={color}>
                <Text as="span" color="inherit" tabularNums>
                  <span className="font-mono">
                    {glyph}
                    {draft.changes?.[`${change}_count`]}
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
            `/dashboard/${organization.slug}/products/versions/${draft.id}`,
          )
        }
      >
        Review draft
      </Button>
    </Box>
  )
}
