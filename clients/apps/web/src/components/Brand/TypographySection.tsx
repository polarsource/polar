import { Grid, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { Chapter } from '../Landing/Chapter'
import { brandSections } from './brand'

interface Typeface {
  name: string
  role: string
  monospace: boolean
  specimen: string
  ascender: number
  descender: number
  capHeight: number
  xHeight: number
  advances: number[]
}

const UNITS_PER_EM = 1000
const GLYPH_SET =
  'ABCDEFGHIJKLMNOPQRSTUVWXYZ abcdefghijklmnopqrstuvwxyz 0123456789'

const typefaces: Typeface[] = [
  {
    name: 'PP Neue Montreal',
    role: 'Display and text',
    monospace: false,
    specimen: 'Aa',
    ascender: 958,
    descender: 242,
    capHeight: 715,
    xHeight: 510,
    advances: [645, 519],
  },
  {
    name: 'Geist Mono',
    role: 'Code and data',
    monospace: true,
    specimen: 'Ai',
    ascender: 1005,
    descender: 295,
    capHeight: 710,
    xHeight: 530,
    advances: [600, 600],
  },
]

const em = (units: number) => `${units / UNITS_PER_EM}em`

function Guide({ label, units }: { label: string; units: number }) {
  return (
    <>
      <div className="absolute -inset-x-[100vw]" style={{ bottom: em(units) }}>
        <Box
          width="100%"
          borderTopWidth={1}
          borderStyle="solid"
          borderColor="border-primary"
        />
      </div>
      <div className="absolute right-0" style={{ bottom: em(units) }}>
        <Box paddingBottom="xs">
          <Text variant="caption" color="muted" wrap="nowrap">
            {label}
          </Text>
        </Box>
      </div>
    </>
  )
}

function Cell({ typeface, index }: { typeface: Typeface; index: number }) {
  const { advances, ascender, descender } = typeface
  const remaining = advances
    .slice(index)
    .reduce((sum, advance) => sum + advance, 0)

  return (
    <div
      className="absolute"
      style={{
        left: em(-remaining),
        bottom: em(-descender),
        width: em(advances[index]),
        height: em(ascender + descender),
      }}
    >
      <Box
        height="100%"
        alignItems="end"
        paddingHorizontal="s"
        paddingBottom="xs"
        borderLeftWidth={1}
        borderRightWidth={index === advances.length - 1 ? 1 : 0}
        borderStyle="solid"
        borderColor="border-primary"
      >
        <Text variant="caption" color="muted" tabularNums>
          {advances[index]}
        </Text>
      </Box>
    </div>
  )
}

function Specimen({ typeface }: { typeface: Typeface }) {
  const { advances, ascender, descender } = typeface
  const width = advances.reduce((sum, advance) => sum + advance, 0)

  return (
    <Box
      flexDirection="column"
      justifyContent="between"
      rowGap={{ base: '2xl', md: '3xl' }}
      padding={{ base: 'xl', md: '3xl' }}
      overflow="hidden"
      backgroundColor="background-secondary"
      color="text-primary"
    >
      <Box justifyContent="between" alignItems="baseline" columnGap="l">
        <Text as="span">{typeface.name}</Text>
        <Text as="span" color="muted">
          {typeface.role}
        </Text>
      </Box>
      <div className="@container">
        <div
          className={`flex items-baseline font-normal tracking-normal [font-kerning:none] ${typeface.monospace ? 'font-mono' : 'font-display'}`}
          style={{
            fontSize: `min(17rem, (100cqw - 5rem) / ${width / UNITS_PER_EM})`,
            lineHeight: (ascender + descender) / UNITS_PER_EM,
          }}
        >
          <span className="relative z-10">{typeface.specimen}</span>
          <div aria-hidden className="relative h-0 flex-1">
            {advances.map((_, index) => (
              <Cell key={index} typeface={typeface} index={index} />
            ))}
            <Guide label="Cap height" units={typeface.capHeight} />
            <Guide label="x-height" units={typeface.xHeight} />
            <Guide label="Baseline" units={0} />
          </div>
        </div>
      </div>
      <div className="wrap-anywhere">
        <Text
          variant="heading-xxs"
          color="muted"
          monospace={typeface.monospace}
        >
          {GLYPH_SET}
        </Text>
      </div>
    </Box>
  )
}

export function TypographySection() {
  return (
    <Chapter
      id={brandSections[2].id}
      index={brandSections[2].index}
      name={brandSections[2].label}
      title="PP Neue Montreal"
      subtitle="Geist Mono for code and data"
      description="PP Neue Montreal is the single typeface of the identity, chosen for its clarity and structured geometry. Geist Mono carries technical detail."
    >
      <Grid templateColumns={{ base: '1fr', md: 'repeat(2, 1fr)' }} gap="l">
        {typefaces.map((typeface) => (
          <Specimen key={typeface.name} typeface={typeface} />
        ))}
      </Grid>
    </Chapter>
  )
}
