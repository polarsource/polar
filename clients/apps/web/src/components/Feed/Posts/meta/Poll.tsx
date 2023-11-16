import { twMerge } from 'tailwind-merge'
import { PollPost } from '../../data'

export const PollMeta = (post: PollPost) => {
  const winningOption = post.poll.options.reduce(
    (acc, option, index) => {
      if (option.votes > acc.votes) {
        return { index, votes: option.votes }
      }
      return acc
    },
    {
      index: 0,
      votes: post.poll.options[0].votes,
    },
  )

  return (
    <div className="flex w-full flex-col">
      <div className="dark:border-polar-700 flex flex-col gap-y-1 border-b border-gray-100 px-6 py-4">
        <h4 className="dark:text-polar-50 font-medium">{post.poll.question}</h4>
        <span className="text-xs">{post.poll.totalVotes} votes</span>
      </div>
      <div className="bg-gray-75 dark:bg-polar-900 flex flex-col gap-y-2 p-6">
        {post.poll.options.map((option, index) => (
          <div key={option.text} className="relative flex flex-row">
            <div
              className={twMerge(
                'h-8 rounded-md',
                winningOption.index === index
                  ? 'bg-blue-600'
                  : 'dark:bg-polar-600 bg-gray-200',
              )}
              style={{
                width: `${(option.votes / post.poll.totalVotes) * 100}%`,
              }}
            />
            <span
              className={twMerge(
                'absolute inset-x-3 inset-y-2 w-full text-xs',
                winningOption.index === index && 'text-white',
              )}
            >
              {`${Math.round((option.votes / post.poll.totalVotes) * 100)}% ${
                option.text
              }`}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
