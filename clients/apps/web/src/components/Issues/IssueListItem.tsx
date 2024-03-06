'use client'

import { ModalBox, Modal as ModernModal } from '@/components/Modal'
import { useToastLatestPledged } from '@/hooks/stripe'
import {
  Issue,
  IssueReferenceRead,
  Pledge,
  PledgesTypeSummaries,
  Reward,
} from '@polar-sh/sdk'
import { api } from 'polarkit/api'
import {
  IssueActivityBox,
  IssueListItemDecoration,
  IssueSummary,
} from 'polarkit/components/Issue'
import Button from 'polarkit/components/ui/atoms/button'
import TextArea from 'polarkit/components/ui/atoms/textarea'
import { getCentsInDollarString } from 'polarkit/money'
import { ChangeEvent, useState } from 'react'
import SplitRewardModal from '../Finance/SplitRewardModal'
import { useModal } from '../Modal/useModal'
import { AddBadgeButton } from './IssuePromotionModal'

const IssueListItem = (props: {
  issue: Issue
  references: IssueReferenceRead[]
  pledges: Array<Pledge>
  pledgesSummary?: PledgesTypeSummaries
  checkJustPledged?: boolean
  canAddRemovePolarLabel: boolean
  showPledgeAction: boolean
  right?: React.ReactElement
  className?: string
  showLogo?: boolean
  showIssueOpenClosedStatus?: boolean
  rewards?: Reward[]
}) => {
  const org = props.issue.repository.organization
  const repo = props.issue.repository

  const mergedPledges = props.pledges || []
  const latestPledge = useToastLatestPledged(
    org.id,
    repo.id,
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

  const [showDisputeModalForPledge, setShowDisputeModalForPledge] = useState<
    Pledge | undefined
  >()

  const onDispute = (pledge: Pledge) => {
    setShowDisputeModalForPledge(pledge)
  }

  const onDisputeModalClose = () => {
    setShowDisputeModalForPledge(undefined)
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
        <IssueSummary
          issue={props.issue}
          showLogo={props.showLogo}
          showStatus={props.showIssueOpenClosedStatus}
          right={
            <>
              {props.canAddRemovePolarLabel && (
                <AddBadgeButton issue={props.issue} />
              )}
              {props.right}
            </>
          }
        />
        {havePledgeOrReference && (
          <IssueActivityBox>
            <IssueListItemDecoration
              issue={props.issue}
              pledges={mergedPledges}
              pledgesSummary={props.pledgesSummary}
              references={props.references}
              showDisputeAction={true}
              onDispute={onDispute}
              showConfirmPledgeAction={true}
              onConfirmPledges={onConfirmPledge}
              confirmPledgeIsLoading={false}
              funding={props.issue.funding}
              rewards={props.rewards}
            />
          </IssueActivityBox>
        )}
      </div>

      <ModernModal
        isShown={showDisputeModalForPledge !== undefined}
        hide={onDisputeModalClose}
        modalContent={
          <>
            {showDisputeModalForPledge && (
              <DisputeModal pledge={showDisputeModalForPledge} />
            )}
          </>
        }
      />

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

const DisputeModal = (props: { pledge: Pledge }) => {
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

        {!didSubmit && (
          <>
            <label
              htmlFor="dispute_description"
              className="whitespace-nowrap py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900 sm:pl-0"
            >
              Description
            </label>
            <TextArea
              id="dispute_description"
              placeholder="Explain what happened"
              rows={8}
              onChange={onUpdateReason}
            ></TextArea>
          </>
        )}

        <Button disabled={!canSubmit} onClick={submit} loading={isLoading}>
          Submit
        </Button>

        {message && <p>{message}</p>}
      </>
    </ModalBox>
  )
}
