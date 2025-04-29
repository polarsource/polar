'use client'

import { CheckoutLinkPage } from '@/components/CheckoutLinks/CheckoutLinkPage'
import { DashboardBody } from '@/components/Layout/DashboardLayout'
import { ConfirmModal } from '@/components/Modal/ConfirmModal'
import { useModal } from '@/components/Modal/useModal'
import { toast } from '@/components/Toast/use-toast'
import { useCheckoutLink, useDeleteCheckoutLink } from '@/hooks/queries'
import { MoreVertOutlined } from '@mui/icons-material'
import Button from '@polar-sh/ui/components/atoms/Button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@polar-sh/ui/components/ui/dropdown-menu'
import { parseAsString, useQueryState } from 'nuqs'
import { CheckoutLinkList } from '../../../../../../../components/CheckoutLinks/CheckoutLinkList'

export const ClientPage = () => {
  const [selectedCheckoutLinkId, setSelectedCheckoutLinkId] = useQueryState(
    'checkoutLinkId',
    parseAsString,
  )

  const { data: checkoutLink } = useCheckoutLink(selectedCheckoutLinkId)

  const { mutateAsync: deleteCheckoutLink, isPending: isDeletePending } =
    useDeleteCheckoutLink()

  const {
    isShown: isDeleteModalShown,
    show: showDeleteModal,
    hide: hideDeleteModal,
  } = useModal()

  const onDelete = async () => {
    if (checkoutLink) {
      await deleteCheckoutLink(checkoutLink).then(({ error }) => {
        if (error) {
          toast({
            title: 'Checkout Link Deletion Failed',
            description: `Error deleting checkout link: ${error.detail}`,
          })
          return
        }
        toast({
          title: 'Checkout Link Deleted',
          description: `${
            checkoutLink?.label ? checkoutLink.label : 'Unlabeled'
          } Checkout Link  was deleted successfully`,
        })
      })
    }
  }

  return (
    <DashboardBody
      className="flex flex-col gap-y-8"
      contextViewClassName="w-full lg:max-w-[320px] xl:max-w-[320px] h-full overflow-y-hidden"
      contextView={
        <CheckoutLinkList
          selectedCheckoutLinkId={selectedCheckoutLinkId}
          setSelectedCheckoutLinkId={setSelectedCheckoutLinkId}
        />
      }
      contextViewPlacement="left"
      title={checkoutLink?.label ?? ''}
      header={
        checkoutLink ? (
          <div className="flex flex-row items-center gap-x-2">
            <DropdownMenu>
              <DropdownMenuTrigger className="focus:outline-none" asChild>
                <Button
                  size="icon"
                  variant="secondary"
                  loading={isDeletePending}
                >
                  <MoreVertOutlined fontSize="inherit" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                className="dark:bg-polar-800 bg-gray-50 shadow-lg"
              >
                <DropdownMenuItem onClick={showDeleteModal}>
                  Delete Checkout Link
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        ) : undefined
      }
      wrapperClassName="!max-w-screen-sm"
    >
      {checkoutLink && (
        <>
          <CheckoutLinkPage checkoutLink={checkoutLink} />
          <ConfirmModal
            title="Confirm Deletion of Checkout Link"
            description="It will cause 404 responses in case the link is still in use anywhere."
            onConfirm={onDelete}
            isShown={isDeleteModalShown}
            hide={hideDeleteModal}
            confirmPrompt={checkoutLink.label ?? ''}
            destructiveText="Delete"
            destructive
          />
        </>
      )}
    </DashboardBody>
  )
}
