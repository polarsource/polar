'use client'

import { CheckoutLinkManagementModal } from '@/components/CheckoutLinks/CheckoutLinkManagementModal'
import { InlineModal } from '@/components/Modal/InlineModal'
import { Modal } from '@/components/Modal'
import { useModal } from '@/components/Modal/useModal'
import { CreateAccessTokenModal } from '@/components/Settings/CreateAccessTokenModal'
import NewWebhookModal from '@/components/Settings/Webhook/NewWebhookModal'
import { toast } from '@/components/Toast/use-toast'
import { getQueryClient } from '@/utils/api/query'
import { schemas } from '@polar-sh/client'
import { Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import Button from '@polar-sh/ui/components/atoms/Button'
import CopyToClipboardInput from '@polar-sh/ui/components/atoms/CopyToClipboardInput'
import Banner from '@polar-sh/ui/components/molecules/Banner'
import Link from 'next/link'
import { useState } from 'react'
import { PathCard } from './PathCard'
import { PathCardBanner } from './PathCardBanner'

interface Props {
  organization: schemas['Organization']
  step: schemas['OrganizationReviewCheck']
}

const subStatus = (
  step: schemas['OrganizationReviewCheck'],
  key: schemas['OrganizationReviewSubCheckKey'],
): schemas['OrganizationReviewCheckStatus'] | undefined =>
  step.sub_checks?.find((s) => s.key === key)?.status

const INLINE_LINK_CLASS =
  'dark:text-polar-300 dark:hover:text-polar-100 text-gray-700 underline underline-offset-2 hover:text-gray-900'

export const SetupReadinessSection = ({ organization, step }: Props) => {
  const checkoutLinkStatus = subStatus(step, 'setup_readiness.checkout_link')
  const accessTokenStatus = subStatus(step, 'setup_readiness.access_token')
  const webhookStatus = subStatus(step, 'setup_readiness.webhook')

  const checkoutLinkNeedsEdit =
    checkoutLinkStatus === 'failed' || checkoutLinkStatus === 'warning'
  const checkoutLinkHref = checkoutLinkNeedsEdit
    ? `/dashboard/${organization.slug}/products/checkout-links`
    : undefined

  const {
    isShown: isCreateCheckoutLinkModalShown,
    show: showCreateCheckoutLinkModal,
    hide: hideCreateCheckoutLinkModal,
  } = useModal()

  const {
    isShown: isCreateTokenModalShown,
    show: showCreateTokenModal,
    hide: hideCreateTokenModal,
  } = useModal()

  const {
    isShown: isCreateWebhookModalShown,
    show: showCreateWebhookModal,
    hide: hideCreateWebhookModal,
  } = useModal()

  const [createdToken, setCreatedToken] =
    useState<schemas['OrganizationAccessTokenCreateResponse']>()

  const invalidateReviewState = () => {
    getQueryClient().invalidateQueries({
      queryKey: ['organizationReviewState', organization.id],
    })
  }

  return (
    <Box display="flex" flexDirection="column" rowGap="xl">
      <Text variant="default" color="muted">
        Looks like you&apos;re not integrated with Polar yet. Pick the option
        that fits your setup, you can always change this later.
      </Text>

      <Box display="flex" flexDirection="column" rowGap="xl">
        <Box display="flex" flexDirection="column" rowGap="s">
          <Text variant="caption" color="muted">
            No-code
          </Text>
          <PathCard
            title="Create a checkout link"
            description="A pre-configured checkout URL you can share anywhere to start selling without writing any code. Drop it on your site, in emails, on social, or send it straight to customers."
            href={checkoutLinkHref}
            onClick={
              checkoutLinkNeedsEdit ? undefined : showCreateCheckoutLinkModal
            }
            docsUrl="https://polar.sh/docs/features/checkout/links"
            status={checkoutLinkStatus}
            extra={
              checkoutLinkStatus === 'failed' && (
                <PathCardBanner
                  tone="danger"
                  title="Checkout link is invalid"
                  description={
                    <>
                      Your checkout links needs either a{' '}
                      <Link
                        href={`/dashboard/${organization.slug}/products`}
                        onClick={(e) => e.stopPropagation()}
                        className={INLINE_LINK_CLASS}
                      >
                        product
                      </Link>{' '}
                      with a benefit attached or a{' '}
                      <Link
                        href={`/dashboard/${organization.slug}/products/checkout-links`}
                        onClick={(e) => e.stopPropagation()}
                        className={INLINE_LINK_CLASS}
                      >
                        checkout link
                      </Link>{' '}
                      with a{' '}
                      <a
                        href="https://polar.sh/docs/features/checkout/links#success-url"
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className={INLINE_LINK_CLASS}
                      >
                        Success URL
                      </a>{' '}
                      set.
                    </>
                  }
                />
              )
            }
          />
        </Box>

        <Box display="flex" alignItems="center" columnGap="m">
          <Box
            flexGrow={1}
            borderTopWidth={1}
            borderStyle="solid"
            borderColor="border-primary"
          />
          <Text
            variant="caption"
            color="muted"
            // eslint-disable-next-line polar/no-classname-text
            className="text-[11px] font-semibold tracking-wider uppercase"
          >
            or
          </Text>
          <Box
            flexGrow={1}
            borderTopWidth={1}
            borderStyle="solid"
            borderColor="border-primary"
          />
        </Box>

        <Box display="flex" flexDirection="column" rowGap="s">
          <Box display="flex" alignItems="baseline" columnGap="s">
            <Text variant="caption" color="muted">
              API integration
            </Text>
          </Box>

          <PathCard
            title="Create an API key"
            description="Authenticate your backend's requests to the Polar API so you can manage products, orders, and subscriptions programmatically from your own app."
            onClick={showCreateTokenModal}
            docsUrl="https://polar.sh/docs/api-reference/introduction"
            required
            status={accessTokenStatus}
          />

          <PathCard
            title="Create a webhook"
            description="Receive real-time HTTP callbacks for events like new orders, refunds and subscription changes, keeping data consistent between your app and Polar."
            onClick={showCreateWebhookModal}
            recommended
            docsUrl="https://polar.sh/docs/integrate/webhooks/endpoints"
            status={webhookStatus}
            extra={
              webhookStatus === 'warning' && (
                <PathCardBanner
                  tone="warning"
                  title="Webhook missing"
                  description="Without a webhook, Polar can't notify your app when orders, refunds, or subscription changes happen, which can cause your data to drift out of sync."
                />
              )
            }
          />
        </Box>
      </Box>

      <InlineModal
        isShown={isCreateCheckoutLinkModalShown}
        hide={hideCreateCheckoutLinkModal}
        modalContent={
          <CheckoutLinkManagementModal
            organization={organization}
            productIds={[]}
            onClose={() => {
              hideCreateCheckoutLinkModal()
              invalidateReviewState()
            }}
          />
        }
      />

      <InlineModal
        isShown={isCreateTokenModalShown}
        hide={hideCreateTokenModal}
        modalContent={
          <CreateAccessTokenModal
            organization={organization}
            title="Create API key"
            onSuccess={(token) => {
              setCreatedToken(token)
              hideCreateTokenModal()
              invalidateReviewState()
            }}
            onHide={hideCreateTokenModal}
          />
        }
      />

      <InlineModal
        isShown={isCreateWebhookModalShown}
        hide={hideCreateWebhookModal}
        modalContent={
          <NewWebhookModal
            organization={organization}
            hide={hideCreateWebhookModal}
            onSuccess={() => {
              hideCreateWebhookModal()
              invalidateReviewState()
            }}
          />
        }
      />

      <Modal
        title="API key created"
        isShown={!!createdToken}
        hide={() => setCreatedToken(undefined)}
        modalContent={
          <Box display="flex" flexDirection="column" rowGap="m" padding="xl">
            <CopyToClipboardInput
              value={createdToken?.token ?? ''}
              onCopy={() => toast({ title: 'Copied to clipboard' })}
              variant="mono"
            />
            <Banner color="blue">
              <span className="text-sm">
                Copy the access token and save it somewhere safe. You
                won&rsquo;t be able to see it again.
              </span>
            </Banner>
            <Box display="flex" justifyContent="end">
              <Button onClick={() => setCreatedToken(undefined)}>Done</Button>
            </Box>
          </Box>
        }
      />
    </Box>
  )
}
