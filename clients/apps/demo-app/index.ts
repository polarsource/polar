import { loadEnvFile } from 'node:process'
import { MeterSDK } from '@polar-sh/polar'
import config from './polar.config'

loadEnvFile(new URL('./.env.local', import.meta.url))

const accessToken = process.env.POLAR_ACCESS_TOKEN

if (!accessToken) {
  throw new Error('POLAR_ACCESS_TOKEN is required in .env.local')
}

const polar = MeterSDK(config, {
  accessToken,
  environment: 'sandbox',
})

const DEMO_ID = '0c65fa03-9f98-4e5c-8ec0-253608c091ce' // External customer ID for Pieter
// const DEMO_ID = '861f6728-4c01-4c6f-8ea1-e8011bb14c78' // External customer ID for Villiam

const expensiveToolCall = async () => {
  const customer = polar.actor({ externalCustomerId: DEMO_ID })

  const balance = await customer.meters.tool_call.balance()

  console.log('Current balance before tool call:', balance)

  if (!balance.isPristine) {
    throw new Error(
      'Balance is not pristine, meaning the last event ingested has not yet been reflected in the balance. Please wait a few seconds and try again.',
    )
  }

  if (balance.balance > 0) {
    console.log('Balance is sufficient, doing the tool call')

    await customer.events.ingest('tool_call')

    const start = new Date()
    let newBalance = await customer.meters.tool_call.balance()

    while (!newBalance.isPristine) {
      console.log('New balance is not pristine yet, polling again in 1s')
      await new Promise((resolve) => setTimeout(resolve, 1000))
      newBalance = await customer.meters.tool_call.balance()

      if (new Date().getTime() - start.getTime() > 60000) {
        throw new Error(
          'Balance is not pristine after 1 minute, something is wrong',
        )
      }
    }

    console.log('New balance after tool call:', newBalance)
  } else {
    console.log('Not enough balance, cannot do the thing')
  }
}

void expensiveToolCall()
