import Modal, { ModalBox } from '@/components/Shared/Modal'
import { useRequireAuth } from '@/hooks'
import { useToastLatestPledged } from '@/hooks/stripe'
import { motion } from 'framer-motion'
import Image from 'next/image'
import { useRouter } from 'next/router'
import { api } from 'polarkit/api'
import {
  IssueDashboardRead,
  IssuePublicRead,
  IssueReferenceRead,
  IssueStatus,
  OrganizationPublicRead,
  Platforms,
  RepositoryPublicRead,
  RepositoryRead,
  UserRead,
  type PledgeRead,
} from 'polarkit/api/client'
import { IssueReadWithRelations } from 'polarkit/api/types'
import {
  IssueActivityBox,
  IssueListItemDecoration,
  generateMarkdownTitle,
} from 'polarkit/components/Issue'
import { PolarTimeAgo, PrimaryButton } from 'polarkit/components/ui'
import {
  useBadgeWithComment,
  useIssueAddComment,
  useIssueAddPolarBadge,
  useIssueRemovePolarBadge,
} from 'polarkit/hooks'
import {
  classNames,
  getCentsInDollarString,
  githubIssueUrl,
} from 'polarkit/utils'
import { ChangeEvent, useState } from 'react'
import { ModalHeader, Modal as ModernModal } from '../Modal'
import { useModal } from '../Modal/useModal'
import PledgeNow from '../Pledge/PledgeNow'
import BadgeMessageForm from './BadgeMessageForm'
import IconCounter from './IconCounter'
import IssueLabel, { LabelSchema } from './IssueLabel'
import IssueProgress, { Progress } from './IssueProgress'

