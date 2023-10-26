import { githubIssueLink } from '@/utils/github'
import { ConfirmIssueSplit, Issue, Pledge, UserRead } from '@polar-sh/sdk'
import { api } from 'polarkit/api'
import { Button, TextArea } from 'polarkit/components/ui/atoms'
import { Banner } from 'polarkit/components/ui/molecules'
import { getCentsInDollarString } from 'polarkit/money'
import { useState } from 'react'
import { ModalHeader } from '../Modal'

const prettyUsernames = (splits: ConfirmIssueSplit[]): string => {
  const usernames = splits
    .map((s) => s.github_username)
    .filter((s): s is string => Boolean(s))
    .map((s) => `@${s}`)

  if (usernames.length == 1) {
    return usernames[0]
  }

  const last = usernames.pop()
  const concatUsernames = usernames.join(', ') + ' and ' + last

  return concatUsernames
}

const SplitNotify = (props: {
  issue: Issue
  pledges: Pledge[]
  splits: ConfirmIssueSplit[]
  user: UserRead
  onCancel: () => void
}) => {
  const totalPledgedAmount = props.pledges
    .map((p) => p.amount.amount)
    .reduce((a, b) => a + b, 0)

  const concatUsernames = prettyUsernames(props.splits)

  const defaultMessage = `Thank you ${concatUsernames} for contributing to close this issue! ⭐

The rewards from this issue, totalling $${getCentsInDollarString(
    totalPledgedAmount,
    false,
    true,
  )}, has been shared with you.

**What now?**

1. Create a [Polar](https://polar.sh) account
2. See incoming rewards & setup Stripe to receive them
3. Get payouts as backers finalize their payments

_If you already have a Polar account setup, you don't need to do anything._
`

  const [value, setValue] = useState(defaultMessage)

  const [isLoading, setIsLoading] = useState(false)

  const [isPosted, setIsPosted] = useState(false)

  const onConfirm = async () => {
    setIsLoading(true)
    await api.issues.addIssueComment({
      id: props.issue.id,
      postIssueComment: {
        message: value,
      },
    })
    setIsLoading(false)
    setIsPosted(true)
  }

  const canSubmit = value.length > 0 && !isPosted

  return (
    <>
      <ModalHeader hide={props.onCancel}>
        <>Share the good news</>
      </ModalHeader>
      <div className="space-y-4 pt-4">
        <div className="flex flex-col gap-4 px-4">
          <TextArea
            resizable={false}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            rows={14}
          />
          <div className="flex flex-row items-center gap-4">
            <img src={props.user.avatar_url} className="h-8 w-8 rounded-full" />
            <span className="dark:text-polar-200 text-gray-500">
              Comment will be posted on your behalf to issue{' '}
              <a href={githubIssueLink(props.issue)} className="font-medium">
                #{props.issue.number}
              </a>
            </span>
          </div>
          {isPosted && (
            <Banner color="blue">Great! Your message has been posted.</Banner>
          )}
        </div>
        <div className="bg-gray-75 dark:bg-polar-800 dark:text-polar-400 flex items-center px-4 py-2 text-gray-500">
          <div className="flex-1"></div>
          <div>
            <Button variant="ghost" className="mr-4" onClick={props.onCancel}>
              Cancel
            </Button>
          </div>
          <div>
            <Button
              disabled={!canSubmit}
              onClick={onConfirm}
              loading={isLoading}
            >
              <span>Post comment</span>
            </Button>
          </div>
        </div>
      </div>
    </>
  )
}

export default SplitNotify
