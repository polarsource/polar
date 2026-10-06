import { Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { PosterFrame } from './PosterFrame'

const LABELS = ['USAGE BILLING', 'SUBSCRIPTIONS', 'MERCHANT OF RECORD']

const Label = ({ children }: { children: string }) => (
  <div className="border border-current">
    <Box paddingHorizontal="s" paddingVertical="xs">
      <Text variant="caption" as="span" color="inherit" monospace wrap="nowrap">
        {children}
      </Text>
    </Box>
  </div>
)

/** Boxed mono labels, the way a lab tags its samples. */
export const LabelsPoster = () => (
  <PosterFrame surface="ether" signed>
    <Box
      position="absolute"
      inset="none"
      flexDirection="column"
      justifyContent="between"
      padding={{ base: 'xl', md: '2xl' }}
    >
      <Box flexDirection="column" alignItems="start" rowGap="s">
        {LABELS.map((label) => (
          <Label key={label}>{label}</Label>
        ))}
      </Box>
      <Box flexDirection="column" paddingRight="3xl">
        <Text variant="heading-xs" as="p" color="inherit" leading="tight">
          Polar
        </Text>
        <Text
          variant="heading-xs"
          as="p"
          color="inherit"
          wrap="balance"
          leading="tight"
        >
          <Box as="span" opacity={0.6}>
            One integration, three jobs off your plate
          </Box>
        </Text>
      </Box>
    </Box>
  </PosterFrame>
)
