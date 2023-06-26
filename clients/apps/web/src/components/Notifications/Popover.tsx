import { BellIcon } from '@heroicons/react/24/outline'
import {
  MaintainerPledgeConfirmationPendingNotification,
  MaintainerPledgeCreatedNotification,
  MaintainerPledgePaidNotification,
  MaintainerPledgePendingNotification,
  NotificationRead,
  NotificationType,
  Platforms,
  PledgeState,
  PledgerPledgePendingNotification,
} from 'polarkit/api/client'
import { GitMergeIcon } from 'polarkit/components/icons'
import { PolarTimeAgo, PrimaryButton } from 'polarkit/components/ui'
import {
  useGetPledge,
  useNotifications,
  useNotificationsMarkRead,
} from 'polarkit/hooks'
import { useOutsideClick } from 'polarkit/utils'
import { useEffect, useMemo, useRef, useState } from 'react'

const Popover = () => {
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

  const ref = useRef(null)

  useOutsideClick([ref], () => {
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
    <>
      <div className="flex">
        <BellIcon
          className="h-6 w-6 cursor-pointer text-gray-500 transition-colors duration-100 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-200"
          aria-hidden="true"
          onMouseDown={clickBell}
        />
        {showBadge && (
          <div className="-ml-3 h-3 w-3 rounded-full border-2 border-white bg-blue-500 dark:border-gray-800"></div>
        )}
      </div>

      {show && notifs.data && (
        <div
          aria-live="assertive"
          className="pointer-events-none fixed top-12 right-6 flex items-end"
          ref={ref}
          onClick={(e) => {
            e.preventDefault()
            e.stopPropagation()
          }}
        >
          <List notifications={notifs.data.notifications} />
        </div>
      )}
    </>
  )
}

export default Popover

export const List = ({
  notifications,
}: {
  notifications: NotificationRead[]
}) => {
  return (
    <div className="flex w-full flex-col items-center space-y-4 sm:items-end">
      <>
        <div className="z-10 mr-8 -mb-7 h-6 w-6 rotate-45 border-t-[1px] border-l-[1px] border-black/5 bg-white dark:bg-gray-700"></div>
        <div className="z-20 h-full w-full max-w-md ">
          <div className="pointer-events-auto w-full rounded-xl bg-white shadow-lg ring-1 ring-black ring-opacity-5 dark:bg-gray-700 dark:ring-gray-600">
            <div className="h-full max-h-[800px] space-y-5 overflow-x-scroll p-5">
              {notifications.length === 0 && (
                <div className="p-4 text-black/60 dark:text-white/60">
                  You don&apos;t have any notifications... yet!
                </div>
              )}
              {notifications.map((n) => {
                return <Notification n={n} key={n.id} />
              })}
            </div>
          </div>
        </div>
      </>
    </div>
  )
}

const Item = ({
  children,
  n,
  iconClasses,
}: {
  iconClasses: string
  n: NotificationRead
  children: { icon: React.ReactElement; text: React.ReactElement }
}) => {
  return (
    <div className="flex space-x-2.5 text-sm transition-colors duration-100">
      <div
        className={`mt-1 inline-flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg ${iconClasses}`}
      >
        {children.icon}
      </div>
      <div>
        <div>{children.text}</div>
        <div className="text-gray-500 dark:text-gray-400/75">
          <PolarTimeAgo date={new Date(n.created_at)} />
        </div>
      </div>
    </div>
  )
}

const MaintainerPledgeCreated = ({
  n,
  payload,
}: {
  n: NotificationRead
  payload: MaintainerPledgeCreatedNotification
}) => {
  return (
    <Item
      n={n}
      iconClasses="bg-blue-200 text-blue-600 dark:bg-blue-600/80 dark:text-blue-200"
    >
      {{
        text: (
          <>
            New ${payload.pledge_amount} pledge behind{' '}
            <Link href={payload.issue_url}>
              <>
                {payload.issue_org_name}/{payload.issue_repo_name}#
                {payload.issue_number}
              </>
            </Link>
          </>
        ),
        icon: <DollarSignIcon />,
      }}
    </Item>
  )
}

const MaintainerPledgeConfirmationPendingWrapper = ({
  n,
  payload,
}: {
  n: NotificationRead
  payload: MaintainerPledgeConfirmationPendingNotification
}) => {
  const pledge = useGetPledge(
    Platforms.GITHUB,
    payload.issue_org_name,
    payload.issue_repo_name,
    payload.issue_number,
    payload.pledge_id,
  )

  const canMarkSolved = useMemo(() => {
    return pledge.data?.state === PledgeState.CONFIRMATION_PENDING
  }, [pledge])
  const isMarkedSolved = useMemo(() => {
    return pledge.data?.state === PledgeState.PENDING
  }, [pledge])

  return (
    <MaintainerPledgeConfirmationPending
      n={n}
      payload={payload}
      canMarkSolved={canMarkSolved}
      isMarkedSolved={isMarkedSolved}
    />
  )
}

const MaintainerPledgeConfirmationPending = ({
  n,
  payload,
  canMarkSolved,
  isMarkedSolved,
}: {
  n: NotificationRead
  payload: MaintainerPledgeConfirmationPendingNotification
  canMarkSolved: boolean
  isMarkedSolved: boolean
}) => {
  return (
    <Item
      n={n}
      iconClasses="bg-blue-200 text-blue-600 dark:bg-blue-600/80 dark:text-blue-200"
    >
      {{
        text: (
          <div className="flex flex-col space-y-2">
            <div>
              Confirm that{' '}
              <Link href={payload.issue_url}>
                <>
                  {payload.issue_org_name}/{payload.issue_repo_name}#
                  {payload.issue_number}
                </>
              </Link>{' '}
              has been solved.
            </div>
            <div>
              {canMarkSolved && (
                <PrimaryButton fullWidth={false}>
                  <span>Mark as solved</span>
                </PrimaryButton>
              )}
              {isMarkedSolved && <>Confirmed!</>}
            </div>
          </div>
        ),
        icon: <DollarSignIcon />,
      }}
    </Item>
  )
}

const MaintainerPledgePending = ({
  n,
  payload,
}: {
  n: NotificationRead
  payload: MaintainerPledgePendingNotification
}) => {
  return (
    <Item
      n={n}
      iconClasses="bg-purple-200 text-[#6D27C6] dark:bg-purple-500/60 dark:text-purple-200"
    >
      {{
        text: (
          <>
            ${payload.pledge_amount} pending for completing{' '}
            <Link href={payload.issue_url}>
              <>
                {payload.issue_org_name}/{payload.issue_repo_name}#
                {payload.issue_number}
              </>
            </Link>
          </>
        ),
        icon: <GitMergeIcon />,
      }}
    </Item>
  )
}

const MaintainerPledgePaid = ({
  n,
  payload,
}: {
  n: NotificationRead
  payload: MaintainerPledgePaidNotification
}) => {
  return (
    <Item
      n={n}
      iconClasses="bg-blue-200 text-blue-600 dark:bg-blue-600/80 dark:text-blue-200"
    >
      {{
        text: (
          <>
            ${payload.paid_out_amount} for{' '}
            <Link href={payload.issue_url}>
              <>
                {payload.issue_org_name}/{payload.issue_repo_name}#
                {payload.issue_number}
              </>
            </Link>{' '}
            has been transferred
          </>
        ),
        icon: <DollarSignIcon />,
      }}
    </Item>
  )
}

const PledgerPledgePending = ({
  n,
  payload,
}: {
  n: NotificationRead
  payload: PledgerPledgePendingNotification
}) => {
  return (
    <Item n={n} iconClasses="bg-blue-200 text-blue-600">
      {{
        text: (
          <>
            <Link href={payload.issue_url}>
              <>
                {payload.issue_org_name}/{payload.issue_repo_name}#
                {payload.issue_number}
              </>
            </Link>{' '}
            has been closed. Review it.
          </>
        ),
        icon: <DollarSignIcon />,
      }}
    </Item>
  )
}

export const Notification = ({ n }: { n: NotificationRead }) => {
  switch (n.type) {
    case NotificationType.MAINTAINER_PLEDGE_CREATED_NOTIFICATION:
      return (
        <MaintainerPledgeCreated
          n={n}
          payload={n.payload as MaintainerPledgeCreatedNotification}
        />
      )

    case NotificationType.MAINTAINER_PLEDGE_CONFIRMATION_PENDING_NOTIFICATION:
      return (
        <MaintainerPledgeConfirmationPendingWrapper
          n={n}
          payload={n.payload as MaintainerPledgeConfirmationPendingNotification}
        />
      )
    case NotificationType.MAINTAINER_PLEDGE_PENDING_NOTIFICATION:
      return (
        <MaintainerPledgePending
          n={n}
          payload={n.payload as MaintainerPledgePendingNotification}
        />
      )
    case NotificationType.MAINTAINER_PLEDGE_PAID_NOTIFICATION:
      return (
        <MaintainerPledgePaid
          n={n}
          payload={n.payload as MaintainerPledgePaidNotification}
        />
      )
    case NotificationType.PLEDGER_PLEDGE_PENDING_NOTIFICATION:
      return (
        <PledgerPledgePending
          n={n}
          payload={n.payload as PledgerPledgePendingNotification}
        />
      )
  }

  return <></>
}

const DollarSignIcon = () => {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 18 18"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <g opacity="0.8">
        <path
          d="M9 0.75V17.25"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M12.75 3.75H7.125C6.42881 3.75 5.76113 4.02656 5.26884 4.51884C4.77656 5.01113 4.5 5.67881 4.5 6.375C4.5 7.07119 4.77656 7.73887 5.26884 8.23116C5.76113 8.72344 6.42881 9 7.125 9H10.875C11.5712 9 12.2389 9.27656 12.7312 9.76885C13.2234 10.2611 13.5 10.9288 13.5 11.625C13.5 12.3212 13.2234 12.9889 12.7312 13.4812C12.2389 13.9734 11.5712 14.25 10.875 14.25H4.5"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </g>
    </svg>
  )
}

