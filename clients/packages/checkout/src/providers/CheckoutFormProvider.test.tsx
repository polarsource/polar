import { act } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { renderWithCheckout } from '../test-utils/renderWithCheckout'
import type { CheckoutContextProps } from './CheckoutProvider'

type UpdateResult = Awaited<ReturnType<CheckoutContextProps['update']>>

describe('CheckoutFormProvider', () => {
  it('surfaces RequestValidationError as field-level form errors', async () => {
    const update = vi.fn<CheckoutContextProps['update']>(
      async () =>
        ({
          ok: false,
          error: {
            error: 'RequestValidationError',
            detail: [
              {
                type: 'value_error',
                loc: ['body', 'customer_email'],
                msg: 'foo@example.com is not a valid email address: The domain name example.com does not accept email.',
                input: 'foo@example.com',
              },
            ],
          },
        }) as UpdateResult,
    )

    const getCtx = renderWithCheckout({ update })

    await act(async () => {
      await expect(
        getCtx().update({ customer_email: 'foo@example.com' }),
      ).rejects.toBeDefined()
    })

    expect(getCtx().form.formState.errors.customer_email?.message).toContain(
      'The domain name example.com does not accept email.',
    )
  })

  it('surfaces PolarRequestValidationError as field-level form errors', async () => {
    const update = vi.fn<CheckoutContextProps['update']>(
      async () =>
        ({
          ok: false,
          error: {
            error: 'PolarRequestValidationError',
            detail: [
              {
                type: 'value_error',
                loc: ['body', 'customer_email'],
                msg: 'Email is already taken',
                input: 'taken@example.com',
              },
            ],
          },
        }) as UpdateResult,
    )

    const getCtx = renderWithCheckout({ update })

    await act(async () => {
      await expect(
        getCtx().update({ customer_email: 'taken@example.com' }),
      ).rejects.toBeDefined()
    })

    expect(getCtx().form.formState.errors.customer_email?.message).toBe(
      'Email is already taken',
    )
  })
})
