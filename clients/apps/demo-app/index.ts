import { MeterSDK } from '@polar-sh/polar'
import config from './polar.config'

const polar = MeterSDK(config, {
  accessToken: 'polar_oat_f2oL0wrw8aJ0QXGq2DuzNi2GUX9BKX1ACPpcq433SAB',
  environment: 'sandbox',
})

const DEMO_ID = '0c65fa03-9f98-4e5c-8ec0-253608c091ce' // External customer ID for Pieter
// const DEMO_ID = '861f6728-4c01-4c6f-8ea1-e8011bb14c78' // External customer ID for Villiam

const expensiveToolCall = async () => {
  const customer = polar.actor({ externalCustomerId: DEMO_ID })

  const balance = await customer.meters.tool_call.balance()

  if (balance.isPristine && balance.balance > 0) {
    console.log('That is plenty, doing the thing')
    // doTheThing();
    await customer.events.ingest('tool_call')

    // // customer.meters.tool_call.isStale() // returns true
    // // customer.meters.tool_call.on('reconciled', () => isStale() // returns false)

    // // A problem is that this is now stale and we have no way of knowing
    // await balance.refresh()

    const newBalance = await customer.meters.tool_call.balance()

    console.log(
      'Checking balance after tool call:',
      newBalance,
      'is pristine:',
      newBalance.isPristine,
    )
  } else {
    console.log('Not enough balance, cannot do the thing')
  }
}

void expensiveToolCall()
