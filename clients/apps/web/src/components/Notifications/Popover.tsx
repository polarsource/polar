import { BellIcon } from '@heroicons/react/24/outline'
import {
  IssuePledgeCreated,
  IssuePledgedBranchCreated,
  IssuePledgedPullRequestCreated,
  IssuePledgedPullRequestMerged,
  MaintainerIssueBranchCreated,
  MaintainerIssuePullRequestCreated,
  MaintainerIssuePullRequestMerged,
  NotificationRead,
} from 'polarkit/api/client'
import { useNotifications, useNotificationsMarkRead } from 'polarkit/hooks'
import { useOutsideClick } from 'polarkit/utils'
import { useEffect, useRef, useState } from 'react'
import ReactTimeago from 'react-timeago'

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

  const clickBell = () => {
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

    const showBadge =
      haveNotifications && (noReadNotifications || lastNotificationIsUnread)

    setShowBadge(showBadge)
  }, [notifs, notifs.data])

  return (
    <>
      <div className="flex">
        <BellIcon
          className="h-6 w-6 cursor-pointer text-gray-500 transition-colors duration-100 hover:text-gray-900"
          aria-hidden="true"
          onClick={clickBell}
        />
        {showBadge && (
          <div className="-ml-3 h-3 w-3 rounded-full border-2 border-white bg-blue-500"></div>
        )}
      </div>

      <div
        aria-live="assertive"
        className="pointer-events-none fixed inset-0 top-6 flex items-end px-4 py-6 sm:items-start sm:p-6"
        ref={ref}
        onClick={(e) => {
          e.stopPropagation()
        }}
      >
        <div className="flex w-full flex-col items-center space-y-4 sm:items-end">
          {show && (
            <>
              <div className="z-10 mr-8 -mb-7 h-6 w-6 rotate-45 border-t-[1px] border-l-[1px] border-black/5 bg-white"></div>
              <div className="z-20 w-full max-w-md">
                <div className="pointer-events-auto w-full  overflow-hidden rounded-lg bg-white shadow-lg ring-1 ring-black ring-opacity-5">
                  {notifs.data.notifications.length === 0 && (
                    <div className="p-4 text-black/60">
                      You don&apos;t have any notifications... yet!
                    </div>
                  )}
                  {notifs.data.notifications.map((n) => {
                    return <Notification n={n} key={n.id} />
                  })}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  )
}

export default Popover

const Item = ({
  title,
  children,
  n,
  iconBg,
}: {
  title: string
  iconBg: string
  n: NotificationRead
  children: React.ReactElement
}) => {
  return (
    <a
      className=" flex space-x-4 p-4 transition-colors duration-100 hover:bg-gray-100"
      href={n.payload.issue_url}
    >
      <div
        className={`inline-flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md ${iconBg}`}
      >
        {children}
      </div>
      <div>
        <div className="font-medium">{title}</div>
        <div className="text-black/50">
          <ReactTimeago date={n.created_at} />
        </div>
      </div>
    </a>
  )
}
const IssuePledgeCreated = ({
  n,
  payload,
}: {
  n: NotificationRead
  payload: IssuePledgeCreated
}) => {
  const title = `Issue #${payload.issue_number} received \$${payload.pledge_amount} in backing`
  return (
    <Item title={title} n={n} iconBg="bg-[#F9E18F]">
      <DollarSignIcon />
    </Item>
  )
}

const PullRequestCreatedNotification = ({
  n,
  payload,
}: {
  n: NotificationRead
  payload: IssuePledgedPullRequestCreated | MaintainerIssuePullRequestCreated
}) => {
  const title = `${payload.pull_request_creator_username} created a PR for issue #${payload.pull_request_number}`
  return (
    <Item title={title} n={n} iconBg="bg-[#DFEFE4]">
      <PullRequestCreatedIcon />
    </Item>
  )
}

const PullRequestMergedNotification = ({
  n,
  payload,
}: {
  n: NotificationRead
  payload: IssuePledgedPullRequestMerged | MaintainerIssuePullRequestMerged
}) => {
  const title = `${payload.pull_request_creator_username} merged a PR for issue #${payload.issue_number}`
  return (
    <Item title={title} n={n} iconBg="bg-[#E8DEFC]">
      <PullRequestMergedIcon />
    </Item>
  )
}

const BranchCreatedNotification = ({
  n,
  payload,
}: {
  n: NotificationRead
  payload: IssuePledgedBranchCreated | MaintainerIssueBranchCreated
}) => {
  const title = `${payload.branch_creator_username} started working on issue #${payload.issue_number}`
  return (
    <Item title={title} n={n} iconBg="bg-[#ECECEC]">
      <BranchCreatedIcon />
    </Item>
  )
}

const Notification = ({ n }: { n: NotificationRead }) => {
  if (n.type === 'issue_pledge_created') {
    return (
      <IssuePledgeCreated n={n} payload={n.payload as IssuePledgeCreated} />
    )
  }

  if (n.type === 'issue_pledged_branch_created') {
    return (
      <BranchCreatedNotification
        n={n}
        payload={n.payload as IssuePledgedBranchCreated}
      />
    )
  }
  if (n.type === 'issue_pledged_pull_request_created') {
    return (
      <PullRequestCreatedNotification
        n={n}
        payload={n.payload as IssuePledgedPullRequestCreated}
      />
    )
  }
  if (n.type === 'issue_pledged_pull_request_merged') {
    return (
      <PullRequestMergedNotification
        n={n}
        payload={n.payload as IssuePledgedPullRequestMerged}
      />
    )
  }
  if (n.type === 'maintainer_issue_branch_created') {
    return (
      <BranchCreatedNotification
        n={n}
        payload={n.payload as MaintainerIssueBranchCreated}
      />
    )
  }

  if (n.type === 'maintainer_issue_pull_request_created') {
    return (
      <PullRequestCreatedNotification
        n={n}
        payload={n.payload as MaintainerIssuePullRequestCreated}
      />
    )
  }

  if (n.type === 'maintainer_issue_pull_request_merged') {
    return (
      <PullRequestMergedNotification
        n={n}
        payload={n.payload as MaintainerIssuePullRequestMerged}
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
          stroke="#8F6700"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M12.75 3.75H7.125C6.42881 3.75 5.76113 4.02656 5.26884 4.51884C4.77656 5.01113 4.5 5.67881 4.5 6.375C4.5 7.07119 4.77656 7.73887 5.26884 8.23116C5.76113 8.72344 6.42881 9 7.125 9H10.875C11.5712 9 12.2389 9.27656 12.7312 9.76885C13.2234 10.2611 13.5 10.9288 13.5 11.625C13.5 12.3212 13.2234 12.9889 12.7312 13.4812C12.2389 13.9734 11.5712 14.25 10.875 14.25H4.5"
          stroke="#8F6700"
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
