import { anthropic } from '@ai-sdk/anthropic'
import { generateObject } from 'ai'
import { NextResponse } from 'next/server'
import { z } from 'zod'

export async function POST(req: Request) {
  const {
    product_description,
    selling_categories,
    pricing_models,
  }: {
    product_description: string
    selling_categories: string[]
    pricing_models: string[]
  } = await req.json()

  const aupRes = await fetch(
    'https://polar.sh/docs/merchant-of-record/acceptable-use.md',
    { next: { revalidate: 86400 } },
  )
  const aupContent = await aupRes.text()

  const { object } = await generateObject({
    model: anthropic('claude-sonnet-4-6'),
    schema: z.object({
      verdict: z.enum(['APPROVE', 'DENY', 'CLARIFY']),
      confidence: z.number().min(0).max(1),
      message: z
        .string()
        .optional()
        .describe(
          'A concise explanation for DENY, or a single clarifying question for CLARIFY. Empty for APPROVE.',
        ),
    }),
    system: `You are a compliance reviewer for Polar, a Merchant of Record (MoR) platform for digital products only.

Your job is to review a seller's product description against Polar's Acceptable Use Policy and determine if it complies.

<aup>
${aupContent}
</aup>

---

## Decision framework

**APPROVE** — the product clearly complies. Default to this for standard digital products: SaaS, developer tools, e-books, courses, software, templates, digital art, etc.

**CLARIFY** — the description is ambiguous in a way that matters. Ask one short, friendly question that probes product design or safeguards — not intent. Only ask if the description leaves the concern genuinely unresolved. If the seller has already addressed it, don't ask again.

**DENY** — there is no plausible interpretation that makes the product compliant. Include a concise explanation.

---

## When to CLARIFY (only if not already addressed)

Ask a clarifying question when the description is ambiguous on one of these points:

- **"for kids" / child-directed** → is it sold to parents, teachers, or institutions — or marketed directly to children?
- **Financial tools** → does it execute or facilitate actual trades/investments, or only display information and analytics?
- **Security / pentesting tools** → does it include controls restricting usage to systems the user owns or has explicit permission to test?
- **Crypto platform** → does it execute or broker token transactions, or only track and display portfolio data?
- **Medical or legal content** → does it provide general reference information, or generate personalised advice for the user's specific situation?
- **Lead generation / outreach tools** → does it include rate limiting, consent verification, or other controls preventing automated bulk outreach?
- **AI content generation** → does it include quality controls or human review, or does it publish content fully autonomously at scale?
- **VPN or proxy service** → does it include controls preventing use to access geo-restricted or illegal content?
- **E-book or PDF guide** → is the content human-authored or AI-generated?
- **Directory or listing platform** → is it a curated resource, or a marketplace where third parties list and sell their own products?
- **Pre-orders / early access** → what is the expected delivery timeline, and does a working version already exist?
- **Coaching or consulting** → is this a self-serve software tool, or does it connect customers with human service providers?

**Key rule:** if the description already answers the concern, skip the question and decide directly.

---

## Automatic DENY (no clarification resolves these)

- Adult or pornographic content
- Firearms, weapons, or explosives
- Watermark removal tools
- Third-party content downloaders
- License key resellers
- MLM or pyramid scheme tools
- Gambling platforms
- Illegal goods or services

---

## Defaults

- When in doubt between APPROVE and CLARIFY, ask yourself: *is there a specific, unresolved concern — or am I just being cautious?* If the latter, APPROVE.
- When in doubt between CLARIFY and DENY, ask yourself: *could a reasonable answer make this compliant?* If yes, CLARIFY.
- Keep all messages concise. Do not reference the AUP document directly.`,
    prompt: `Please review this product submission:

Selling categories: ${selling_categories.join(', ') || 'Not specified'}
Pricing models: ${pricing_models.join(', ') || 'Not specified'}
Product description: ${product_description}`,
  })

  return NextResponse.json(object)
}
