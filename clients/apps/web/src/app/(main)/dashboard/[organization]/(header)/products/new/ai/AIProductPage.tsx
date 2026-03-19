'use client'

import { DashboardBody } from '@/components/Layout/DashboardLayout'
import { schemas } from '@polar-sh/client'
import { AIProductChat } from './AIProductChat'

export default function AIProductPage({
  organization,
}: {
  organization: schemas['Organization']
}) {
  return (
    <DashboardBody
      title="Create Product with AI"
      wrapperClassName="max-w-(--breakpoint-md)!"
      className="gap-y-8"
    >
      <p className="dark:text-polar-400 text-gray-500">
        Describe your product and how you want to sell it. The AI assistant will
        configure it for you.
      </p>
      <AIProductChat organization={organization} />
    </DashboardBody>
  )
}