const IssueListItem = (props: {
  org: OrganizationPublicRead
  repo: RepositoryRead | RepositoryPublicRead
  issue: IssueDashboardRead | IssuePublicRead
  references: IssueReferenceRead[]
  dependents?: IssueReadWithRelations[]
  pledges: PledgeRead[]
  checkJustPledged?: boolean
  canAddRemovePolarLabel: boolean
  showIssueProgress: boolean
  right?: React.ReactElement
}) => {
  const { title, number, state, issue_created_at, reactions, comments } =
    props.issue

  const router = useRouter()

  const createdAt = new Date(issue_created_at)
  const closedAt = new Date(issue_created_at)

  const mergedPledges = props.pledges || []
  const latestPledge = useToastLatestPledged(
    props.org.id,
    props.repo.id,
    props.issue.id,
    props.checkJustPledged,
  )
  const containsLatestPledge =
    mergedPledges.find((pledge) => pledge.id === latestPledge?.id) !== undefined

  if (!containsLatestPledge && latestPledge) {
    mergedPledges.push(latestPledge)
  }

  const havePledge = mergedPledges.length > 0
  const haveReference = props.references && props.references?.length > 0
  const havePledgeOrReference = havePledge || haveReference

  const showCommentsCount = !!(comments && comments > 0)
  const showReactionsThumbs = !!(reactions.plus_one > 0)

  const getissueProgress = (): Progress => {
    switch (props.issue.progress) {
      case IssueStatus.BUILDING:
        return 'building'
      case IssueStatus.PULL_REQUEST:
        return 'pull_request'
      case IssueStatus.CLOSED:
        return 'closed'
      case IssueStatus.IN_PROGRESS:
        return 'in_progress'
      case IssueStatus.TRIAGED:
        return 'triaged'
      default:
        return 'backlog'
    }
  }
  const issueProgress = getissueProgress()

  const markdownTitle = generateMarkdownTitle(title)

  const [showDisputeModalForPledge, setShowDisputeModalForPledge] = useState<
    PledgeRead | undefined
  >()

  const onDispute = (pledge: PledgeRead) => {
    setShowDisputeModalForPledge(pledge)
  }

  const onDisputeModalClose = () => {
    setShowDisputeModalForPledge(undefined)
  }

  const isDependency = props.dependents && props.dependents.length > 0
  /**
   * We can get the dependent org from the first dependent issue.
   * Since dashboard is always filtered by an org, it will be the same across array instances.
   *
   * Not the most elegent solution, but circumventing the need to pass props down a long chain.
   */
  const dependentOrg = props.dependents && props.dependents[0].organization
  const showPledgeAction =
    isDependency && props.issue.progress !== IssueStatus.CLOSED

  const redirectToPledge = () => {
    if (!dependentOrg) return

    const path = `/${props.org.name}/${props.repo.name}/issues/${props.issue.number}`
    const url = new URL(window.location.origin + path)
    url.searchParams.append('as_org', dependentOrg.id)

    const gotoURL = `${window.location.pathname}${window.location.search}`
    url.searchParams.append('goto_url', gotoURL)

    router.push(url.toString())
  }

  const rowMotion = {
    rest: {},
    hover: {},
  }

  const rightSideMotion = {
    rest: {
      x: props.canAddRemovePolarLabel ? 115 : 0,
    },
    hover: {
      x: 0,
    },
  }

  const [isHovered, setIsHovered] = useState(false)

  return (
    <>
      <motion.div
        className="group/issue"
        initial="rest"
        whileHover="hover"
        animate="rest"
        variants={rowMotion}
        onMouseOver={() => setIsHovered(true)}
        onMouseOut={() => setIsHovered(false)}
      >
        <div className="hover:bg-gray-75 group flex items-center justify-between gap-4 overflow-hidden py-4 px-2 pb-5 dark:hover:bg-gray-900">
          <div className="flex flex-row items-center">
            {isDependency && (
              <div className="mr-3 flex-shrink-0 justify-center rounded-full bg-white p-[1px] shadow">
                <Image
                  alt={`Avatar of ${props.org.name}`}
                  src={props.org.avatar_url}
                  className="h-8 w-8 rounded-full"
                  height={200}
                  width={200}
                />
              </div>
            )}
            <div className="flex flex-col gap-1">
              <div className="flex flex-wrap items-start gap-x-4 gap-y-2">
                <a
                  className="text-md text-nowrap font-medium"
                  href={githubIssueUrl(props.org.name, props.repo.name, number)}
                >
                  {markdownTitle}
                  {isDependency && (
                    <span className="text-gray-400">
                      {' '}
                      #{props.issue.number}
                    </span>
                  )}
                </a>

                {props.issue.labels &&
                  props.issue.labels.map((label: LabelSchema) => {
                    return <IssueLabel label={label} key={label.id} />
                  })}
              </div>
              {!isDependency && (
                <div className="text-xs text-gray-500">
                  <p>
                    #{number}{' '}
                    {state == 'open' && (
                      <>
                        opened <PolarTimeAgo date={new Date(createdAt)} />
                      </>
                    )}
                    {state == 'closed' && (
                      <>
                        closed <PolarTimeAgo date={new Date(closedAt)} />
                      </>
                    )}{' '}
                    in {props.org.name}/{props.repo.name}
                  </p>
                </div>
              )}
              {isDependency && (
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  {props.dependents?.map((dep: IssueReadWithRelations) => (
                    <p key={dep.id}>
                      Mentioned in{' '}
                      <a
                        href={githubIssueUrl(
                          dep.organization.name,
                          dep.repository.name,
                          dep.number,
                        )}
                        className="font-medium text-blue-600 dark:text-blue-500"
                      >
                        {dep.organization.name}/{dep.repository.name}#
                        {dep.number} - {dep.title}
                      </a>
                    </p>
                  ))}
                </div>
              )}
            </div>
          </div>
          <motion.div
            className="flex items-center gap-6"
            variants={rightSideMotion}
            transition={{
              type: 'spring',
              damping: 25,
              stiffness: 250,
            }}
          >
            <>
              <div className="flex items-center gap-6">
                {showCommentsCount && (
                  <IconCounter icon="comments" count={comments} />
                )}
                {showReactionsThumbs && (
                  <IconCounter icon="thumbs_up" count={reactions.plus_one} />
                )}
              </div>

              {props.showIssueProgress && (
                <IssueProgress progress={issueProgress} />
              )}

              {showPledgeAction && <PledgeNow onClick={redirectToPledge} />}

              {props.canAddRemovePolarLabel && (
                <AddRemoveBadge
                  orgName={props.org.name}
                  repoName={props.repo.name}
                  issue={props.issue}
                />
              )}

              {props.right}
            </>
          </motion.div>
        </div>

        {havePledgeOrReference && (
          <IssueActivityBox>
            <IssueListItemDecoration
              orgName={props.org.name}
              repoName={props.repo.name}
              pledges={mergedPledges}
              references={props.references}
              showDisputeAction={true}
              onDispute={onDispute}
            />
          </IssueActivityBox>
        )}
      </motion.div>

      {showDisputeModalForPledge && (
        <Modal onClose={onDisputeModalClose}>
          <DisputeModal pledge={showDisputeModalForPledge} />
        </Modal>
      )}
    </>
  )
}

