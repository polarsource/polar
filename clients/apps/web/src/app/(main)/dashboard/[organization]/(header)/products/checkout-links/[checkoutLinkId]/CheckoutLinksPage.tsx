'use client'

import { CheckoutLinkPage } from '@/components/CheckoutLinks/CheckoutLinkPage'
import { MasterDetailLayoutContent } from '@/components/Layout/MasterDetailLayout'
import { ConfirmModal } from '@/components/Modal/ConfirmModal'
import { useModal } from '@/components/Modal/useModal'
import { toast } from '@/components/Toast/use-toast'
import { useDeleteCheckoutLink } from '@/hooks/queries'
import { extractApiErrorMessage } from '@/utils/api/errors'
import { usePushRouteWithoutCache } from '@/utils/router'
import MoreVertOutlined from '@mui/icons-material/MoreVertOutlined'
import { schemas } from '@polar-sh/client'
import { Button, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
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
          description: `Error deleting checkout link: ${extractApiErrorMessage(error)}`,
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
        <Box width="100%" alignItems="center" justifyContent="between" gap="l">
          <Text variant="heading-xs" as="p" truncate>
            {(checkoutLink.label?.length ?? 0) > 0
              ? checkoutLink.label
              : 'Untitled'}
          </Text>

          <Box flexShrink={0} alignItems="center" gap="s">
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
          </Box>
        </Box>
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
