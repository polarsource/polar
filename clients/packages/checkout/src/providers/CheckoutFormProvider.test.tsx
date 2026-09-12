import { act } from '@testing-library/react'
import type { Stripe, StripeElements } from '@stripe/stripe-js'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { renderWithCheckout } from '../test-utils/renderWithCheckout'
import type { CheckoutFormContextProps } from './CheckoutFormProvider'
import type { CheckoutContextProps } from './CheckoutProvider'

type CheckoutResult = Awaited<ReturnType<CheckoutFormContextProps['update']>>

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

    it('sets discount_code error for DiscountRedemptionLimitReached when the code input is shown', async () => {
      const getCtx = renderWithCheckout({
        checkout: { allow_discount_codes: true, is_discount_applicable: true },
        update: vi.fn<CheckoutContextProps['update']>(async () =>
          updateErrorResult({
            error: 'DiscountRedemptionLimitReached',
            detail: 'limit reached',
          }),
        ),
      })

      await act(async () => {
        await expect(
          getCtx().update({ discount_code: 'CODE' }),
        ).rejects.toBeDefined()
      })

      expect(getCtx().form.formState.errors.discount_code?.message).toBe(
        'limit reached',
      )
    })

    it('sets root error for DiscountRedemptionLimitReached when discount codes are disabled', async () => {
      const getCtx = renderWithCheckout({
        checkout: { allow_discount_codes: false, is_discount_applicable: true },
        update: vi.fn<CheckoutContextProps['update']>(async () =>
          updateErrorResult({
            error: 'DiscountRedemptionLimitReached',
            detail: 'limit reached',
          }),
        ),
      })

      await act(async () => {
        await expect(
          getCtx().update({ customer_email: 'a@b.com' }),
        ).rejects.toBeDefined()
      })

      expect(getCtx().form.formState.errors.root?.message).toBe('limit reached')
    })

    it('sets root error for DiscountRedemptionLimitReached when no discount applies', async () => {
      const getCtx = renderWithCheckout({
        checkout: { allow_discount_codes: true, is_discount_applicable: false },
        update: vi.fn<CheckoutContextProps['update']>(async () =>
          updateErrorResult({
            error: 'DiscountRedemptionLimitReached',
            detail: 'limit reached',
          }),
        ),
      })

      await act(async () => {
        await expect(
          getCtx().update({ customer_email: 'a@b.com' }),
        ).rejects.toBeDefined()
      })

      expect(getCtx().form.formState.errors.root?.message).toBe('limit reached')
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

  describe('update (single-flight)', () => {
    beforeEach(() => vi.useFakeTimers())
    afterEach(() => vi.useRealTimers())

    interface Deferred<T> {
      promise: Promise<T>
      resolve: (value: T) => void
    }

    const createDeferred = <T,>(): Deferred<T> => {
      let resolve!: (value: T) => void
      const promise = new Promise<T>((res) => {
        resolve = res
      })
      return { promise, resolve }
    }

    it('never overlaps requests and coalesces pending calls into one trailing request', async () => {
      const outer: Deferred<UpdateResult>[] = []
      const update = vi.fn<CheckoutContextProps['update']>(() => {
        const deferred = createDeferred<UpdateResult>()
        outer.push(deferred)
        return deferred.promise
      })

      const getCtx = renderWithCheckout({ update })

      await act(async () => {
        void getCtx().update({ customer_email: 'a@example.com' })
        await vi.advanceTimersByTimeAsync(100)
      })
      expect(update).toHaveBeenCalledTimes(1)

      // Two calls made while the first is in flight must not fire a request yet.
      let bResult: CheckoutResult | undefined
      let cResult: CheckoutResult | undefined
      await act(async () => {
        void getCtx()
          .update({ customer_name: 'B' })
          .then((value) => {
            bResult = value
          })
        void getCtx()
          .update({ customer_tax_id: 'C' })
          .then((value) => {
            cResult = value
          })
        await vi.advanceTimersByTimeAsync(100)
      })
      expect(update).toHaveBeenCalledTimes(1)

      // Resolving the first flushes a single coalesced request with both fields.
      await act(async () => {
        outer[0].resolve({ ok: true, value: { id: 'ch_1' } } as UpdateResult)
      })
      expect(update).toHaveBeenCalledTimes(2)
      expect(update).toHaveBeenLastCalledWith({
        customer_name: 'B',
        customer_tax_id: 'C',
      })

      // Both coalesced callers resolve with the trailing request's result.
      await act(async () => {
        outer[1].resolve({ ok: true, value: { id: 'ch_2' } } as UpdateResult)
      })
      expect(bResult).toMatchObject({ id: 'ch_2' })
      expect(cResult).toMatchObject({ id: 'ch_2' })
    })

    it('debounces again once the queue drains', async () => {
      const outer: Deferred<UpdateResult>[] = []
      const update = vi.fn<CheckoutContextProps['update']>(() => {
        const deferred = createDeferred<UpdateResult>()
        outer.push(deferred)
        return deferred.promise
      })

      const getCtx = renderWithCheckout({ update })

      await act(async () => {
        void getCtx().update({ customer_email: 'a@example.com' })
        await vi.advanceTimersByTimeAsync(100)
        outer[0].resolve({ ok: true, value: { id: 'ch_1' } } as UpdateResult)
      })
      expect(update).toHaveBeenCalledTimes(1)

      await act(async () => {
        void getCtx().update({ customer_name: 'B' })
      })
      expect(update).toHaveBeenCalledTimes(1)
      await act(async () => {
        await vi.advanceTimersByTimeAsync(100)
      })
      expect(update).toHaveBeenCalledTimes(2)
      await act(async () => {
        outer[1].resolve({ ok: true, value: { id: 'ch_2' } } as UpdateResult)
      })
      expect(getCtx().isUpdatePending).toBe(false)
    })

    it('combines name blur and rapid checkbox toggles using the final value', async () => {
      const update = vi.fn<CheckoutContextProps['update']>(
        async () => ({ ok: true, value: { id: 'ch_1' } }) as UpdateResult,
      )
      const getCtx = renderWithCheckout({ update })
      const results: CheckoutResult[] = []

      await act(async () => {
        void getCtx()
          .update({ customer_name: 'Buyer' })
          .then((v) => results.push(v))
        void getCtx()
          .update({ is_business_customer: true })
          .then((v) => results.push(v))
        await vi.advanceTimersByTimeAsync(50)
        void getCtx()
          .update({ is_business_customer: false })
          .then((v) => results.push(v))
        await vi.advanceTimersByTimeAsync(99)
      })
      expect(update).not.toHaveBeenCalled()
      expect(getCtx().isUpdatePending).toBe(true)

      await act(async () => {
        await vi.advanceTimersByTimeAsync(1)
      })
      expect(update).toHaveBeenCalledExactlyOnceWith({
        customer_name: 'Buyer',
        is_business_customer: false,
      })
      expect(results).toEqual([{ id: 'ch_1' }, { id: 'ch_1' }, { id: 'ch_1' }])
      expect(getCtx().isUpdatePending).toBe(false)
    })

    it('waits for the remaining debounce when an in-flight request finishes', async () => {
      const first = createDeferred<UpdateResult>()
      const update = vi
        .fn<CheckoutContextProps['update']>()
        .mockReturnValueOnce(first.promise)
        .mockResolvedValue({ ok: true, value: { id: 'ch_2' } } as UpdateResult)
      const getCtx = renderWithCheckout({ update })

      await act(async () => {
        void getCtx().update({ customer_name: 'Buyer' })
        await vi.advanceTimersByTimeAsync(100)
        void getCtx().update({ is_business_customer: true })
        await vi.advanceTimersByTimeAsync(50)
        first.resolve({ ok: true, value: { id: 'ch_1' } } as UpdateResult)
      })
      expect(update).toHaveBeenCalledTimes(1)
      expect(getCtx().isUpdatePending).toBe(true)
      await act(async () => {
        await vi.advanceTimersByTimeAsync(50)
      })
      expect(update).toHaveBeenCalledTimes(2)
      expect(getCtx().isUpdatePending).toBe(false)
    })
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

      // oxlint-disable-next-line typescript/no-explicit-any
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

    it('sets discount_code error for DiscountRedemptionLimitReached when the code input is shown', async () => {
      const getCtx = renderWithCheckout({
        checkout: {
          ...freeCheckout,
          allow_discount_codes: true,
          is_discount_applicable: true,
        },
        update: vi.fn(),
        confirm: vi.fn<CheckoutContextProps['confirm']>(async () =>
          confirmErrorResult({
            error: 'DiscountRedemptionLimitReached',
            detail: 'limit reached',
          }),
        ),
      })

      await act(async () => {
        await expect(
          getCtx().confirm({ customer_email: 'a@b.com' }, null, null),
        ).rejects.toBeDefined()
      })

      expect(getCtx().form.formState.errors.discount_code?.message).toBe(
        'limit reached',
      )
    })

    it('sets root error for DiscountRedemptionLimitReached when discount codes are disabled', async () => {
      const getCtx = renderWithCheckout({
        checkout: {
          ...freeCheckout,
          allow_discount_codes: false,
          is_discount_applicable: true,
        },
        update: vi.fn(),
        confirm: vi.fn<CheckoutContextProps['confirm']>(async () =>
          confirmErrorResult({
            error: 'DiscountRedemptionLimitReached',
            detail: 'limit reached',
          }),
        ),
      })

      await act(async () => {
        await expect(
          getCtx().confirm({ customer_email: 'a@b.com' }, null, null),
        ).rejects.toBeDefined()
      })

      expect(getCtx().form.formState.errors.root?.message).toBe('limit reached')
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

    it('on TrialAlreadyRedeemed, flags trialUnavailable and retries with allow_trial=false without a root error', async () => {
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

      expect(getCtx().trialUnavailable).toBe(true)
      expect(getCtx().form.formState.errors.root).toBeUndefined()
      expect(update).toHaveBeenCalledWith({ allow_trial: false })
    })

    it('resets trialUnavailable when a new confirm is attempted', async () => {
      const update = vi.fn<CheckoutContextProps['update']>(
        async () => ({ ok: true, value: { id: 'ch_retry' } }) as UpdateResult,
      )
      const confirm = vi
        .fn<CheckoutContextProps['confirm']>()
        .mockImplementationOnce(async () =>
          confirmErrorResult({
            error: 'TrialAlreadyRedeemed',
            detail: 'trial already used',
          }),
        )
        .mockImplementationOnce(
          async () =>
            ({
              ok: true,
              value: { id: 'ch_confirmed', status: 'confirmed' },
            }) as ConfirmResult,
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

      expect(getCtx().trialUnavailable).toBe(true)

      await act(async () => {
        await getCtx().confirm({ customer_email: 'a@b.com' }, null, null)
      })

      expect(getCtx().trialUnavailable).toBe(false)
    })
  })

  describe('confirm (payment-required path: requires_action loop)', () => {
    const confirmedWithActionResult = (): ConfirmResult =>
      ({
        ok: true,
        value: {
          id: 'ch_confirmed',
          status: 'confirmed',
          payment_processor_metadata: {
            intent_status: 'requires_action',
            intent_client_secret: 'pi_secret',
          },
        },
      }) as unknown as ConfirmResult

    type ConfirmedCheckout = Awaited<
      ReturnType<CheckoutFormContextProps['confirm']>
    >

    const makeElements = () =>
      ({ submit: vi.fn(async () => ({})) }) as unknown as StripeElements

    const makeStripe = (
      handleNextAction: (...args: unknown[]) => unknown,
    ): Stripe =>
      ({
        createConfirmationToken: vi.fn(async () => ({
          confirmationToken: { id: 'ctoken' },
          error: undefined,
        })),
        handleNextAction: vi.fn(handleNextAction),
      }) as unknown as Stripe

    const renderPaymentConfirm = (
      handleNextAction: (...args: unknown[]) => unknown,
    ) => {
      const confirm = vi.fn<CheckoutContextProps['confirm']>(async () =>
        confirmedWithActionResult(),
      )
      const getCtx = renderWithCheckout({
        checkout: {
          is_payment_form_required: true,
          is_payment_required: true,
        },
        update: vi.fn(),
        confirm,
      })
      const stripe = makeStripe(handleNextAction)
      const elements = makeElements()
      return { getCtx, confirm, stripe, elements }
    }

    it('resolves and resets loading when handleNextAction returns succeeded', async () => {
      const { getCtx, stripe, elements } = renderPaymentConfirm(async () => ({
        paymentIntent: { status: 'succeeded' },
      }))

      let result: ConfirmedCheckout | undefined
      await act(async () => {
        result = await getCtx().confirm(
          { customer_email: 'a@b.com' },
          stripe,
          elements,
        )
      })

      expect(result).toMatchObject({ id: 'ch_confirmed' })
      expect(getCtx().loading).toBe(false)
      expect(stripe.handleNextAction).toHaveBeenCalledTimes(1)
    })

    it('resets loading=false and sets root error when handleNextAction returns an error field', async () => {
      const { getCtx, stripe, elements } = renderPaymentConfirm(async () => ({
        error: { message: '3DS authentication failed' },
      }))

      await act(async () => {
        await expect(
          getCtx().confirm({ customer_email: 'a@b.com' }, stripe, elements),
        ).rejects.toThrow('3DS authentication failed')
      })

      expect(getCtx().loading).toBe(false)
      expect(getCtx().form.formState.errors.root?.message).toBe(
        '3DS authentication failed',
      )
    })

    it('resets loading=false when stripe.handleNextAction rejects', async () => {
      const { getCtx, stripe, elements } = renderPaymentConfirm(async () => {
        const err = new Error(
          'This PaymentIntent is not in the requires_action state.',
        )
        err.name = 'IntegrationError'
        throw err
      })

      await act(async () => {
        await expect(
          getCtx().confirm({ customer_email: 'a@b.com' }, stripe, elements),
        ).rejects.toThrow('not in the requires_action state')
      })

      expect(getCtx().loading).toBe(false)
    })

    it('reprompts while the intent still requires_action then resolves', async () => {
      let calls = 0
      const { getCtx, stripe, elements } = renderPaymentConfirm(async () => {
        calls += 1
        if (calls === 1) {
          return { paymentIntent: { status: 'requires_action' } }
        }
        return { paymentIntent: { status: 'succeeded' } }
      })

      let result: ConfirmedCheckout | undefined
      await act(async () => {
        result = await getCtx().confirm(
          { customer_email: 'a@b.com' },
          stripe,
          elements,
        )
      })

      expect(result).toMatchObject({ id: 'ch_confirmed' })
      expect(getCtx().loading).toBe(false)
      expect(stripe.handleNextAction).toHaveBeenCalledTimes(2)
    })

    it('resets loading=false when handleNextAction rejects on a subsequent iteration', async () => {
      let calls = 0
      const { getCtx, stripe, elements } = renderPaymentConfirm(async () => {
        calls += 1
        if (calls === 1) {
          return { paymentIntent: { status: 'requires_action' } }
        }
        throw new Error('network interrupted during 3DS challenge')
      })

      await act(async () => {
        await expect(
          getCtx().confirm({ customer_email: 'a@b.com' }, stripe, elements),
        ).rejects.toThrow('network interrupted during 3DS challenge')
      })

      expect(getCtx().loading).toBe(false)
      expect(stripe.handleNextAction).toHaveBeenCalledTimes(2)
    })
  })
})
