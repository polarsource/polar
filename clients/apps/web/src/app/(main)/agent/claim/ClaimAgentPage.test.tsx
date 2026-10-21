import { setSessionRefreshListener } from '@/components/SessionRefresh/store'
import { UserContextProvider } from '@/providers/auth'
import { stubLocationAssign } from '@/test-utils/location'
import { renderWithProviders } from '@/test-utils/render'
import { API_URL, apiError, server } from '@/test-utils/server'
import type { schemas } from '@polar-sh/client'
import { fireEvent, screen, waitFor } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { beforeAll, describe, expect, it, onTestFinished, vi } from 'vitest'
import ClaimAgentPage from './ClaimAgentPage'

const LINK_TOKEN = 'polar_acl_123'

const user = {
  id: 'user_1',
  email: 'ada@example.com',
  avatar_url: null,
} as schemas['UserRead']

const claim: schemas['AgentClaim'] = {
  agent_name: 'Claude',
  email: 'ada@example.com',
  expires_at: '2026-10-27T12:00:00Z',
  organization: {
    id: 'org_1',
    name: 'Acme',
    slug: 'acme',
    avatar_url: null,
    product_count: 3,
    benefit_count: 2,
    meter_count: 1,
  },
}

const serveClaim = (
  getClaim: () => Response = () => HttpResponse.json(claim),
  confirmClaim: () => Response = () => new HttpResponse(null, { status: 204 }),
) => {
  const confirmations: unknown[] = []
  server.use(
    http.get(`${API_URL}/v1/agent/claim/:linkToken`, ({ params }) =>
      params.linkToken === LINK_TOKEN ? getClaim() : apiError(404, 'x'),
    ),
    http.post(`${API_URL}/v1/agent/claim`, async ({ request }) => {
      confirmations.push(await request.json())
      return confirmClaim()
    }),
  )
  return confirmations
}

const renderPage = (resumeActionId?: string) =>
  renderWithProviders(
    <UserContextProvider user={user} userOrganizations={[]}>
      <ClaimAgentPage linkToken={LINK_TOKEN} resumeActionId={resumeActionId} />
    </UserContextProvider>,
  )

const enterCode = async (code: string) => {
  fireEvent.change(await screen.findByLabelText('Claim code'), {
    target: { value: code },
  })
  fireEvent.click(screen.getByRole('button', { name: 'Claim agent' }))
}

