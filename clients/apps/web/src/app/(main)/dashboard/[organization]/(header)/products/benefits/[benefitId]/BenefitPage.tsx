'use client'

import { BenefitPage } from '@/components/Benefit/BenefitPage'
import { LicenseKeysPage } from '@/components/Benefit/LicenseKeysPage'
import UpdateBenefitModalContent from '@/components/Benefit/UpdateBenefitModalContent'
import {
  benefitsDisplayNames,
  resolveBenefitIcon,
} from '@/components/Benefit/utils'
import { MasterDetailLayoutContent } from '@/components/Layout/MasterDetailLayout'
import { ConfirmModal } from '@/components/Modal/ConfirmModal'
import { InlineModal } from '@/components/Modal/InlineModal'
import { useModal } from '@/components/Modal/useModal'
import { useToast } from '@/components/Toast/use-toast'
import { useDeleteBenefit } from '@/hooks/queries'
import { usePushRouteWithoutCache } from '@/utils/router'
import MoreVertOutlined from '@mui/icons-material/MoreVertOutlined'
import { schemas } from '@polar-sh/client'
import Button from '@polar-sh/ui/components/atoms/Button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@polar-sh/ui/components/ui/dropdown-menu'
import { useCallback } from 'react'

interface ClientPageProps {
  organization: schemas['Organization']
  benefit: schemas['Benefit']
}

const ClientPage: React.FC<ClientPageProps> = ({
  organization,
  benefit,
}: ClientPageProps) => {
  const pushRouteWithoutCache = usePushRouteWithoutCache()
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
      pushRouteWithoutCache(`/dashboard/${organization.slug}/products/benefits`)
    })
  }, [deleteBenefit, benefit, toast, organization, pushRouteWithoutCache])

  const copyBenefitId = async () => {
    try {
      await navigator.clipboard.writeText(benefit.id)
      toast({
        title: 'Benefit ID Copied',
        description: `Benefit ${benefit.description} ID successfully copied`,
      })
    } catch {
      toast({
        title: 'Benefit ID Copy Failed',
        description: `Error copying ID of benefit ${benefit.description}`,
      })
    }
  }

  return (
    <MasterDetailLayoutContent
      header={
        <>
          <div className="flex flex-row items-center gap-6">
            <span className="dark:bg-polar-700 flex h-12 w-12 shrink-0 flex-row items-center justify-center rounded-full bg-gray-200 text-2xl text-black dark:text-white">
              {resolveBenefitIcon(benefit.type, 'h-4 w-4')}
            </span>
            <div className="flex flex-col">
              <p className="text-lg">
                {(benefit.description?.length ?? 0) > 0
                  ? benefit.description
                  : '—'}
              </p>
              <div className="dark:text-polar-500 flex flex-row items-center gap-2 font-mono text-sm text-gray-500">
                <span>{benefitsDisplayNames[benefit.type]}</span>
              </div>
            </div>
          </div>

          <div className="flex flex-row items-center gap-4">
            <Button onClick={toggleEdit}>Edit Benefit</Button>
            <DropdownMenu>
              <DropdownMenuTrigger className="focus:outline-none" asChild>
                <Button className="h-10 w-10" variant="secondary">
                  <MoreVertOutlined fontSize="inherit" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                className="dark:bg-polar-800 bg-gray-50 shadow-lg"
              >
                <DropdownMenuItem onClick={copyBenefitId}>
                  Copy ID
                </DropdownMenuItem>
                {benefit?.deletable && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem destructive onClick={toggleDelete}>
                      Delete Benefit
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </>
      }
    >
      <div className="flex h-full w-full flex-col">
        <div className="flex w-full flex-col gap-8 pb-8">
          {benefit.type === 'license_keys' ? (
            <LicenseKeysPage organization={organization} benefit={benefit} />
          ) : (
            <BenefitPage benefit={benefit} organization={organization} />
          )}
        </div>
      </div>

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
        title={`Delete "${benefit?.description}"`}
        description="Deleting a benefit will remove it from every product & revoke it for existing customers. Are you sure?"
        onConfirm={handleDeleteBenefit}
        destructiveText="Yes, delete"
        destructive
      />
    </MasterDetailLayoutContent>
  )
}

export default ClientPage
