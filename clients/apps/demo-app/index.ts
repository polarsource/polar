import { MeterSDK } from '@polar-sh/polar'
import config from './config'

const polar = MeterSDK(config, {
  accessToken: 'polar_oat_f2oL0wrw8aJ0QXGq2DuzNi2GUX9BKX1ACPpcq433SAB',
  environment: 'sandbox',
})

const DEMO_ID_PIETER = '0c65fa03-9f98-4e5c-8ec0-253608c091ce' // External customer ID for Pieter

const expensiveToolCall = async () => {
  const customer = polar.actor({ externalCustomerId: DEMO_ID_PIETER })

  const balance = await customer.meters.tool_call.balance()

  console.log('Checking balance before tool call:', balance)

  if (balance > -100) {
    console.log('That is plenty, doing the thing')
    // doTheThing();
    await customer.events.tool_call.ingest()

    const newBalance = await customer.meters.tool_call.balance()

    console.log('Checking balance after tool call:', newBalance)
  } else {
    console.log('Not enough balance, cannot do the thing')
  }
}

void expensiveToolCall()
