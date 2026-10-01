import AutorenewOutlined from '@mui/icons-material/AutorenewOutlined'
import BoltOutlined from '@mui/icons-material/BoltOutlined'
import GppMaybeOutlined from '@mui/icons-material/GppMaybeOutlined'
import HourglassEmptyOutlined from '@mui/icons-material/HourglassEmptyOutlined'
import InsertDriveFileOutlined from '@mui/icons-material/InsertDriveFileOutlined'
import PersonAddAltOutlined from '@mui/icons-material/PersonAddAltOutlined'
import PersonRemoveOutlined from '@mui/icons-material/PersonRemoveOutlined'
import ShoppingBagOutlined from '@mui/icons-material/ShoppingBagOutlined'
import { schemas } from '@polar-sh/client'
import { formatCurrency } from '@polar-sh/currency'
import { DEFAULT_LOCALE } from '@polar-sh/i18n'
import { formatDate } from '@polar-sh/i18n/formatters/date'
import { Avatar, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import PolarTimeAgo from '@polar-sh/ui/components/atoms/PolarTimeAgo'
import { PopoverClose } from '@polar-sh/ui/components/ui/popover'
import Link from 'next/link'
import type { ReactNode } from 'react'

type Notification = schemas['NotificationsList']['notifications'][number]

const Row = ({
  icon,
  avatar,
  title,
  subtitle,
  href,
  date,
  unread,
}: {
  icon: ReactNode
  avatar: string | null
  title: string
  subtitle: string
  href: string | null
  date: string
  unread: boolean
}) => {
  const content = (
    <Box alignItems="center" columnGap="m" padding="s">
      {avatar ? (
        <Avatar className="h-8 w-8 shrink-0" avatar_url={null} name={avatar} />
      ) : (
        <Box
          width={32}
          height={32}
          flexShrink={0}
          alignItems="center"
          justifyContent="center"
          borderRadius="full"
          borderWidth={1}
          borderStyle="solid"
          borderColor="border-primary"
          color="text-secondary"
        >
          <InsertDriveFileOutlined sx={{ fontSize: 16 }} />
        </Box>
      )}
      <Box flexDirection="column" flex={1} minWidth={0}>
        <Box alignItems="center" justifyContent="between" columnGap="s">
          <Box alignItems="center" columnGap="s" minWidth={0}>
            {unread && (
              <span
                aria-label="Unread"
                className="size-1.5 shrink-0 rounded-full bg-blue-500"
              />
            )}
            <Text truncate>{title}</Text>
          </Box>
          {icon}
        </Box>
        <Box alignItems="center" justifyContent="between" columnGap="s">
          <Text truncate variant="caption" color="muted">
            {subtitle}
          </Text>
          <Text variant="caption" color="muted" wrap="nowrap">
            <PolarTimeAgo date={new Date(date)} />
          </Text>
        </Box>
      </Box>
    </Box>
  )

  return (
    <li>
      {href ? (
        <PopoverClose asChild>
          <Link
            href={href}
            className="dark:hover:bg-polar-800 block rounded-lg hover:bg-gray-100"
          >
            {content}
          </Link>
        </PopoverClose>
      ) : (
        content
      )}
    </li>
  )
}

export const NotificationRow = ({
  notification: n,
  unread,
}: {
  notification: Notification
  unread: boolean
}) => {
  switch (n.type) {
    case 'MaintainerNewPaidSubscriptionNotification': {
      const p = n.payload
      return (
        <Row
          date={n.created_at}
          unread={unread}
          icon={
            <PersonAddAltOutlined
              className="text-emerald-500"
              sx={{ fontSize: 16 }}
            />
          }
          avatar={p.subscriber_name}
          title={`${p.subscriber_name} subscribed`}
          subtitle={`${p.tier_name} · ${p.formatted_price_with_interval}`}
          href={
            p.tier_organization_slug && p.subscription_id
              ? `/dashboard/${p.tier_organization_slug}/sales/subscriptions/${p.subscription_id}`
              : null
          }
        />
      )
    }
    case 'MaintainerNewTrialNotification': {
      const p = n.payload
      const ends = p.trial_end
        ? ` · ends ${formatDate(p.trial_end, DEFAULT_LOCALE, { month: 'short', day: 'numeric' })}`
        : ''
      return (
        <Row
          date={n.created_at}
          unread={unread}
          icon={
            <HourglassEmptyOutlined
              className="text-indigo-500"
              sx={{ fontSize: 16 }}
            />
          }
          avatar={p.subscriber_name}
          title={`${p.subscriber_name} started a trial`}
          subtitle={`${p.product_name}${ends}`}
          href={
            p.organization_slug && p.subscription_id
              ? `/dashboard/${p.organization_slug}/sales/subscriptions/${p.subscription_id}`
              : null
          }
        />
      )
    }
    case 'MaintainerSubscriptionCancellationNotification': {
      const p = n.payload
      const ends =
        p.cancel_at_period_end && p.ends_at
          ? `, ends ${new Date(p.ends_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`
          : ''
      return (
        <Row
          date={n.created_at}
          unread={unread}
          icon={
            <PersonRemoveOutlined
              className="text-red-500"
              sx={{ fontSize: 16 }}
            />
          }
          avatar={p.subscriber_name}
          title={`${p.subscriber_name} canceled`}
          subtitle={`${p.product_name}${ends}`}
          href={
            p.organization_slug && p.subscription_id
              ? `/dashboard/${p.organization_slug}/sales/subscriptions/${p.subscription_id}`
              : null
          }
        />
      )
    }
    case 'MaintainerNewProductSaleNotification': {
      const p = n.payload
      const customer = p.customer_name || 'A customer'
      return (
        <Row
          date={n.created_at}
          unread={unread}
          icon={
            <ShoppingBagOutlined
              className="text-emerald-500"
              sx={{ fontSize: 16 }}
            />
          }
          avatar={customer}
          title={`${customer} purchased`}
          subtitle={`${p.product_name} · ${formatCurrency('compact')(p.product_price_amount, p.currency)}`}
          href={
            p.organization_slug && p.order_id
              ? `/dashboard/${p.organization_slug}/sales/${p.order_id}`
              : null
          }
        />
      )
    }
    case 'MaintainerSubscriptionRenewalNotification': {
      const p = n.payload
      const customer = p.customer_name || 'A customer'
      return (
        <Row
          date={n.created_at}
          unread={unread}
          icon={
            <AutorenewOutlined
              className="text-emerald-500"
              sx={{ fontSize: 16 }}
            />
          }
          avatar={customer}
          title={`${customer} renewed`}
          subtitle={`${p.product_name} · ${formatCurrency('compact')(p.product_price_amount, p.currency)} ${p.formatted_recurring_interval}`}
          href={
            p.organization_slug && p.subscription_id
              ? `/dashboard/${p.organization_slug}/sales/subscriptions/${p.subscription_id}`
              : null
          }
        />
      )
    }
    case 'MaintainerAccountCreditsGrantedNotification': {
      const p = n.payload
      return (
        <Row
          date={n.created_at}
          unread={unread}
          icon={
            <BoltOutlined className="text-indigo-500" sx={{ fontSize: 16 }} />
          }
          avatar={p.organization_name}
          title="Fee credits granted"
          subtitle={`${p.organization_name} · ${formatCurrency('compact')(p.amount, p.currency)}`}
          href={null}
        />
      )
    }
    case 'MaintainerFileFlaggedMaliciousNotification':
      return (
        <Row
          date={n.created_at}
          unread={unread}
          icon={
            <GppMaybeOutlined className="text-red-500" sx={{ fontSize: 16 }} />
          }
          avatar={null}
          title="File flagged as malicious"
          subtitle={n.payload.file_name}
          href={null}
        />
      )
  }
}
