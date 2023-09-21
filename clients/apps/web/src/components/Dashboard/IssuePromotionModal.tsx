import { useRequireAuth } from '@/hooks'
import {
  GiftIcon,
  HeartIcon,
  MegaphoneIcon,
  UserIcon,
} from '@heroicons/react/24/outline'
import Image from 'next/image'
import {
  CurrencyAmount,
  IssueDashboardRead,
  Label,
  Organization,
  Repository,
  UserRead,
} from 'polarkit/api/client'
import { PrimaryButton } from 'polarkit/components/ui'
import {
  useBadgeWithComment,
  useIssueAddComment,
  useIssueAddPolarBadge,
  useIssueRemovePolarBadge,
  useOrganizationBadgeSettings,
  useUpdateIssue,
} from 'polarkit/hooks'
import { classNames } from 'polarkit/utils'
import { posthog } from 'posthog-js'
import { ChangeEvent, useMemo, useState } from 'react'
import { twMerge } from 'tailwind-merge'
import CopyToClipboardInput from '../../../../../packages/polarkit/src/components/ui/atoms/CopyToClipboardInput'
import { ModalHeader, Modal as ModernModal } from '../Modal'
import { useModal } from '../Modal/useModal'
import { Switch } from '../ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs'
import BadgeMessageForm from './BadgeMessageForm'

const isIssueBadged = (issue: IssueDashboardRead): boolean => {
  if (issue.pledge_badge_currently_embedded) {
    return true
  }

  const hasPolarLabel =
    issue.labels &&
    (issue.labels as Array<Label>).find((l) => l.name.toLowerCase() === 'polar')

  return hasPolarLabel
}

export const AddBadgeButton = (props: {
  org: Organization
  repo: Repository
  issue: IssueDashboardRead
}) => {
  const [isBadged, setBadged] = useState<boolean>(isIssueBadged(props.issue))

  const remove = useIssueRemovePolarBadge()
  const add = useIssueAddPolarBadge()

  const { isShown, toggle } = useModal()

  const click = async () => {
    if (isBadged) {
      toggle()
      return
    }

    await add
      .mutateAsync({
        id: props.issue.id,
      })
      .then(() => {
        setBadged(true)
        toggle()
      })

    posthog.capture('add-issue-badge', {
      organization_name: props.org.name,
      repository_name: props.repo.name,
      issue_number: props.issue.number,
    })
  }

  const onRemoveBadge = async () => {
    await remove
      .mutateAsync({
        id: props.issue.id,
      })
      .then(() => {
        setBadged(false)
      })

    posthog.capture('remove-issue-badge', {
      organization_name: props.org.name,
      repository_name: props.repo.name,
      issue_number: props.issue.number,
    })
  }

  const addComment = useIssueAddComment()

  const onAddComment = async (message: string) => {
    await addComment.mutateAsync({
      id: props.issue.id,
      body: {
        message: message,
        append_badge: true,
      },
    })
  }

  const badgeWithComment = useBadgeWithComment()

  const onBadgeWithComment = async (message: string) => {
    await badgeWithComment.mutateAsync({
      id: props.issue.id,
      body: {
        message: message,
      },
    })

    posthog.capture('badge-with-comment', {
      organization_name: props.org.name,
      repository_name: props.repo.name,
      issue_number: props.issue.number,
    })
  }

  const updateIssue = useUpdateIssue()

  const onUpdateFundingGoal = async (amount: CurrencyAmount) => {
    await updateIssue.mutateAsync({
      id: props.issue.id,
      funding_goal: amount,
    })

    posthog.capture('set-issue-funding-goal', {
      organization_name: props.org.name,
      repository_name: props.repo.name,
      issue_number: props.issue.number,
    })
  }

  const { currentUser } = useRequireAuth()

  if (!currentUser) {
    return <></>
  }

  return (
    <>
      <button
        onClick={click}
        className={classNames(
          isBadged ? 'bg-white dark:bg-gray-800' : '',
          isBadged
            ? 'border-green-200 text-green-600 hover:border-green-300 dark:border-green-600'
            : 'border-blue-200 bg-white text-blue-600 transition ease-in-out hover:border-blue-600 hover:bg-blue-600 hover:text-white dark:border-gray-600 dark:bg-transparent dark:text-gray-400 dark:hover:border-blue-600 dark:hover:bg-blue-600 dark:hover:text-white',
          'cursor-pointer items-center justify-center space-x-1 rounded-md border px-2 py-1 text-sm',
          'flex overflow-hidden whitespace-nowrap',
        )}
      >
        {isBadged && (
          <>
            <BadgedCheckmarkIcon />
            <span>Badged</span>
          </>
        )}
        {!isBadged && (
          <>
            <span>Add badge</span>
          </>
        )}
      </button>

      <ModernModal
        isShown={isShown}
        hide={toggle}
        modalContent={
          <BadgePromotionModal
            org={props.org}
            repo={props.repo}
            issue={props.issue}
            isShown={isShown}
            toggle={toggle}
            onRemoveBadge={onRemoveBadge}
            user={currentUser}
            onAddComment={onAddComment}
            onBadgeWithComment={onBadgeWithComment}
            onUpdateFundingGoal={onUpdateFundingGoal}
          />
        }
      />
    </>
  )
}

