'use client'

import { BenefitPage } from '@/components/Benefit/BenefitPage'
import { BenefitProducts } from '@/components/Benefit/BenefitProducts'
import { LicenseKeysPage } from '@/components/Benefit/LicenseKeysPage'
import UpdateBenefitModalContent from '@/components/Benefit/UpdateBenefitModalContent'
import {
  benefitsDisplayNames,
  resolveBenefitIcon,
} from '@/components/Benefit/utils'
import { MasterDetailLayoutContent } from '@/components/Layout/MasterDetailLayout'
import { ConfirmModal } from '@/components/Modal/ConfirmModal'
import { Button, InlineModal, Status, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { useModal } from '@/components/Modal/useModal'
import { useToast } from '@/components/Toast/use-toast'
import { useDeleteBenefit } from '@/hooks/queries'
import { extractApiErrorMessage } from '@/utils/api/errors'
import { usePushRouteWithoutCache } from '@/utils/router'
import MoreVertOutlined from '@mui/icons-material/MoreVertOutlined'
import { schemas } from '@polar-sh/client'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@polar-sh/ui/components/ui/dropdown-menu'
import { parseAsString, useQueryState } from 'nuqs'
import { useCallback, useEffect, useRef } from 'react'

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
    show: showEdit,
    hide: hideEdit,
  } = useModal()
  const [editBenefitId, setEditBenefitId] = useQueryState(
    'edit_benefit',
    parseAsString,
  )

  const {
    isShown: isDeleteShown,
    hide: hideDelete,
    toggle: toggleDelete,
  } = useModal()

  const {
    isShown: isDiscardShown,
    hide: hideDiscard,
    show: showDiscard,
  } = useModal()

  const isDirtyRef = useRef(false)

  const requestClose = useCallback(() => {
    if (isDirtyRef.current) {
      showDiscard()
    } else {
      hideEdit()
    }
  }, [showDiscard, hideEdit])

  const handleDiscardConfirm = useCallback(() => {
    hideDiscard()
    hideEdit()
  }, [hideDiscard, hideEdit])

  const handleDirtyChange = useCallback((dirty: boolean) => {
    isDirtyRef.current = dirty
  }, [])

  useEffect(() => {
    if (editBenefitId !== benefit.id) {
      return
    }

    showEdit()
    setEditBenefitId(null)
  }, [benefit.id, editBenefitId, setEditBenefitId, showEdit])

  const deleteBenefit = useDeleteBenefit(organization.id)

  const handleDeleteBenefit = useCallback(() => {
    deleteBenefit.mutateAsync({ id: benefit.id }).then(({ error }) => {
      if (error) {
        toast({
          title: 'Benefit Deletion Failed',
          description: `Error deleting benefit ${benefit.description}: ${extractApiErrorMessage(error)}`,
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
          <Box alignItems={{ base: 'start', sm: 'center' }} gap="xl">
            <Box
              width={48}
              height={48}
              flexShrink={0}
              alignItems="center"
              justifyContent="center"
              borderRadius="full"
              backgroundColor="background-card"
              color="text-primary"
            >
              {resolveBenefitIcon(benefit.type, 'h-4 w-4')}
            </Box>
            <Box flexDirection="column" rowGap={{ base: 'xs', sm: 'none' }}>
              <Box
                minWidth={0}
                flexDirection={{ base: 'column', sm: 'row' }}
                alignItems={{ base: 'start', sm: 'center' }}
                gap={{ base: 'xs', sm: 'l' }}
              >
                <Text variant="heading-xxs" as="p" truncate>
                  {(benefit.description?.length ?? 0) > 0
                    ? benefit.description
                    : '—'}
                </Text>
                <Box flexShrink={0}>
                  <Status
                    color="gray"
                    status={
                      benefit.visibility === 'public'
                        ? 'Visible to customers'
                        : 'Hidden from customers'
                    }
                  />
                </Box>
              </Box>
              <Text color="muted">{benefitsDisplayNames[benefit.type]}</Text>
            </Box>
          </Box>

          <Box alignItems="center" gap="l">
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
          </Box>
        </>
      }
    >
      <Box flexDirection="column" width="100%" height="100%">
        <Box flexDirection="column" width="100%" gap="2xl" paddingBottom="2xl">
          <BenefitProducts benefit={benefit} organization={organization} />
          {benefit.type === 'license_keys' ? (
            <LicenseKeysPage organization={organization} benefit={benefit} />
          ) : (
            <BenefitPage benefit={benefit} organization={organization} />
          )}
        </Box>
      </Box>

      <InlineModal
        isShown={isEditShown}
        hide={requestClose}
        modalContent={
          <UpdateBenefitModalContent
            organization={organization}
            benefit={benefit}
            hideModal={hideEdit}
            requestClose={requestClose}
            onDirtyChange={handleDirtyChange}
          />
        }
      />
      <ConfirmModal
        isShown={isDiscardShown}
        hide={hideDiscard}
        title="Discard changes?"
        description="You have unsaved changes that will be lost."
        onConfirm={handleDiscardConfirm}
        destructiveText="Discard"
        destructive
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
