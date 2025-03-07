'use client'

import CreateBenefitModalContent from '@/components/Benefit/CreateBenefitModalContent'
import UpdateBenefitModalContent from '@/components/Benefit/UpdateBenefitModalContent'
import {
  resolveBenefitIcon,
  resolveBenefitTypeDisplayName,
} from '@/components/Benefit/utils'
import { DashboardBody } from '@/components/Layout/DashboardLayout'
import { ConfirmModal } from '@/components/Modal/ConfirmModal'
import { InlineModal } from '@/components/Modal/InlineModal'
import { useModal } from '@/components/Modal/useModal'
import { useToast } from '@/components/Toast/use-toast'
import {
  useBenefitProducts,
  useBenefits,
  useDeleteBenefit,
} from '@/hooks/queries'
import { AddOutlined, AutoAwesome, MoreVertOutlined } from '@mui/icons-material'
import { schemas } from '@polar-sh/client'
import Button from '@polar-sh/ui/components/atoms/Button'
import { List, ListItem } from '@polar-sh/ui/components/atoms/List'
import { ShadowBoxOnMd } from '@polar-sh/ui/components/atoms/ShadowBox'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@polar-sh/ui/components/ui/dropdown-menu'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { twMerge } from 'tailwind-merge'

const ClientPage = ({
  organization,
}: {
  organization: schemas['Organization']
}) => {
  const [selectedBenefit, setSelectedBenefit] = useState<
    schemas['Benefit'] | undefined
  >()
  const { data: benefits } = useBenefits(organization.id, 100)
  const { data: benefitProducts } = useBenefitProducts(
    organization.id,
    selectedBenefit?.id,
    100,
  )
  const searchParams = useSearchParams()

  const { isShown, toggle, hide } = useModal(
    searchParams?.get('create_benefit') === 'true',
  )

  useEffect(() => {
    setSelectedBenefit(benefits?.items[0])
  }, [benefits])

  const selectedBenefitContextView = useMemo(() => {
    return selectedBenefit ? (
      <div className="flex flex-col gap-y-8 p-8 py-12">
        <div className="flex flex-col gap-y-2">
          <h3 className="text-lg font-medium">{selectedBenefit.description}</h3>
          <span className="dark:text-polar-500 text-sm text-gray-500">
            {resolveBenefitTypeDisplayName(selectedBenefit.type)}
          </span>
        </div>

        <div className="flex flex-col gap-y-4">
          <h3 className="font-medium">Products</h3>

          {benefitProducts?.items.length ? (
            <List size="small">
              {benefitProducts.items.map((product) => (
                <Link
                  key={product.id}
                  href={`/dashboard/${organization.slug}/products/${product.id}`}
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
      </div>
    ) : undefined
  }, [selectedBenefit, benefitProducts, organization])

  return (
    <DashboardBody contextView={selectedBenefitContextView} wide>
      <div className="flex flex-row items-start gap-x-16">
        <div className="flex w-full flex-col gap-y-8">
          <div className="flex flex-row items-center justify-between">
            <h2 className="text-lg font-medium">Overview</h2>
            <Button wrapperClassNames="gap-x-2" onClick={toggle}>
              <AddOutlined fontSize="inherit" />
              <span>New Benefit</span>
            </Button>
          </div>
          {(benefits?.items.length ?? 0) > 0 ? (
            <List size="small">
              {benefits?.items.map((benefit) => (
                <ListItem
                  key={benefit.id}
                  className={twMerge(
                    'dark:hover:bg-polar-800',
                    selectedBenefit?.id === benefit.id
                      ? 'dark:bg-polar-800 bg-gray-50'
                      : '',
                  )}
                  selected={selectedBenefit?.id === benefit.id}
                  onSelect={() => setSelectedBenefit(benefit)}
                >
                  <BenefitRow organization={organization} benefit={benefit} />
                </ListItem>
              ))}
            </List>
          ) : (
            <ShadowBoxOnMd className="items-center justify-center gap-y-6 md:flex md:flex-col md:py-48">
              <AutoAwesome
                className="dark:text-polar-600 text-5xl text-gray-300"
                fontSize="inherit"
              />
              <div className="flex flex-col items-center gap-y-6">
                <div className="flex flex-col items-center gap-y-2">
                  <h3 className="text-lg font-medium">No Benefits found</h3>
                  <p className="dark:text-polar-500 text-center text-gray-500">
                    Benefits are automated and granted upon purchase of a
                    product
                  </p>
                </div>
                <Button role="link" variant="secondary" onClick={toggle}>
                  <span>Create Benefit</span>
                </Button>
              </div>
            </ShadowBoxOnMd>
          )}
        </div>

        <InlineModal
          isShown={isShown}
          hide={toggle}
          modalContent={
            <CreateBenefitModalContent
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
  benefit: schemas['Benefit']
  organization: schemas['Organization']
}

const BenefitRow = ({ benefit, organization }: BenefitRowProps) => {
  const { toast } = useToast()

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
    deleteBenefit.mutateAsync({ id: benefit.id }).then(({ error }) => {
      if (error) {
        toast({
          title: 'Benefit Deletion Failed',
          description: `Error deleting benefit ${benefit.description}: ${error.detail}`,
        })
        return
      }
      toast({
        title: 'Benefit Deleted',
        description: `Benefit ${benefit.description} successfully deleted`,
      })
    })
  }, [deleteBenefit, benefit, toast])

  const copyBenefitId = async () => {
    try {
      await navigator.clipboard.writeText(benefit.id)
      toast({
        title: 'Benefit ID Copied',
        description: `Benefit ${benefit.description} ID successfully copied`,
      })
    } catch (err) {
      toast({
        title: 'Benefit ID Copy Failed',
        description: `Error copying ID of benefit ${benefit.description}`,
      })
    }
  }

  return (
    <div className="flex w-full flex-row items-center justify-between">
      <div
        key={benefit.id}
        className="flex flex-row items-start gap-x-3 align-middle"
      >
        <span className="dark:bg-polar-700 flex h-6 w-6 shrink-0 flex-row items-center justify-center rounded-full bg-blue-50 text-2xl text-blue-500 dark:text-white">
          {resolveBenefitIcon(benefit.type, 'h-3 w-3')}
        </span>
        <span className="text-sm">{benefit.description}</span>
      </div>

      <DropdownMenu>
        <DropdownMenuTrigger className="focus:outline-none" asChild>
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
          <DropdownMenuItem onClick={copyBenefitId}>Copy ID</DropdownMenuItem>
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
