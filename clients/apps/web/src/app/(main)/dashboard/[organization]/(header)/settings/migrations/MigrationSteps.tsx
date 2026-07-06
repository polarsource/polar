import { Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { MIGRATION_STEPS } from './steps'

export function MigrationSteps() {
  return (
    <Box as="ol" flexDirection="column" rowGap="m">
      {MIGRATION_STEPS.map(({ step, title }, index) => (
        <Box
          as="li"
          key={step}
          display="flex"
          alignItems="center"
          columnGap="m"
        >
          <Box
            width={24}
            height={24}
            flexShrink={0}
            borderRadius="full"
            alignItems="center"
            justifyContent="center"
            backgroundColor="background-secondary"
            borderWidth={1}
            borderStyle="solid"
            borderColor="border-primary"
          >
            <Text variant="caption" color="muted">
              {index + 1}
            </Text>
          </Box>
          <Text variant="body">{title}</Text>
        </Box>
      ))}
    </Box>
  )
}
