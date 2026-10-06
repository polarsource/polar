import { Grid, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { Chapter } from '../Landing/Chapter'
import { brandSections } from './brand'
import { type Board, STORY_BOARDS, SYSTEM_BOARDS } from './posters/boards'

const PRINCIPLES = [
  {
    title: 'One idea per sheet',
    description: 'A sentence or a figure. Never both competing for the eye.',
  },
  {
    title: 'Type is the image',
    description:
      'Neue Montreal carries the message. Graphics stay hairline-thin behind it.',
  },
  {
    title: 'Night and Snow',
    description:
      'Every sheet is monochrome. Ether appears at most once per board.',
  },
  {
    title: 'Mono in the margins',
    description:
      'Geist Mono is for figure numbers, amounts and metadata, not headlines.',
  },
  {
    title: 'Signed in the corner',
    description:
      'The mark sits lower right, small, where a sheet has room for it.',
  },
]

const SHEETS_PER_BOARD = 3

const PosterBoard = ({ board, offset }: { board: Board; offset: number }) => (
  <Box
    backgroundColor="background-secondary"
    padding={{ base: 'l', md: '3xl' }}
    flexDirection="column"
    rowGap={{ base: 'xl', md: '2xl' }}
  >
    {board.act ? (
      <Box justifyContent="between" alignItems="baseline" columnGap="l">
        <Box alignItems="baseline" columnGap="m">
          <Text variant="caption" as="span" color="muted" monospace>
            ACT {board.act.numeral}
          </Text>
          <Text variant="title" as="h3">
            {board.act.title}
          </Text>
        </Box>
        <Text variant="caption" as="span" color="muted">
          {board.act.lead}
        </Text>
      </Box>
    ) : null}
    <Grid
      templateColumns={{ base: '1fr', sm: 'repeat(3, 1fr)' }}
      gap={{ base: 'xl', md: 'l' }}
    >
      {board.sheets.map(({ caption, Poster }, index) => (
        <Box key={caption} flexDirection="column" rowGap="m">
          <Poster />
          <Box columnGap="m">
            <Text variant="caption" as="span" color="muted" tabularNums>
              {String(offset + index + 1).padStart(2, '0')}
            </Text>
            <Text variant="caption" as="span" color="muted">
              {caption}
            </Text>
          </Box>
        </Box>
      ))}
    </Grid>
  </Box>
)

const Boards = ({ boards, offset }: { boards: Board[]; offset: number }) => (
  <Box flexDirection="column" rowGap="l">
    {boards.map((board, index) => (
      <PosterBoard
        key={index}
        board={board}
        offset={offset + index * SHEETS_PER_BOARD}
      />
    ))}
  </Box>
)

export function PostersSection() {
  return (
    <>
      <Chapter
        id={brandSections[6].id}
        index={brandSections[6].index}
        name={brandSections[6].label}
        title="One idea per sheet"
        subtitle="Thirty-three posters from the same parts as the product"
        description="Print and social sheets that reuse the grid, the type and the illustrations. The grid is the ornament, and the headline does the work."
      >
        <Box as="ol" flexDirection="column">
          {PRINCIPLES.map((principle, index) => (
            <Box
              key={principle.title}
              as="li"
              display="grid"
              gridTemplateColumns={{ base: '1fr', lg: 'repeat(2, 1fr)' }}
              gap={{ base: 's', lg: 'l' }}
              paddingVertical="xl"
              borderTopWidth={1}
              borderStyle="solid"
              borderColor="border-primary"
            >
              <Box columnGap="xl">
                <Text variant="heading-xxs" color="muted" tabularNums>
                  {String(index + 1).padStart(2, '0')}
                </Text>
                <Text variant="heading-xxs" as="h3">
                  {principle.title}
                </Text>
              </Box>
              <Text variant="heading-xxs" as="p" color="muted" wrap="pretty">
                {principle.description}
              </Text>
            </Box>
          ))}
        </Box>
      </Chapter>
      <Chapter
        name="The system"
        title="One part of Polar per sheet"
        subtitle="Eighteen sheets, six boards"
      >
        <Boards boards={SYSTEM_BOARDS} offset={0} />
      </Chapter>
      <Chapter
        name="The story"
        title="One event, from the wire to the payout"
        subtitle="Fifteen sheets in five acts"
      >
        <Boards
          boards={STORY_BOARDS}
          offset={SYSTEM_BOARDS.length * SHEETS_PER_BOARD}
        />
      </Chapter>
    </>
  )
}
