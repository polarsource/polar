import { ErrorOutlined } from '@mui/icons-material'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from 'polarkit/components/ui/tooltip'
import React from 'react'

const NoPayoutAccountTooltip: React.FC = () => {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger>
          <div className="text-yellow-500">
            <ErrorOutlined className="h-4 w-4" />
          </div>
        </TooltipTrigger>
        <TooltipContent side="right">
          Earnings won&apos;t show up here until you set up a payout account.
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

export default NoPayoutAccountTooltip
