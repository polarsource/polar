'use client'

import { CheckoutLinkPage } from '@/components/CheckoutLinks/CheckoutLinkPage'
import { MasterDetailLayoutContent } from '@/components/Layout/MasterDetailLayout'
import { ConfirmModal } from '@/components/Modal/ConfirmModal'
import { useModal } from '@/components/Modal/useModal'
import { toast } from '@/components/Toast/use-toast'
import { useDeleteCheckoutLink } from '@/hooks/queries'
import { usePushRouteWithoutCache } from '@/utils/router'
import LinkOutlined from '@mui/icons-material/LinkOutlined'
import MoreVertOutlined from '@mui/icons-material/MoreVertOutlined'
import { schemas } from '@polar-sh/client'
import Button from '@polar-sh/ui/components/atoms/Button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@polar-sh/ui/components/ui/dropdown-menu'
import React from 'react'

interface ClientPageProps {
  organization: schemas['Organization']
  checkoutLink: schemas['CheckoutLink']
}

const ClientPage: React.FC<ClientPageProps> = ({
  organization,
  checkoutLink,
}) => {
  const pushRouteWithoutCache = usePushRouteWithoutCache()

  const { mutateAsync: deleteCheckoutLink, isPending: isDeletePending } =
    useDeleteCheckoutLink()

  const {
    isShown: isDeleteModalShown,
    show: showDeleteModal,
    hide: hideDeleteModal,
  } = useModal()

  const onDelete = async () => {
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
        } Checkout Link was deleted successfully`,
      })

      pushRouteWithoutCache(
        `/dashboard/${organization.slug}/products/checkout-links`,
      )
    })
  }

  return (
    <MasterDetailLayoutContent
      header={
        <>
          <div className="flex flex-row items-center gap-6">
            <span className="dark:bg-polar-700 flex h-12 w-12 shrink-0 flex-row items-center justify-center rounded-full bg-gray-200 text-2xl text-black dark:text-white">
              <LinkOutlined />
            </span>
            <div className="flex flex-col">
              <p className="text-lg">
                {(checkoutLink.label?.length ?? 0) > 0
                  ? checkoutLink.label
                  : 'Untitled'}
              </p>
              <div className="dark:text-polar-500 flex flex-row items-center gap-2 font-mono text-sm text-gray-500">
                <span>
                  {checkoutLink.products.length === 1
                    ? checkoutLink.products[0].name
                    : `${checkoutLink.products.length} Products`}
                </span>
              </div>
            </div>
          </div>

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
                <DropdownMenuItem destructive onClick={showDeleteModal}>
                  Delete Checkout Link
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </>
      }
    >
      <div className="flex h-full w-full flex-col">
        <div className="flex w-full flex-col gap-8 pb-8">
          <CheckoutLinkPage checkoutLink={checkoutLink} />
        </div>
      </div>
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
    </MasterDetailLayoutContent>
  )
}

export default ClientPage
