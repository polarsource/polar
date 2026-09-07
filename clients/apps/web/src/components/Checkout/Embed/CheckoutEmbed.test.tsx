import { fireEvent, waitFor } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import {
  CHECKOUT_URL,
  CUSTOMER_SESSION_TOKEN,
  freeProductCheckout,
  renderCheckout,
  submitCheckout,
} from '@/test-utils/checkout'
import { getEmbedCloseButton, listenToParentMessages } from '@/test-utils/embed'

const embedOrigin = window.location.origin

describe('embedded checkout', () => {
  it('tells the parent page when it has loaded', async () => {
    const messages = listenToParentMessages()

    renderCheckout({ embed: true, checkout: { embed_origin: embedOrigin } })

    await waitFor(() =>
      expect(messages).toContainEqual(
        expect.objectContaining({ event: 'loaded' }),
      ),
    )
  })

  it('asks the parent page to close from the close button and from clicks outside the content', async () => {
    const messages = listenToParentMessages()
    renderCheckout({ embed: true, checkout: { embed_origin: embedOrigin } })

    fireEvent.click(getEmbedCloseButton())
    await waitFor(() =>
      expect(
        messages.filter((message) => message.event === 'close'),
      ).toHaveLength(1),
    )

    fireEvent.click(document.getElementById('polar-embed-layout')!)
    await waitFor(() =>
      expect(
        messages.filter((message) => message.event === 'close'),
      ).toHaveLength(2),
    )
  })

  it('only reports success to the parent page once fulfillment has completed', async () => {
    const messages = listenToParentMessages()
    const { router } = renderCheckout({
      embed: true,
      checkout: { ...freeProductCheckout(), embed_origin: embedOrigin },
    })

    submitCheckout('Get for free')

    await waitFor(() =>
      expect(messages).toContainEqual(
        expect.objectContaining({ event: 'confirmed' }),
      ),
    )
    const successURL = `${CHECKOUT_URL}/confirmation?embed=true&theme=light&customer_session_token=${CUSTOMER_SESSION_TOKEN}`
    await waitFor(() =>
      expect(messages).toContainEqual(
        expect.objectContaining({
          event: 'success',
          successURL,
          redirect: false,
        }),
      ),
    )
    expect(router.push).toHaveBeenCalledWith(successURL)
  })

  it('hands merchant success URLs to the parent page instead of navigating', async () => {
    const messages = listenToParentMessages()
    const { router } = renderCheckout({
      embed: true,
      checkout: {
        ...freeProductCheckout(),
        embed_origin: embedOrigin,
        success_url: 'https://merchant.example/thanks',
      },
    })

    submitCheckout('Get for free')

    await waitFor(() =>
      expect(messages).toContainEqual(
        expect.objectContaining({
          event: 'success',
          successURL: `https://merchant.example/thanks?customer_session_token=${CUSTOMER_SESSION_TOKEN}`,
          redirect: true,
        }),
      ),
    )
    expect(router.push).not.toHaveBeenCalled()
  })
})
