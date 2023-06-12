import { CONFIG } from 'polarkit'
import { PostHog } from 'posthog-node'

let posthog: PostHog | undefined
if (CONFIG.POSTHOG_TOKEN) {
  posthog = new PostHog(CONFIG.POSTHOG_TOKEN, {
    host: 'https://app.posthog.com',
  })
}

export default posthog
