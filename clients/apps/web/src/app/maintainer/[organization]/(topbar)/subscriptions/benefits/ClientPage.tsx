'use client'

import { Benefit } from '@/components/Benefit/Benefit'
import { DashboardBody } from '@/components/Layout/DashboardLayout'
import { Modal } from '@/components/Modal'
import { useModal } from '@/components/Modal/useModal'
import { ConfirmModal } from '@/components/Shared/ConfirmModal'
import SubscriptionGroupIcon from '@/components/Subscriptions/SubscriptionGroupIcon'
import {
  NewSubscriptionTierBenefitModalContent,
  UpdateSubscriptionTierBenefitModalContent,
} from '@/components/Subscriptions/SubscriptionTierBenefitsForm'
import { resolveBenefitIcon } from '@/components/Subscriptions/utils'
import { AddOutlined, MoreVertOutlined } from '@mui/icons-material'
import { Organization } from '@polar-sh/sdk'
import Link from 'next/link'
import { Button, ShadowBoxOnMd } from 'polarkit/components/ui/atoms'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from 'polarkit/components/ui/dropdown-menu'
import {
  useDeleteSubscriptionBenefit,
  useSubscriptionBenefits,
  useSubscriptionTiers,
} from 'polarkit/hooks'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { twMerge } from 'tailwind-merge'

const ClientPage = ({ organization }: { organization: Organization }) => {
  const [selectedBenefit, setSelectedBenefit] = useState<Benefit | undefined>()
  const { data: benefits } = useSubscriptionBenefits(organization.name, 100)
  const { data: subscriptionTiers } = useSubscriptionTiers(
    organization.name,
    100,
  )
  const { isShown, toggle, hide } = useModal()

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
        <ShadowBoxOnMd className="flex w-2/3 flex-col gap-y-6">
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
        {selectedBenefit && (
          <ShadowBoxOnMd className="sticky top-8 flex w-1/3 flex-col gap-y-8">
            <div className="flex flex-row items-center gap-x-3">
              <div
                className={twMerge(
                  'flex h-8 w-8 items-center justify-center rounded-full bg-blue-500 text-blue-500 dark:bg-blue-950 dark:text-blue-400',
                )}
              >
                {resolveBenefitIcon(selectedBenefit, true)}
              </div>
              <span className="text-sm">{selectedBenefit.description}</span>
            </div>
            {(benefitSubscriptionTiers?.length ?? 0) > 0 && (
              <div className="flex flex-col gap-y-4">
                <h3 className="text-sm font-medium">Subscription Tiers</h3>
                <div className="flex flex-col gap-y-2">
                  {benefitSubscriptionTiers?.map((tier) => (
                    <Link
                      key={tier.id}
                      href={`/maintainer/${organization.name}/subscriptions/tiers/${tier.id}`}
                      className="dark:hover:bg-polar-800 -mx-2 flex flex-row items-center gap-x-2 rounded-lg px-4 py-2 hover:bg-gray-50"
                    >
                      <SubscriptionGroupIcon
                        className="h-4! w-4! text-lg"
                        type={tier.type}
                      />
                      <span>{tier.name}</span>
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </ShadowBoxOnMd>
        )}

        <Modal
          className="overflow-visible"
          isShown={isShown}
          hide={toggle}
          modalContent={
            <NewSubscriptionTierBenefitModalContent
              organization={organization}
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
        'dark:hover:bg-polar-800 flex cursor-pointer flex-row justify-between gap-x-8 rounded-2xl border px-4 py-3 shadow-sm transition-colors dark:border-transparent',
        selected &&
          'dark:bg-polar-800 dark:hover:bg-polar-700 dark:border-polar-700 border-blue-100 bg-blue-50 hover:bg-blue-100',
      )}
      onClick={handleSelectBenefit(benefit)}
    >
      <div className="flex flex-row items-center gap-x-3">
        <div
          className={twMerge(
            'flex h-8 w-8 items-center justify-center rounded-full bg-blue-500 text-blue-500 dark:bg-blue-950 dark:text-blue-400',
          )}
        >
          {resolveBenefitIcon(benefit, true)}
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
