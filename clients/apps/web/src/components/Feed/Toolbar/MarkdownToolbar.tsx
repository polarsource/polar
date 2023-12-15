import { ChevronDownIcon } from '@heroicons/react/24/outline'
import { Button } from 'polarkit/components/ui/atoms'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from 'polarkit/components/ui/dropdown-menu'

export const MarkdownToolbar = () => {
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="secondary" className="px-2 text-left" size="sm">
            <span>Components</span>
            <ChevronDownIcon className="ml-2 h-3 w-3" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem>Paywall</DropdownMenuItem>
          <DropdownMenuItem>Poll</DropdownMenuItem>
          <DropdownMenuItem>Subscription Upsell</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  )
}
