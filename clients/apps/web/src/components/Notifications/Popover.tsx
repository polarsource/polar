import { NotificationsOutlined, VerifiedUser } from '@mui/icons-material'
import {
  MaintainerAccountReviewedNotification,
  MaintainerAccountUnderReviewNotification,
  MaintainerNewPaidSubscriptionNotification,
  MaintainerPledgeConfirmationPendingNotification,
  MaintainerPledgeCreatedNotification,
  MaintainerPledgePaidNotification,
  MaintainerPledgePendingNotification,
  MaintainerPledgedIssueConfirmationPendingNotification,
  MaintainerPledgedIssuePendingNotification,
  NotificationsInner,
  PledgerPledgePendingNotification,
  RewardPaidNotification,
  TeamAdminMemberPledgedNotification,
} from '@polar-sh/sdk'
import Link from 'next/link'
import { GitMergeIcon } from 'polarkit/components/icons'
import { Button, PolarTimeAgo } from 'polarkit/components/ui/atoms'
import {
  useGetPledge,
  useIssueMarkConfirmed,
  useListPledesForIssue,
  useNotifications,
  useNotificationsMarkRead,
} from 'polarkit/hooks'
import { getCentsInDollarString } from 'polarkit/money'
import { useOutsideClick } from 'polarkit/utils'
import { useEffect, useMemo, useRef, useState } from 'react'
import { twMerge } from 'tailwind-merge'
import SplitRewardModal from '../Finance/SplitRewardModal'
import DollarSignIcon from '../Icons/DollarSignIcon'
import Icon from '../Icons/Icon'
import { Modal } from '../Modal'
import { useModal } from '../Modal/useModal'

type NotificationSchema = NotificationsInner

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
  notifications: NotificationSchema[]
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
  n: NotificationSchema
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
}: {
  n: MaintainerPledgeCreatedNotification
}) => {
  const { payload } = n
  return (
    <Item
      n={n}
      iconClasses="bg-blue-200 text-blue-500 dark:bg-blue-500/80 dark:text-blue-200"
    >
      {{
        text: (
          <>
            New ${payload.pledge_amount} pledge behind{' '}
            <ExternalLink href={payload.issue_url}>
              <>
                {payload.issue_org_name}/{payload.issue_repo_name}#
                {payload.issue_number}
              </>
            </ExternalLink>
          </>
        ),
        icon: <DollarSignIcon />,
      }}
    </Item>
  )
}

