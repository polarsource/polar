import { NotificationsOutlined } from '@mui/icons-material'
import {
  MaintainerPledgeConfirmationPendingNotification,
  MaintainerPledgeCreatedNotification,
  MaintainerPledgePaidNotification,
  MaintainerPledgePendingNotification,
  MaintainerPledgedIssueConfirmationPendingNotification,
  MaintainerPledgedIssuePendingNotification,
  NotificationRead,
  NotificationType,
  PledgerPledgePendingNotification,
  RewardPaidNotification,
} from '@polar-sh/sdk'
import { GitMergeIcon } from 'polarkit/components/icons'
import { Button, PolarTimeAgo } from 'polarkit/components/ui/atoms'
import {
  useGetPledge,
  useIssueMarkConfirmed,
  useListPledesForIssue,
  useNotifications,
  useNotificationsMarkRead,
} from 'polarkit/hooks'
import { useOutsideClick } from 'polarkit/utils'
import { useEffect, useMemo, useRef, useState } from 'react'
import { twMerge } from 'tailwind-merge'
import SplitRewardModal from '../Finance/SplitRewardModal'
import DollarSignIcon from '../Icons/DollarSignIcon'
import Icon from '../Icons/Icon'
import { Modal } from '../Modal'
import { useModal } from '../Modal/useModal'

const Popover = ({ type = 'topbar' }: { type?: 'topbar' | 'dashboard' }) => {
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

  const notificationsContainerClassnames = twMerge(
    'pointer-events-none fixed z-40 flex items-end',
    type === 'topbar' ? 'right-5 top-20' : 'right-4 top-12 left-2',
  )

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
    <>
      <div className="flex">
        <NotificationsOutlined
          className="dark:text-polar-500 dark:hover:text-polar-300 h-5 w-5 cursor-pointer text-gray-500 transition-colors duration-100 hover:text-gray-900"
          aria-hidden="true"
          onMouseDown={clickBell}
        />
        {showBadge && (
          <div className="dark:border-polar-700 -ml-3 h-3 w-3 rounded-full border-2 border-white bg-blue-500"></div>
        )}
      </div>

      {show && notifs.data && (
        <div
          aria-live="assertive"
          className={notificationsContainerClassnames}
          ref={ref}
          onClick={(e) => {
            e.preventDefault()
            e.stopPropagation()
          }}
        >
          <List
            notifications={notifs.data.notifications}
            setIsInNestedModal={setIsInNestedModal}
          />
        </div>
      )}
    </>
  )
}

export default Popover

