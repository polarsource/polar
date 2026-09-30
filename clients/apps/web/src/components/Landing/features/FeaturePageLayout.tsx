import GetStartedButton from '@/components/Auth/GetStartedButton'
import { Button, Grid, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { ComponentType, PropsWithChildren } from 'react'
import { FeatureChapter, HairlineRow, SectionTitle } from './FeatureChapter'

export interface FeaturePageHeaderProps {
  title: string
  description: string
  graphic: ComponentType
  docsHref?: string
}

export const FeaturePageHeader = ({
  title,
  description,
  graphic: Graphic,
  docsHref,
}: FeaturePageHeaderProps) => (
  <Box
    as="section"
    width="100%"
    paddingTop={{ base: 'm', md: '3xl' }}
    paddingBottom={{ base: '3xl', md: '5xl' }}
  >
    <Grid
      templateColumns={{ base: '1fr', lg: 'repeat(2, 1fr)' }}
      gap={{ base: '3xl', lg: 'l' }}
    >
      <Box
        flexDirection="column"
        justifyContent="between"
        alignItems="start"
        rowGap="3xl"
      >
        <Box flexDirection="column">
          <Text variant="heading-m" as="h1" wrap="balance">
            {title}
          </Text>
          <Text variant="heading-m" as="p" color="muted" wrap="balance">
            {description}
          </Text>
        </Box>
        <Box alignItems="center" columnGap="m">
          <GetStartedButton size="lg" text="Get Started" />
          {docsHref ? (
            <a href={docsHref}>
              <Button size="lg" variant="secondary">
                Documentation
              </Button>
            </a>
          ) : null}
        </Box>
      </Box>
      <Box
        aspectRatio="4 / 3"
        alignItems="center"
        justifyContent="center"
        padding={{ base: 'xl', md: '3xl' }}
        backgroundColor="background-secondary"
      >
        <Box display="block" height="100%" aspectRatio="1 / 1">
          <Graphic />
        </Box>
      </Box>
    </Grid>
  </Box>
)

export const FeaturePageIntro = ({ children }: PropsWithChildren) => (
  <FeatureChapter
    content={
      <Text variant="heading-s" as="p" wrap="pretty">
        {children}
      </Text>
    }
  />
)

export const FeatureHighlight = ({ children }: PropsWithChildren) => (
  <Text variant="heading-xxs" as="strong">
    {children}
  </Text>
)

export const FeatureSection = ({
  title,
  children,
}: PropsWithChildren<{ title: string }>) => (
  <FeatureChapter
    aside={<SectionTitle>{title}</SectionTitle>}
    content={
      <Text variant="heading-xxs" as="div" color="muted" wrap="pretty">
        <Box flexDirection="column" rowGap="xl">
          {children}
        </Box>
      </Text>
    }
  />
)

export const FeatureSplit = ({
  title,
  description,
  bullets,
}: {
  title: string
  description: string
  bullets: { title: string; description: string }[]
}) => (
  <FeatureChapter
    aside={
      <Box flexDirection="column" rowGap="l" maxWidth="32rem">
        <SectionTitle>{title}</SectionTitle>
        <Text variant="heading-xxs" as="p" color="muted" wrap="pretty">
          {description}
        </Text>
      </Box>
    }
    content={
      <Box flexDirection="column">
        {bullets.map((bullet) => (
          <HairlineRow key={bullet.title}>
            <Text variant="heading-xxs" as="h3">
              {bullet.title}
            </Text>
            <Text variant="heading-xxs" as="p" color="muted" wrap="pretty">
              {bullet.description}
            </Text>
          </HairlineRow>
        ))}
      </Box>
    }
  />
)

export const FeatureRichList = ({
  title,
  description,
  items,
}: {
  title: string
  description?: string
  items: { title: string; description: string }[]
}) => (
  <FeatureChapter
    aside={<SectionTitle>{title}</SectionTitle>}
    content={
      description ? (
        <Text variant="heading-xs" as="p" color="muted" wrap="pretty">
          {description}
        </Text>
      ) : null
    }
  >
    <Box flexDirection="column">
      {items.map((item, index) => (
        <HairlineRow key={item.title}>
          <Grid
            templateColumns={{ base: '1fr', lg: 'repeat(2, 1fr)' }}
            gap={{ base: 's', lg: 'l' }}
          >
            <Box columnGap="xl">
              <Text variant="heading-xxs" color="muted" tabularNums>
                {String(index + 1).padStart(2, '0')}
              </Text>
              <Text variant="heading-xxs" as="h3">
                {item.title}
              </Text>
            </Box>
            <Text variant="heading-xxs" as="p" color="muted" wrap="pretty">
              {item.description}
            </Text>
          </Grid>
        </HairlineRow>
      ))}
    </Box>
  </FeatureChapter>
)

export interface FeatureCard {
  title: string
  description: string
}

export const FeatureCardGrid = ({ cards }: { cards: FeatureCard[] }) => (
  <Box display="block" width="100%" paddingBottom={{ base: '4xl', md: '5xl' }}>
    <Grid
      templateColumns={{
        base: '1fr',
        md: 'repeat(2, 1fr)',
        xl: 'repeat(4, 1fr)',
      }}
      gap="l"
    >
      {cards.map((card) => (
        <Box
          key={card.title}
          height="100%"
          flexDirection="column"
          rowGap="s"
          padding="xl"
          backgroundColor="background-secondary"
        >
          <Text variant="heading-xxs" as="h3">
            {card.title}
          </Text>
          <Text variant="body" color="muted" wrap="pretty">
            {card.description}
          </Text>
        </Box>
      ))}
    </Grid>
  </Box>
)

export const FeatureCTA = ({
  title,
  description,
}: {
  title: string
  description: string
}) => (
  <Box
    as="section"
    width="100%"
    flexDirection="column"
    alignItems="center"
    rowGap="3xl"
    paddingVertical={{ base: '4xl', md: '5xl' }}
    borderTopWidth={1}
    borderStyle="solid"
    borderColor="border-primary"
  >
    <Box flexDirection="column" alignItems="center" textAlign="center">
      <Text variant="heading-xs" as="h2" wrap="balance">
        {title}
      </Text>
      <Text variant="heading-xs" as="p" color="muted" wrap="balance">
        {description}
      </Text>
    </Box>
    <GetStartedButton size="lg" text="Get Started" />
  </Box>
)

export const FeaturePageLayout = ({ children }: PropsWithChildren) => (
  <Box width="100%" flexDirection="column">
    {children}
  </Box>
)
