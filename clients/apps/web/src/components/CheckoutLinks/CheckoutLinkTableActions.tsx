'use client'

import { toast } from '@/components/Toast/use-toast'
import MoreVertOutlined from '@mui/icons-material/MoreVertOutlined'
import { schemas } from '@polar-sh/client'
import { Button } from '@polar-sh/orbit'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@polar-sh/ui/components/ui/dropdown-menu'

interface CheckoutLinkTableActionsProps {
  checkoutLink: schemas['CheckoutLink']
  onEdit: (checkoutLink: schemas['CheckoutLink']) => void
  onDelete: (checkoutLink: schemas['CheckoutLink']) => void
}

export const CheckoutLinkTableActions = ({
  checkoutLink,
  onEdit,
  onDelete,
}: CheckoutLinkTableActionsProps) => {
  const copyCheckoutLink = async () => {
    await navigator.clipboard.writeText(checkoutLink.url)
    toast({
      title: 'Checkout Link Copied',
      description: 'Checkout Link was copied to clipboard',
    })
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          size="icon"
          variant="ghost"
          aria-label={`Actions for ${checkoutLink.label || 'Untitled'}`}
        >
          <MoreVertOutlined fontSize="inherit" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => onEdit(checkoutLink)}>
          Edit
        </DropdownMenuItem>
        <DropdownMenuItem onClick={copyCheckoutLink}>
          Copy link
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem destructive onClick={() => onDelete(checkoutLink)}>
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
