import { Badge } from '@/../../../packages/polarkit/src/components'
import { Marked } from '@ts-stack/markdown'
import { useTheme } from 'next-themes'
import { IssueDashboardRead } from 'polarkit/api/client'
import { classNames } from 'polarkit/utils'
import { ChangeEvent, MouseEvent, useEffect, useRef, useState } from 'react'
import LabeledRadioButton from '../UI/LabeledRadioButton'

const BadgeMessageForm = (props: {
  orgName: string
  repoName: string
  issue: IssueDashboardRead
  onBadgeWithComment: (comment: string) => Promise<void>
}) => {
  // TODO: Get this from backend based on settings to reflect how it's currently embedded.
  // Starting with empty string now since that is how it currently would work.
  const [message, setMessage] = useState('')

  const [descriptionMode, setDescirptionMode] = useState('View')

  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (ref.current) {
      ref.current.innerHTML = Marked.parse(message)
    }
  }, [ref, message, descriptionMode])

  const [canSave, setCanSave] = useState(false)

  const onChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
    setMessage(e.target.value)
    setCanSave(e.target.value !== props.issue.badge_custom_content)
  }

  const [isLoading, setIsLoading] = useState(false)

  const onClickUpdate = async (e: MouseEvent<HTMLButtonElement>) => {
    setIsLoading(true)
    await props.onBadgeWithComment(message)
    setIsLoading(false)
  }

  const { resolvedTheme } = useTheme()

  return (
    <div className="flex flex-col space-y-3">
      <div className="text-gray flex items-center justify-between">
        <div className="text-sm font-medium">
          Customize Polar description in issue
        </div>
        <LabeledRadioButton
          values={['View', 'Edit']}
          value={descriptionMode}
          onSelected={setDescirptionMode}
        />
      </div>
      <div className="rounded-xl bg-white py-3.5 px-5 shadow dark:bg-gray-800 dark:ring-1 dark:ring-gray-600">
        {descriptionMode === 'View' && (
          <>
            <div className="prose dark:prose-invert" ref={ref} />
            <Badge
              showAmountRaised={false}
              darkmode={resolvedTheme === 'dark'}
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
      <div className="flex justify-between">
        {/* <div className="text-gray-600">
          Template variables: <code>{'{badge}'}</code>, <code>{'{repo}'}</code>
        </div> */}
        <div className="flex-1"></div>
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
      </div>
    </div>
  )
}

export default BadgeMessageForm
