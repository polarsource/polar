import { Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { Chapter } from '../Landing/Chapter'
import { brandSections } from './brand'

const traits = [
  {
    trait: 'Clear',
    description:
      'We communicate with precision. No jargon, no fluff. Every word earns its place.',
  },
  {
    trait: 'Confident',
    description:
      'We know our product and our audience. We speak directly and with conviction.',
  },
  {
    trait: 'Technical',
    description:
      'We respect our developer audience. We use correct terminology and assume intelligence.',
  },
  {
    trait: 'Approachable',
    description:
      'We are experts, not gatekeepers. We welcome questions and encourage exploration.',
  },
]

export function VoiceSection() {
  return (
    <Chapter
      id={brandSections[4].id}
      index={brandSections[4].index}
      name={brandSections[4].label}
      title="How Polar speaks"
      subtitle="Four principles behind every sentence"
    >
      <Box as="ul" flexDirection="column">
        {traits.map((item, index) => (
          <Box
            key={item.trait}
            as="li"
            display="flex"
            flexDirection={{ base: 'column', md: 'row' }}
            rowGap="l"
            columnGap="xl"
            paddingVertical="xl"
            borderTopWidth={index > 0 ? 1 : 0}
            borderStyle="solid"
            borderColor="border-primary"
          >
            <Box flex={1} alignItems="baseline" columnGap="l">
              <Text as="span" variant="heading-xs" color="muted" tabularNums>
                {String(index + 1).padStart(2, '0')}
              </Text>
              <Text variant="heading-xs" as="h3">
                {item.trait}
              </Text>
            </Box>
            <Box flex={1}>
              <Text variant="heading-xs" as="p" color="muted">
                {item.description}
              </Text>
            </Box>
          </Box>
        ))}
      </Box>
    </Chapter>
  )
}
