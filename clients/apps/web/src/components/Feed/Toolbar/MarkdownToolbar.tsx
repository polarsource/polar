import { ChevronDownIcon } from '@heroicons/react/24/outline'
import { Button } from 'polarkit/components/ui/atoms'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from 'polarkit/components/ui/dropdown-menu'
import { useMarkdownComponents } from './useMarkdownComponents'

export const MarkdownToolbar = () => {
  const { insertPaywall, insertSubscribeNow } = useMarkdownComponents()

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild onMouseDown={(e) => e.stopPropagation()}>
          <Button variant="secondary" className="px-2 text-left" size="sm">
            <span>Components</span>
            <ChevronDownIcon className="ml-2 h-3 w-3" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={insertPaywall}>Paywall</DropdownMenuItem>
          <DropdownMenuItem onClick={insertSubscribeNow}>
            Subscription Upsell
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  )
}
