import { OmniSearch } from '@/components/Search/OmniSearch'
import { schemas } from '@polar-sh/client'
import {
  Button,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { ChartNoAxesColumn, Search, Wallet } from '@polar-sh/orbit/icons'
import Link from 'next/link'
import { ReactNode, useState } from 'react'

const QuickAction = ({
  label,
  children,
}: {
  label: string
  children: ReactNode
}) => (
  <Tooltip>
    <TooltipTrigger asChild>{children}</TooltipTrigger>
    <TooltipContent>{label}</TooltipContent>
  </Tooltip>
)

const QuickLink = ({
  label,
  href,
  icon,
}: {
  label: string
  href: string
  icon: ReactNode
}) => (
  <QuickAction label={label}>
    <Link
      href={href}
      aria-label={label}
      className="dark:hover:bg-polar-700 focus-visible:ring-ring inline-flex h-8 w-8 items-center justify-center rounded-full text-black transition-colors hover:bg-gray-200 focus-visible:ring-2 focus-visible:outline-none dark:text-white"
    >
      {icon}
    </Link>
  </QuickAction>
)

export const OverviewQuickActions = ({
  organization,
}: {
  organization: schemas['Organization']
}) => {
  const [searchOpen, setSearchOpen] = useState(false)
  const base = `/dashboard/${organization.slug}`

  return (
    <Box alignItems="center" columnGap="s">
      <QuickLink
        label="Payouts"
        href={`${base}/finance/payouts`}
        icon={<Wallet className="h-4 w-4" />}
      />
      <QuickLink
        label="Metrics"
        href={`${base}/analytics/metrics`}
        icon={<ChartNoAxesColumn className="h-4 w-4" />}
      />
      <QuickAction label="Search">
        <Button
          size="icon"
          variant="secondary"
          className="h-8 w-8"
          aria-label="Search"
          onClick={() => setSearchOpen(true)}
        >
          <Search className="h-4 w-4" />
        </Button>
      </QuickAction>
      <OmniSearch
        open={searchOpen}
        onOpenChange={setSearchOpen}
        organization={organization}
      />
    </Box>
  )
}
