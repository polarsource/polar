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
          <div className="text-red-500">
            <ErrorOutlined className="h-5 w-5" />
          </div>
        </TooltipTrigger>
        <TooltipContent align="start" side="right">
          Earnings won&apos;t show up here until you set up a payout account.
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

export default NoPayoutAccountTooltip
