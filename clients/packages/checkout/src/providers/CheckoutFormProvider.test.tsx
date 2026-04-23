import { act } from '@testing-library/react'
import type { Stripe, StripeElements } from '@stripe/stripe-js'
import { describe, expect, it, vi } from 'vitest'
import { renderWithCheckout } from '../test-utils/renderWithCheckout'
import type { CheckoutContextProps } from './CheckoutProvider'

type UpdateResult = Awaited<ReturnType<CheckoutContextProps['update']>>
type ConfirmResult = Awaited<ReturnType<CheckoutContextProps['confirm']>>

type UpdateError = Extract<UpdateResult, { ok: false }>['error']
type ConfirmError = Extract<ConfirmResult, { ok: false }>['error']

const updateErrorResult = (error: UpdateError): UpdateResult =>
  ({ ok: false, error }) as UpdateResult

const confirmErrorResult = (error: ConfirmError): ConfirmResult =>
  ({ ok: false, error }) as ConfirmResult

describe('CheckoutFormProvider', () => {
  describe('update', () => {
    it('resolves with the updated checkout on success', async () => {
      const getCtx = renderWithCheckout({
        update: vi.fn<CheckoutContextProps['update']>(
          async () =>
            ({
              ok: true,
              value: { id: 'ch_new' },
            }) as UpdateResult,
        ),
      })

      let resultId: string | undefined
      await act(async () => {
        const result = await getCtx().update({
          customer_email: 'ok@example.com',
        })
        resultId = result.id
      })

      expect(resultId).toBe('ch_new')
      expect(getCtx().form.formState.errors).toEqual({})
    })

    it('surfaces RequestValidationError as field-level form errors', async () => {
      const getCtx = renderWithCheckout({
        update: vi.fn<CheckoutContextProps['update']>(async () =>
          updateErrorResult({
            error: 'RequestValidationError',
            detail: [
              {
                type: 'value_error',
                loc: ['body', 'customer_email'],
                msg: 'foo@example.com is not a valid email address: The domain name example.com does not accept email.',
                input: 'foo@example.com',
              },
            ],
          }),
        ),
      })

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
      const getCtx = renderWithCheckout({
        update: vi.fn<CheckoutContextProps['update']>(async () =>
          updateErrorResult({
            error: 'PolarRequestValidationError',
            detail: [
              {
                type: 'value_error',
                loc: ['body', 'customer_email'],
                msg: 'Email is already taken',
                input: 'taken@example.com',
              },
            ],
          }),
        ),
      })

      await act(async () => {
        await expect(
          getCtx().update({ customer_email: 'taken@example.com' }),
        ).rejects.toBeDefined()
      })

      expect(getCtx().form.formState.errors.customer_email?.message).toBe(
        'Email is already taken',
      )
    })

    it.each([
      'AlreadyActiveSubscriptionError',
      'NotOpenCheckout',
      'PaymentNotReady',
    ] as const)('sets root error for %s', async (errorCode) => {
      const getCtx = renderWithCheckout({
        update: vi.fn<CheckoutContextProps['update']>(async () =>
          updateErrorResult({
            error: errorCode,
            detail: `${errorCode} detail`,
          }),
        ),
      })

      await act(async () => {
        await expect(
          getCtx().update({ customer_email: 'a@b.com' }),
        ).rejects.toBeDefined()
      })

      expect(getCtx().form.formState.errors.root?.message).toBe(
        `${errorCode} detail`,
      )
    })

    it.each(['ResourceNotFound', 'ExpiredCheckoutError'] as const)(
      'does not set a form error for %s',
      async (errorCode) => {
        const getCtx = renderWithCheckout({
          update: vi.fn<CheckoutContextProps['update']>(async () =>
            updateErrorResult({
              error: errorCode,
              detail: `${errorCode} detail`,
            }),
          ),
        })

        await act(async () => {
          await expect(
            getCtx().update({ customer_email: 'a@b.com' }),
          ).rejects.toBeDefined()
        })

        expect(getCtx().form.formState.errors).toEqual({})
      },
    )
  })

  describe('confirm (free checkout path)', () => {
    const freeCheckout = {
      is_payment_form_required: false,
      is_payment_required: false,
      is_free_product_price: true,
      amount: 0,
      total_amount: 0,
      net_amount: 0,
    }

    it('resolves with the confirmed checkout on success', async () => {
      const getCtx = renderWithCheckout({
        checkout: freeCheckout,
        update: vi.fn(),
        confirm: vi.fn<CheckoutContextProps['confirm']>(
          async () =>
            ({
              ok: true,
              value: { id: 'ch_confirmed', status: 'confirmed' },
            }) as ConfirmResult,
        ),
      })

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let result: any = null
      await act(async () => {
        result = await getCtx().confirm(
          { customer_email: 'ok@example.com' },
          null,
          null,
        )
      })

      expect(result).toMatchObject({ id: 'ch_confirmed' })
      expect(getCtx().form.formState.errors).toEqual({})
    })

    it('surfaces RequestValidationError as field-level form errors', async () => {
      const getCtx = renderWithCheckout({
        checkout: freeCheckout,
        update: vi.fn(),
        confirm: vi.fn<CheckoutContextProps['confirm']>(async () =>
          confirmErrorResult({
            error: 'RequestValidationError',
            detail: [
              {
                type: 'value_error',
                loc: ['body', 'customer_email'],
                msg: 'Invalid email domain',
                input: 'bad@invalid.test',
              },
            ],
          }),
        ),
      })

      await act(async () => {
        await expect(
          getCtx().confirm({ customer_email: 'bad@invalid.test' }, null, null),
        ).rejects.toBeDefined()
      })

      expect(getCtx().form.formState.errors.customer_email?.message).toBe(
        'Invalid email domain',
      )
    })

    it.each([
      'PaymentError',
      'AlreadyActiveSubscriptionError',
      'NotOpenCheckout',
      'PaymentNotReady',
    ] as const)('sets root error for %s', async (errorCode) => {
      const getCtx = renderWithCheckout({
        checkout: freeCheckout,
        update: vi.fn(),
        confirm: vi.fn<CheckoutContextProps['confirm']>(async () =>
          confirmErrorResult({
            error: errorCode,
            detail: `${errorCode} detail`,
          }),
        ),
      })

      await act(async () => {
        await expect(
          getCtx().confirm({ customer_email: 'a@b.com' }, null, null),
        ).rejects.toBeDefined()
      })

      expect(getCtx().form.formState.errors.root?.message).toBe(
        `${errorCode} detail`,
      )
    })

    it.each(['ResourceNotFound', 'ExpiredCheckoutError'] as const)(
      'does not set a form error for %s',
      async (errorCode) => {
        const getCtx = renderWithCheckout({
          checkout: freeCheckout,
          update: vi.fn(),
          confirm: vi.fn<CheckoutContextProps['confirm']>(async () =>
            confirmErrorResult({
              error: errorCode,
              detail: `${errorCode} detail`,
            }),
          ),
        })

        await act(async () => {
          await expect(
            getCtx().confirm({ customer_email: 'a@b.com' }, null, null),
          ).rejects.toBeDefined()
        })

        expect(getCtx().form.formState.errors).toEqual({})
      },
    )

    it('throws when payment form is required but stripe/elements are missing', async () => {
      const getCtx = renderWithCheckout({
        checkout: { is_payment_form_required: true },
        update: vi.fn(),
        confirm: vi.fn(),
      })

      await act(async () => {
        await expect(
          getCtx().confirm({ customer_email: 'a@b.com' }, null, null),
        ).rejects.toThrow('Stripe elements not provided')
      })
    })

    it('sets root error when elements.submit() returns a non-validation error', async () => {
      const elements = {
        submit: vi.fn(async () => ({
          error: { type: 'card_error', message: 'card declined' },
        })),
      } as unknown as StripeElements

      const getCtx = renderWithCheckout({
        checkout: { is_payment_form_required: true },
        update: vi.fn(),
        confirm: vi.fn(),
      })

      await act(async () => {
        await expect(
          getCtx().confirm(
            { customer_email: 'a@b.com' },
            {} as Stripe,
            elements,
          ),
        ).rejects.toThrow('card declined')
      })

      expect(getCtx().form.formState.errors.root?.message).toBe('card declined')
    })

    it('does not set root error for validation errors from elements.submit()', async () => {
      const elements = {
        submit: vi.fn(async () => ({
          error: { type: 'validation_error', message: 'card incomplete' },
        })),
      } as unknown as StripeElements

      const getCtx = renderWithCheckout({
        checkout: { is_payment_form_required: true },
        update: vi.fn(),
        confirm: vi.fn(),
      })

      await act(async () => {
        await expect(
          getCtx().confirm(
            { customer_email: 'a@b.com' },
            {} as Stripe,
            elements,
          ),
        ).rejects.toThrow('card incomplete')
      })

      expect(getCtx().form.formState.errors.root).toBeUndefined()
    })

    it('on TrialAlreadyRedeemed, sets root error and retries with allow_trial=false', async () => {
      const update = vi.fn<CheckoutContextProps['update']>(
        async () => ({ ok: true, value: { id: 'ch_retry' } }) as UpdateResult,
      )
      const confirm = vi.fn<CheckoutContextProps['confirm']>(async () =>
        confirmErrorResult({
          error: 'TrialAlreadyRedeemed',
          detail: 'trial already used',
        }),
      )

      const getCtx = renderWithCheckout({
        checkout: freeCheckout,
        update,
        confirm,
      })

      await act(async () => {
        await expect(
          getCtx().confirm({ customer_email: 'a@b.com' }, null, null),
        ).rejects.toBeDefined()
      })

      expect(getCtx().form.formState.errors.root?.message).toBe(
        'trial already used',
      )
      expect(update).toHaveBeenCalledWith({ allow_trial: false })
    })
  })
})
