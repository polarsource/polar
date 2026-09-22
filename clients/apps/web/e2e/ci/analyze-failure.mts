import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const ARTIFACTS = 'e2e/artifacts'
const MODEL = 'gpt-5.5'
const LOG_LIMIT = 15_000

const CONTEXT = `Polar (polar.sh) is a merchant-of-record payments platform. You are reviewing the hourly check of its checkout on the sandbox environment, which runs the same code as main against Stripe test mode.
The test drives a real Chrome with Stagehand: it opens a checkout link for a subscription with a free trial, fills email and cardholder name, sets a US billing address (country, street, postal code, city, state), types Stripe's 4242 test card into the Payment Element iframe, clicks "Start trial", expects a redirect to /confirmation, polls the Polar API until the checkout status is "succeeded" (which depends on Stripe's setup_intent.succeeded webhook reaching Polar) and a "trialing" subscription exists, then cancels it through the customer portal API.
Every form field is verified against the API before the test moves on, dropdowns are driven with typeahead and Enter, and the test was retried; every attempt failed. The artifacts below are from the last attempt: the failure, the model's plan with the selectors it chose, the browser console log (which also records failed fetch calls, uncaught errors and unhandled rejections), and one screenshot per step in order.`

const INSTRUCTIONS = `Explain why this run most likely failed, based only on the artifacts. Write plain sentences without any markdown. Keep likely_cause, verdict_reason and next_step to at most two sentences each, and give at most five evidence items, each citing a screenshot or a log line.`

const VERDICTS = {
  transient: 'Transient, worth a re-run',
  provider_outage: 'Provider problem',
  checkout_regression: 'Checkout regression',
  test_problem: 'Problem in the test itself',
}

const SCHEMA = {
  type: 'object',
  properties: {
    likely_cause: { type: 'string' },
    evidence: { type: 'array', items: { type: 'string' } },
    verdict: { type: 'string', enum: Object.keys(VERDICTS) },
    verdict_reason: { type: 'string' },
    next_step: { type: 'string' },
  },
  required: [
    'likely_cause',
    'evidence',
    'verdict',
    'verdict_reason',
    'next_step',
  ],
  additionalProperties: false,
}

type Results = {
  testResults: Array<{
    assertionResults: Array<{
      fullName: string
      status: string
      failureMessages: string[]
      meta: { artifacts?: string }
    }>
  }>
}
type Analysis = {
  likely_cause: string
  evidence: string[]
  verdict: keyof typeof VERDICTS
  verdict_reason: string
  next_step: string
}
type Content =
  | { type: 'input_text'; text: string }
  | { type: 'input_image'; image_url: string; detail: 'auto' }

const scrub = (text: string) =>
  text.replace(/polar_[a-z]+_[A-Za-z0-9_-]{8,}/g, 'polar_***')

const escape = (text: string) =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

const render = (analysis: Analysis) =>
  [
    `*Likely cause:* ${escape(analysis.likely_cause)}`,
    '*Evidence*',
    ...analysis.evidence.map((item) => `• ${escape(item)}`),
    `*Verdict:* ${VERDICTS[analysis.verdict]}. ${escape(analysis.verdict_reason)}`,
    `*Next step:* ${escape(analysis.next_step)}`,
  ].join('\n')

const collect = (failure: Results['testResults'][0]['assertionResults'][0]) => {
  const content: Content[] = [
    {
      type: 'input_text',
      text: `Test: ${failure.fullName}\nFailure:\n${scrub(failure.failureMessages.join('\n'))}`,
    },
  ]
  if (!failure.meta.artifacts) return content
  const dir = join(ARTIFACTS, failure.meta.artifacts)
  if (!existsSync(dir)) return content
  const files = readdirSync(dir).sort()
  for (const file of files.filter((f) => f.endsWith('-plan.json'))) {
    content.push({
      type: 'input_text',
      text: `Plan ${file}:\n${scrub(readFileSync(join(dir, file), 'utf8'))}`,
    })
  }
  if (files.includes('browser.log')) {
    const log = readFileSync(join(dir, 'browser.log'), 'utf8')
    content.push({
      type: 'input_text',
      text: `Browser log (last ${LOG_LIMIT} characters):\n${scrub(log.slice(-LOG_LIMIT))}`,
    })
  }
  for (const file of files.filter((f) => f.endsWith('.png'))) {
    content.push({ type: 'input_text', text: `Screenshot ${file}` })
    content.push({
      type: 'input_image',
      image_url: `data:image/png;base64,${readFileSync(join(dir, file)).toString('base64')}`,
      detail: 'auto',
    })
  }
  return content
}

const analyze = async (content: Content[]): Promise<string> => {
  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: MODEL,
      instructions: INSTRUCTIONS,
      text: {
        format: {
          type: 'json_schema',
          name: 'failure_analysis',
          strict: true,
          schema: SCHEMA,
        },
      },
      input: [
        {
          role: 'user',
          content: [{ type: 'input_text', text: CONTEXT }, ...content],
        },
      ],
    }),
  })
  if (!response.ok) {
    throw new Error(`OpenAI ${response.status}: ${await response.text()}`)
  }
  const json = (await response.json()) as {
    output?: Array<{ content?: Array<{ type: string; text?: string }> }>
  }
  const text = (json.output ?? [])
    .flatMap((item) => item.content ?? [])
    .filter((part) => part.type === 'output_text')
    .map((part) => part.text ?? '')
    .join('')
  return render(JSON.parse(text) as Analysis)
}

const main = async () => {
  const resultsPath = join(ARTIFACTS, 'results.json')
  const failures = existsSync(resultsPath)
    ? (JSON.parse(readFileSync(resultsPath, 'utf8')) as Results).testResults
        .flatMap((file) => file.assertionResults)
        .filter((test) => test.status === 'failed')
    : []

  let text: string
  if (failures.length === 0) {
    text = 'No failed test to analyze: the job failed before the test ran.'
  } else {
    try {
      text = await analyze(failures.flatMap(collect))
    } catch (error) {
      text = `Could not analyze the failure: ${error instanceof Error ? error.message : String(error)}`
    }
  }

  console.log(text)
  writeFileSync(
    'slack-analysis.json',
    JSON.stringify({
      channel: process.env.SLACK_CHANNEL_ID,
      thread_ts: process.env.SLACK_THREAD_TS,
      text: `:mag: *What probably happened*\n${text}`,
    }),
  )
}

await main()
