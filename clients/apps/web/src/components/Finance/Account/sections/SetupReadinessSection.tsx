'use client'

import { CheckoutLinkManagementModal } from '@/components/CheckoutLinks/CheckoutLinkManagementModal'
import { useModal } from '@/components/Modal/useModal'
import { CreateAccessTokenModal } from '@/components/Settings/CreateAccessTokenModal'
import NewWebhookModal from '@/components/Settings/Webhook/NewWebhookModal'
import { toast } from '@/components/Toast/use-toast'
import { useCheckoutLinks } from '@/hooks/queries/checkout_links'
import { getQueryClient } from '@/utils/api/query'
import { schemas } from '@polar-sh/client'
import {
  Button,
  InlineModal,
  Modal,
  SegmentedControl,
  Text,
} from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import CopyToClipboardInput from '@polar-sh/ui/components/atoms/CopyToClipboardInput'
import Banner from '@polar-sh/ui/components/molecules/Banner'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { DeliveryRadioGroup, LearnMore, Todo } from './SetupReadinessParts'

interface Props {
  organization: schemas['Organization']
  step: schemas['OrganizationReviewCheck']
}

type Path = 'no-code' | 'api'
type Status = schemas['OrganizationReviewCheckStatus']

const DOCS = {
  checkoutLink: 'https://polar.sh/docs/features/checkout/links',
  api: 'https://polar.sh/docs/api-reference/introduction',
}

const API_ONLY_BENEFIT_TYPES: ReadonlySet<schemas['BenefitType']> = new Set([
  'feature_flag',
  'meter_credit',
])

const isMissingBenefit = (product: schemas['CheckoutLinkProduct']): boolean =>
  !product.is_archived &&
  !product.benefits.some((benefit) => !API_ONLY_BENEFIT_TYPES.has(benefit.type))

const subStatus = (
  step: schemas['OrganizationReviewCheck'],
  key: schemas['OrganizationReviewSubCheckKey'],
): Status | undefined => step.sub_checks?.find((s) => s.key === key)?.status