const PullRequestCreatedIcon = () => {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 18 18"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M13.5 15.75C14.7426 15.75 15.75 14.7426 15.75 13.5C15.75 12.2574 14.7426 11.25 13.5 11.25C12.2574 11.25 11.25 12.2574 11.25 13.5C11.25 14.7426 12.2574 15.75 13.5 15.75Z"
        stroke="#24A065"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M4.5 6.75C5.74264 6.75 6.75 5.74264 6.75 4.5C6.75 3.25736 5.74264 2.25 4.5 2.25C3.25736 2.25 2.25 3.25736 2.25 4.5C2.25 5.74264 3.25736 6.75 4.5 6.75Z"
        stroke="#24A065"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M9.75 4.5H12C12.3978 4.5 12.7794 4.65804 13.0607 4.93934C13.342 5.22064 13.5 5.60218 13.5 6V11.25"
        stroke="#24A065"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M4.5 6.75V15.75"
        stroke="#24A065"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

const PullRequestMergedIcon = () => {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 18 18"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M13.5 15.75C14.7426 15.75 15.75 14.7426 15.75 13.5C15.75 12.2574 14.7426 11.25 13.5 11.25C12.2574 11.25 11.25 12.2574 11.25 13.5C11.25 14.7426 12.2574 15.75 13.5 15.75Z"
        stroke="#633EB7"
        strokeOpacity="0.8"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M4.5 6.75C5.74264 6.75 6.75 5.74264 6.75 4.5C6.75 3.25736 5.74264 2.25 4.5 2.25C3.25736 2.25 2.25 3.25736 2.25 4.5C2.25 5.74264 3.25736 6.75 4.5 6.75Z"
        stroke="#633EB7"
        strokeOpacity="0.8"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M4.5 15.75V6.75C4.5 8.54021 5.21116 10.2571 6.47703 11.523C7.7429 12.7888 9.45979 13.5 11.25 13.5"
        stroke="#633EB7"
        strokeOpacity="0.8"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

const BranchCreatedIcon = () => {
  return (
    <svg
      width="18"
      height="19"
      viewBox="0 0 18 19"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <g opacity="0.58">
        <path
          d="M4.5 2.5V11.5"
          stroke="#232323"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M13.5 7C14.7426 7 15.75 5.99264 15.75 4.75C15.75 3.50736 14.7426 2.5 13.5 2.5C12.2574 2.5 11.25 3.50736 11.25 4.75C11.25 5.99264 12.2574 7 13.5 7Z"
          stroke="#232323"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M4.5 16C5.74264 16 6.75 14.9926 6.75 13.75C6.75 12.5074 5.74264 11.5 4.5 11.5C3.25736 11.5 2.25 12.5074 2.25 13.75C2.25 14.9926 3.25736 16 4.5 16Z"
          stroke="#232323"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M13.5 7C13.5 8.79021 12.7888 10.5071 11.523 11.773C10.2571 13.0388 8.54021 13.75 6.75 13.75"
          stroke="#232323"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </g>
    </svg>
  )
}

const Link = (props: { href: string; children: React.ReactElement }) => {
  return (
    <a className="font-bold hover:underline" href={props.href}>
      {props.children}
    </a>
  )
}
