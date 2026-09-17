import { VoidHttpError } from '@void/sdk'
import { ORG, void_ } from './void'

/**
 * Run after `void deploy`: the organization becomes a root identity, a
 * paying customer, and a subscriber to the team plan. Safe to run again.
 */
const main = async () => {
  const org = await void_.root(ORG)

  try {
    await void_.api.customers.get(ORG)
  } catch (error) {
    if (!(error instanceof VoidHttpError && error.notFound)) throw error
    await void_.api.customers.create({
      external_id: ORG,
      email: 'acme.po.bot@gmail.com',
      name: 'Acme',
    })
  }

  const active = await org.subscriptions.list({ active: true })
  if (active.length === 0) await org.products.team.subscribe()

  console.log(`${ORG} is subscribed to Po Bot Team`)
  await void_.dispose()
}

main()
