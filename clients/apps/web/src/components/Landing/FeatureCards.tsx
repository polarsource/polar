import { Grid, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { ArrowRight } from '@polar-sh/orbit/icons'
import Link from 'next/link'
import type { ComponentType } from 'react'

export interface GraphicCardProps {
  title: string
  desc: string
  href?: string
  Graphic: ComponentType
}

/** A graphic in a rounded panel, with a title, description and optional link set beneath it. */
export const GraphicCard = ({
  title,
  desc,
  href,
  Graphic,
}: GraphicCardProps) => (
  <Box flexDirection="column" rowGap="xl">
    <div className="dark:border-polar-800 dark:bg-polar-900 aspect-square w-full overflow-hidden rounded-md border border-gray-200 bg-gray-50 p-8 xl:p-12">
      <Graphic />
    </div>
    <Box flexDirection="column" rowGap="xs">
      <Text variant="heading-xxs" as="h3">
        {title}
      </Text>
      <Text variant="body" color="muted" as="p" wrap="pretty">
        {desc}
      </Text>
      {href ? (
        <Link href={href}>
          <Box
            alignItems="center"
            columnGap="xs"
            paddingTop="s"
            color={{ base: 'text-primary', hover: 'text-secondary' }}
            transitionProperty="colors"
            transitionDuration="fast"
          >
            <Text variant="body" color="inherit">
              Learn more
            </Text>
            <ArrowRight size={16} />
          </Box>
        </Link>
      ) : null}
    </Box>
  </Box>
)

export const GraphicCardGrid = ({ cards }: { cards: GraphicCardProps[] }) => (
  <Grid
    templateColumns={{
      base: '1fr',
      md: 'repeat(2, 1fr)',
      xl: 'repeat(3, 1fr)',
    }}
    gap="2xl"
  >
    {cards.map((card) => (
      <GraphicCard key={card.title} {...card} />
    ))}
  </Grid>
)
