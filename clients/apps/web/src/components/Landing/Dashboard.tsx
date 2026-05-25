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
            Watch your revenue happen
          </Text>
        </Box>
        <Box
          display="flex"
          flex={1}
          flexDirection="column"
          rowGap="2xl"
          justifyContent="between"
        >
          <Box
            borderTopWidth={4}
            borderColor="border-primary"
            width="4rem"
            display={{ base: 'none', xl: 'flex' }}
          />
          <Text variant="heading-xs">
            Orders, subscriptions, and customers the moment they land. Made for
            teams moving as fast as the models.
          </Text>
        </Box>
      </Box>
      <Box
        width="100%"
        overflow="hidden"
        borderRadius="l"
        borderWidth={1}
        borderStyle="solid"
        borderColor="border-secondary"
        padding="m"
      >
        <Box
          width="100%"
          overflow="hidden"
          borderRadius="s"
          borderWidth={1}
          borderStyle="solid"
          borderColor="border-primary"
        >
          <StaticImage
            src="/assets/landing/dash-light.jpg"
            alt="Polar dashboard"
            width={3840}
            height={2160}
            className="block h-auto w-full dark:hidden"
            sizes="(min-width: 1280px) 1280px, 100vw"
            priority
          />
          <StaticImage
            src="/assets/landing/dash-dark.jpg"
            alt="Polar dashboard"
            width={3840}
            height={2160}
            className="hidden h-auto w-full dark:block"
            sizes="(min-width: 1280px) 1280px, 100vw"
            priority
          />
        </Box>
      </Box>
    </Box>
  )
}
