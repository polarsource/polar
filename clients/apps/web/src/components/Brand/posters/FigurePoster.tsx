import { Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import {
  PosterFrame,
  PosterHeader,
  PosterMono,
  PosterRule,
} from './PosterFrame'

const Meta = ({ left, right }: { left: string; right: string }) => (
  <Box justifyContent="between" alignItems="baseline" columnGap="l">
    <PosterMono>{left}</PosterMono>
    <PosterMono>{right}</PosterMono>
  </Box>
)

/** A figure from a spec sheet: numbered, ruled, and captioned in mono. */
export const FigurePoster = () => (
  <PosterFrame surface="snow" signed>
    <Box
      position="absolute"
      inset="none"
      flexDirection="column"
      justifyContent="between"
      padding={{ base: 'xl', md: '2xl' }}
      rowGap="xl"
    >
      <Box flexDirection="column" rowGap="m">
        <PosterHeader>USAGE BILLING</PosterHeader>
        <PosterRule />
      </Box>
      <Box flexDirection="column">
        <Text
          variant="heading-s"
          as="p"
          color="inherit"
          wrap="balance"
          leading="tight"
        >
          Your customers 10x&apos;d their usage overnight
        </Text>
        <Text
          variant="heading-s"
          as="p"
          color="inherit"
          wrap="balance"
          leading="tight"
        >
          <Box as="span" opacity={0.5}>
            Polar already invoiced for it
          </Box>
        </Text>
      </Box>
      <Box flexDirection="column" rowGap="m">
        <PosterRule />
        <Meta left="FIG. 04" right="polar.sh" />
      </Box>
    </Box>
  </PosterFrame>
)
