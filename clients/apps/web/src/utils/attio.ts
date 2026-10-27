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

export class AttioError extends Error {
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

const LINKEDIN_PROFILE_REGEX =
  /^(?:https?:\/\/)?(?:[a-z]{2,3}\.|www\.)?linkedin\.com\/in\/([^/?#\s]+)/i

// Attio rejects LinkedIn values that aren't a valid profile handle or URL, so
// normalize what we can and drop the rest instead of failing the submission.
export const normalizeLinkedinUrl = (raw?: string): string | null => {
  const match = raw?.trim().match(LINKEDIN_PROFILE_REGEX)
  if (!match) return null
  return `https://www.linkedin.com/in/${match[1]}`
}

const isLinkedinValidationError = (error: unknown): boolean =>
  error instanceof AttioError &&
  error.status === 400 &&
  JSON.stringify(error.body).includes('LINKEDIN_HANDLE_INVALID')

interface CreatePersonInput {
  firstName: string
  lastName: string
  email: string
  jobTitle?: string
  linkedinUrl?: string
  companyRecordId?: string
}

export const createPerson = async (
  input: CreatePersonInput,
): Promise<AttioRecord> => {
  const values: Record<string, unknown> = {
    email_addresses: [{ email_address: input.email }],
  }
  const fullName = `${input.firstName} ${input.lastName}`.trim()
  if (fullName) {
    values.name = [
      {
        first_name: input.firstName,
        last_name: input.lastName,
        full_name: fullName,
      },
    ]
  }
  if (input.jobTitle) {
    values.job_title = input.jobTitle
  }
  const linkedin = normalizeLinkedinUrl(input.linkedinUrl)
  if (linkedin) {
    values.linkedin = linkedin
  }
  if (input.companyRecordId) {
    values.company = [
      { target_object: 'companies', target_record_id: input.companyRecordId },
    ]
  }

  const upsertPerson = (values: Record<string, unknown>) =>
    request<AttioResponse<AttioRecord>>(
      '/objects/people/records?matching_attribute=email_addresses',
      {
        method: 'PUT',
        body: JSON.stringify({ data: { values } }),
      },
    )

  try {
    return (await upsertPerson(values)).data
  } catch (error) {
    // A bad LinkedIn value shouldn't block the application: retry without it.
    if (!values.linkedin || !isLinkedinValidationError(error)) {
      throw error
    }
    const { linkedin: _linkedin, ...valuesWithoutLinkedin } = values
    return (await upsertPerson(valuesWithoutLinkedin)).data
  }
}

interface AddToListInput {
  listId: string
  parentRecordId: string
  parentObject?: 'companies' | 'people'
  entryValues?: Record<string, unknown>
}

export const addToList = async (
  input: AddToListInput,
): Promise<AttioRecord> => {
  const result = await request<AttioResponse<AttioRecord>>(
    `/lists/${input.listId}/entries`,
    {
      method: 'POST',
      body: JSON.stringify({
        data: {
          parent_record_id: input.parentRecordId,
          parent_object: input.parentObject ?? 'companies',
          entry_values: input.entryValues ?? {},
        },
      }),
    },
  )
  return result.data
}
