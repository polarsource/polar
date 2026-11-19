import PostHog from 'posthog-react-native'

export const posthog = new PostHog(
  'phc_H2ajVAY4cy0uQpcgN5fzpv8JC3yP8VZOjx2EXiFBbgz',
  {
    host: 'https://us.i.posthog.com',
    disabled: __DEV__,
  },
)

type AppEvents = {
  'app:checkout_links:link:create': { product_count: number }
  'app:checkout_links:link:update': { product_count: number }
  'app:checkout_links:link:copy': undefined
  'app:onboarding:organization:create': undefined
  'app:organizations:organization:switch': undefined
  'app:subscriptions:subscription:cancel': {
    action: 'cancel_at_period_end' | 'revoke'
    reason: string | null
  }
  'app:subscriptions:subscription:update': {
    proration_behavior: string | null
  }
  'app:finance:payout:create': undefined
  'app:finance:support_email:verify': undefined
  'app:settings:push_notifications:update': { enabled: boolean }
  'app:settings:notification_setting:update': {
    setting: string
    enabled: boolean
  }
  'app:notifications:push:open': undefined
  'app:user:account:delete': undefined
}

export const capture = <E extends keyof AppEvents>(
  event: E,
  ...[properties]: AppEvents[E] extends undefined ? [] : [AppEvents[E]]
) => {
  posthog.capture(event, properties)
}