export const List = ({
  notifications,
  setIsInNestedModal,
}: {
  notifications: NotificationRead[]
  setIsInNestedModal: (_: boolean) => void
}) => {
  return (
    <div className="flex w-full flex-col items-center space-y-4 sm:items-end">
      <>
        {/*<div className="z-10 mr-8 -mb-7 h-6 w-6 rotate-45 border-t-[1px] border-l-[1px] border-black/5 bg-white dark:bg-polar-700"></div>*/}
        <div className="z-20 h-full w-full max-w-md ">
          <div className="dark:bg-polar-700 pointer-events-auto w-full rounded-2xl bg-white shadow-lg">
            <div className="h-full max-h-[800px] space-y-5 overflow-x-scroll p-5">
              {notifications.length === 0 && (
                <div className="dark:text-polar-400 flex w-full flex-row items-center justify-center p-4 text-center text-sm text-black/60">
                  You don&apos;t have any notifications... yet!
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
  setIsInNestedModal,
}: {
  n: NotificationRead
  payload: MaintainerPledgeConfirmationPendingNotification
  setIsInNestedModal: (_: boolean) => void
}) => {
  const pledge = useGetPledge(payload.pledge_id)

  const { isShown, hide: hideModal, show: showModal } = useModal()

  const canMarkSolved = useMemo(() => {
    return pledge.data?.issue.needs_confirmation_solved === true
  }, [pledge])

  const isMarkedSolved = useMemo(() => {
    return pledge.data?.issue.confirmed_solved_at !== undefined
  }, [pledge])

  const markSolved = useIssueMarkConfirmed()

  const close = () => {
    setIsInNestedModal(false)
    hideModal()
  }

  const onMarkSolved = async () => {
    setIsInNestedModal(true)
    showModal()
  }

  return (
    <>
      <MaintainerPledgeConfirmationPending
        n={n}
        payload={payload}
        canMarkSolved={canMarkSolved}
        isMarkedSolved={isMarkedSolved}
        isLoading={markSolved.isPending}
        onMarkSoved={onMarkSolved}
      />
      <Modal
        isShown={isShown}
        hide={close}
        modalContent={
          <>
            {pledge.data?.issue.id && (
              <SplitRewardModal
                issueId={pledge.data.issue.id}
                onClose={close}
              />
            )}
          </>
        }
      />
    </>
  )
}

const MaintainerPledgedIssueConfirmationPendingWrapper = ({
  n,
  payload,
  setIsInNestedModal,
}: {
  n: NotificationRead
  payload: MaintainerPledgedIssueConfirmationPendingNotification
  setIsInNestedModal: (_: boolean) => void
}) => {
  const pledges = useListPledesForIssue(payload.issue_id)

  const { isShown, hide: hideModal, show: showModal } = useModal()

  const canMarkSolved = useMemo(() => {
    if (
      pledges?.data?.items &&
      pledges.data.items.some((p) => p.issue.needs_confirmation_solved)
    ) {
      return true
    }

    return false
  }, [pledges])

  const isMarkedSolved = useMemo(() => {
    if (
      !canMarkSolved &&
      pledges?.data?.items &&
      pledges.data.items.some((p) => p.issue.confirmed_solved_at)
    ) {
      return true
    }

    return false
  }, [canMarkSolved, pledges])

  const markSolved = useIssueMarkConfirmed()

  const close = () => {
    setIsInNestedModal(false)
    hideModal()
  }

  const onMarkSolved = async () => {
    setIsInNestedModal(true)
    showModal()
  }

  return (
    <>
      <MaintainerPledgeConfirmationPending
        n={n}
        payload={payload}
        canMarkSolved={canMarkSolved}
        isMarkedSolved={isMarkedSolved}
        isLoading={markSolved.isPending}
        onMarkSoved={onMarkSolved}
      />
      <Modal
        isShown={isShown}
        hide={close}
        modalContent={
          <SplitRewardModal issueId={payload.issue_id} onClose={close} />
        }
      />
    </>
  )
}

export const MaintainerPledgeConfirmationPending = ({
  n,
  payload,
  canMarkSolved,
  isMarkedSolved,
  isLoading,
  onMarkSoved,
}: {
  n: NotificationRead
  payload:
    | MaintainerPledgeConfirmationPendingNotification
    | MaintainerPledgedIssueConfirmationPendingNotification
  canMarkSolved: boolean
  isMarkedSolved: boolean
  isLoading: boolean
  onMarkSoved: () => Promise<void>
}) => {
  return (
    <Item
      n={n}
      iconClasses="bg-blue-200 text-blue-600 dark:bg-blue-600/80 dark:text-blue-200"
    >
      {{
        text: (
          <div className="flex flex-col space-y-1">
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
                <Button
                  fullWidth={false}
                  size="sm"
                  loading={isLoading}
                  disabled={isLoading}
                  onClick={onMarkSoved}
                >
                  <span>Mark as solved</span>
                </Button>
              )}
              {isMarkedSolved && (
                <div className="font-medium text-green-600">
                  Marked as solved
                </div>
              )}
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
const MaintainerPledgedIssuePending = ({
  n,
  payload,
}: {
  n: NotificationRead
  payload: MaintainerPledgedIssuePendingNotification
}) => {
  return (
    <Item
      n={n}
      iconClasses="bg-purple-200 text-[#6D27C6] dark:bg-purple-500/60 dark:text-purple-200"
    >
      {{
        text: (
          <>
            ${payload.pledge_amount_sum} pending for completing{' '}
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

const RewardPaid = ({
  n,
  payload,
}: {
  n: NotificationRead
  payload: RewardPaidNotification
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
            has paid out
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

export const Notification = ({
  n,
  setIsInNestedModal,
}: {
  n: NotificationRead
  setIsInNestedModal: (_: boolean) => void
}) => {
  switch (n.type) {
    case NotificationType.MAINTAINER_PLEDGE_CREATED_NOTIFICATION:
      if (n.maintainer_pledge_created) {
        return (
          <MaintainerPledgeCreated
            n={n}
            payload={n.maintainer_pledge_created}
          />
        )
      }

    case NotificationType.MAINTAINER_PLEDGE_CONFIRMATION_PENDING_NOTIFICATION:
      if (n.maintainer_pledge_confirmation_pending) {
        return (
          <MaintainerPledgeConfirmationPendingWrapper
            n={n}
            payload={n.maintainer_pledge_confirmation_pending}
            setIsInNestedModal={setIsInNestedModal}
          />
        )
      }

    case NotificationType.MAINTAINER_PLEDGED_ISSUE_CONFIRMATION_PENDING_NOTIFICATION:
      if (n.maintainer_pledged_issue_confirmation_pending) {
        return (
          <MaintainerPledgedIssueConfirmationPendingWrapper
            n={n}
            payload={n.maintainer_pledged_issue_confirmation_pending}
            setIsInNestedModal={setIsInNestedModal}
          />
        )
      }

    case NotificationType.MAINTAINER_PLEDGE_PENDING_NOTIFICATION:
      if (n.maintainer_pledge_pending) {
        return (
          <MaintainerPledgePending
            n={n}
            payload={n.maintainer_pledge_pending}
          />
        )
      }

    case NotificationType.MAINTAINER_PLEDGED_ISSUE_PENDING_NOTIFICATION:
      if (n.maintainer_pledged_issue_pending) {
        return (
          <MaintainerPledgedIssuePending
            n={n}
            payload={n.maintainer_pledged_issue_pending}
          />
        )
      }

    case NotificationType.MAINTAINER_PLEDGE_PAID_NOTIFICATION:
      if (n.maintainer_pledge_paid) {
        return <MaintainerPledgePaid n={n} payload={n.maintainer_pledge_paid} />
      }
    case NotificationType.REWARD_PAID_NOTIFICATION:
      if (n.reward_paid) {
        return <RewardPaid n={n} payload={n.reward_paid} />
      }
    case NotificationType.PLEDGER_PLEDGE_PENDING_NOTIFICATION:
      if (n.pledger_pledge_pending) {
        return <PledgerPledgePending n={n} payload={n.pledger_pledge_pending} />
      }
  }

  return <></>
}

const PullRequestCreatedIcon = () => {
  return (
    <svg viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
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
    <svg viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
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
    <svg viewBox="0 0 18 19" fill="none" xmlns="http://www.w3.org/2000/svg">
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
