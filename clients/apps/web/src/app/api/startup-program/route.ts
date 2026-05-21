import { createPerson, upsertCompany } from '@/utils/attio'
import * as Sentry from '@sentry/nextjs'
import { NextResponse } from 'next/server'
import { z } from 'zod'

const requestSchema = z.object({
  startupName: z.string().min(1).max(200),
  industry: z.string().max(200).optional().default(''),
  website: z.string().max(500).optional().default(''),
  foundedAt: z.string().max(50).optional().default(''),
  funding: z.string().max(100).optional().default(''),
  partner: z.string().max(100).optional().default(''),
  partnerOther: z.string().max(200).optional().default(''),
  paymentVolume: z.string().max(200).optional().default(''),
  teamSize: z.string().max(50).optional().default(''),
  location: z.string().max(200).optional().default(''),
  pitch: z.string().max(2000).optional().default(''),
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  role: z.string().max(100).optional().default(''),
  email: z.email().max(200),
})

const buildCompanyDescription = (
  data: z.infer<typeof requestSchema>,
): string => {
  const lines: string[] = []
  if (data.pitch) lines.push(data.pitch, '')
  if (data.industry) lines.push(`Industry: ${data.industry}`)
  if (data.foundedAt) lines.push(`Founded: ${data.foundedAt}`)
  if (data.funding) lines.push(`Funding raised: ${data.funding}`)
  const partner = data.partner === 'Other' ? data.partnerOther : data.partner
  if (partner) lines.push(`Partner / Investor: ${partner}`)
  if (data.teamSize) lines.push(`Team size: ${data.teamSize}`)
  if (data.location) lines.push(`Location: ${data.location}`)
  if (data.paymentVolume) lines.push(`Payment volume: ${data.paymentVolume}`)
  return lines.join('\n')
}

export async function POST(req: Request) {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = requestSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid request', issues: parsed.error.issues },
      { status: 400 },
    )
  }
  const data = parsed.data

  if (!process.env.ATTIO_API_KEY) {
    console.warn('[startup-program] ATTIO_API_KEY not set; skipping forward.')
    return NextResponse.json({ ok: true, forwarded: false })
  }

  try {
    const company = await upsertCompany({
      name: data.startupName,
      website: data.website,
      description: buildCompanyDescription(data),
    })

    await createPerson({
      firstName: data.firstName,
      lastName: data.lastName,
      email: data.email,
      jobTitle: data.role,
      companyRecordId: company.id.record_id,
    })

    return NextResponse.json({ ok: true, forwarded: true })
  } catch (error) {
    console.error('[startup-program] Attio forward failed:', error)
    Sentry.captureException(error)
    return NextResponse.json(
      { error: 'Failed to submit application' },
      { status: 502 },
    )
  }
}
