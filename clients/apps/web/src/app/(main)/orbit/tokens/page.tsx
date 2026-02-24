import { Box, Headline, Stack, Text, orbitTokens } from '@polar-sh/orbit'
import type { ReactNode } from 'react'
import { OrbitPageHeader } from '../OrbitPageHeader'
const sp = orbitTokens.SPACING
const cl = orbitTokens.COLORS
const ra = orbitTokens.RADII


// ─── Token data ────────────────────────────────────────────────────────────────

const colorTokens = [
  {
    token: '--orbit-bg',
    light: '#ffffff',
    lightLabel: 'white',
    dark: 'hsl(233,5%,3%)',
    darkLabel: 'polar-950',
    usage: 'Page background',
  },
  {
    token: '--orbit-BG_SURFACE',
    light: 'hsl(0,0%,97%)',
    lightLabel: 'neutral-50',
    dark: 'hsl(233,5%,6.5%)',
    darkLabel: 'polar-900',
    usage: 'Sidebar, card backgrounds',
  },
  {
    token: '--orbit-BG_ELEVATED',
    light: 'hsl(0,0%,90%)',
    lightLabel: 'neutral-200',
    dark: 'hsl(233,5%,9.5%)',
    darkLabel: 'polar-800',
    usage: 'Borders, dividers, elevated surfaces',
  },
  {
    token: '--orbit-text',
    light: '#111111',
    lightLabel: '#111111',
    dark: '#f0f0f0',
    darkLabel: '#f0f0f0',
    usage: 'Primary text and icons',
  },
  {
    token: '--orbit-text-muted',
    light: 'hsl(0,0%,45%)',
    lightLabel: 'neutral-500',
    dark: 'hsl(233,5%,46%)',
    darkLabel: 'polar-500',
    usage: 'Secondary text, captions, labels',
  },
  {
    token: '--orbit-TEXT_SUBTLE',
    light: 'hsl(0,0%,60%)',
    lightLabel: 'neutral-400',
    dark: 'hsl(233,5%,52%)',
    darkLabel: 'polar-400',
    usage: 'Placeholder, disabled text',
  },
  {
    token: '--orbit-DESTRUCTIVE',
    light: '#ef4444',
    lightLabel: 'red-500',
    dark: '#dc2626',
    darkLabel: 'red-600',
    usage: 'Error states, DESTRUCTIVE actions',
  },
]

const typeScaleTokens = [
  {
    level: 'h1',
    mobile: '3rem / 48px',
    desktop: '6rem / 96px',
    weight: '300',
    tracking: '−0.04em',
  },
  {
    level: 'h2',
    mobile: '2.25rem / 36px',
    desktop: '3rem / 48px',
    weight: '400',
    tracking: '−0.04em',
  },
  {
    level: 'h3',
    mobile: '1.875rem / 30px',
    desktop: '3rem / 48px',
    weight: '400',
    tracking: '−0.04em',
  },
  {
    level: 'h4',
    mobile: '1.5rem / 24px',
    desktop: '1.875rem / 30px',
    weight: '400',
    tracking: '−0.04em',
  },
  {
    level: 'h5',
    mobile: '1.25rem / 20px',
    desktop: '1.5rem / 24px',
    weight: '400',
    tracking: '−0.04em',
  },
  {
    level: 'h6',
    mobile: '1.125rem / 18px',
    desktop: '1.25rem / 20px',
    weight: '400',
    tracking: '−0.04em',
  },
]

