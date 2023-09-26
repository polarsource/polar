'use client'

import { Modal as ModernModal } from '@/components/Modal'
import Modal, { ModalBox } from '@/components/Shared/Modal'
import { useToastLatestPledged } from '@/hooks/stripe'
import { CheckCircleIcon } from '@heroicons/react/24/outline'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { api } from 'polarkit/api'
import {
  Issue,
  IssueDashboardRead,
  IssueReferenceRead,
  IssueStatus,
  Label,
  Organization,
  Pledge,
  Repository,
  State,
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
import { githubIssueUrl } from 'polarkit/github'
import { getCentsInDollarString } from 'polarkit/money'
import { ChangeEvent, useState } from 'react'
import { twMerge } from 'tailwind-merge'
import SplitRewardModal from '../Finance/SplitRewardModal'
import { useModal } from '../Modal/useModal'
import PledgeNow from '../Pledge/PledgeNow'
import IconCounter from './IconCounter'
import IssueLabel from './IssueLabel'
import { AddBadgeButton } from './IssuePromotionModal'

const IssueListItem = (props: {
  org: Organization
  repo: Repository
  issue: IssueDashboardRead | Issue
  references: IssueReferenceRead[]
  dependents?: IssueReadWithRelations[]
  pledges: Array<PledgeRead | Pledge>
  checkJustPledged?: boolean
  canAddRemovePolarLabel: boolean
  showPledgeAction: boolean
  right?: React.ReactElement
  showSelfPledgesFor?: UserRead
  className?: string
  showLogo?: boolean
  showIssueOpenClosedStatus?: boolean
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

  const issueIsOpen =
    props.issue.state === Issue.state.OPEN || props.issue.state === State.OPEN

  const markdownTitle = generateMarkdownTitle(title)

  const [showDisputeModalForPledge, setShowDisputeModalForPledge] = useState<
    PledgeRead | Pledge | undefined
  >()

  const onDispute = (pledge: PledgeRead | Pledge) => {
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
    isDependency &&
    'progress' in props.issue &&
    props.issue.progress !== IssueStatus.CLOSED &&
    props.showPledgeAction

  const redirectToPledge = () => {
    if (!dependentOrg) return

    const path = `/${props.org.name}/${props.repo.name}/issues/${props.issue.number}`
    const url = new URL(window.location.origin + path)
    url.searchParams.append('as_org', dependentOrg.id)

    const gotoURL = `${window.location.pathname}${window.location.search}`
    url.searchParams.append('goto_url', gotoURL)

    router.push(url.toString())
  }

  const {
    isShown: isSplitRewardsModalShown,
    hide: closeSplitRewardModal,
    show: showSplitRewardModal,
  } = useModal()

  const onConfirmPledge = () => {
    showSplitRewardModal()
  }

  return (
    <>
      <div>
        <div
          className={twMerge(
            'hover:bg-gray-75 group flex items-center justify-between gap-4 overflow-hidden px-2 py-4 pb-5 dark:hover:bg-gray-900/50',
            props.className,
          )}
        >
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

            {props.showLogo && 'repository' in props.issue && (
              <div className="mr-3 flex-shrink-0 justify-center rounded-full bg-white p-[1px] shadow">
                <Image
                  alt={`Avatar of ${props.issue.repository.organization.name}`}
                  src={props.issue.repository.organization.avatar_url}
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
                  props.issue.labels.map((label: Label) => {
                    return <IssueLabel label={label} key={label.name} />
                  })}
              </div>
              {!isDependency && (
                <div className="text-xs text-gray-500">
                  <p>
                    #{number}{' '}
                    {(state == 'open' || state === Issue.state.OPEN) && (
                      <>
                        opened <PolarTimeAgo date={new Date(createdAt)} />
                      </>
                    )}
                    {(state == 'closed' || state === Issue.state.CLOSED) && (
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
          <>
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-6">
                {props.showIssueOpenClosedStatus && (
                  <div className="flex flex-row items-center gap-2 text-sm text-gray-500">
                    {issueIsOpen ? (
                      <>
                        <div className="h-4 w-4 rounded-full border border-gray-500"></div>
                        <span>Open</span>
                      </>
                    ) : (
                      <>
                        <CheckCircleIcon className="h-4 w-4" />
                        <span>Closed</span>
                      </>
                    )}
                  </div>
                )}

                {showCommentsCount && (
                  <IconCounter icon="comments" count={comments} />
                )}
                {showReactionsThumbs && (
                  <IconCounter icon="thumbs_up" count={reactions.plus_one} />
                )}
              </div>

              {showPledgeAction && <PledgeNow onClick={redirectToPledge} />}

              {props.canAddRemovePolarLabel &&
                'funding' in props.issue &&
                'pledge_badge_currently_embedded' in props.issue && (
                  <AddBadgeButton
                    org={props.org}
                    repo={props.repo}
                    issue={props.issue}
                  />
                )}

              {props.right}
            </div>
          </>
        </div>

        {havePledgeOrReference && (
          <IssueActivityBox>
            <IssueListItemDecoration
              issue={props.issue}
              orgName={props.org.name}
              repoName={props.repo.name}
              issueNumber={props.issue.number}
              pledges={mergedPledges}
              references={props.references}
              showDisputeAction={true}
              onDispute={onDispute}
              showConfirmPledgeAction={true}
              onConfirmPledges={onConfirmPledge}
              confirmPledgeIsLoading={false}
              funding={'funding' in props.issue ? props.issue.funding : {}}
              showSelfPledgesFor={props.showSelfPledgesFor}
            />
          </IssueActivityBox>
        )}
      </div>

      {showDisputeModalForPledge && (
        <Modal onClose={onDisputeModalClose}>
          <DisputeModal pledge={showDisputeModalForPledge} />
        </Modal>
      )}

      <ModernModal
        isShown={isSplitRewardsModalShown}
        hide={closeSplitRewardModal}
        modalContent={
          <>
            <SplitRewardModal
              issueId={props.issue.id}
              onClose={closeSplitRewardModal}
            />
          </>
        }
      />
    </>
  )
}

export default IssueListItem

const DisputeModal = (props: { pledge: PledgeRead | Pledge }) => {
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

        {/* Pledge */}
        {'pledger' in pledge && (
          <table className="min-w-full divide-y divide-gray-300">
            <tr>
              <td className="whitespace-nowrap py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900 sm:pl-0">
                Amount
              </td>
              <td className="whitespace-nowrap py-2 pl-4 pr-3 text-sm text-gray-500 sm:pl-0">
                ${getCentsInDollarString(pledge.amount.amount)}
              </td>
            </tr>
            <tr>
              <td className="whitespace-nowrap py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900 sm:pl-0">
                Pledger
              </td>
              <td className="whitespace-nowrap py-2 pl-4 pr-3 text-sm text-gray-500 sm:pl-0">
                {pledge.pledger?.name}
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
                {pledge.issue.id}
              </td>
            </tr>
          </table>
        )}

        {/* PledgeRead */}
        {'pledger_name' in pledge && (
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
        )}

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
