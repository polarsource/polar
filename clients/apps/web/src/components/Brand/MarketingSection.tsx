'use client'

import { Grid, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { Chapter } from '../Landing/Chapter'
import { brandSections } from './brand'
import { type Board, STORY_BOARDS, SYSTEM_BOARDS } from './posters/boards'
import { useState } from 'react'
import { Stream } from '@cloudflare/stream-react'
import VolumeUp from '@mui/icons-material/VolumeUp'
import VolumeOff from '@mui/icons-material/VolumeOff'

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

const BOARDS = [...SYSTEM_BOARDS, ...STORY_BOARDS]

export function MarketingSection() {
  const [muted, setMuted] = useState(true)

  return (
    <Chapter
      id={brandSections[5].id}
      index={brandSections[5].index}
      name={brandSections[5].label}
      title="The product, said out loud"
      subtitle="Marketing is how Polar explains itself"
      description="Every sheet, post and billboard is built from the same grid, type and figures as the product. We show the thing itself, an event, a meter, an invoice, in the words engineers use."
    >
      <Box flexDirection="column" rowGap={{ base: '3xl', md: '5xl' }}>
        <Box flexDirection="column" rowGap="l">
          {BOARDS.map((board, index) => (
            <PosterBoard
              key={index}
              board={board}
              offset={index * SHEETS_PER_BOARD}
            />
          ))}
        </Box>
      </Box>
      <Box
        display="block"
        position="relative"
        width="100%"
        overflow="hidden"
        backgroundColor="background-secondary"
      >
        <Stream
          src="dd150505f55955403f2e2dd190771af7"
          controls={false}
          autoplay
          muted={muted}
          loop
        />
        <button
          type="button"
          onClick={() => setMuted((value) => !value)}
          aria-label={muted ? 'Unmute video' : 'Mute video'}
          aria-pressed={!muted}
          className="absolute top-4 right-4 z-10 flex h-16 w-16 cursor-pointer items-center justify-center text-4xl text-white md:top-12 md:right-12 md:text-5xl"
        >
          {muted ? (
            <VolumeOff fontSize="inherit" />
          ) : (
            <VolumeUp fontSize="inherit" />
          )}
        </button>
      </Box>
    </Chapter>
  )
}