const motionTokens = [
  {
    token: '--orbit-ease-expressive',
    value: 'cubic-bezier(0.7, 0, 0.3, 1)',
    usage: 'Headline reveal, BarChart scale',
  },
  {
    token: '--orbit-ease-fade',
    value: 'ease-out',
    usage: 'Opacity overlays, hover transitions',
  },
  {
    token: '--orbit-ease-instant',
    value: 'linear',
    usage: 'Button opacity, 50ms interactions',
  },
  {
    token: '--orbit-duration-display',
    value: '1.7s',
    usage: 'Headline curtain reveal per line',
  },
  {
    token: '--orbit-duration-structural',
    value: '1.4s',
    usage: 'BarChart bar scale animation',
  },
  {
    token: '--orbit-duration-fade',
    value: '0.4s',
    usage: 'Opacity fades, content overlays',
  },
  {
    token: '--orbit-duration-instant',
    value: '50ms',
    usage: 'Button hover opacity',
  },
  {
    token: '--orbit-stagger',
    value: '0.2s ÷ n',
    usage: 'Per-element delay in staggered sequences',
  },
]

const spacingTokens = [
  {
    token: '--orbit-space-1',
    px: '8px',
    rem: '0.5rem',
    usage: 'Icon gaps, tight padding',
  },
  {
    token: '--orbit-space-2',
    px: '16px',
    rem: '1rem',
    usage: 'Component inner padding',
  },
  {
    token: '--orbit-space-3',
    px: '24px',
    rem: '1.5rem',
    usage: 'Card padding',
  },
  {
    token: '--orbit-space-4',
    px: '32px',
    rem: '2rem',
    usage: 'Section internal gap',
  },
  {
    token: '--orbit-space-6',
    px: '48px',
    rem: '3rem',
    usage: 'Component section gap',
  },
  {
    token: '--orbit-space-8',
    px: '64px',
    rem: '4rem',
    usage: 'Page padding — mobile',
  },
  {
    token: '--orbit-space-12',
    px: '96px',
    rem: '6rem',
    usage: 'Section spacing — mobile',
  },
  {
    token: '--orbit-space-16',
    px: '128px',
    rem: '8rem',
    usage: 'Page padding — desktop',
  },
  {
    token: '--orbit-space-32',
    px: '256px',
    rem: '16rem',
    usage: 'Section spacing — desktop',
  },
]

// ─── Sub-components ─────────────────────────────────────────────────────────

function TableHeader({ cols }: { cols: string[] }) {
  return (
    <div
      className="dark:border-polar-800 grid border-b border-neutral-200 pb-2"
      style={{ gridTemplateColumns: `repeat(${cols.length}, 1fr)` }}
    >
      {cols.map((col) => (
        <Text
          key={col}
          as="span"
          variant="subtle"
          fontSize="xs"
          tracking="widest"
          transform="uppercase"
        >
          {col}
        </Text>
      ))}
    </div>
  )
}

function TableRow({ cells, cols }: { cells: ReactNode[]; cols: number }) {
  return (
    <div
      className="dark:border-polar-800 grid items-start border-b border-neutral-100 py-3.5"
      style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}
    >
      {cells.map((cell, i) => (
        <div key={i}>{cell}</div>
      ))}
    </div>
  )
}

function Swatch({ color }: { color: string }) {
  return (
    <span
      className="inline-block h-4 w-4 rounded-full border border-black/10 dark:border-white/10"
      style={{ backgroundColor: color }}
    />
  )
}

function Mono({ children }: { children: ReactNode }) {
  return (
    <Text as="code" fontFamily="mono" fontSize="xs" variant="subtle">
      {children}
    </Text>
  )
}

// ─── Page ───────────────────────────────────────────────────────────────────

