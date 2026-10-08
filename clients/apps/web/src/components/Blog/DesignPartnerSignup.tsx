import LogoIcon from '@/components/Brand/logos/LogoIcon'
import { DesignPartnerForm } from '@/components/Landing/design-partner/DesignPartnerForm'
import { Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'

export const DesignPartnerSignup = () => (
  <Box flexDirection="column" rowGap="l">
    <Box
      flexDirection="column"
      rowGap="3xl"
      padding={{ base: 'xl', md: '3xl' }}
      backgroundColor="background-secondary"
    >
      <Box color="text-tertiary">
        <LogoIcon size={56} />
      </Box>
      <Box flexDirection="column" rowGap="m">
        <Text as="h3" variant="heading-xs">
          Become a design partner
        </Text>
        <Text as="p" variant="body" color="muted">
          We&apos;d love to dig into your biggest pain points today and hear
          your thoughts on what we&apos;re building, with early access and a
          direct line to our team as we iterate together.
        </Text>
        <Text as="p" variant="body" color="muted">
          We review every application and will reach out if it looks like a
          good fit.
        </Text>
      </Box>
    </Box>
    <DesignPartnerForm />
  </Box>
)
