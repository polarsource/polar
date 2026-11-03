import { Box } from '@polar-sh/orbit/Box'
import {
  PosterBody,
  PosterFrame,
  PosterHeader,
  PosterHeadline,
  PosterMono,
  PosterRule,
} from './PosterFrame'

const TRANSITIONS: {
  id: string
  event: string
  access: string
  on: boolean
}[] = [
  { id: 'start', event: 'subscription.active', access: 'GRANTED', on: true },
  { id: 'dunning', event: 'subscription.past_due', access: 'KEPT', on: true },
  {
    id: 'cancel',
    event: 'subscription.canceled',
    access: 'REVOKED',
    on: false,
  },
  { id: 'resume', event: 'subscription.active', access: 'GRANTED', on: true },
]

const Marker = ({ on }: { on: boolean }) => (
  <svg width={10} height={10} viewBox="0 0 10 10" aria-hidden>
    <circle
      cx={5}
      cy={5}
      r={4}
      fill={on ? 'currentColor' : 'none'}
      stroke="currentColor"
    />
  </svg>
)

/** Access tracks the subscription, event by event, with nobody in the loop. */
export const BenefitsPoster = () => (
  <PosterFrame surface="night" signed>
    <PosterBody>
      <Box flexDirection="column">
        <PosterHeader>ENTITLEMENTS</PosterHeader>
        {TRANSITIONS.map(({ id, event, access, on }) => (
          <Box key={id} flexDirection="column" rowGap="s" paddingTop="s">
            <PosterRule />
            <Box alignItems="center" columnGap="m">
              <Marker on={on} />
              <Box flex={1} justifyContent="between" columnGap="l">
                <PosterMono>{event}</PosterMono>
                {on ? (
                  <PosterMono>{access}</PosterMono>
                ) : (
                  <PosterMono dim>{access}</PosterMono>
                )}
              </Box>
            </Box>
          </Box>
        ))}
      </Box>
      <PosterHeadline primary="Access follows" secondary="the subscription" />
    </PosterBody>
  </PosterFrame>
)
