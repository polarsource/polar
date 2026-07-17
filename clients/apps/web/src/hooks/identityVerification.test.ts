import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useStartIdentityVerification } from './identityVerification'

const mutateAsyncMock = vi.fn()
const reloadUserMock = vi.fn()
const verifyIdentityMock = vi.fn()

let identityVerificationStatus:
  | 'unverified'
  | 'pending'
  | 'verified'
  | 'failed'
  | null
  | undefined

vi.mock('@/hooks', () => ({
  useAuth: () => ({
    currentUser: {
      identity_verification_status: identityVerificationStatus,
    },
    reloadUser: reloadUserMock,
  }),
}))

vi.mock('@/hooks/queries', () => ({
  useCreateIdentityVerification: () => ({
    mutateAsync: mutateAsyncMock,
  }),
}))

vi.mock('@/components/Toast/use-toast', () => ({
  toast: vi.fn(),
}))

vi.mock('@/utils/stripe', () => ({
  loadPolarStripe: () =>
    Promise.resolve({
      verifyIdentity: verifyIdentityMock,
    }),
}))

describe('useStartIdentityVerification', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    identityVerificationStatus = 'failed'
    mutateAsyncMock.mockReset()
    reloadUserMock.mockReset()
    verifyIdentityMock.mockReset()
    mutateAsyncMock.mockResolvedValue({
      data: { client_secret: 'secret' },
      error: undefined,
    })
    reloadUserMock.mockResolvedValue(undefined)
    verifyIdentityMock.mockResolvedValue({ error: null })
  })

  it('keeps polling through a retry pending state and stops after verification succeeds', async () => {
    const { result, rerender } = renderHook(() =>
      useStartIdentityVerification(),
    )

    await act(async () => {
      await result.current.start()
    })

    expect(reloadUserMock).toHaveBeenCalledTimes(1)

    identityVerificationStatus = 'pending'
    rerender()

    await act(async () => {
      await vi.advanceTimersByTimeAsync(3000)
    })

    expect(reloadUserMock).toHaveBeenCalledTimes(2)

    identityVerificationStatus = 'verified'
    rerender()

    await act(async () => {
      await vi.advanceTimersByTimeAsync(3000)
    })

    expect(reloadUserMock).toHaveBeenCalledTimes(2)
  })
})
