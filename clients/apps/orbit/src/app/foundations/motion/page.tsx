import { Box } from '@polar-sh/orbit/Box'
import {
  PageHeader,
  Section,
  Prose,
  Example,
  PropsTable,
} from '@/components/docs'
import type { PropRow } from '@/components/docs'
import { Text } from '@polar-sh/orbit'

const DURATIONS: PropRow[] = [
  {
    name: 'instant',
    type: '0ms',
    description: 'No animation; immediate state change.',
  },
  {
    name: 'fast',
    type: '120ms',
    description: 'Hover, focus, and small toggles.',
  },
  { name: 'base', type: '200ms', description: 'Default for most transitions.' },
  {
    name: 'slow',
    type: '320ms',
    description: 'Larger surfaces entering or leaving.',
  },
  {
    name: 'slower',
    type: '480ms',
    description: 'Full-screen or emphasis moments.',
  },
]

const EASINGS: PropRow[] = [
  {
    name: 'standard',
    type: 'cubic-bezier(0.2, 0, 0, 1)',
    description: 'General-purpose, symmetric. Default choice.',
  },
  {
    name: 'decelerate',
    type: 'cubic-bezier(0, 0, 0, 1)',
    description: 'Enter transitions: fast in, settle out.',
  },
  {
    name: 'accelerate',
    type: 'cubic-bezier(0.3, 0, 1, 1)',
    description: 'Exit transitions: settle in, fast out.',
  },
  {
    name: 'spring',
    type: 'cubic-bezier(0.5, 1.25, 0.4, 1)',
    description: 'Slight overshoot for playful emphasis.',
  },
]

const MOTION_CODE = `<Box
  transform={{ hover: 'translateY(-4px)' }}
  transitionProperty="transform"
  transitionDuration="fast"
  ease="decelerate"
>
  Hover me
</Box>`

export default function MotionPage() {
  return (
    <>
      <PageHeader
        title="Motion"
        description="Duration and easing tokens for transitions. Pair transitionDuration and ease with pseudo-state props to animate state changes."
      />

      <Section
        title="Durations"
        description="Durations are CSS variables, so motion can be tuned globally or zeroed for prefers-reduced-motion. Pass to transitionDuration."
      >
        <PropsTable rows={DURATIONS} />
      </Section>

      <Section
        title="Easings"
        description="Easings are compile-time constants; they never vary at runtime. Pass to ease or transitionTimingFunction."
      >
        <PropsTable rows={EASINGS} />
      </Section>

      <Section
        title="Usage"
        description="Combine a transition property, a duration, and an easing with a hover value. The transition runs from pure CSS, no JavaScript required."
      >
        <Prose>
          <Text color="muted">
            Hover the surface below to see fast plus decelerate, the recommended
            pairing for elements entering toward the pointer.
          </Text>
        </Prose>
        <Example code={MOTION_CODE}>
          <Box
            paddingVertical="l"
            paddingHorizontal="xl"
            borderRadius="m"
            backgroundColor="background-inverse"
            transform={{ hover: 'translateY(-4px)' }}
            boxShadow={{ base: 's', hover: 'l' }}
            transitionProperty="common"
            transitionDuration="fast"
            ease="decelerate"
            cursor="pointer"
          >
            <Text color="inverse">Hover me</Text>
          </Box>
        </Example>
      </Section>
    </>
  )
}
