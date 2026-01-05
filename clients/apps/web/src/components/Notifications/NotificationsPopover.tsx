import { useNotifications, useNotificationsMarkRead } from '@/hooks/queries'
import { useOutsideClick } from '@/utils/useOutsideClick'
import BoltOutlined from '@mui/icons-material/BoltOutlined'
import InfoOutlined from '@mui/icons-material/InfoOutlined'
import ShoppingBagOutlined from '@mui/icons-material/ShoppingBagOutlined'
import { schemas } from '@polar-sh/client'
import Button from '@polar-sh/ui/components/atoms/Button'
import PolarTimeAgo from '@polar-sh/ui/components/atoms/PolarTimeAgo'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@polar-sh/ui/components/ui/popover'
import { getCentsInDollarString } from '@polar-sh/ui/lib/money'
import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { twMerge } from 'tailwind-merge'
import Icon from '../Icons/Icon'

type NotificationSchema = schemas['NotificationsList']['notifications'][number]

export const NotificationsPopover = () => {
  const [show, setShow] = useState(false)
  const [showBadge, setShowBadge] = useState(false)

  const notifs = useNotifications()
  const markRead = useNotificationsMarkRead()

  const markLatest = () => {
    if (!notifs || !notifs.data || notifs.data.notifications.length === 0) {
      return
    }
    const first = notifs.data.notifications[0]
    markRead.mutate({ notification_id: first.id })
  }

  // Using onMouseDown to use the same event as "useOutsideClick"
  // That way useOutsideClick can cancel the event before clickBell triggers
  const clickBell = (e: React.MouseEvent) => {
    e.stopPropagation()
    e.preventDefault()

    if (!show && notifs.data) {
      setShow(true)
      markLatest()
    }

    if (show) {
      setShow(false)
    }
  }

  const [inNestedModal, setIsInNestedModal] = useState(false)

  const ref = useRef(null)

  useOutsideClick([ref], () => {
    if (inNestedModal) {
      return
    }
    setShow(false)
  })

  useEffect(() => {
    const haveNotifications =
      notifs.data && notifs.data.notifications.length > 0
    const noReadNotifications =
      haveNotifications && !notifs.data.last_read_notification_id
    const lastNotificationIsUnread =
      haveNotifications &&
      notifs.data.last_read_notification_id !== notifs.data.notifications[0].id

    const showBadge = !!(
      haveNotifications &&
      (noReadNotifications || lastNotificationIsUnread)
    )

    setShowBadge(showBadge)
  }, [notifs, notifs.data])

  return (
    <Popover>
      <Button
        className="relative h-8 w-8"
        variant="ghost"
        onMouseDown={clickBell}
        asChild
      >
        <PopoverTrigger>
          <BoltOutlined
            className="[&svg]:size-5!"
            fontSize="medium"
            aria-hidden="true"
          />
          {showBadge && (
            <div className="dark:border-polar-700 bg-blue absolute top-1 right-1 h-1.5 w-1.5 rounded-full" />
          )}
        </PopoverTrigger>
      </Button>
      <PopoverContent sideOffset={12} align="start">
        <List
          notifications={notifs.data?.notifications ?? []}
          setIsInNestedModal={setIsInNestedModal}
        />
      </PopoverContent>
    </Popover>
  )
}

export default Popover

export const List = ({
  notifications,
  setIsInNestedModal,
}: {
  notifications: NotificationSchema[]
  setIsInNestedModal: (_: boolean) => void
}) => {
  return (
    <div className="h-full max-h-[800px] space-y-5 overflow-x-scroll">
      {notifications.length === 0 && (
        <div className="dark:text-polar-400 flex w-full flex-row items-center justify-center p-4 text-center text-sm text-black/60">
          You don&apos;t have any notifications
        </div>
      )}
      {notifications.map((n) => {
        return (
          <Notification
            n={n}
            key={n.id}
            setIsInNestedModal={setIsInNestedModal}
          />
        )
      })}
    </div>
  )
}

const Item = ({
  children,
  n,
  iconClasses,
}: {
  iconClasses: string
  n: NotificationSchema
  children: { icon: React.ReactElement<any>; text: React.ReactElement<any> }
}) => {
  return (
    <div className="flex space-x-2.5 text-sm transition-colors duration-100">
      <Icon classes={twMerge('mt-1 p-1', iconClasses)} icon={children.icon} />
      <div>
        <div>{children.text}</div>
        <div className="dark:text-polar-300 text-gray-500">
          <PolarTimeAgo date={new Date(n.created_at)} />
        </div>
      </div>
    </div>
  )
}

const MaintainerNewPaidSubscription = ({
  n,
}: {
  n: schemas['MaintainerNewPaidSubscriptionNotification']
}) => {
  const { payload } = n
  return (
    <Item n={n} iconClasses="bg-green-200 text-green-500">
      {{
        text: (
          <>
            {payload.subscriber_name} is now subscribing to{' '}
            <InternalLink
              href={`/dashboard/${payload.tier_organization_name}/sales/subscriptions`}
            >
              <>{payload.tier_name}</>
            </InternalLink>{' '}
            {payload.tier_price_amount !== null && (
              <>
                (${getCentsInDollarString(payload.tier_price_amount)}/
                {payload.tier_price_recurring_interval})
              </>
            )}
          </>
        ),
        icon: <ShoppingBagOutlined fontSize="small" />,
      }}
    </Item>
  )
}

const MaintainerNewProductSale = ({
  n,
}: {
  n: schemas['MaintainerNewProductSaleNotification']
}) => {
  const { payload } = n
  return (
    <Item n={n} iconClasses="bg-green-200 text-green-500">
      {{
        text: (
          <>
            {payload.customer_name} just purchased{' '}
            <InternalLink
              href={`/dashboard/${payload.organization_name}/sales`}
            >
              <>{payload.product_name}</>
            </InternalLink>{' '}
            (${getCentsInDollarString(payload.product_price_amount)})
          </>
        ),
        icon: <ShoppingBagOutlined fontSize="small" />,
      }}
    </Item>
  )
}

const MaintainerCreateAccount = ({
  n,
}: {
  n: schemas['MaintainerCreateAccountNotification']
}) => {
  const { payload } = n
  return (
    <Item n={n} iconClasses="bg-yellow-200 text-yellow-500">
      {{
        text: (
          <>
            Create a{' '}
            <InternalLink href={payload.url}>
              <>payout account</>
            </InternalLink>{' '}
            now for {payload.organization_name} to receive funds.
          </>
        ),
        icon: <InfoOutlined fontSize="small" />,
      }}
    </Item>
  )
}

export const Notification = ({
  n,
}: {
  n: NotificationSchema
  setIsInNestedModal: (_: boolean) => void
}) => {
  switch (n.type) {
    case 'MaintainerNewPaidSubscriptionNotification':
      return <MaintainerNewPaidSubscription n={n} />

    case 'MaintainerNewProductSaleNotification':
      return <MaintainerNewProductSale n={n} />

    case 'MaintainerCreateAccountNotification':
      return <MaintainerCreateAccount n={n} />
  }
}

const InternalLink = (props: {
  href: string
  children: React.ReactElement<any>
}) => {
  return (
    <Link className="font-bold hover:underline" href={props.href}>
      {props.children}
    </Link>
  )
}