export const BadgePromotionModal = (props: {
  org: Organization
  repo: Repository
  issue: IssueDashboardRead
  isShown: boolean
  toggle: () => void
  onRemoveBadge: () => Promise<void>
  user: UserRead
  onAddComment: (message: string) => Promise<void>
  onBadgeWithComment: (comment: string) => Promise<void>
  onUpdateFundingGoal: (amount: CurrencyAmount) => Promise<void>
  defaultTab?: string
}) => {
  const { isShown, toggle } = props

  const clickRemoveBadge = async () => {
    await props.onRemoveBadge()
    toggle()
  }

  const badgeSettings = useOrganizationBadgeSettings(props.org.id)
  const isBadged = isIssueBadged(props.issue)
  const gitHubIssueLink = `https://github.com/${props.org.name}/${props.repo.name}/issues/${props.issue.number}`

  return (
    <>
      <ModalHeader hide={toggle} className="border-none">
        <div className="flex items-center space-x-2">
          <BadgedCheckmarkLargeIcon />
          <div className="pr-2 text-lg font-medium">
            Funding is now public for{' '}
            <a href={gitHubIssueLink}>#{props.issue.number}</a>
          </div>
          {isBadged && (
            <button
              onClick={clickRemoveBadge}
              className="text-gray flex cursor-pointer items-center rounded-full border border-gray-200 px-2 py-0.5 pr-3 text-sm text-gray-500 hover:bg-gray-100 dark:border-gray-500 dark:text-gray-400 dark:hover:bg-gray-700"
            >
              <XIcon /> Remove
            </button>
          )}
        </div>
      </ModalHeader>

      <Tabs defaultValue={props.defaultTab ?? 'funding'}>
        <TabsList
          className={twMerge(
            'mx-2 flex h-fit w-full flex-row justify-start space-x-2 !border-0 bg-transparent !p-0',
          )}
        >
          <Tab
            value="funding"
            icon={
              <HeartIcon className="h-6 w-6 text-gray-600 dark:text-gray-300" />
            }
            title="Funding"
          />
          <Tab
            value="rewards"
            icon={
              <GiftIcon className="h-6 w-6 text-gray-600 dark:text-gray-300" />
            }
            title="Rewards"
          />
          <Tab
            value="promote"
            icon={
              <MegaphoneIcon className="h-6 w-6 text-gray-600 dark:text-gray-300" />
            }
            title="Promote"
          />
        </TabsList>
        <TabsContent
          value="funding"
          className="bg-gray-75 -mt-[1px] border-t p-4 dark:border-gray-600 dark:bg-gray-900"
        >
          <BadgeMessageForm
            value={
              props.issue.badge_custom_content ||
              badgeSettings.data?.message ||
              ''
            }
            showAmountRaised={badgeSettings.data?.show_amount || false}
            funding={props.issue.funding}
            onUpdateMessage={props.onBadgeWithComment}
            onUpdateFundingGoal={props.onUpdateFundingGoal}
            onChangeMessage={() => {}}
            onChangeFundingGoal={() => {}}
            showUpdateButton={true}
            innerClassNames="shadow"
            canSetFundingGoal={true}
          />
        </TabsContent>
        <TabsContent
          value="rewards"
          className="bg-gray-75 -mt-[1px] border-t p-4 dark:border-gray-600 dark:bg-gray-900"
        >
          <RewardsTab {...props} />
        </TabsContent>
        <TabsContent
          value="promote"
          className="bg-gray-75 -mt-[1px] border-t p-4 dark:border-gray-600 dark:bg-gray-900"
        >
          <PromoteTab {...props} />
        </TabsContent>
      </Tabs>
    </>
  )
}