describe('ClaimAgentPage', () => {
  beforeAll(() => {
    // input-otp probes for password manager badges, which jsdom can't lay out.
    document.elementFromPoint = () => null
  })

  it('shows what the agent built and claims it with the code', async () => {
    const confirmations = serveClaim()
    const assign = stubLocationAssign()
    renderPage()

    expect(await screen.findByText('Claim Claude')).toBeInTheDocument()
    expect(screen.getByText('Acme')).toBeInTheDocument()
    expect(screen.getByText('Products').previousSibling).toHaveTextContent('3')
    expect(screen.getByText('Benefits').previousSibling).toHaveTextContent('2')
    expect(screen.getByText('Meters').previousSibling).toHaveTextContent('1')
    expect(screen.getByText(/This claim is for ada@example.com/)).toBeVisible()

    await enterCode('123456')

    await waitFor(() => expect(assign).toHaveBeenCalledWith('/dashboard/acme'))
    expect(confirmations).toEqual([{ link_token: LINK_TOKEN, code: '123456' }])
    expect(screen.getByText('Acme is yours')).toBeInTheDocument()
  })

  it('falls back to a generic name for an unnamed agent', async () => {
    serveClaim(() => HttpResponse.json({ ...claim, agent_name: null }))
    renderPage()

    expect(
      await screen.findByText(
        /^Once you claim it, the agent can do anything you can/,
      ),
    ).toBeInTheDocument()
    expect(screen.getByText('Claim your agent')).toBeInTheDocument()
  })

  it('claims an agent that built no organization', async () => {
    serveClaim(() => HttpResponse.json({ ...claim, organization: null }))
    const assign = stubLocationAssign()
    renderPage()

    expect(await screen.findByText('No organization yet')).toBeInTheDocument()
    await enterCode('123456')

    await waitFor(() => expect(assign).toHaveBeenCalledWith('/dashboard'))
  })

  it('keeps the form after a wrong code', async () => {
    serveClaim(undefined, () =>
      apiError(400, 'AgentClaimInvalidCode', 'This code is wrong.'),
    )
    renderPage()

    await enterCode('000000')

    expect(await screen.findByText(/This code is wrong/)).toBeInTheDocument()
    expect(screen.getByLabelText('Claim code')).toBeInTheDocument()
  })

  it('keeps the form when rate limited', async () => {
    serveClaim(undefined, () => new HttpResponse(null, { status: 429 }))
    const assign = stubLocationAssign()
    renderPage()

    await enterCode('000000')

    expect(await screen.findByText(/Too many attempts/)).toBeInTheDocument()
    expect(screen.getByLabelText('Claim code')).toBeInTheDocument()
    expect(assign).not.toHaveBeenCalled()
  })

  it.each([
    [404, 'ResourceNotFound', 'This claim link doesn’t work'],
    [410, 'AgentClaimExpired', 'This claim has expired'],
  ])('explains a %i %s', async (status, error, title) => {
    serveClaim(() => apiError(status, error))
    renderPage()

    expect(await screen.findByText(title)).toBeInTheDocument()
    expect(screen.queryByLabelText('Claim code')).not.toBeInTheDocument()
  })

  it('tells which account to use when the email does not match', async () => {
    const detail =
      'This claim was started for a***@example.com. Sign in with that email to claim the agent.'
    serveClaim(() => apiError(403, 'AgentClaimEmailMismatch', detail))
    renderPage()

    expect(
      await screen.findByText(
        `${detail} Once you’re signed in with it, open the claim link from your agent again.`,
      ),
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Sign out' })).toBeInTheDocument()
  })

  const requireFreshSignIn = async () => {
    const original = `${window.location.pathname}${window.location.search}`
    window.history.replaceState(null, '', `/agent/claim?token=${LINK_TOKEN}`)
    onTestFinished(() => window.history.replaceState(null, '', original))
    sessionStorage.clear()
    const prompt = vi.fn()
    setSessionRefreshListener(prompt)
    onTestFinished(() => setSessionRefreshListener(null))
    const { unmount } = renderPage()

    await enterCode('123456')

    await waitFor(() =>
      expect(prompt).toHaveBeenCalledWith({
        returnTo: expect.stringMatching(
          /^\/agent\/claim\?token=polar_acl_123&resume_claim=/,
        ),
      }),
    )
    unmount()
    const actionId = new URLSearchParams(
      prompt.mock.lastCall?.[0].returnTo.split('?')[1],
    ).get('resume_claim')
    expect(actionId).not.toBeNull()
    expect(sessionStorage).toHaveLength(1)
    return actionId as string
  }

  it('asks for a fresh sign-in, then resumes the claim with the same code', async () => {
    let fresh = false
    const confirmations = serveClaim(undefined, () =>
      fresh
        ? new HttpResponse(null, { status: 204 })
        : apiError(403, 'SessionNotFreshError'),
    )
    const actionId = await requireFreshSignIn()
    const assign = stubLocationAssign()

    fresh = true
    renderPage(actionId)

    await waitFor(() => expect(assign).toHaveBeenCalledWith('/dashboard/acme'))
    expect(confirmations).toEqual([
      { link_token: LINK_TOKEN, code: '123456' },
      { link_token: LINK_TOKEN, code: '123456' },
    ])
    expect(sessionStorage).toHaveLength(0)
  })

  it('drops the saved code when the claim fails to load after the sign-in', async () => {
    let expired = false
    const confirmations = serveClaim(
      () =>
        expired ? apiError(410, 'AgentClaimExpired') : HttpResponse.json(claim),
      () => apiError(403, 'SessionNotFreshError'),
    )
    const actionId = await requireFreshSignIn()

    expired = true
    renderPage(actionId)

    expect(
      await screen.findByText('This claim has expired'),
    ).toBeInTheDocument()
    expect(sessionStorage).toHaveLength(0)
    expect(confirmations).toHaveLength(1)
  })
})
