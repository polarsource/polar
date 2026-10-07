import { loadEnvFile } from 'node:process'
import { RuntimeSDK } from '@polar-sh/polar'
import { log } from './log'
import config from './polar.config'

loadEnvFile(new URL('./.env.local', import.meta.url))

const accessToken = process.env.POLAR_ACCESS_TOKEN

if (!accessToken) {
  throw new Error('POLAR_ACCESS_TOKEN is required in .env.local')
}

const polar = RuntimeSDK(config, {
  accessToken,
  environment: 'sandbox',
})

const DEMO_ID = '0c65fa03-9f98-4e5c-8ec0-253608c091ce' // External customer ID for Pieter
// const DEMO_ID = '861f6728-4c01-4c6f-8ea1-e8011bb14c78' // External customer ID for Villiam

const expensiveToolCall = async () => {
  const customer = polar.actor({ externalCustomerId: DEMO_ID })

  const benefitsSpan = log.start('Checking benefits')

  if (await customer.has('custom_servers')) {
    log('Customer has custom servers benefit, embedding custom servers')
  }

  benefitsSpan.end()

  const balanceSpan = log.start('Fetching initial balance')
  const balance = await customer.balance('tool_call')
  balanceSpan.end()

  log('Current balance before tool call:', balance)

  if (!balance.pristine) {
    throw new Error(
      'Balance is not pristine, meaning the last event ingested has not yet been reflected in the balance. Please wait a few seconds and try again.',
    )
  }

  if (balance.balance > 0) {
    log('Balance is sufficient, doing the tool call')

    const ingestSpan = log.start('Ingesting tool_call')
    await customer.track('tool_call')
    ingestSpan.end()

    const pollingSpan = log.start('Waiting for pristine balance')
    const start = performance.now()
    let newBalance = await customer.balance('tool_call')

    while (!newBalance.pristine) {
      pollingSpan.log('New balance is not pristine yet, polling again in 1s')
      await new Promise((resolve) => setTimeout(resolve, 1000))
      newBalance = await customer.balance('tool_call')

      if (performance.now() - start > 60000) {
        throw new Error(
          'Balance is not pristine after 1 minute, something is wrong',
        )
      }
    }

    pollingSpan.end()
    log('New balance after tool call:', newBalance)
  } else {
    log('Not enough balance, cannot do the thing')
  }
}

void expensiveToolCall()