const PostCommentForm = (props: {
  org: Organization
  repo: Repository
  issue: IssueDashboardRead
  user: UserRead
  onAddComment: (message: string) => Promise<void>
}) => {
  const [message, setMessage] = useState(
    'You can pledge behind and help support this effort using Polar.sh',
  )

  const [loading, setIsLoading] = useState(false)
  const [posted, setPosted] = useState(false)

  const submitComment = async () => {
    setIsLoading(true)
    await props.onAddComment(message)
    setIsLoading(false)
    setPosted(true)

    posthog.capture('posted-issue-comment', {
      organization_name: props.org.name,
      repository_name: props.repo.name,
      issue_number: props.issue.number,
    })
  }

  return (
    <div className="mt-3 flex flex-1 space-x-2">
      {props.user.avatar_url && (
        <Image
          alt={`Avatar of ${props.user.username}`}
          src={props.user.avatar_url}
          height={200}
          width={200}
          className="h-6 w-6 rounded-full"
        />
      )}
      <div className="flex h-full flex-1 flex-col overflow-hidden rounded-md border ">
        <textarea
          className="overflow-hiddens max-h-[10rem] w-full flex-1 border-0 px-4 py-2.5 text-gray-800 outline-0 dark:bg-gray-700 dark:text-white"
          value={message}
          disabled={posted || loading}
          onChange={(e: ChangeEvent<HTMLTextAreaElement>) => {
            setMessage(e.target.value)
          }}
        ></textarea>
        <div className="flex items-center justify-between border-t bg-blue-50 px-4 py-2 dark:bg-blue-500/30">
          <div className="text-xs text-gray-900 dark:text-white/90">
            🔔 Comments on your behalf
          </div>
          <button
            onClick={submitComment}
            disabled={posted || loading}
            className={classNames(
              !posted
                ? 'text-blue-600 dark:text-blue-300'
                : 'text-gray-400 dark:text-blue-200/40',
              'font-medium',
            )}
          >
            {!posted && !loading && <>Post</>}
            {!posted && loading && <>Posting...</>}
            {posted && <>Posted</>}
          </button>
        </div>
      </div>
    </div>
  )
}

