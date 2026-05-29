import { addToList, createPerson, upsertCompany } from '@/utils/attio'
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
  currentBillingPlatform: z.string().max(100).optional().default(''),
  currentBillingPlatformOther: z.string().max(200).optional().default(''),
  polarOrgSlug: z.string().max(200).optional().default(''),
  teamSize: z.string().max(50).optional().default(''),
  location: z.string().max(200).optional().default(''),
  pitch: z.string().max(2000).optional().default(''),
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  role: z.string().max(100).optional().default(''),
  email: z.email().max(200),
})

// Attio's select-type attributes expect `[{ option: '<title>' }]` — the
// option value is the option title string, not a wrapped object.
const selectValue = (title: string) => [{ option: title }]

const buildEntryValues = (
  data: z.infer<typeof requestSchema>,
  personRecordId: string,
): Record<string, unknown> => {
  const values: Record<string, unknown> = {}

  // Text attributes — Attio accepts the bare string for text shorthand.
  if (data.industry) values.industry = data.industry
  if (data.foundedAt) values.founded = data.foundedAt
  if (data.paymentVolume) values.payment_volume = data.paymentVolume
  if (data.location) values.location = data.location
  if (data.pitch) values.pitch = data.pitch
  if (data.polarOrgSlug) values.polar_org_slug = data.polarOrgSlug

  // Select attributes — option titles must match the choices configured on
  // the Attio list (mirrors FUNDING_OPTIONS / PARTNER_OPTIONS / TEAM_SIZE_OPTIONS
  // / BILLING_PLATFORM_OPTIONS in StartupProgramForm.tsx).
  if (data.funding) values.funding_raised = selectValue(data.funding)
  if (data.partner) values.partner = selectValue(data.partner)
  if (data.teamSize) values.team_size = selectValue(data.teamSize)
  if (data.currentBillingPlatform) {
    values.current_billing_platform = selectValue(data.currentBillingPlatform)
  }

  // Free-text used only when the partner picker is set to "Other".
  if (data.partner === 'Other' && data.partnerOther) {
    values.partner_other = data.partnerOther
  }

  // Free-text used only when the billing platform picker is set to "Other".
  if (
    data.currentBillingPlatform === 'Other' &&
    data.currentBillingPlatformOther
  ) {
    values.current_billing_platform_other = data.currentBillingPlatformOther
  }

  // Record reference to the applicant Person on the list entry.
  values.applicant = [
    { target_object: 'people', target_record_id: personRecordId },
  ]

  return values
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
    console.error('[startup-program] ATTIO_API_KEY is not configured.')
    Sentry.captureMessage('startup-program: ATTIO_API_KEY missing', 'error')
    return NextResponse.json(
      { error: 'Submission service is not configured' },
      { status: 500 },
    )
  }

  const listId = process.env.ATTIO_STARTUP_LIST_ID
  if (!listId) {
    console.error('[startup-program] ATTIO_STARTUP_LIST_ID is not configured.')
    Sentry.captureMessage(
      'startup-program: ATTIO_STARTUP_LIST_ID missing',
      'error',
    )
    return NextResponse.json(
      { error: 'Submission service is not configured' },
      { status: 500 },
    )
  }

  try {
    const company = await upsertCompany({
      name: data.startupName,
      website: data.website,
    })
    console.log(
      '[startup-program] upserted Company:',
      company.id.record_id,
      'name:',
      data.startupName,
    )

    const person = await createPerson({
      firstName: data.firstName,
      lastName: data.lastName,
      email: data.email,
      jobTitle: data.role,
      companyRecordId: company.id.record_id,
    })
    console.log(
      '[startup-program] upserted Person:',
      person.id.record_id,
      'email:',
      data.email,
    )

    const entry = await addToList({
      listId,
      parentRecordId: company.id.record_id,
      parentObject: 'companies',
      entryValues: buildEntryValues(data, person.id.record_id),
    })
    console.log(
      '[startup-program] added list entry:',
      entry.id.record_id ?? entry.id,
    )

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
