import { loadEnvFile } from 'node:process'
import { RuntimeSDK } from '@polar-sh/polar'
import config from './polar.config.ts'

loadEnvFile(new URL('./.env.local', import.meta.url))

const accessToken = process.env.POLAR_ACCESS_TOKEN

if (!accessToken) {
  throw new Error('POLAR_ACCESS_TOKEN is required in .env.local')
}

const baseUrl = process.env.POLAR_BASE_URL

const polar = RuntimeSDK(config, {
  accessToken,
  ...(baseUrl ? { baseUrl } : { environment: 'sandbox' }),
})

const DEMO_ID = '0c65fa03-9f98-4e5c-8ec0-253608c091ce' // External customer ID for Pieter
// const DEMO_ID = '861f6728-4c01-4c6f-8ea1-e8011bb14c78' // External customer ID for Villiam
const LOCAL_DEMO_ID = '3942DFC4-331A-42B2-BED9-E2916EB4E05D'

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

const actorsDoToolCalls = async () => {
  const customer = { externalCustomerId: LOCAL_DEMO_ID }

  const owner = { externalMemberId: LOCAL_DEMO_ID }
  const alice = { externalMemberId: 'member_123' }
  const bob = { externalMemberId: 'member_222' }
  const carol = { externalMemberId: 'member_333' }

  const engineeringTeam = { externalEntityId: 'engineering_team' }
  const designTeam = { externalEntityId: 'design_team' }

  const nightlySync = { externalEntityId: 'nightly_sync' }
  const supportBot = { externalEntityId: 'support_bot' }
  const codingAgent = { externalEntityId: 'coding_agent' }
  const testRunner = { externalEntityId: 'test_runner' }
  const reviewAgent = { externalEntityId: 'review_agent' }
  const imageAgent = { externalEntityId: 'image_agent' }
  const upscaler = { externalEntityId: 'upscaler' }

  const workload: [ReturnType<typeof polar.actor>, number][] = [
    [polar.actor(customer), 2],
    [polar.actor([customer, nightlySync]), 4],
    [polar.actor([customer, supportBot]), 3],

    [polar.actor({ ...customer, ...owner }), 2],

    [polar.actor([customer, engineeringTeam, alice]), 1],
    [polar.actor([customer, engineeringTeam, alice, codingAgent]), 5],
    [
      polar.actor([customer, engineeringTeam, alice, codingAgent, testRunner]),
      8,
    ],

    [polar.actor([customer, engineeringTeam, bob]), 2],
    [polar.actor([customer, engineeringTeam, bob, reviewAgent]), 4],

    [polar.actor([customer, designTeam, carol, imageAgent]), 3],
    [polar.actor([customer, designTeam, carol, imageAgent, upscaler]), 3],
  ]

  let total = 0
  for (const [actor, count] of workload) {
    for (let i = 0; i < count; i++) {
      total += await actor.events.ingest('tool_call')
    }
  }

  console.log(`Ingested ${total} tool_call events`)
}

void actorsDoToolCalls()

// Alternative syntaxes for actor paths
//
// Each example builds the same three actors
//   acme
//   acme → engineering → alice
//   acme → engineering → alice → coding_agent
//
// An array of identifier objects.
//
//    polar.actor({ externalCustomerId: 'acme' })
//    polar.actor([
//      { externalCustomerId: 'acme' },
//      { externalEntityId: 'engineering' },
//      { externalMemberId: 'alice' },
//    ])
//    polar.actor([
//      { externalCustomerId: 'acme' },
//      { externalEntityId: 'engineering' },
//      { externalMemberId: 'alice' },
//      { externalEntityId: 'coding_agent' },
//    ])
//
// Method chaining
//
//    polar.customer('acme')
//    polar.customer('acme').entity('engineering').member('alice')
//    polar.customer('acme').entity('engineering').member('alice').entity('coding_agent')
//
// Parent references
//
//    const acme = polar.customer('acme')
//    const engineering = polar.entity('engineering', { parent: acme })
//    const alice = polar.member('alice', { parent: engineering })
//    const codingAgent = polar.entity('coding_agent', { parent: alice })
