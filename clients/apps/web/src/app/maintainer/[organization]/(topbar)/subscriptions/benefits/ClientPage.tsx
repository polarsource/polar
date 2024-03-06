'use client'

import { Benefit } from '@/components/Benefit/Benefit'
import { DashboardBody } from '@/components/Layout/DashboardLayout'
import { Modal } from '@/components/Modal'
import { ConfirmModal } from '@/components/Modal/ConfirmModal'
import { useModal } from '@/components/Modal/useModal'
import SubscriptionGroupIcon from '@/components/Subscriptions/SubscriptionGroupIcon'
import {
  NewSubscriptionTierBenefitModalContent,
  NewSubscriptionsModalParams,
  UpdateSubscriptionTierBenefitModalContent,
} from '@/components/Subscriptions/SubscriptionTierBenefitsForm'
import {
  DiscordIcon,
  resolveBenefitIcon,
} from '@/components/Subscriptions/utils'
import { AddOutlined, MoreVertOutlined, WebOutlined } from '@mui/icons-material'
import {
  BenefitsInner,
  Organization,
  SubscriptionBenefitType,
} from '@polar-sh/sdk'
import { encode } from 'html-entities'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import Button from 'polarkit/components/ui/atoms/button'
import { ShadowBoxOnMd } from 'polarkit/components/ui/atoms/shadowbox'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from 'polarkit/components/ui/dropdown-menu'
import { Textarea } from 'polarkit/components/ui/textarea'
import {
  useAdvertisementDisplays,
  useDeleteSubscriptionBenefit,
  useSubscriptionBenefits,
  useSubscriptionTiers,
} from 'polarkit/hooks'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { twMerge } from 'tailwind-merge'

const ClientPage = ({ organization }: { organization: Organization }) => {
  const [selectedBenefit, setSelectedBenefit] = useState<Benefit | undefined>()
  const { data: benefits, isFetched: benefitsIsFetched } =
    useSubscriptionBenefits(organization.name, 100)
  const { data: subscriptionTiers } = useSubscriptionTiers(
    organization.name,
    100,
  )
  const searchParams = useSearchParams()

  const {
    isShown,
    toggle,
    hide,
    show: openCreateBenefitModal,
  } = useModal(searchParams?.get('create_benefit') === 'true')

  const [createModalDefaultValues, setCreateModalDefaultValues] =
    useState<NewSubscriptionsModalParams>()

  const benefitSubscriptionTiers = useMemo(
    () =>
      subscriptionTiers?.items?.filter((tier) =>
        tier.benefits.some((benefit) => benefit.id === selectedBenefit?.id),
      ),
    [subscriptionTiers, selectedBenefit],
  )

  useEffect(() => {
    setSelectedBenefit(benefits?.items?.[0])
  }, [benefits])

  const handleSelectBenefit = useCallback(
    (benefit: Benefit) => () => {
      setSelectedBenefit(benefit)
    },
    [],
  )

  return (
    <DashboardBody className="flex flex-col gap-y-8">
      <div className="flex flex-row items-center justify-between">
        <h2 className="text-lg font-medium">Benefits</h2>
        <Button className="h-8 w-8 rounded-full" onClick={toggle}>
          <AddOutlined fontSize="inherit" />
        </Button>
      </div>
      <div className="flex flex-row items-start gap-x-8">
        <div className="flex w-2/3 flex-col gap-y-8">
          <ShadowBoxOnMd className="flex  flex-col gap-y-6">
            <div className="flex flex-col gap-y-2">
              {benefits?.items?.map((benefit) => (
                <BenefitRow
                  organization={organization}
                  benefit={benefit}
                  selected={selectedBenefit?.id === benefit.id}
                  handleSelectBenefit={handleSelectBenefit}
                  key={benefit.id}
                />
              ))}
            </div>
          </ShadowBoxOnMd>

          {benefitsIsFetched ? (
            <RecommendedBenefits
              existingBenefits={benefits?.items ?? []}
              openCreateBenefitModal={openCreateBenefitModal}
              setCreateModalDefaultValues={setCreateModalDefaultValues}
            />
          ) : null}
        </div>
        {selectedBenefit && (
          <ShadowBoxOnMd className="sticky top-8 flex w-1/3 flex-col gap-y-8">
            <div className="flex flex-row items-center gap-x-3">
              <div
                className={twMerge(
                  'flex h-8 w-8 shrink-0  items-center justify-center rounded-full bg-blue-100 text-blue-500 dark:bg-blue-950 dark:text-blue-400',
                )}
              >
                {resolveBenefitIcon(selectedBenefit, 'inherit')}
              </div>
              <span className="text-sm">{selectedBenefit.description}</span>
            </div>

            <div className="flex flex-col gap-y-4">
              <h3 className="font-medium">Subscription Tiers</h3>
              <div className="flex flex-col gap-y-2">
                {(benefitSubscriptionTiers?.length ?? 0) > 0 ? (
                  benefitSubscriptionTiers?.map((tier) => (
                    <Link
                      key={tier.id}
                      href={`/maintainer/${organization.name}/subscriptions/tiers/${tier.id}`}
                      className="dark:hover:bg-polar-800 -mx-2 flex flex-row items-center gap-x-2 rounded-lg px-4 py-2 hover:bg-gray-100"
                    >
                      <SubscriptionGroupIcon
                        className="h-4! w-4! text-lg"
                        type={tier.type}
                      />
                      <span>{tier.name}</span>
                    </Link>
                  ))
                ) : (
                  <span className="text-sm text-gray-500">
                    Benefit not tied to any subscription tier
                  </span>
                )}
              </div>
            </div>

            {selectedBenefit.type === 'ads' ? (
              <AdsBenefitContent benefit={selectedBenefit} />
            ) : null}
          </ShadowBoxOnMd>
        )}

        <Modal
          className="overflow-visible"
          isShown={isShown}
          hide={toggle}
          modalContent={
            <NewSubscriptionTierBenefitModalContent
              organization={organization}
              defaultValues={createModalDefaultValues}
              hideModal={hide}
              onSelectBenefit={hide}
            />
          }
        />
      </div>
    </DashboardBody>
  )
}

