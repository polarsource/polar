import { StaticImage } from '@/components/Image/StaticImage'
import { Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'

export const Dashboard = () => {
  return (
    <Box
      position="relative"
      display="flex"
      flexDirection="column"
      rowGap={{ base: '2xl', md: '3xl' }}
      paddingTop={{ base: 'l', md: '3xl' }}
      paddingBottom={{ base: '2xl', md: '4xl' }}
    >
      <Box
        display="flex"
        flexDirection={{ base: 'column', xl: 'row' }}
        rowGap="2xl"
      >
        <Box display="flex" flex={1}>
          <Text variant="heading-xl" as="h2" wrap="balance">
            Know your unit economics
          </Text>
        </Box>
        <Box
          display="flex"
          flex={1}
          flexDirection="column"
          rowGap="xl"
          justifyContent="between"
        >
          <Box
            borderTopWidth={4}
            borderColor="border-primary"
            width="3rem"
            display={{ base: 'none', xl: 'flex' }}
          />
          <Text variant="heading-xs" wrap="pretty">
            Revenue, costs & margins in one overview. The unit economics every
            AI startup needs to scale with confidence.
          </Text>
        </Box>
      </Box>
      <Box
        width="100%"
        overflow="hidden"
        position="relative"
        borderRadius={{
          base: 's',
          md: 'm',
        }}
        borderWidth={1}
        borderStyle="solid"
        borderColor="border-primary"
      >
        <StaticImage
          src="/assets/landing/dashboard.jpg"
          alt="Polar dashboard"
          width={3840}
          height={2160}
          className="relative z-10 h-auto w-full"
          sizes="(min-width: 1280px) 1280px, 100vw"
          priority
        />
      </Box>
    </Box>
  )
}
