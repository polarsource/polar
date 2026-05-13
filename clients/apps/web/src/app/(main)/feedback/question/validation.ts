import { POLAR_DESCRIPTION } from '@/components/Feedback/constants'
import { createGoogleGenerativeAI } from '@ai-sdk/google'
import { generateObject } from 'ai'
import { z } from 'zod'

import { flushPostHog, type TracingContext, wrapWithTracing } from './posthog'

export const validationSchema = z.object({
  status: z
    .enum([
      'answerable',
      'unclear',
      'off_topic',
      'account_review',
      'pre_approval',
    ])
    .describe(
      '"answerable" if the message is a clear question that is about Polar; "unclear" if the message is not phrased as a question or lacks enough context to answer; "off_topic" if the message is clearly not about Polar; "account_review" if the user is asking why their account is under review or anything closely related to that; "pre_approval" if the user is asking us to pre-approve their account, eligibility, business model, or use case before they have signed up and gone through onboarding.',
    ),
})

export type ValidationStatus = z.infer<typeof validationSchema>['status']

const VALIDATION_SYSTEM_PROMPT = `You classify incoming messages for the Polar support assistant.

About Polar:
${POLAR_DESCRIPTION}

Return one of:
- "account_review": the user is asking why their account is under review, why their payouts are paused for a review, why they are being verified, or anything closely related to that. Examples: "why is my account under review?", "why are payouts on hold for a review?", "what's going on with this review?". When in doubt about whether a message is about an ongoing account review, return "account_review" — we have a canned answer for this case and never want to escalate it to a human.
- "pre_approval": the user is asking us to confirm upfront whether their business, product, use case, or model is allowed on Polar, or to pre-approve their account before they sign up and go through onboarding. Examples: "can I sell X on Polar?", "is my use case eligible?", "would Polar approve a business that does Y?", "can you confirm I'm allowed under your AUP before I sign up?", "is my model acceptable?". We don't do proactive AUP or eligibility reviews over support — onboarding is the required path.
- "answerable": the message is a clear question and is plausibly about Polar (its product, configuration, billing, payouts, integrations, account, API, or anything a Polar seller or customer would ask).
- "unclear": the message is not phrased as a question or does not contain enough context for us to look anything up.
- "off_topic": the message is clearly not about Polar (e.g. weather, unrelated programming questions, general chitchat, other unrelated products).

When in doubt between "answerable" and "off_topic", prefer "answerable" — we will search the docs and let the answer step decide.`

const google = createGoogleGenerativeAI({
  apiKey: process.env.PYDANTIC_AI_GATEWAY_API_KEY,
  headers: {
    Authorization: `Bearer ${process.env.PYDANTIC_AI_GATEWAY_API_KEY}`,
  },
  baseURL: 'https://gateway-us.pydantic.dev/proxy/google-vertex/',
})

export const validateFeedbackQuestion = async (
  question: string,
  tracing: TracingContext,
): Promise<ValidationStatus> => {
  const model = wrapWithTracing(
    google('gemini-3.1-flash-lite-preview'),
    tracing,
  )
  try {
    const result = await generateObject({
      model,
      schema: validationSchema,
      system: VALIDATION_SYSTEM_PROMPT,
      prompt: question,
    })
    return result.object.status
  } finally {
    flushPostHog()
  }
}
