const ATTIO_API_BASE = 'https://api.attio.com/v2'

interface AttioRecord {
  id: {
    workspace_id: string
    object_id: string
    record_id: string
  }
}

interface AttioResponse<T> {
  data: T
}

class AttioError extends Error {
  constructor(
    public status: number,
    public body: unknown,
  ) {
    super(`Attio API error ${status}: ${JSON.stringify(body)}`)
    this.name = 'AttioError'
  }
}

const request = async <T>(
  path: string,
  init: RequestInit & { method: string },
): Promise<T> => {
  const apiKey = process.env.ATTIO_API_KEY
  if (!apiKey) {
    throw new Error('ATTIO_API_KEY is not set')
  }

  const response = await fetch(`${ATTIO_API_BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      ...init.headers,
    },
  })

  const body = await response.json().catch(() => null)
  if (!response.ok) {
    throw new AttioError(response.status, body)
  }
  return body as T
}

const extractDomain = (rawWebsite: string): string | null => {
  if (!rawWebsite) return null
  try {
    const url = new URL(
      rawWebsite.startsWith('http') ? rawWebsite : `https://${rawWebsite}`,
    )
    return url.hostname.replace(/^www\./, '')
  } catch {
    return null
  }
}

interface UpsertCompanyInput {
  name: string
  website: string
  description?: string
}

export const upsertCompany = async (
  input: UpsertCompanyInput,
): Promise<AttioRecord> => {
  const domain = extractDomain(input.website)
  const values: Record<string, unknown> = {
    name: input.name,
  }
  if (domain) {
    values.domains = [{ domain }]
  }
  if (input.description) {
    values.description = input.description
  }

  const path = domain
    ? '/objects/companies/records?matching_attribute=domains'
    : '/objects/companies/records'
  const method = domain ? 'PUT' : 'POST'

  const result = await request<AttioResponse<AttioRecord>>(path, {
    method,
    body: JSON.stringify({ data: { values } }),
  })
  return result.data
}

interface CreatePersonInput {
  firstName: string
  lastName: string
  email: string
  jobTitle?: string
  companyRecordId?: string
}

export const createPerson = async (
  input: CreatePersonInput,
): Promise<AttioRecord> => {
  const values: Record<string, unknown> = {
    name: [
      {
        first_name: input.firstName,
        last_name: input.lastName,
        full_name: `${input.firstName} ${input.lastName}`.trim(),
      },
    ],
    email_addresses: [{ email_address: input.email }],
  }
  if (input.jobTitle) {
    values.job_title = input.jobTitle
  }
  if (input.companyRecordId) {
    values.company = [
      { target_object: 'companies', target_record_id: input.companyRecordId },
    ]
  }

  const result = await request<AttioResponse<AttioRecord>>(
    '/objects/people/records?matching_attribute=email_addresses',
    {
      method: 'PUT',
      body: JSON.stringify({ data: { values } }),
    },
  )
  return result.data
}
