import { defineWebhookHandler } from '@polar-sh/polar'
import type config from './polar.config'
import { polar } from './polar'

const servers = {
  enable: async (customerId: string) => console.log('enable', customerId),
  disable: async (customerId: string) => console.log('disable', customerId),
}

export default defineWebhookHandler<typeof config, 'app'>(async (event) => {
  switch (event.type) {
    case 'order.paid':
      console.log('paid', event.data.id, event.data.total_amount)
      return

    // Logic that spans events lives in one place
    case 'subscription.canceled':
    case 'subscription.revoked':
      console.log(event.type, event.data.id, event.data.status)
      return

    case 'benefit_grant.created':
    case 'benefit_grant.revoked': {
      if (polar.benefitKey(event.data.benefit) !== 'custom_servers') return
      const toggle =
        event.type === 'benefit_grant.created'
          ? servers.enable
          : servers.disable
      await toggle(event.data.customer_id)
      return
    }
  }
})
