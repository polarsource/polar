import ArrowOutwardOutlined from '@mui/icons-material/ArrowOutwardOutlined'
import { Grid, GridItem, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import Link from 'next/link'
import { PropsWithChildren } from 'react'
import { PolarLogotype } from '../Layout/Public/PolarLogotype'
import { CookiePreferencesButton } from '../Privacy/CookiePreferencesButton'

const Footer = () => {
  return (
    <Box
      as="footer"
      width="100%"
      flexDirection="column"
      marginTop={{ base: 'none', md: '2xl' }}
      paddingHorizontal={{ base: 'xl', md: 'none' }}
      paddingVertical={{ base: '4xl', md: '5xl' }}
      borderTopWidth={1}
      borderStyle="solid"
      borderColor="border-primary"
    >
      <Grid
        width="100%"
        templateColumns={{
          base: '1fr',
          md: 'repeat(2, 1fr)',
          lg: 'repeat(6, 1fr)',
        }}
        gap={{ base: '3xl', md: '4xl' }}
      >
        <GridItem
          colSpan={{ md: 2 }}
          flexDirection="column"
          justifyContent="between"
          rowGap="xl"
        >
          <PolarLogotype
            className="ml-2 md:ml-0"
            logoVariant="logotype"
            size={120}
          />
          <Box flexDirection="column" rowGap="xl">
            <Link
              href="/signup"
              className="w-fit border-b border-current pb-0.5"
            >
              <Box
                as="span"
                display="inline-flex"
                alignItems="center"
                columnGap="s"
                color="text-primary"
              >
                <Text as="span" variant="body" color="inherit">
                  Get Started
                </Text>
                <ArrowOutwardOutlined fontSize="inherit" />
              </Box>
            </Link>
            <Text variant="body" color="muted">
              &copy; Polar Software, Inc. {new Date().getFullYear()}
            </Text>
          </Box>
        </GridItem>

        <FooterSection title="Features">
          <FooterLink href="/features/usage-billing">Usage Billing</FooterLink>
          <FooterLink href="/features/subscriptions">Subscriptions</FooterLink>
          <FooterLink href="/features/seats">Seats</FooterLink>
          <FooterLink href="/features/credits">Credits</FooterLink>
          <FooterLink href="/features/trials">Trials</FooterLink>
          <FooterLink href="/features/discounts">Discounts</FooterLink>
          <FooterLink href="/features/cost-insights">Cost Insights</FooterLink>
          <FooterLink href="/features/finance">Finance</FooterLink>
          <FooterLink href="/features/merchant-of-record">
            Merchant of Record
          </FooterLink>
        </FooterSection>

        <FooterSection title="Resources">
          <FooterLink href="/resources/why">Why Polar</FooterLink>
          <FooterLink href="/resources/merchant-of-record">
            Merchant of Record
          </FooterLink>
          <FooterLink href="/resources/pricing">Pricing</FooterLink>
          <FooterLink href="/downloads">Downloads</FooterLink>
        </FooterSection>

        <FooterSection title="Company">
          <FooterLink href="/company">About Polar</FooterLink>
          <FooterLink href="https://github.com/polarsource">GitHub</FooterLink>
          <FooterLink href="https://x.com/polar_sh">X / Twitter</FooterLink>
          <FooterLink href="https://polar.sh/assets/brand/polar_brand.zip">
            Brand Assets
          </FooterLink>
          <FooterLink href="https://polar.sh/legal">Legal</FooterLink>
          <CookiePreferencesButton />
        </FooterSection>

        <FooterSection title="Support">
          <FooterLink href="https://polar.sh/docs">Docs</FooterLink>
          <FooterLink href="mailto:support@polar.sh">Contact</FooterLink>
          <FooterLink href="https://status.polar.sh">Service Status</FooterLink>
        </FooterSection>
      </Grid>
    </Box>
  )
}

export default Footer

const FooterSection = ({
  title,
  children,
}: PropsWithChildren<{ title: string }>) => (
  <Box flexDirection="column" rowGap="l">
    <Text as="h3" color="muted">
      {title}
    </Text>
    <Box flexDirection="column" rowGap="s">
      {children}
    </Box>
  </Box>
)

const FooterLink = ({
  href,
  children,
}: PropsWithChildren<{ href: string }>) => (
  <Link href={href}>
    <Box
      as="span"
      display="inline-flex"
      alignItems="center"
      columnGap="xs"
      color={{ base: 'text-primary', hover: 'text-secondary' }}
      transitionProperty="colors"
      transitionDuration="fast"
    >
      <Text as="span" color="inherit">
        {children}
      </Text>
    </Box>
  </Link>
)
