'use client'

import { BanknoteIcon } from 'lucide-react'
import { StatusBlock } from './Account/sections/StatusBlock'

export const ManualPayoutStatusBlock = () => (
  <StatusBlock
    tone="neutral"
    icon={BanknoteIcon}
    title="Manual payouts"
    description={
      <>
        You are receiving manual payouts.{' '}
        <a
          href="mailto:support@polar.sh"
          className="underline hover:no-underline"
        >
          Reach out to support
        </a>{' '}
        to request a payout or change this.
      </>
    }
  />
)