const BadgedCheckmarkIcon = () => {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M5.75 8.5625L7.4375 10.25L10.25 6.3125M14.75 8C14.75 8.951 14.2775 9.7925 13.5553 10.301C13.6331 10.7456 13.6026 11.2024 13.4664 11.6327C13.3303 12.063 13.0924 12.4541 12.773 12.773C12.4541 13.0924 12.063 13.3303 11.6327 13.4664C11.2024 13.6026 10.7456 13.6331 10.301 13.5552C10.0417 13.9246 9.69714 14.226 9.2966 14.434C8.89607 14.642 8.45131 14.7504 8 14.75C7.049 14.75 6.2075 14.2775 5.699 13.5552C5.25443 13.633 4.79766 13.6025 4.36737 13.4663C3.93707 13.3302 3.54591 13.0924 3.227 12.773C2.90759 12.4541 2.66973 12.063 2.53357 11.6327C2.3974 11.2024 2.36693 10.7456 2.44475 10.301C2.07539 10.0417 1.77397 9.69714 1.566 9.2966C1.35802 8.89607 1.24963 8.45131 1.25 8C1.25 7.049 1.7225 6.2075 2.44475 5.699C2.36693 5.25442 2.3974 4.79764 2.53357 4.36734C2.66973 3.93703 2.90759 3.54588 3.227 3.227C3.54591 2.90765 3.93707 2.66982 4.36737 2.53366C4.79766 2.39749 5.25443 2.367 5.699 2.44475C5.95838 2.07544 6.30292 1.77405 6.70344 1.56608C7.10397 1.35811 7.5487 1.2497 8 1.25C8.951 1.25 9.7925 1.7225 10.301 2.44475C10.7456 2.367 11.2023 2.39749 11.6326 2.53366C12.0629 2.66982 12.4541 2.90765 12.773 3.227C13.0924 3.54591 13.3302 3.93707 13.4663 4.36737C13.6025 4.79766 13.633 5.25442 13.5553 5.699C13.9246 5.95834 14.226 6.30286 14.434 6.7034C14.642 7.10394 14.7504 7.54869 14.75 8Z"
        stroke="#2D8C31"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

const BadgedCheckmarkLargeIcon = () => {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="h-5 w-5 text-green-600 dark:text-green-500"
    >
      <path
        d="M5.75 8.5625L7.4375 10.25L10.25 6.3125M14.75 8C14.75 8.951 14.2775 9.7925 13.5553 10.301C13.6331 10.7456 13.6026 11.2024 13.4664 11.6327C13.3303 12.063 13.0924 12.4541 12.773 12.773C12.4541 13.0924 12.063 13.3303 11.6327 13.4664C11.2024 13.6026 10.7456 13.6331 10.301 13.5552C10.0417 13.9246 9.69714 14.226 9.2966 14.434C8.89607 14.642 8.45131 14.7504 8 14.75C7.049 14.75 6.2075 14.2775 5.699 13.5552C5.25443 13.633 4.79766 13.6025 4.36737 13.4663C3.93707 13.3302 3.54591 13.0924 3.227 12.773C2.90759 12.4541 2.66973 12.063 2.53357 11.6327C2.3974 11.2024 2.36693 10.7456 2.44475 10.301C2.07539 10.0417 1.77397 9.69714 1.566 9.2966C1.35802 8.89607 1.24963 8.45131 1.25 8C1.25 7.049 1.7225 6.2075 2.44475 5.699C2.36693 5.25442 2.3974 4.79764 2.53357 4.36734C2.66973 3.93703 2.90759 3.54588 3.227 3.227C3.54591 2.90765 3.93707 2.66982 4.36737 2.53366C4.79766 2.39749 5.25443 2.367 5.699 2.44475C5.95838 2.07544 6.30292 1.77405 6.70344 1.56608C7.10397 1.35811 7.5487 1.2497 8 1.25C8.951 1.25 9.7925 1.7225 10.301 2.44475C10.7456 2.367 11.2023 2.39749 11.6326 2.53366C12.0629 2.66982 12.4541 2.90765 12.773 3.227C13.0924 3.54591 13.3302 3.93707 13.4663 4.36737C13.6025 4.79766 13.633 5.25442 13.5553 5.699C13.9246 5.95834 14.226 6.30286 14.434 6.7034C14.642 7.10394 14.7504 7.54869 14.75 8Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

const XIcon = () => {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 20 20"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M6.28015 5.21985C6.13798 5.08737 5.94993 5.01524 5.75563 5.01867C5.56133 5.0221 5.37594 5.10081 5.23853 5.23822C5.10112 5.37564 5.02241 5.56102 5.01898 5.75532C5.01555 5.94963 5.08767 6.13767 5.22015 6.27985L8.94015 9.99985L5.22015 13.7198C5.14647 13.7885 5.08736 13.8713 5.04637 13.9633C5.00538 14.0553 4.98334 14.1546 4.98156 14.2553C4.97979 14.356 4.99831 14.4561 5.03603 14.5494C5.07375 14.6428 5.1299 14.7277 5.20112 14.7989C5.27233 14.8701 5.35717 14.9262 5.45056 14.964C5.54394 15.0017 5.64397 15.0202 5.74468 15.0184C5.84538 15.0167 5.94469 14.9946 6.03669 14.9536C6.12869 14.9126 6.21149 14.8535 6.28015 14.7798L10.0002 11.0598L13.7202 14.7798C13.7888 14.8535 13.8716 14.9126 13.9636 14.9536C14.0556 14.9946 14.1549 15.0167 14.2556 15.0184C14.3563 15.0202 14.4564 15.0017 14.5498 14.964C14.6431 14.9262 14.728 14.8701 14.7992 14.7989C14.8704 14.7277 14.9266 14.6428 14.9643 14.5494C15.002 14.4561 15.0205 14.356 15.0187 14.2553C15.017 14.1546 14.9949 14.0553 14.9539 13.9633C14.9129 13.8713 14.8538 13.7885 14.7802 13.7198L11.0602 9.99985L14.7802 6.27985C14.9126 6.13767 14.9848 5.94963 14.9813 5.75532C14.9779 5.56102 14.8992 5.37564 14.7618 5.23822C14.6244 5.10081 14.439 5.0221 14.2447 5.01867C14.0504 5.01524 13.8623 5.08737 13.7202 5.21985L10.0002 8.93985L6.28015 5.21985Z"
        fill="currentColor"
      />
    </svg>
  )
}

const Tab = ({
  value,
  icon,
  title,
}: {
  value: string
  icon: React.ReactElement
  title: string
}) => (
  <TabsTrigger
    value={value}
    className="data-[state=active]:bg-gray-75 rounded-none rounded-t-lg border !border-b-0 border-transparent bg-transparent !shadow-none outline-0 ring-0 hover:bg-gray-500/10 data-[state=active]:border-gray-200   dark:data-[state=active]:border-gray-600 dark:data-[state=active]:bg-gray-900"
  >
    <div className="flex w-full items-center gap-4 px-1 text-left">
      {icon}
      <div>
        <div className='font-medium" text-sm text-gray-700 dark:text-gray-300'>
          {title}
        </div>
      </div>
    </div>
  </TabsTrigger>
)

const PromoteTab = (props: {
  org: Organization
  repo: Repository
  issue: IssueDashboardRead
  user: UserRead
  onAddComment: (message: string) => Promise<void>
}) => {
  const pledgePageLink = `https://polar.sh/${props.org.name}/${props.repo.name}/issues/${props.issue.number}`
  const pledgeBadgeSVG = `https://api.polar.sh/api/github/${props.org.name}/${props.repo.name}/issues/${props.issue.number}/pledge.svg`

  const embeds = [
    {
      name: 'Light theme',
      classNames: 'w-[100px]',
      embed: `<a href="${pledgePageLink}"><img alt="Fund with Polar" src="${pledgeBadgeSVG}" /></a>`,
    },
    {
      name: 'Dark theme',
      classNames: 'w-[100px]',
      embed: `<a href="${pledgePageLink}"><img alt="Fund with Polar" src="${pledgeBadgeSVG}?darkmode=1" /></a>`,
    },
    {
      name: 'Match the system',
      classNames: 'w-[130px]',
      embed: `<a href="${pledgePageLink}"><picture><source media="(prefers-color-scheme: dark)" srcset="${pledgeBadgeSVG}?darkmode=1"><img alt="Fund with Polar" src="${pledgeBadgeSVG}"></picture></a>`,
    },
  ]

  const [embed, setEmbed] = useState(embeds[0])

  const onCopy = (id: string) => {
    posthog.capture('copy-to-clipboard', {
      value: id,
      organization_name: props.org.name,
      repository_name: props.repo.name,
      issue_number: props.issue.number,
    })
  }

  return (
    <div className="grid w-full grid-cols-2 space-x-6">
      <div className="flex flex-col">
        <div className="text-sm font-medium">Post a Github comment</div>

        <PostCommentForm
          org={props.org}
          repo={props.repo}
          issue={props.issue}
          user={props.user}
          onAddComment={props.onAddComment}
        />
      </div>

      <div className="flex flex-col">
        <div className="text-sm font-medium">Spread the word</div>

        <div className="mb-1 mt-2 text-xs text-gray-500 dark:text-gray-400">
          Share link to the pledge page
        </div>

        <CopyToClipboardInput
          id="padge-page-link"
          value={pledgePageLink}
          onCopy={() => onCopy('badge-page-link')}
        />

        <div className="my-2 flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
          <span>Embed badge on website</span>

          <select
            className={classNames(
              'border-0 bg-transparent p-0 text-xs',
              embed.classNames,
            )}
            onChange={(e) => {
              setEmbed(
                embeds.find((v) => v.name === e.currentTarget.value) ||
                  embeds[0],
              )
            }}
            value={embed.name}
          >
            {embeds.map((e, i) => (
              <option key={i} value={e.name}>
                {e.name}
              </option>
            ))}
          </select>
        </div>

        <CopyToClipboardInput
          id="badge-embed-content"
          value={embed.embed}
          onCopy={() => onCopy('badge-embed-content')}
        />
      </div>
    </div>
  )
}

const RewardsTab = (props: {
  issue: IssueDashboardRead
  org: Organization
}) => {
  const [usePublicRewards, setUsePublicRewards] = useState<boolean>(
    props.issue.upfront_split_to_contributors !== null,
  )

  const [contributorsShare, setContributorsShare] = useState<number>(
    props.issue.upfront_split_to_contributors ?? 50,
  )

  const maintainerShare = useMemo(() => {
    if (contributorsShare === undefined) {
      return 50
    }
    return 100 - contributorsShare
  }, [contributorsShare])

  const updateIssue = useUpdateIssue()

  const onSubmit = async () => {
    await updateIssue.mutateAsync({
      id: props.issue.id,

      upfront_split_to_contributors: usePublicRewards
        ? contributorsShare
        : undefined,

      unset_upfront_split_to_contributors: !usePublicRewards ? true : undefined,
    })
  }

  return (
    <div className="flex w-full flex-col space-y-2">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm font-medium text-gray-900">
            Public rewards
          </div>
          <div className="text-xs text-gray-600">
            Public & upfront rewards can attract contributors. You can also
            reward & adjust splits later too.{' '}
          </div>
        </div>
        <div>
          <Switch
            className="data-[state=checked]:bg-blue-600"
            checked={usePublicRewards}
            onCheckedChange={setUsePublicRewards}
          />
        </div>
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <UserIcon className="h-6 w-6 rounded-full bg-gray-50 p-1" />
          <div className="text-sm">Reserved for contributor(s)</div>
        </div>
        <div className="flex w-[120px] items-center gap-1 overflow-hidden rounded-lg border bg-white px-3 py-2 pr-1.5 dark:bg-gray-700">
          <span className="flex-shrink-0 text-gray-500">%</span>
          <div className="flex-1">
            <input
              className={classNames(
                'w-full bg-white dark:bg-gray-700 dark:outline-gray-700 ',
                usePublicRewards
                  ? 'font-medium text-black dark:text-gray-100'
                  : 'text-gray-500 dark:text-gray-400',
              )}
              disabled={!usePublicRewards}
              value={contributorsShare}
              placeholder={'50'}
              onChange={(e) => {
                let val = parseInt(e.target.value)
                val = Math.min(Math.max(val, 0), 100)
                if (isNaN(val)) {
                  val = 0
                }
                setContributorsShare(val)
              }}
            />
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm">
          <img src={props.org.avatar_url} className="h-6 w-6 rounded-full" />
          <div>{props.org.pretty_name || props.org.name}.</div>
          <div className="text-gray-500">
            Reviews, feedback & maintenance. Reward yourself too.
          </div>
        </div>
        <div className="flex w-[120px] items-center gap-1 overflow-hidden rounded-lg border bg-white px-3 py-2 pr-1.5 dark:bg-gray-700">
          <span className="flex-shrink-0 text-gray-500">%</span>
          <div className="flex-1">
            <input
              className={classNames(
                'w-full bg-white dark:bg-gray-700 dark:outline-gray-700 ',
                'text-gray-500 dark:text-gray-400',
              )}
              disabled
              value={maintainerShare}
            />
          </div>
        </div>
      </div>

      <div className="flex justify-end">
        <PrimaryButton
          fullWidth={false}
          loading={updateIssue.isPending}
          onClick={onSubmit}
        >
          Update
        </PrimaryButton>
      </div>
    </div>
  )
}