export default function TokensPage() {
  return (
    <Stack vertical gap={sp['SPACING_10']}>
      <OrbitPageHeader
        title="Design Tokens"
        description="The raw values that underpin every visual decision in Orbit. Tokens are the single source of truth for color, typography, motion, and spacing."
      />

      {/* Color */}
      <Stack vertical gap={sp['SPACING_3']}>
        <Stack vertical gap={sp['SPACING_1']}>
          <Headline as="h4" text="Color" />
          <Box className="dark:border-polar-800 border-t border-neutral-200" />
        </Stack>
        <TableHeader cols={['Token', 'Light', 'Dark', 'Usage']} />
        {colorTokens.map(
          ({ token, light, lightLabel, dark, darkLabel, usage }) => (
            <TableRow
              key={token}
              cols={4}
              cells={[
                <Mono key="token">{token}</Mono>,
                <span key="light" className="inline-flex items-center gap-2">
                  <Swatch color={light} />
                  <Text as="span" variant="subtle" fontSize="xs">
                    {lightLabel}
                  </Text>
                </span>,
                <span key="dark" className="inline-flex items-center gap-2">
                  <Swatch color={dark} />
                  <Text as="span" variant="subtle" fontSize="xs">
                    {darkLabel}
                  </Text>
                </span>,
                <Text key="usage" as="span" variant="subtle" fontSize="xs">
                  {usage}
                </Text>,
              ]}
            />
          ),
        )}
      </Stack>

      {/* Type scale */}
      <Stack vertical gap={sp['SPACING_3']}>
        <Stack vertical gap={sp['SPACING_1']}>
          <Headline as="h4" text="Type Scale" />
          <Box className="dark:border-polar-800 border-t border-neutral-200" />
        </Stack>
        <TableHeader
          cols={['Level', 'Mobile', 'Desktop', 'Weight', 'Tracking']}
        />
        {typeScaleTokens.map(({ level, mobile, desktop, weight, tracking }) => (
          <TableRow
            key={level}
            cols={5}
            cells={[
              <Mono key="level">{level}</Mono>,
              <Text key="mobile" as="span" variant="subtle" fontSize="xs">
                {mobile}
              </Text>,
              <Text key="desktop" as="span" variant="subtle" fontSize="xs">
                {desktop}
              </Text>,
              <Text key="weight" as="span" variant="subtle" fontSize="xs">
                {weight}
              </Text>,
              <Text key="tracking" as="span" variant="subtle" fontSize="xs">
                {tracking}
              </Text>,
            ]}
          />
        ))}
        <Text variant="subtle" fontSize="xs">
          All heading levels use font-feature-settings: &apos;ss07&apos; 1,
          &apos;ss08&apos; 1, &apos;zero&apos; 1, &apos;liga&apos; 0
        </Text>
      </Stack>

      {/* Motion */}
      <Stack vertical gap={sp['SPACING_3']}>
        <Stack vertical gap={sp['SPACING_1']}>
          <Headline as="h4" text="Motion" />
          <Box className="dark:border-polar-800 border-t border-neutral-200" />
        </Stack>
        <TableHeader cols={['Token', 'Value', 'Usage']} />
        {motionTokens.map(({ token, value, usage }) => (
          <TableRow
            key={token}
            cols={3}
            cells={[
              <Mono key="token">{token}</Mono>,
              <Mono key="value">{value}</Mono>,
              <Text key="usage" as="span" variant="subtle" fontSize="xs">
                {usage}
              </Text>,
            ]}
          />
        ))}
      </Stack>

      {/* Spacing */}
      <Stack vertical gap={sp['SPACING_3']}>
        <Stack vertical gap={sp['SPACING_1']}>
          <Headline as="h4" text="Spacing" />
          <Box className="dark:border-polar-800 border-t border-neutral-200" />
          <Text variant="subtle" fontSize="sm">
            All spacing follows a base-8 grid. Use these values exclusively.
          </Text>
        </Stack>
        <Stack vertical gap={sp['SPACING_1']}>
          {spacingTokens.map(({ token, px, rem, usage }) => {
            const size = parseInt(px)
            const barWidth = Math.min(100, (size / 256) * 100)
            return (
              <Stack key={token} alignItems="center" gap={sp['SPACING_3']}>
                <Box className="w-32 shrink-0">
                  <div
                    className="h-1.5 rounded-full bg-black dark:bg-white"
                    style={{ width: `${barWidth}%` }}
                  />
                </Box>
                <Mono>{px}</Mono>
                <Mono>{rem}</Mono>
                <Text as="span" variant="subtle" fontSize="xs" className="flex-1">
                  {usage}
                </Text>
              </Stack>
            )
          })}
        </Stack>
      </Stack>
    </Stack>
  )
}
