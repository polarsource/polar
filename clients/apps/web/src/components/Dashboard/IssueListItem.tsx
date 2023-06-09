import Modal, { ModalBox } from '@/components/Shared/Modal'
import { useToastLatestPledged } from '@/hooks/stripe'
import { useRouter } from 'next/router'
import { api } from 'polarkit/api'
import {
  IssueDashboardRead,
  IssueReferenceRead,
  IssueStatus,
  OrganizationPublicRead,
  Platforms,
  RepositoryRead,
  type PledgeRead,
} from 'polarkit/api/client'
import { IssueReadWithRelations } from 'polarkit/api/types'
import {
  IssueActivityBox,
  IssueListItemDecoration,
  generateMarkdownTitle,
} from 'polarkit/components/Issue'
import { PolarTimeAgo, PrimaryButton } from 'polarkit/components/ui'
import { useIssueAddPolarBadge, useIssueRemovePolarBadge } from 'polarkit/hooks'
import {
  classNames,
  getCentsInDollarString,
  githubIssueUrl,
} from 'polarkit/utils'
import { ChangeEvent, useState } from 'react'
import PledgeNow from '../Pledge/PledgeNow'
import IconCounter from './IconCounter'
import IssueLabel, { LabelSchema } from './IssueLabel'
import IssueProgress, { Progress } from './IssueProgress'

const IssueListItem = (props: {
  org: OrganizationPublicRead
  repo: RepositoryRead
  issue: IssueDashboardRead
  references: IssueReferenceRead[]
  dependents?: IssueReadWithRelations[]
  pledges: PledgeRead[]
  checkJustPledged?: boolean
  canAddRemovePolarLabel: boolean
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

  return (
    <>
      <div className="group/issue">
        <div className="hover:bg-gray-75 group flex items-center justify-between gap-4 overflow-hidden py-4 px-2 pb-5 dark:hover:bg-gray-900">
          <div className="flex flex-row items-center">
            {isDependency && (
              <div className="mr-3 flex-shrink-0 justify-center rounded-full bg-white p-[1px] shadow">
                <img
                  src={props.org.avatar_url}
                  className="h-8 w-8 rounded-full"
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
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-6">
              {showCommentsCount && (
                <IconCounter icon="comments" count={comments} />
              )}
              {showReactionsThumbs && (
                <IconCounter icon="thumbs_up" count={reactions.plus_one} />
              )}
            </div>

            <IssueProgress progress={issueProgress} />

            {showPledgeAction && <PledgeNow onClick={redirectToPledge} />}

            {props.canAddRemovePolarLabel && (
              <AddRemoveBadge
                orgName={props.org.name}
                repoName={props.repo.name}
                issue={props.issue}
              />
            )}
          </div>
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
      </div>

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

  const add = useIssueAddPolarBadge()
  const remove = useIssueRemovePolarBadge()

  const click = async () => {
    if (hasPolarLabel) {
      await remove.mutateAsync({
        platform: Platforms.GITHUB,
        orgName: props.orgName,
        repoName: props.repoName,
        issueNumber: props.issue.number,
      })
    } else {
      await add.mutateAsync({
        platform: Platforms.GITHUB,
        orgName: props.orgName,
        repoName: props.repoName,
        issueNumber: props.issue.number,
      })
    }
  }

  return (
    <div
      onClick={click}
      className={classNames(
        hasPolarLabel ? 'border bg-white dark:bg-gray-800' : '',
        hasPolarLabel
          ? ' hover-border-red-200 border-green-200  text-green-600 hover:text-red-600 dark:border-green-500 dark:hover:border-red-500 '
          : '',
        !hasPolarLabel ? 'bg-blue-600 text-white' : '',
        'group/button flex w-0 translate-x-5 cursor-pointer items-center space-x-1 rounded-md px-2 py-1 text-sm opacity-0',
        'transition-transform transition-opacity transition-colors',
        'group-hover/issue:mr-0 group-hover/issue:w-auto group-hover/issue:translate-x-0 group-hover/issue:opacity-100',
      )}
    >
      {hasPolarLabel && <BadgedCheckmarkIcon />}
      {hasPolarLabel && (
        <>
          <span className="group-hover/button:hidden">Badged</span>
          <span className="hidden group-hover/button:inline-block">
            Remove badge
          </span>
        </>
      )}
      {!hasPolarLabel && <span>Add badge</span>}
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
      className="group-hover/button:hidden"
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