export default ClientPage

interface BenefitRowProps {
  benefit: Benefit
  organization: Organization
  selected: boolean
  handleSelectBenefit: (benefit: Benefit) => () => void
}

const BenefitRow = ({
  benefit,
  handleSelectBenefit,
  organization,
  selected,
}: BenefitRowProps) => {
  const {
    isShown: isEditShown,
    toggle: toggleEdit,
    hide: hideEdit,
  } = useModal()
  const {
    isShown: isDeleteShown,
    hide: hideDelete,
    toggle: toggleDelete,
  } = useModal()

  const deleteSubscriptionBenefit = useDeleteSubscriptionBenefit(
    organization.name,
  )

  const handleDeleteSubscriptionBenefit = useCallback(() => {
    deleteSubscriptionBenefit.mutateAsync({ id: benefit.id })
  }, [deleteSubscriptionBenefit, benefit])

  return (
    <div
      className={twMerge(
        'dark:hover:bg-polar-800 flex cursor-pointer flex-row justify-between gap-x-8 rounded-2xl border border-gray-100 px-4 py-3 transition-colors hover:border-blue-100 hover:bg-blue-50 dark:border-transparent',
        selected &&
          'dark:bg-polar-800 dark:hover:bg-polar-700 dark:border-polar-700 border-blue-100 bg-blue-50 hover:bg-blue-100',
      )}
      onClick={handleSelectBenefit(benefit)}
    >
      <div className="flex flex-row items-center gap-x-3">
        <div
          className={twMerge(
            'flex h-8 w-8 shrink-0  items-center justify-center rounded-full bg-blue-100 text-blue-500 dark:bg-blue-950 dark:text-blue-400',
          )}
        >
          {resolveBenefitIcon(benefit, 'inherit')}
        </div>
        <span className="text-sm">{benefit.description}</span>
      </div>

      <DropdownMenu>
        <DropdownMenuTrigger className="focus:outline-none">
          <Button
            className={
              'border-none bg-transparent text-[16px] opacity-50 transition-opacity hover:opacity-100 dark:bg-transparent'
            }
            size="icon"
            variant="secondary"
          >
            <MoreVertOutlined fontSize="inherit" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="end"
          className="dark:bg-polar-800 bg-gray-50 shadow-lg"
        >
          <DropdownMenuItem onClick={toggleEdit}>Edit</DropdownMenuItem>
          {benefit.deletable && (
            <DropdownMenuItem onClick={toggleDelete}>Delete</DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
      <Modal
        className="overflow-visible"
        isShown={isEditShown}
        hide={hideEdit}
        modalContent={
          <UpdateSubscriptionTierBenefitModalContent
            organization={organization}
            benefit={benefit}
            hideModal={hideEdit}
          />
        }
      />
      <ConfirmModal
        isShown={isDeleteShown}
        hide={hideDelete}
        title="Delete Benefit"
        description={`Deleting a benefit will remove it from other Subscription tiers & revokes it for existing subscribers. Are you sure?`}
        onConfirm={handleDeleteSubscriptionBenefit}
        destructive
      />
    </div>
  )
}

const AdsBenefitContent = ({ benefit }: { benefit: BenefitsInner }) => {
  const shortID = benefit.id.substring(benefit.id.length - 6)

  const height =
    'properties' in benefit && 'image_height' in benefit.properties
      ? benefit.properties.image_height
      : 100

  const width =
    'properties' in benefit && 'image_width' in benefit.properties
      ? benefit.properties.image_width
      : 240

  const displays = useAdvertisementDisplays(benefit.id)

  const showAds = displays.data?.items ?? []

  const formattedDisplays = showAds
    .map((a) => {
      let ad = `<a href="${encodeURI(a.link_url)}"><picture>`

      if (a.image_url_dark) {
        const image_url_dark = `https://polar.sh/embed/ad?id=${a.id}&dark=1`
        ad += `<source media="(prefers-color-scheme: dark)" srcset="${image_url_dark}">`
      }

      const image_url = `https://polar.sh/embed/ad?id=${a.id}`
      ad += `<img src="${image_url}" alt="${encode(a.text)}" height="${
        a.height
      }" width="${a.width}" />`

      ad += `</picture></a>`

      return ad
    })
    .join('\n')

  const code = `<!-- POLAR type=ads id=${shortID} subscription_benefit_id=${benefit.id} width=${width} height=${height} -->
${formattedDisplays}
<!-- POLAR-END id=${shortID} -->`

  const embedTextarea = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (embedTextarea.current) {
      embedTextarea.current.style.height = `${embedTextarea.current.scrollHeight}px`
    }
  }, [embedTextarea.current, code])

  return (
    <>
      <div className="flex flex-col gap-y-3">
        <h3 className="font-medium">Identifier</h3>
        <p className="dark:text-polar-400 text-sm text-gray-600">
          Use this ID when{' '}
          <a
            href="https://docs.polar.sh/maintainers/ads/"
            target="_blank"
            rel="noopener"
            className="text-blue-500 hover:text-blue-400 dark:text-blue-400 dark:hover:text-blue-300"
          >
            integrating
          </a>{' '}
          ads in your README or website.
        </p>
        <pre>
          <code className="dark:bg-polar-700 rounded-md bg-gray-100 p-2 text-xs">
            {benefit.id}
          </code>
        </pre>
      </div>

      <div className="flex flex-col gap-y-3">
        <h3 className="font-medium">Markdown & HTML embed code</h3>
        <p className="dark:text-polar-400 text-sm text-gray-600">
          Use this to get started, and setup the{' '}
          <a
            href="https://github.com/polarsource/actions"
            rel="noopener"
            className="text-blue-500 hover:text-blue-400 dark:text-blue-400 dark:hover:text-blue-300"
          >
            GitHub Action
          </a>{' '}
          to keep it the ad automatically updated.
        </p>
        <Textarea
          ref={embedTextarea}
          className="dark:bg-polar-700 min-h-[100px] rounded-md border-0 bg-gray-100 font-mono text-xs text-gray-500"
          value={code}
          readOnly
        />
      </div>
    </>
  )
}

