import { Marked } from '@ts-stack/markdown'
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
  const [message, setMessage] = useState(
    `## Funding
    
* Lorem ipsum dolor sit amet
* Lorem ipsum dolor sit amet
`,
  )

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

  return (
    <div className="flex flex-col space-y-2">
      <div className="flex justify-between">
        <div className="font-medium">Markdown added to issue description</div>
        <LabeledRadioButton
          values={['View', 'Edit']}
          value={descriptionMode}
          onSelected={setDescirptionMode}
        />
      </div>
      <div className="rounded-xl bg-white py-2 px-4 shadow">
        {descriptionMode === 'View' && <div className="prose" ref={ref} />}
        {descriptionMode === 'Edit' && (
          <>
            <textarea
              className="w-full rounded-md border-0"
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
            canSave ? 'cursor-pointer text-blue-600' : 'text-gray-500',
            'font-medium',
          )}
        >
          Update
        </button>
      </div>
    </div>
  )
}

export default BadgeMessageForm