const MaintainerPledgeConfirmationPendingWrapper = ({
  n,
  setIsInNestedModal,
}: {
  n: MaintainerPledgeConfirmationPendingNotification
  setIsInNestedModal: (_: boolean) => void
}) => {
  const { payload } = n
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
  setIsInNestedModal,
}: {
  n: MaintainerPledgedIssueConfirmationPendingNotification
  setIsInNestedModal: (_: boolean) => void
}) => {
  const { payload } = n
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
  canMarkSolved,
  isMarkedSolved,
  isLoading,
  onMarkSoved,
}: {
  n:
    | MaintainerPledgeConfirmationPendingNotification
    | MaintainerPledgedIssueConfirmationPendingNotification
  canMarkSolved: boolean
  isMarkedSolved: boolean
  isLoading: boolean
  onMarkSoved: () => Promise<void>
}) => {
  const { payload } = n
  return (
    <Item
      n={n}
      iconClasses="bg-blue-200 text-blue-500 dark:bg-blue-500/80 dark:text-blue-200"
    >
      {{
        text: (
          <div className="flex flex-col space-y-1">
            <div>
              Confirm that{' '}
              <ExternalLink href={payload.issue_url}>
                <>
                  {payload.issue_org_name}/{payload.issue_repo_name}#
                  {payload.issue_number}
                </>
              </ExternalLink>{' '}
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
}: {
  n: MaintainerPledgePendingNotification
}) => {
  const { payload } = n
  return (
    <Item
      n={n}
      iconClasses="bg-purple-200 text-[#6D27C6] dark:bg-purple-500/60 dark:text-purple-200"
    >
      {{
        text: (
          <>
            ${payload.pledge_amount} pending for completing{' '}
            <ExternalLink href={payload.issue_url}>
              <>
                {payload.issue_org_name}/{payload.issue_repo_name}#
                {payload.issue_number}
              </>
            </ExternalLink>
          </>
        ),
        icon: <GitMergeIcon />,
      }}
    </Item>
  )
}
const MaintainerPledgedIssuePending = ({
  n,
}: {
  n: MaintainerPledgedIssuePendingNotification
}) => {
  const { payload } = n
  return (
    <Item
      n={n}
      iconClasses="bg-purple-200 text-[#6D27C6] dark:bg-purple-500/60 dark:text-purple-200"
    >
      {{
        text: (
          <>
            ${payload.pledge_amount_sum} pending for completing{' '}
            <ExternalLink href={payload.issue_url}>
              <>
                {payload.issue_org_name}/{payload.issue_repo_name}#
                {payload.issue_number}
              </>
            </ExternalLink>
          </>
        ),
        icon: <GitMergeIcon />,
      }}
    </Item>
  )
}

const MaintainerPledgePaid = ({
  n,
}: {
  n: MaintainerPledgePaidNotification
}) => {
  const { payload } = n
  return (
    <Item
      n={n}
      iconClasses="bg-blue-200 text-blue-500 dark:bg-blue-500/80 dark:text-blue-200"
    >
      {{
        text: (
          <>
            ${payload.paid_out_amount} for{' '}
            <ExternalLink href={payload.issue_url}>
              <>
                {payload.issue_org_name}/{payload.issue_repo_name}#
                {payload.issue_number}
              </>
            </ExternalLink>{' '}
            has been transferred
          </>
        ),
        icon: <DollarSignIcon />,
      }}
    </Item>
  )
}

const RewardPaid = ({ n }: { n: RewardPaidNotification }) => {
  const { payload } = n
  return (
    <Item
      n={n}
      iconClasses="bg-blue-200 text-blue-500 dark:bg-blue-500/80 dark:text-blue-200"
    >
      {{
        text: (
          <>
            ${payload.paid_out_amount} for{' '}
            <ExternalLink href={payload.issue_url}>
              <>
                {payload.issue_org_name}/{payload.issue_repo_name}#
                {payload.issue_number}
              </>
            </ExternalLink>{' '}
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
}: {
  n: PledgerPledgePendingNotification
}) => {
  const { payload } = n
  return (
    <Item n={n} iconClasses="bg-blue-200 text-blue-500">
      {{
        text: (
          <>
            <ExternalLink href={payload.issue_url}>
              <>
                {payload.issue_org_name}/{payload.issue_repo_name}#
                {payload.issue_number}
              </>
            </ExternalLink>{' '}
            has been closed. Review it.
          </>
        ),
        icon: <DollarSignIcon />,
      }}
    </Item>
  )
}

const TeamAdminMemberPledged = ({
  n,
}: {
  n: TeamAdminMemberPledgedNotification
}) => {
  const { payload } = n
  return (
    <Item n={n} iconClasses="bg-blue-200 text-blue-500">
      {{
        text: (
          <>
            {payload.team_member_name} pledged ${payload.pledge_amount} towards{' '}
            <ExternalLink href={payload.issue_url}>
              <>
                {payload.issue_org_name}/{payload.issue_repo_name}#
                {payload.issue_number}
              </>
            </ExternalLink>{' '}
            on behalf of {payload.team_name}.
          </>
        ),
        icon: <DollarSignIcon />,
      }}
    </Item>
  )
}

const MaintainerAccountUnderReview = ({
  n,
}: {
  n: MaintainerAccountUnderReviewNotification
}) => {
  return (
    <Item n={n} iconClasses="bg-yellow-200 text-yellow-500">
      {{
        text: (
          <>
            Your{' '}
            <InternalLink href="/finance/account">
              <>payout account</>
            </InternalLink>{' '}
            is under review. Transfers are paused until we complete the review
            of your account.
          </>
        ),
        icon: <VerifiedUser />,
      }}
    </Item>
  )
}

const MaintainerAccountReviewed = ({
  n,
}: {
  n: MaintainerAccountReviewedNotification
}) => {
  const { payload } = n
  return (
    <Item n={n} iconClasses="bg-green-200 text-green-500">
      {{
        text: (
          <>
            Your{' '}
            <InternalLink href="/finance/account">
              <>payout account</>
            </InternalLink>{' '}
            has been reviewed successfully. Transfers are resumed.
          </>
        ),
        icon: <VerifiedUser />,
      }}
    </Item>
  )
}

const MaintainerNewPaidSubscription = ({
  n,
}: {
  n: MaintainerNewPaidSubscriptionNotification
}) => {
  const { payload } = n
  return (
    <Item n={n} iconClasses="bg-green-200 text-green-500">
      {{
        text: (
          <>
            {payload.subscriber_name} is now subscribing to{' '}
            <InternalLink
              href={`/maintainer/${payload.tier_organization_name}/subscriptions`}
            >
              <>{payload.tier_name}</>
            </InternalLink>{' '}
            (${getCentsInDollarString(payload.tier_price_amount)})
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
  n: NotificationSchema
  setIsInNestedModal: (_: boolean) => void
}) => {
  switch (n.type) {
    case 'MaintainerPledgeCreatedNotification':
      return <MaintainerPledgeCreated n={n} />

    case 'MaintainerPledgeConfirmationPendingNotification':
      return (
        <MaintainerPledgeConfirmationPendingWrapper
          n={n}
          setIsInNestedModal={setIsInNestedModal}
        />
      )

    case 'MaintainerPledgedIssueConfirmationPendingNotification':
      return (
        <MaintainerPledgedIssueConfirmationPendingWrapper
          n={n}
          setIsInNestedModal={setIsInNestedModal}
        />
      )

    case 'MaintainerPledgePendingNotification':
      return <MaintainerPledgePending n={n} />

    case 'MaintainerPledgedIssuePendingNotification':
      return <MaintainerPledgedIssuePending n={n} />

    case 'MaintainerPledgePaidNotification':
      return <MaintainerPledgePaid n={n} />

    case 'RewardPaidNotification':
      return <RewardPaid n={n} />

    case 'PledgerPledgePendingNotification':
      return <PledgerPledgePending n={n} />

    case 'TeamAdminMemberPledgedNotification':
      return <TeamAdminMemberPledged n={n} />

    case 'MaintainerAccountUnderReviewNotification':
      return <MaintainerAccountUnderReview n={n} />
    case 'MaintainerAccountReviewedNotification':
      return <MaintainerAccountReviewed n={n} />

    case 'MaintainerNewPaidSubscriptionNotification':
      return <MaintainerNewPaidSubscription n={n} />
  }
}

const ExternalLink = (props: {
  href: string
  children: React.ReactElement
}) => {
  return (
    <a
      className="font-bold hover:underline"
      href={props.href}
      target="_blank"
      rel="noopener noreferrer"
    >
      {props.children}
    </a>
  )
}

const InternalLink = (props: {
  href: string
  children: React.ReactElement
}) => {
  return (
    <Link className="font-bold hover:underline" href={props.href}>
      {props.children}
    </Link>
  )
}
