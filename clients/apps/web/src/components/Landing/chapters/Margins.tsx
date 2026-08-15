import { Box } from '@polar-sh/orbit/Box'
import { Chapter } from '../Chapter'
import { MarginGap } from '../graphics/MarginGap'

export const Margins = () => (
  <Chapter
    index="03"
    name="Understand"
    title="The only payment stack that knows your margins"
    subtitle="Revenue meets cost, customer by customer"
    description="Polar already collects every payment, so placing inference cost beside it reveals your true gross margin per customer. The $90 plan burning $600 of tokens stops hiding in your averages."
  >
    <Box
      display="grid"
      gridTemplateColumns={{ base: '1fr', lg: 'repeat(2, 1fr)' }}
      gap="l"
    >
      <Box display={{ base: 'none', lg: 'flex' }} />
      <Box
        display="block"
        width="100%"
        backgroundColor="background-secondary"
        padding={{ base: 'l', md: '3xl' }}
      >
        <Box display="block" width="100%" aspectRatio="4 / 3">
          <MarginGap />
        </Box>
      </Box>
    </Box>
  </Chapter>
)
