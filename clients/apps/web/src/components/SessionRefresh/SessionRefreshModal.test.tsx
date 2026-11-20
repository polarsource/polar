import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeAll, describe, expect, it, vi } from 'vitest'
import { SessionRefreshModal } from './SessionRefreshModal'
import { promptSessionRefresh } from './store'

const push = vi.hoisted(() => vi.fn())

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push }),
}))

describe('SessionRefreshModal', () => {
  beforeAll(async () => {
    await import('@/components/Modal/ConfirmModal')
  })

  it('renders nothing until a session refresh is requested', async () => {
    render(<SessionRefreshModal />)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()

    act(() => promptSessionRefresh({ returnTo: '/dashboard/acme?tab=keys' }))

    expect(
      await screen.findByRole('heading', { name: 'Please sign in again' }),
    ).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Confirm' }))

    await waitFor(() =>
      expect(push).toHaveBeenCalledWith(
        `/auth?return_to=${encodeURIComponent('/dashboard/acme?tab=keys')}`,
      ),
    )
  })

  it('unlocks scrolling when dismissed and can be shown again', async () => {
    window.history.replaceState(null, '', '/dashboard/acme/settings?x=1')
    render(<SessionRefreshModal />)

    act(() => promptSessionRefresh())
    await screen.findByRole('heading', { name: 'Please sign in again' })
    expect(document.body.style.overflow).toBe('hidden')

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(document.body.style.overflow).toBe('unset')

    act(() => promptSessionRefresh())
    fireEvent.click(await screen.findByRole('button', { name: 'Confirm' }))
    await waitFor(() =>
      expect(push).toHaveBeenLastCalledWith(
        `/auth?return_to=${encodeURIComponent('/dashboard/acme/settings?x=1')}`,
      ),
    )
  })
})