const RecommendedBenefits = ({
  existingBenefits,
  openCreateBenefitModal,
  setCreateModalDefaultValues,
}: {
  existingBenefits: BenefitsInner[]
  openCreateBenefitModal: () => void
  setCreateModalDefaultValues: (v: NewSubscriptionsModalParams) => void
}) => {
  const hasDiscord = existingBenefits.find((b) => b.type === 'discord')
  const hasAds = existingBenefits.find((b) => b.type === 'ads')

  // No remaining recommendations
  if (hasDiscord && hasAds) {
    return <></>
  }

  return (
    <div className="flex flex-col gap-y-2">
      <h2 className="text-md font-medium">Recommended benefits</h2>
      {!hasDiscord && (
        <BenefitSuggestionRow
          icon={<DiscordIcon />}
          onClick={() => {
            setCreateModalDefaultValues({
              description: 'Invite to community Discord server',
              type: SubscriptionBenefitType.DISCORD,
            })
            openCreateBenefitModal()
          }}
        >
          Invite to community Discord server
        </BenefitSuggestionRow>
      )}

      {!hasAds && (
        <BenefitSuggestionRow
          icon={<WebOutlined className="h-4 w-4" fontSize="inherit" />}
          onClick={() => {
            setCreateModalDefaultValues({
              description: 'Logo in README',
              type: SubscriptionBenefitType.ADS,
            })
            openCreateBenefitModal()
          }}
        >
          Logo in README
        </BenefitSuggestionRow>
      )}
    </div>
  )
}

const BenefitSuggestionRow = ({
  icon,
  children,
  onClick,
}: {
  children: React.ReactNode
  icon: React.ReactNode
  onClick: () => void
}) => {
  return (
    <div
      className="dark:hover:bg-polar-800 dark:bg-polar-900 flex cursor-pointer flex-row justify-between gap-x-8 rounded-2xl border border-gray-100 bg-white px-4 py-3 transition-colors hover:border-blue-100 hover:bg-blue-50 dark:border-transparent"
      onClick={onClick}
    >
      <div className="flex flex-row items-center gap-x-3">
        <div className="flex h-8 w-8 shrink-0  items-center justify-center rounded-full bg-blue-100 text-blue-500 dark:bg-blue-950 dark:text-blue-400">
          {icon}
        </div>
        <span className="text-sm">{children}</span>
      </div>
    </div>
  )
}
