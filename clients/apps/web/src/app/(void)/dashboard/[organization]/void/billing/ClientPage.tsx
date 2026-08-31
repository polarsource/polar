'use client'

import { VoidCell, VoidGrid } from '@/components/Void/VoidGrid'
import { VoidSection } from '@/components/Void/VoidSection'
import { useMeters } from '@/hooks/queries/meters'
import { OrganizationContext } from '@/providers/maintainerOrganization'
import { Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { useContext } from 'react'

const INDENT = ['none', 'l', '2xl', '3xl'] as const

interface CodeLine {
  indent: 0 | 1 | 2 | 3
  text: string
  muted?: boolean
}

const toIdentifier = (name: string) =>
  name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')

const buildDefinition = (meterNames: string[]): CodeLine[] => {
  const names = meterNames.length > 0 ? meterNames : ['api_calls']
  return [
    { indent: 0, text: '// billing.config.ts', muted: true },
    { indent: 0, text: "import { billing, meter } from '@polar/billing'" },
    { indent: 0, text: '' },
    { indent: 0, text: 'export default billing({' },
    { indent: 1, text: 'meters: [' },
    ...names.slice(0, 3).flatMap((name): CodeLine[] => [
      { indent: 2, text: `meter('${toIdentifier(name)}', {` },
      { indent: 3, text: `filter: { name: '${toIdentifier(name)}' },` },
      { indent: 3, text: 'aggregate: count(),' },
      { indent: 2, text: '}),' },
    ]),
    { indent: 1, text: '],' },
    { indent: 0, text: '})' },
  ]
}

const DEPLOYMENTS = [
  { version: 'v14', hash: '8f2c41a', time: 'Today 09:12', status: 'Active' },
  { version: 'v13', hash: 'c90d7e2', time: '3 days ago', status: 'Superseded' },
  { version: 'v12', hash: '4b11f08', time: 'Last week', status: 'Superseded' },
]

export default function ClientPage() {
  const { organization } = useContext(OrganizationContext)
  const { data } = useMeters(organization.id, { limit: 3, is_archived: false })
  const lines = buildDefinition(data?.items.map((meter) => meter.name) ?? [])

  return (
    <Box as="main" flexDirection="column" paddingTop="xl" flexGrow={1}>
      <VoidSection flush label="Billing" meta="Billing as code">
        <VoidGrid>
          <VoidCell colSpan={{ base: 1, md: 2, lg: 2 }}>
            <Box flexDirection="column" rowGap="xl">
              <Box justifyContent="between" columnGap="l">
                <Text variant="body" monospace>
                  billing.config.ts
                </Text>
                <Text variant="body" monospace color="muted">
                  sha 8f2c41a
                </Text>
              </Box>
              <Box flexDirection="column" rowGap="xs" overflowX="auto">
                {lines.map((line, index) => (
                  <Box
                    key={index}
                    paddingLeft={INDENT[line.indent]}
                    minHeight={16}
                  >
                    <Text
                      variant="body"
                      monospace
                      color={line.muted ? 'muted' : 'default'}
                      wrap="nowrap"
                    >
                      {line.text}
                    </Text>
                  </Box>
                ))}
              </Box>
            </Box>
          </VoidCell>
          <VoidCell colSpan={{ base: 1, md: 2, lg: 2 }}>
            <Box
              flexDirection="column"
              justifyContent="between"
              rowGap="2xl"
              flexGrow={1}
            >
              <Box flexDirection="column" rowGap="xl">
                <Text variant="body">Deployments</Text>
                {DEPLOYMENTS.map((deployment) => (
                  <Box
                    key={deployment.hash}
                    justifyContent="between"
                    alignItems="baseline"
                    columnGap="l"
                  >
                    <Box columnGap="xl" alignItems="baseline">
                      <Text variant="heading-s">{deployment.version}</Text>
                      <Text variant="body" monospace color="muted">
                        {deployment.hash}
                      </Text>
                    </Box>
                    <Box columnGap="xl" alignItems="baseline">
                      <Text variant="body" color="muted">
                        {deployment.time}
                      </Text>
                      <Text
                        variant="body"
                        color={
                          deployment.status === 'Active' ? 'default' : 'muted'
                        }
                      >
                        {deployment.status}
                      </Text>
                    </Box>
                  </Box>
                ))}
              </Box>
              <Text variant="body" color="muted">
                Runtime lambda / isolated per meter / cold start 12ms
              </Text>
            </Box>
          </VoidCell>
        </VoidGrid>
      </VoidSection>
    </Box>
  )
}
