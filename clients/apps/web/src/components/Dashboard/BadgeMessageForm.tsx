import { Marked } from '@ts-stack/markdown'
import { useTheme } from 'next-themes'
import { CurrencyAmount, Funding } from 'polarkit/api/client'
import { Badge } from 'polarkit/components/badge'
import {
  LabeledRadioButton,
  MoneyInput,
  PrimaryButton,
} from 'polarkit/components/ui'
import { classNames } from 'polarkit/utils'
import { ChangeEvent, MouseEvent, useEffect, useRef, useState } from 'react'

const BadgeMessageForm = (props: {
  value: string
  onUpdateMessage: (comment: string) => Promise<void> // when "update" is clicked
  onUpdateFundingGoal: (amount: CurrencyAmount) => Promise<void> // when "update" is clicked
  showUpdateButton: boolean
  onChangeMessage: (comment: string) => void // real time updates
  onChangeFundingGoal: (amount: CurrencyAmount) => void // real time updates
  innerClassNames: string
  showAmountRaised: boolean
  canSetFundingGoal: boolean
  funding: Funding
}) => {
  const [message, setMessage] = useState(props.value)

  const [descriptionMode, setDescirptionMode] = useState('View')

  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setMessage(props.value)
  }, [props.value])

  useEffect(() => {
    if (ref.current) {
      ref.current.innerHTML = Marked.parse(message)
    }
  }, [ref, message, descriptionMode])

  const [canSave, setCanSave] = useState(false)

  const onChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
    setMessage(e.target.value)
    setCanSave(e.target.value !== props.value)
    props.onChangeMessage(e.target.value)
  }

  const [isLoading, setIsLoading] = useState(false)

  const [fundingGoal, setFundingGoal] = useState<number>(
    props.funding.funding_goal?.amount || 0,
  )

  const funding = {
    ...props.funding,
    funding_goal: {
      ...props.funding.funding_goal,
      amount: fundingGoal,
      currency: 'USD',
    },
  }

  const onClickUpdate = async (e: MouseEvent<HTMLButtonElement>) => {
    setIsLoading(true)
    await props.onUpdateMessage(message)
    await props.onUpdateFundingGoal(funding.funding_goal)
    setIsLoading(false)
  }

  const { resolvedTheme } = useTheme()

  const onFundingGoalChange = (e: ChangeEvent<HTMLInputElement>) => {
    let newAmount = parseInt(e.target.value)
    if (isNaN(newAmount)) {
      newAmount = 0
    }
    const amountInCents = newAmount * 100
    setFundingGoal(amountInCents)
    setCanSave(amountInCents !== props.funding?.funding_goal?.amount)
    if (props.onChangeFundingGoal) {
      props.onChangeFundingGoal({ currency: 'USD', amount: amountInCents })
    }
  }

  return (
    <div className="flex flex-col space-y-3">
      <div className="text-gray flex items-center justify-between">
        <div className="text-sm font-medium">Customize embed</div>
        <LabeledRadioButton
          values={['View', 'Edit']}
          value={descriptionMode}
          onSelected={setDescirptionMode}
        />
      </div>
      <div
        className={classNames(
          props.innerClassNames,
          'rounded-xl bg-white px-5 py-3.5 dark:bg-gray-800 dark:ring-1 dark:ring-gray-600',
        )}
      >
        {descriptionMode === 'View' && (
          <>
            <div className="prose dark:prose-invert" ref={ref} />
            <Badge
              showAmountRaised={props.showAmountRaised}
              darkmode={resolvedTheme === 'dark'}
              funding={funding}
              avatarsUrls={[]}
            />
          </>
        )}
        {descriptionMode === 'Edit' && (
          <>
            <textarea
              className="w-full rounded-md border-0 text-gray-800 dark:bg-gray-800 dark:text-white"
              rows={6}
              value={message}
              onChange={onChange}
            />
          </>
        )}
      </div>
      <div className="flex items-center justify-between">
        {/* <div className="text-gray-600">
          Template variables: <code>{'{badge}'}</code>, <code>{'{repo}'}</code>
        </div> */}

        {props.canSetFundingGoal && (
          <div className="flex max-w-[300px] items-center space-x-2">
            <label htmlFor="fundingGoal" className="flex-shrink-0">
              Set funding goal:{' '}
            </label>
            <MoneyInput
              id={'fundingGoal'}
              name={'fundingGoal'}
              onChange={onFundingGoalChange}
              onBlur={onFundingGoalChange}
              placeholder={20000}
              value={fundingGoal}
              className="bg-white dark:bg-gray-800"
            />
          </div>
        )}

        <div className="flex-1"></div>
        {props.showUpdateButton && (
          <div>
            <PrimaryButton
              onClick={onClickUpdate}
              disabled={!canSave}
              fullWidth={false}
            >
              Update
            </PrimaryButton>
          </div>
        )}
      </div>
    </div>
  )
}

export default BadgeMessageForm
