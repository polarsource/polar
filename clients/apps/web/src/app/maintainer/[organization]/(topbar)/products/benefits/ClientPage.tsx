'use client'

import CreateBenefitModalContent, {
  CreateBenefitModalParams,
} from '@/components/Benefit/CreateBenefitModalContent'
import UpdateBenefitModalContent from '@/components/Benefit/UpdateBenefitModalContent'
import { DiscordIcon, resolveBenefitIcon } from '@/components/Benefit/utils'
import { DashboardBody } from '@/components/Layout/DashboardLayout'
import { ConfirmModal } from '@/components/Modal/ConfirmModal'
import { InlineModal } from '@/components/Modal/InlineModal'
import { useModal } from '@/components/Modal/useModal'
import {
  useAdvertisementDisplays,
  useBenefitProducts,
  useBenefits,
  useDeleteBenefit,
} from '@/hooks/queries'
import { AddOutlined, MoreVertOutlined, WebOutlined } from '@mui/icons-material'
import { BenefitPublicInner, BenefitType, Organization } from '@polar-sh/sdk'
import { encode } from 'html-entities'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import Button from 'polarkit/components/ui/atoms/button'
import { List, ListItem } from 'polarkit/components/ui/atoms/list'
import { ShadowBoxOnMd } from 'polarkit/components/ui/atoms/shadowbox'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from 'polarkit/components/ui/dropdown-menu'
import { Textarea } from 'polarkit/components/ui/textarea'
import { useCallback, useEffect, useRef, useState } from 'react'
import { twMerge } from 'tailwind-merge'

const ClientPage = ({ organization }: { organization: Organization }) => {
  const [selectedBenefit, setSelectedBenefit] = useState<
    BenefitPublicInner | undefined
  >()
  const { data: benefits, isFetched: benefitsIsFetched } = useBenefits(
    organization.id,
    100,
  )
  const { data: benefitProducts } = useBenefitProducts(
    organization.id,
    selectedBenefit?.id,
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
    useState<CreateBenefitModalParams>()

  useEffect(() => {
    setSelectedBenefit(benefits?.items?.[0])
  }, [benefits])

  return (
    <DashboardBody className="flex flex-col gap-y-8">
      <div className="flex flex-row items-start gap-x-8">
        <div className="flex w-2/3 flex-col gap-y-8">
          <div className="flex flex-row items-center justify-between">
            <h2 className="text-lg font-medium">Benefits</h2>
            <Button className="h-8 w-8 rounded-full" onClick={toggle}>
              <AddOutlined fontSize="inherit" />
            </Button>
          </div>
          <List>
            {benefits?.items?.map((benefit) => (
              <ListItem
                key={benefit.id}
                selected={selectedBenefit?.id === benefit.id}
                onSelect={() => setSelectedBenefit(benefit)}
              >
                <BenefitRow organization={organization} benefit={benefit} />
              </ListItem>
            ))}
          </List>
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
              <span className="font-medium">{selectedBenefit.description}</span>
            </div>

            <div className="flex flex-col gap-y-4">
              <h3 className="font-medium">Products</h3>

              {benefitProducts?.items?.length ? (
                <List size="small">
                  {benefitProducts.items.map((product) => (
                    <Link
                      key={product.id}
                      href={`/maintainer/${organization.name}/products/${product.id}`}
                    >
                      <ListItem className="text-sm" size="small">
                        <span>{product.name}</span>
                        <span className="dark:text-polar-500 text-xs text-gray-500">
                          {product.benefits.length > 0
                            ? `${product.benefits.length} ${product.benefits.length === 1 ? 'Benefit' : 'Benefits'}`
                            : null}
                        </span>
                      </ListItem>
                    </Link>
                  ))}
                </List>
              ) : (
                <span className="text-sm text-gray-500">
                  Benefit not tied to any product
                </span>
              )}
            </div>

            {selectedBenefit.type === 'ads' ? (
              <AdsBenefitContent benefit={selectedBenefit} />
            ) : null}
          </ShadowBoxOnMd>
        )}

        <InlineModal
          isShown={isShown}
          hide={toggle}
          modalContent={
            <CreateBenefitModalContent
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
  benefit: BenefitPublicInner
  organization: Organization
}

const BenefitRow = ({ benefit, organization }: BenefitRowProps) => {
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

  const deleteBenefit = useDeleteBenefit(organization.id)

  const handleDeleteBenefit = useCallback(() => {
    deleteBenefit.mutateAsync({ id: benefit.id })
  }, [deleteBenefit, benefit])

  return (
    <div className="flex w-full flex-row items-center justify-between">
      <div className={twMerge('flex flex-row items-center gap-x-3')}>
        {resolveBenefitIcon(benefit, 'inherit')}
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
      <InlineModal
        isShown={isEditShown}
        hide={hideEdit}
        modalContent={
          <UpdateBenefitModalContent
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
        description="Deleting a benefit will remove it from every Products & revoke it for existing customers. Are you sure?"
        onConfirm={handleDeleteBenefit}
        destructive
      />
    </div>
  )
}

const AdsBenefitContent = ({ benefit }: { benefit: BenefitPublicInner }) => {
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
      ad += `<img src="${image_url}" alt="${encode(a.text)}" height="${height}" width="${width}" />`

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
  }, [embedTextarea, code])

  return (
    <>
      <div className="flex flex-col gap-y-3">
        <h3 className="font-medium">Identifier</h3>
        <p className="dark:text-polar-400 text-sm text-gray-600">
          Use this ID when{' '}
          <Link
            href="/docs/ads"
            target="_blank"
            rel="noopener"
            className="text-blue-500 hover:text-blue-400 dark:text-blue-400 dark:hover:text-blue-300"
          >
            integrating
          </Link>{' '}
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
  existingBenefits: BenefitPublicInner[]
  openCreateBenefitModal: () => void
  setCreateModalDefaultValues: (v: CreateBenefitModalParams) => void
}) => {
  const hasDiscord = existingBenefits.find((b) => b.type === 'discord')
  const hasAds = existingBenefits.find((b) => b.type === 'ads')

  // No remaining recommendations
  if (hasDiscord && hasAds) {
    return <></>
  }

  return (
    <div className="flex flex-col gap-y-4">
      <h2 className="text-md font-medium">Recommended benefits</h2>
      <List>
        {!hasDiscord && (
          <ListItem
            onSelect={() => {
              setCreateModalDefaultValues({
                description: 'Invite to community Discord server',
                type: BenefitType.DISCORD,
              })
              openCreateBenefitModal()
            }}
          >
            <BenefitSuggestionRow icon={<DiscordIcon />}>
              Invite to community Discord server
            </BenefitSuggestionRow>
          </ListItem>
        )}

        {!hasAds && (
          <ListItem
            onSelect={() => {
              setCreateModalDefaultValues({
                description: 'Logo in README',
                type: BenefitType.ADS,
              })
              openCreateBenefitModal()
            }}
          >
            <BenefitSuggestionRow
              icon={<WebOutlined className="h-4 w-4" fontSize="inherit" />}
            >
              Logo in README
            </BenefitSuggestionRow>
          </ListItem>
        )}
      </List>
    </div>
  )
}

const BenefitSuggestionRow = ({
  icon,
  children,
}: {
  children: React.ReactNode
  icon: React.ReactNode
}) => {
  return (
    <div className="flex w-full flex-row items-center gap-x-3">
      {icon}
      <span className="text-sm">{children}</span>
    </div>
  )
}
