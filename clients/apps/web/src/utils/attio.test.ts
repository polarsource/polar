import { afterEach, describe, expect, it, vi } from 'vitest'
import { createPerson, normalizeLinkedinUrl } from './attio'

describe('normalizeLinkedinUrl', () => {
  it.each([
    ['https://linkedin.com/in/janedoe', 'https://www.linkedin.com/in/janedoe'],
    [
      'https://www.linkedin.com/in/janedoe/?utm=1',
      'https://www.linkedin.com/in/janedoe',
    ],
    ['linkedin.com/in/janedoe', 'https://www.linkedin.com/in/janedoe'],
    [
      '  http://fr.linkedin.com/in/jane-doe  ',
      'https://www.linkedin.com/in/jane-doe',
    ],
  ])('normalizes %s', (input, expected) => {
    expect(normalizeLinkedinUrl(input)).toBe(expected)
  })

  it.each([
    '',
    undefined,
    'janedoe',
    'https://example.com/in/janedoe',
    'Jane Doe',
  ])('returns null for %s', (input) => {
    expect(normalizeLinkedinUrl(input)).toBeNull()
  })
})

describe('createPerson', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.unstubAllEnvs()
  })

  const input = {
    firstName: 'Jane',
    lastName: 'Doe',
    email: 'jane@example.com',
    linkedinUrl: 'https://linkedin.com/in/janedoe',
  }

  const record = { data: { id: { record_id: 'rec_1' } } }

  it('retries without linkedin when Attio rejects the handle', async () => {
    vi.stubEnv('ATTIO_API_KEY', 'key')
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            validation_errors: [{ message: 'LINKEDIN_HANDLE_INVALID' }],
          }),
          { status: 400 },
        ),
      )
      .mockResolvedValueOnce(new Response(JSON.stringify(record)))
    vi.stubGlobal('fetch', fetchMock)

    const person = await createPerson(input)

    expect(person.id.record_id).toBe('rec_1')
    expect(fetchMock).toHaveBeenCalledTimes(2)
    const first = JSON.parse(fetchMock.mock.calls[0][1].body)
    const second = JSON.parse(fetchMock.mock.calls[1][1].body)
    expect(first.data.values.linkedin).toBe(
      'https://www.linkedin.com/in/janedoe',
    )
    expect(second.data.values.linkedin).toBeUndefined()
  })

  it('does not retry on other errors', async () => {
    vi.stubEnv('ATTIO_API_KEY', 'key')
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify({}), { status: 500 }))
    vi.stubGlobal('fetch', fetchMock)

    await expect(createPerson(input)).rejects.toThrow('Attio API error 500')
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
})