export default IssueListItem

const DisputeModal = (props: { pledge: PledgeRead }) => {
  const [reason, setReason] = useState('')
  const [canSubmit, setCanSubmit] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [didSubmit, setDidSubmit] = useState(false)

  const submit = async () => {
    setIsLoading(true)
    setMessage('')

    try {
      await api.pledges.disputePledge({
        pledgeId: pledge.id,
        reason: reason,
      })
      setMessage("Thanks, we'll review your dispute soon.")
      setDidSubmit(true)
    } catch (Error) {
      setMessage('Something went wrong. Please try again.')
    }
    setIsLoading(false)
  }

  const onUpdateReason = (e: ChangeEvent<HTMLTextAreaElement>) => {
    setReason(e.target.value)
    setCanSubmit(e.target.value.length > 4 && !didSubmit)
  }

  const { pledge } = props
  return (
    <ModalBox>
      <>
        <h1 className="text-2xl font-normal">Dispute your pledge</h1>
        <p className="text-sm text-gray-500">
          Still an issue or not solved in a satisfactory way?
          <br />
          <br />
          Submit a dispute and the money will be on hold until Polar has
          manually reviewed the issue and resolved the dispute.
        </p>
        <table className="min-w-full divide-y divide-gray-300">
          <tr>
            <td className="whitespace-nowrap py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900 sm:pl-0">
              Amount
            </td>
            <td className="whitespace-nowrap py-2 pl-4 pr-3 text-sm text-gray-500 sm:pl-0">
              ${getCentsInDollarString(pledge.amount)}
            </td>
          </tr>
          <tr>
            <td className="whitespace-nowrap py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900 sm:pl-0">
              Pledger
            </td>
            <td className="whitespace-nowrap py-2 pl-4 pr-3 text-sm text-gray-500 sm:pl-0">
              {pledge.pledger_name}
            </td>
          </tr>
          <tr>
            <td className="whitespace-nowrap py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900 sm:pl-0">
              Pledge ID
            </td>
            <td className="whitespace-nowrap py-2 pl-4 pr-3 text-sm text-gray-500 sm:pl-0">
              {pledge.id}
            </td>
          </tr>
          <tr>
            <td className="whitespace-nowrap py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900 sm:pl-0">
              Issue ID
            </td>
            <td className="whitespace-nowrap py-2 pl-4 pr-3 text-sm text-gray-500 sm:pl-0">
              {pledge.issue_id}
            </td>
          </tr>
        </table>

        {!didSubmit && (
          <>
            <label
              htmlFor="dispute_description"
              className="whitespace-nowrap py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900 sm:pl-0"
            >
              Description
            </label>
            <textarea
              id="dispute_description"
              placeholder="Explain what happened"
              rows={8}
              onChange={onUpdateReason}
            ></textarea>
          </>
        )}

        <PrimaryButton
          disabled={!canSubmit}
          onClick={submit}
          loading={isLoading}
        >
          Submit
        </PrimaryButton>

        {message && <p>{message}</p>}
      </>
    </ModalBox>
  )
}

