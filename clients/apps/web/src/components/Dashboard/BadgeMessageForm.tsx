import { Marked } from '@ts-stack/markdown'
import { useTheme } from 'next-themes'
import { CONFIG } from 'polarkit'
import { CurrencyAmount, Funding } from 'polarkit/api/client'
import { Badge } from 'polarkit/components/badge'
import { classNames } from 'polarkit/utils'
import { ChangeEvent, MouseEvent, useEffect, useRef, useState } from 'react'
import LabeledRadioButton from '../UI/LabeledRadioButton'
import MoneyInput from '../UI/MoneyInput'

const generateSuggestedMarkup = (orgName: string) => {
  const currentURL = new URL(window.location.href)
  const maintainerURL = new URL(currentURL.origin)
  maintainerURL.pathname = `/${orgName}`

  return `## Upvote & Fund

- We're using [Polar.sh](${maintainerURL.toString()}) so you can upvote and help fund this issue.
- We receive the funding once the issue is completed & confirmed by you.
- Thank you in advance for helping prioritize & fund our backlog.
`
}

const BadgeMessageForm = (props: {
  orgName: string
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
  const [message, setMessage] = useState('')

  const [descriptionMode, setDescriptionMode] = useState('Preview')

  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (ref.current) {
      ref.current.innerHTML = Marked.parse(props.value)
    }
    setMessage(props.value)
  }, [ref, props.value, descriptionMode])

  const [canSave, setCanSave] = useState(false)

  const onChange = (message: string) => {
    setMessage(message)
    setCanSave(message !== props.value)
    props.onChangeMessage(message)
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
    <>
      <div className="text-gray flex items-center justify-between">
        <div className="text-sm font-medium">Polar funding badge settings</div>
        <LabeledRadioButton
          values={['Preview', 'Customize']}
          value={descriptionMode}
          onSelected={setDescriptionMode}
        />
      </div>
      <div className="my-4 overflow-hidden rounded-lg border border-gray-200 bg-gray-50 dark:border-gray-600 dark:bg-gray-700/30">
        <div className="inline-flex w-full items-center space-x-2 border-b-[1px] border-gray-200 bg-gray-100 px-4 py-2 text-xs text-sm text-gray-500 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-400">
          <div className="inline h-4 w-full max-w-[100px] rounded-full bg-gray-300 dark:bg-gray-400"></div>
          <div className="inline h-4 w-full max-w-[160px] rounded-full bg-gray-200/75 dark:bg-gray-600/75"></div>
          <p>edited by {CONFIG.GITHUB_APP_NAMESPACE}</p>
          <div className="rounded-full border-[1px] border-gray-300 px-2 py-0.5 dark:border-gray-500">
            bot
          </div>
        </div>
        <div className="flex flex-col space-y-3.5 p-4 pb-3">
          <div className="h-4 w-full max-w-[500px] rounded-full bg-gray-200/75 dark:bg-gray-600/75"></div>
          <div className="h-4 w-full max-w-[250px] rounded-full bg-gray-200/75 dark:bg-gray-600/75"></div>
          {descriptionMode === 'Preview' && (
            <div className="prose dark:prose-invert" ref={ref} />
          )}
          {descriptionMode === 'Customize' && (
            <div
              className={classNames(
                props.innerClassNames,
                'rounded-xl bg-white py-3.5 px-3 dark:bg-gray-800 dark:ring-1 dark:ring-gray-600',
              )}
            >
              <textarea
                className="w-full rounded-md border-0 text-gray-800 dark:bg-gray-800 dark:text-white"
                rows={6}
                value={message}
                autoFocus={true}
                onChange={(e: ChangeEvent<HTMLTextAreaElement>) => {
                  onChange(e.target.value)
                }}
              />
              {!message && (
                <div className="flex items-center rounded-md bg-blue-50 p-3 dark:bg-gray-700">
                  <p className="grow text-xs text-blue-600 dark:text-gray-400">
                    We&apos;re coders, not copywriters.
                  </p>
                  <button
                    className="rounded bg-white py-1 px-2 text-xs text-blue-800 shadow dark:bg-gray-400 dark:text-gray-800"
                    onClick={() => {
                      onChange(generateSuggestedMarkup(props.orgName))
                    }}
                  >
                    Generate copy
                  </button>
                </div>
              )}
            </div>
          )}
          <Badge
            showAmountRaised={props.showAmountRaised}
            darkmode={resolvedTheme === 'dark'}
            funding={funding}
          />
        </div>
      </div>
      <div className="flex justify-between">
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
          <button
            onClick={onClickUpdate}
            disabled={!canSave}
            className={classNames(
              isLoading ? 'cursor-wait' : '',
              canSave
                ? 'cursor-pointer text-blue-600 dark:text-blue-500'
                : 'text-gray-400 dark:text-gray-500',
              'text-sm font-medium',
            )}
          >
            Update
          </button>
        )}
      </div>
    </>
  )
}

export default BadgeMessageForm
