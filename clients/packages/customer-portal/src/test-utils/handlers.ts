import { http, HttpResponse } from 'msw'
import { customerFixture } from './fixtures'

const API_BASE = 'http://example.com:8000'

export const handlers = [
  http.get(`${API_BASE}/v1/customer-portal/customers/me`, () => {
    return HttpResponse.json(customerFixture())
  }),

  http.patch(
    `${API_BASE}/v1/customer-portal/customers/me`,
    async ({ request }) => {
      const body = await request.json()
      return HttpResponse.json(customerFixture(body as Record<string, unknown>))
    },
  ),
]