export const SetupReadinessSection = ({ organization, step }: Props) => {
  const router = useRouter()
  const checkoutLinkStatus = subStatus(step, 'setup_readiness.checkout_link')
  const accessTokenStatus =
    subStatus(step, 'setup_readiness.access_token') ?? 'pending'
  const webhookStatus = subStatus(step, 'setup_readiness.webhook') ?? 'pending'

  const { data: checkoutLinksData } = useCheckoutLinks(organization.id)
  const checkoutLinks =
    checkoutLinksData?.pages.flatMap((page) => page.items) ?? []
  const blockingLinks = checkoutLinks.filter(
    (link) => !link.success_url && link.products.some(isMissingBenefit),
  )
  const linkToEdit = blockingLinks[0] ?? checkoutLinks[0]

  const hasCheckoutLink =
    checkoutLinkStatus === 'passed' ||
    checkoutLinkStatus === 'failed' ||
    checkoutLinks.length > 0
  const isFulfillable = checkoutLinkStatus === 'passed'

  const productsPath = `/dashboard/${organization.slug}/products`
  const returnTo = encodeURIComponent(
    `/dashboard/${organization.slug}/finance/account`,
  )
  const productsMissingBenefit = [
    ...new Map(
      blockingLinks
        .flatMap((link) => link.products)
        .filter(isMissingBenefit)
        .map((product) => [product.id, product] as const),
    ).values(),
  ].map((product) => ({
    id: product.id,
    name: product.name,
    href: `${productsPath}/${product.id}/edit?return_to=${returnTo}`,
  }))

  const startedApi =
    accessTokenStatus === 'passed' || webhookStatus === 'passed'
  const [path, setPath] = useState<Path>(
    startedApi && !isFulfillable ? 'api' : 'no-code',
  )

  const checkoutModal = useModal()
  const editCheckoutLinkModal = useModal()
  const tokenModal = useModal()
  const webhookModal = useModal()
  const [createdToken, setCreatedToken] =
    useState<schemas['OrganizationAccessTokenCreateResponse']>()

  const invalidateReviewState = () => {
    getQueryClient().invalidateQueries({
      queryKey: ['organizationReviewState', organization.id],
    })
  }

  return (
    <Box flexDirection="column" rowGap="l">
      <SegmentedControl
        variant="tabs"
        value={path}
        onChange={setPath}
        options={[
          { value: 'no-code', label: 'No-code' },
          { value: 'api', label: 'API integration' },
        ]}
      />

      {path === 'no-code' ? (
        <Box flexDirection="column" rowGap="l">
          <Text variant="caption" color="muted">
            A pre-configured checkout URL you can share anywhere to start
            selling without writing any code. Drop it on your site, in emails,
            on social, or send it straight to customers.{' '}
            <LearnMore href={DOCS.checkoutLink} />
          </Text>
          <Box flexDirection="column" rowGap="m">
            <Todo
              status={hasCheckoutLink ? 'passed' : 'pending'}
              title="Create a checkout link"
              actionLabel="Create"
              onAction={checkoutModal.show}
            />
            {hasCheckoutLink && !isFulfillable && (
              <DeliveryRadioGroup
                productsMissingBenefit={productsMissingBenefit}
                onAddBenefit={() => router.push(productsPath)}
                onAddSuccessUrl={editCheckoutLinkModal.show}
              />
            )}
          </Box>
        </Box>
      ) : (
        <Box flexDirection="column" rowGap="l">
          <Text variant="caption" color="muted">
            Integrate your application with the Polar API to manage orders,
            customers, and subscriptions programmatically from your own code.{' '}
            <LearnMore href={DOCS.api} />
          </Text>
          <Box flexDirection="column" rowGap="m">
            <Todo
              status={accessTokenStatus}
              title="Create an API key"
              hint="Required"
              hintColor="gray"
              actionLabel="Create"
              onAction={tokenModal.show}
            />
            <Todo
              status={webhookStatus}
              title="Create a webhook"
              hint="Recommended"
              hintColor="blue"
              actionLabel="Create"
              onAction={webhookModal.show}
            />
          </Box>
        </Box>
      )}

      <InlineModal
        isShown={checkoutModal.isShown}
        hide={checkoutModal.hide}
        modalContent={
          <CheckoutLinkManagementModal
            organization={organization}
            productIds={[]}
            onClose={() => {
              checkoutModal.hide()
              invalidateReviewState()
            }}
            hide={checkoutModal.hide}
          />
        }
      />

      <InlineModal
        isShown={editCheckoutLinkModal.isShown}
        hide={editCheckoutLinkModal.hide}
        modalContent={
          linkToEdit ? (
            <CheckoutLinkManagementModal
              organization={organization}
              checkoutLink={linkToEdit}
              onClose={() => {
                editCheckoutLinkModal.hide()
                invalidateReviewState()
              }}
              hide={editCheckoutLinkModal.hide}
            />
          ) : null
        }
      />

      <InlineModal
        isShown={tokenModal.isShown}
        hide={tokenModal.hide}
        modalContent={
          <CreateAccessTokenModal
            organization={organization}
            title="Create API key"
            onSuccess={(token) => {
              setCreatedToken(token)
              tokenModal.hide()
              invalidateReviewState()
            }}
            onHide={tokenModal.hide}
          />
        }
      />

      <InlineModal
        isShown={webhookModal.isShown}
        hide={webhookModal.hide}
        modalContent={
          <NewWebhookModal
            organization={organization}
            hide={webhookModal.hide}
            onSuccess={() => {
              webhookModal.hide()
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
          <Box flexDirection="column" rowGap="m" padding="xl">
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
            <Box justifyContent="end">
              <Button onClick={() => setCreatedToken(undefined)}>Done</Button>
            </Box>
          </Box>
        }
      />
    </Box>
  )
}
