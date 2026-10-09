import { loadEnvFile } from 'node:process'
import { RuntimeSDK, type MeterBalance } from '@polar-sh/polar'
import { log } from './log'
import config from './polar.config'
import { purchaseOffSession } from './top-up'

loadEnvFile(new URL('./.env.local', import.meta.url))

const accessToken = process.env.POLAR_ACCESS_TOKEN

if (!accessToken) {
  throw new Error('POLAR_ACCESS_TOKEN is required in .env.local')
}

const polar = RuntimeSDK(config, {
  accessToken,
  environment: 'sandbox',
})

// const DEMO_ID = '0c65fa03-9f98-4e5c-8ec0-253608c091ce' // External customer ID for Pieter
const DEMO_ID = '861f6728-4c01-4c6f-8ea1-e8011bb14c78' // External customer ID for Villiam
//

const waitForBalance = async (
  customer: ReturnType<typeof polar.actor>,
  until: (balance: MeterBalance) => boolean,
  span: ReturnType<typeof log.start>,
) => {
  const start = performance.now()
  let balance = await customer.balance('tool_call')

  while (!until(balance)) {
    span.log('Balance not updated yet, polling again in 1s', balance)
    await new Promise((resolve) => setTimeout(resolve, 1000))
    balance = await customer.balance('tool_call')

    if (performance.now() - start > 60000) {
      throw new Error('Balance not updated after 1 minute, something is wrong')
    }
  }

  span.end()
  return balance
}

const expensiveToolCall = async () => {
  const customer = polar.actor({ externalCustomerId: DEMO_ID })

  const benefitsSpan = log.start('Checking benefits')

  if ((await customer.access('custom_servers')).granted) {
    log('Customer has custom servers benefit, embedding custom servers')
  }

  benefitsSpan.end()

  const balanceSpan = log.start('Fetching initial balance')
  let balance = await customer.balance('tool_call')
  balanceSpan.end()

  log('Current balance before tool call:', balance)

  if (!balance.pristine) {
    throw new Error(
      'Balance is not pristine, meaning the last event ingested has not yet been reflected in the balance. Please wait a few seconds and try again.',
    )
  }

  if (balance.balance <= 0) {
    const topUpSpan = log.start('Out of tool calls, charging a top-up')
    const order = await purchaseOffSession(polar.sdk, DEMO_ID, 'tool_call_pack')
    topUpSpan.end(`order ${order.id}`)

    const before = balance.balance
    balance = await waitForBalance(
      customer,
      (next) => next.balance > before,
      log.start('Waiting for top-up credits'),
    )
    log('Balance after top-up:', balance)
  }

  if (balance.balance > 0) {
    log('Balance is sufficient, doing the tool call')

    const ingestSpan = log.start('Ingesting tool_call')
    await customer.track('tool_call', {
      tool: 'search',
      server: 'builtin',
      success: true,
      duration_ms: 420,
    })
    ingestSpan.end()

    const newBalance = await waitForBalance(
      customer,
      (next) => next.pristine,
      log.start('Waiting for pristine balance'),
    )
    log('New balance after tool call:', newBalance)
  } else {
    log('Not enough balance, cannot do the thing')
  }
}

void expensiveToolCall()