const AddRemoveBadge = (props: {
  orgName: string
  repoName: string
  issue: IssueDashboardRead
}) => {
  const hasPolarLabel =
    props.issue.labels &&
    (props.issue.labels as Array<LabelSchema>).find(
      (l) => l.name.toLowerCase() === 'polar',
    )

  const remove = useIssueRemovePolarBadge()
  const add = useIssueAddPolarBadge()

  const { isShown, toggle } = useModal()

  const click = async () => {
    if (!hasPolarLabel) {
      await add.mutateAsync({
        platform: Platforms.GITHUB,
        orgName: props.orgName,
        repoName: props.repoName,
        issueNumber: props.issue.number,
      })
    }

    toggle()
  }

  const onRemoveBadge = async () => {
    await remove.mutateAsync({
      platform: Platforms.GITHUB,
      orgName: props.orgName,
      repoName: props.repoName,
      issueNumber: props.issue.number,
    })
  }

  const addComment = useIssueAddComment()

  const onAddComment = async (message: string) => {
    await addComment.mutateAsync({
      platform: Platforms.GITHUB,
      orgName: props.orgName,
      repoName: props.repoName,
      issueNumber: props.issue.number,
      body: {
        message: message,
        append_badge: true,
      },
    })
  }

  const badgeWithComment = useBadgeWithComment()

  const onBadgeWithComment = async (message: string) => {
    await badgeWithComment.mutateAsync({
      platform: Platforms.GITHUB,
      orgName: props.orgName,
      repoName: props.repoName,
      issueNumber: props.issue.number,
      body: {
        message: message,
      },
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
          hasPolarLabel ? 'border bg-white dark:bg-gray-800' : '',
          hasPolarLabel
            ? ' border-green-200 text-green-600 hover:border-green-300 dark:border-green-600'
            : '',
          !hasPolarLabel ? 'bg-blue-600 text-white' : '',
          'cursor-pointer items-center justify-center space-x-1 rounded-md px-2 py-1 text-sm',
          'flex overflow-hidden whitespace-nowrap',
        )}
      >
        {hasPolarLabel && (
          <>
            <BadgedCheckmarkIcon />
            <span>Badged</span>
          </>
        )}
        {!hasPolarLabel && <span>Add badge</span>}
      </button>

      <ModernModal
        isShown={isShown}
        hide={toggle}
        modalContent={
          <BadgePromotionModal
            orgName={props.orgName}
            repoName={props.repoName}
            issue={props.issue}
            isShown={isShown}
            toggle={toggle}
            onRemoveBadge={onRemoveBadge}
            user={currentUser}
            onAddComment={onAddComment}
            onBadgeWithComment={onBadgeWithComment}
          />
        }
      />
    </>
  )
}

