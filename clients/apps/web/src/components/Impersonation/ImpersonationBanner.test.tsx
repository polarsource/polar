import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import ImpersonationBanner from './ImpersonationBanner'

describe('ImpersonationBanner', () => {
  const originalBackofficeUrl = process.env.NEXT_PUBLIC_BACKOFFICE_URL

  beforeEach(() => {
    process.env.NEXT_PUBLIC_BACKOFFICE_URL = 'https://backoffice.test'
  })

  afterEach(() => {
    cleanup()
    process.env.NEXT_PUBLIC_BACKOFFICE_URL = originalBackofficeUrl
    // jsdom cookies persist across tests within the same document; expire it.
    document.cookie = 'polar_is_impersonating=; max-age=0'
  })

  it('submits a POST form to end impersonation (not a cross-site-able GET link)', async () => {
    document.cookie = 'polar_is_impersonating=true'

    render(<ImpersonationBanner />)

    const button = await screen.findByRole('button', {
      name: 'Exit impersonation',
    })
    const form = button.closest('form')

    expect(form).not.toBeNull()
    // The CSRF defense is that /impersonation/end is reached via a non-safe
    // method. SameSite=Lax cookies are withheld from cross-site POSTs, so a
    // form POST is not CSRF-able — unlike the old top-level GET link.
    expect(form!.getAttribute('method')).toBe('post')
    expect(form!.getAttribute('action')).toBe(
      'https://backoffice.test/impersonation/end',
    )
    expect(button.getAttribute('type')).toBe('submit')
  })
})
