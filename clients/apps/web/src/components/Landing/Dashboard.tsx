import { StaticImage } from '@/components/Image/StaticImage'
import { Box } from '@polar-sh/orbit/Box'
import { SectionHeader } from './SectionHeader'

export const Dashboard = () => {
  return (
    <Box
      position="relative"
      flexDirection="column"
      rowGap={{ base: '2xl', md: '3xl' }}
      paddingTop={{ base: 'l', md: '3xl' }}
      paddingBottom={{ base: '2xl', md: '4xl' }}
    >
      <SectionHeader
        title="Know your unit economics"
        description="Revenue, costs & margins in one overview. The unit economics every AI startup needs to scale with confidence."
      />
      <Box
        display="block"
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
