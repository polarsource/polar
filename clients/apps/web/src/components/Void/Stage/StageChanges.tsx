import { Status, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { definitionKinds, displayValue, type DefinitionChange } from './diff'

const labels = {
  products: 'Products',
  meters: 'Meters',
  reducers: 'Reducers',
  entitlements: 'Entitlements',
  activities: 'Activities',
  signals: 'Signals',
}
const actions = {
  added: { label: 'Added', color: 'green' },
  changed: { label: 'Changed', color: 'blue' },
  removed: { label: 'Removed', color: 'red' },
} as const

const Value = ({
  value,
  label,
  removed = false,
}: {
  value: unknown
  label: string
  removed?: boolean
}) => (
  <Box
    flexDirection="column"
    rowGap="xs"
    minWidth={0}
    padding="m"
    backgroundColor={
      value === undefined
        ? 'background-primary'
        : removed
          ? 'background-danger'
          : 'background-success'
    }
  >
    <Box display={{ base: 'flex', md: 'none' }}>
      <Text variant="caption" color="muted">
        {label}
      </Text>
    </Box>
    <Box overflow="auto">
      <pre>
        <Text as="code" variant="caption" monospace>
          {displayValue(value)}
        </Text>
      </pre>
    </Box>
  </Box>
)

export const StageChanges = ({ changes }: { changes: DefinitionChange[] }) => (
  <Box flexDirection="column" rowGap="2xl">
    {definitionKinds.map((kind) => {
      const definitions = changes.filter((change) => change.kind === kind)
      if (!definitions.length) return null
      return (
        <Box as="section" key={kind} flexDirection="column" rowGap="m">
          <Box alignItems="center" columnGap="s">
            <Text as="h2" variant="heading-xs">
              {labels[kind]}
            </Text>
            <Text color="muted" variant="caption">
              {definitions.length}
            </Text>
          </Box>
          {definitions.map((change) => (
            <Box
              key={change.slug}
              flexDirection="column"
              borderWidth={1}
              borderStyle="solid"
              borderColor="border-primary"
              borderRadius="m"
              overflow="hidden"
            >
              <Box
                justifyContent="between"
                alignItems="center"
                gap="m"
                padding="l"
                backgroundColor="background-card"
              >
                <Text as="h3">{change.slug}</Text>
                <Status
                  status={actions[change.action].label}
                  color={actions[change.action].color}
                  size="small"
                />
              </Box>
              {change.fields.length > 0 ? (
                <>
                  <Box
                    display={{ base: 'none', md: 'grid' }}
                    gridTemplateColumns="1fr 2fr 2fr"
                    gap="xs"
                    padding="m"
                  >
                    <Text color="muted" variant="caption">
                      Field
                    </Text>
                    <Text color="muted" variant="caption">
                      Applied
                    </Text>
                    <Text color="muted" variant="caption">
                      Staged
                    </Text>
                  </Box>
                  {change.fields.map((field) => (
                    <Box
                      key={field.path}
                      display="grid"
                      gridTemplateColumns={{
                        base: 'repeat(2, minmax(0, 1fr))',
                        md: 'minmax(0, 1fr) repeat(2, minmax(0, 2fr))',
                      }}
                      gap="xs"
                      borderTopWidth={1}
                      borderStyle="solid"
                      borderColor="border-primary"
                    >
                      <Box
                        gridColumn={{ base: '1 / -1', md: 'auto' }}
                        padding="m"
                        overflow="auto"
                      >
                        <Text variant="caption">
                          {field.path
                            .replaceAll('_', ' ')
                            .replaceAll('.', ' / ')}
                        </Text>
                      </Box>
                      <Value label="Applied" value={field.before} removed />
                      <Value label="Staged" value={field.after} />
                    </Box>
                  ))}
                </>
              ) : null}
            </Box>
          ))}
        </Box>
      )
    })}
  </Box>
)