export const BadgePromotionModal = (props: {
  orgName: string
  repoName: string
  issue: IssueDashboardRead
  isShown: boolean
  toggle: () => void
  onRemoveBadge: () => Promise<void>
  user: UserRead
  onAddComment: (message: string) => Promise<void>
  onBadgeWithComment: (comment: string) => Promise<void>
}) => {
  const { isShown, toggle } = props

  const clickRemoveBadge = async () => {
    await props.onRemoveBadge()
    toggle()
  }

  const copyToClipboard = (id: string) => {
    const copyText = document.getElementById(id) as HTMLInputElement
    if (!copyText) {
      return
    }
    copyText.select()
    copyText.setSelectionRange(0, 99999)
    navigator.clipboard.writeText(copyText.value)
  }

  const pledgePageLink = `https://polar.sh/${props.orgName}/${props.repoName}/issues/${props.issue.number}`
  const pledgeBadgeSVG = `https://api.polar.sh/api/github/${props.orgName}/${props.repoName}/issues/${props.issue.number}/pledge.svg`
  const pledgeEmbed = `<a href="${pledgePageLink}"><picture><source media="(prefers-color-scheme: dark)" srcset="${pledgeBadgeSVG}?darkmode=1"><img alt="Fund with Polar" src="${pledgeBadgeSVG}"></picture></a>`
  const gitHubIssueLink = `https://github.com/${props.orgName}/${props.repoName}/issues/${props.issue.number}`

  return (
    <>
      <ModalHeader hide={toggle}>
        <div className="flex items-center space-x-2">
          <BadgedCheckmarkLargeIcon />
          <div className="pr-2 text-lg font-medium">
            Badge added to{' '}
            <a href={gitHubIssueLink}>
              {props.repoName}#{props.issue.number}
            </a>
          </div>
          <button
            onClick={clickRemoveBadge}
            className="text-gray flex cursor-pointer items-center rounded-full border border-gray-200 px-2 py-0.5 pr-3 text-sm text-gray-500 hover:bg-gray-100 dark:border-gray-500 dark:text-gray-400 dark:hover:bg-gray-700"
          >
            <XIcon /> Remove
          </button>
        </div>
      </ModalHeader>
      <div className="bg-gray-75 w-full px-5 py-4 dark:bg-gray-700">
        <BadgeMessageForm
          orgName={props.orgName}
          repoName={props.repoName}
          issue={props.issue}
          onBadgeWithComment={props.onBadgeWithComment}
        />
      </div>
      <div className="grid w-full grid-cols-2 space-x-6 bg-white px-5 pt-3.5 pb-7 dark:bg-gray-800">
        <div className="flex flex-col">
          <div className="text-sm font-medium">Post a Github comment</div>

          <PostCommentForm
            orgName={props.orgName}
            repoName={props.repoName}
            issue={props.issue}
            user={props.user}
            onAddComment={props.onAddComment}
          />
        </div>

        <div className="flex flex-col">
          <div className="text-sm font-medium">Spread the word</div>

          <div className="mt-2 mb-1 text-xs text-gray-500 dark:text-gray-400">
            Share link to the pledge page
          </div>
          <div className="flex w-full overflow-hidden rounded-lg border">
            <input
              id="badge-page-link"
              className="flex-1 rounded-l-lg px-3 py-2 font-mono text-sm text-gray-600 dark:text-gray-400"
              onClick={() => {
                copyToClipboard('badge-page-link')
              }}
              value={pledgePageLink}
            />
            <div
              className="cursor-pointer bg-blue-50 px-3 py-2 text-sm font-medium  text-blue-600 dark:bg-blue-500/30 dark:text-blue-300"
              onClick={() => {
                copyToClipboard('badge-page-link')
              }}
            >
              Copy
            </div>
          </div>

          <div className="my-2 text-xs text-gray-500 dark:text-gray-400">
            Embed badge on website
          </div>
          <div className="flex w-full overflow-hidden rounded-lg border">
            <input
              id="badge-embed-content"
              className="flex-1 rounded-l-lg px-3 py-2 font-mono text-sm text-gray-600 dark:text-gray-400"
              value={pledgeEmbed}
              onClick={() => {
                copyToClipboard('badge-embed-content')
              }}
            />
            <div
              className="cursor-pointer bg-blue-50 px-3 py-2 text-sm font-medium text-blue-600 dark:bg-blue-500/30 dark:text-blue-300"
              onClick={() => {
                copyToClipboard('badge-embed-content')
              }}
            >
              Copy
            </div>
          </div>
        </div>
      </div>
    </>
  )
}

const PostCommentForm = (props: {
  orgName: string
  repoName: string
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
