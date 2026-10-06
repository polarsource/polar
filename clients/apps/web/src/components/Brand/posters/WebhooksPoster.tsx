import { Box } from '@polar-sh/orbit/Box'
import {
  PosterBody,
  PosterFrame,
  PosterHeadline,
  PosterMono,
} from './PosterFrame'

const EVENTS: [string, string][] = [
  ['09:41:02', 'checkout.created'],
  ['09:41:37', 'order.paid'],
  ['09:41:37', 'customer.state_changed'],
  ['09:41:38', 'subscription.active'],
  ['09:41:38', 'benefit_grant.created'],
  ['09:42:10', 'order.updated'],
  ['09:58:51', 'refund.created'],
  ['09:58:52', 'benefit_grant.revoked'],
]

/** A minute of webhooks: every change in Polar, delivered to you. */
export const WebhooksPoster = () => (
  <PosterFrame surface="snow" signed>
    <PosterBody>
      <Box flexDirection="column" rowGap="l">
        <Box justifyContent="between">
          <PosterMono>WEBHOOKS</PosterMono>
          <PosterMono dim>POST /webhooks</PosterMono>
        </Box>
        <Box flexDirection="column" rowGap="s">
          {EVENTS.map(([time, event], i) => (
            <Box key={i} columnGap="l">
              <PosterMono dim>{time}</PosterMono>
              <PosterMono>{event}</PosterMono>
            </Box>
          ))}
        </Box>
      </Box>
      <PosterHeadline primary="Every change" secondary="delivered to you" />
    </PosterBody>
  </PosterFrame>
)
