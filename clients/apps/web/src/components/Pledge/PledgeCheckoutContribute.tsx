import { WrenchScrewdriverIcon } from '@heroicons/react/24/outline'
import { Issue } from '@polar-sh/sdk'
import CircledNumber from './CircledNumber'

const PledgeCheckoutContribute = ({ issue }: { issue: Issue }) => {
  return (
    <div className="flex flex-col gap-6 py-4">
      <div className="flex items-center gap-4">
        <WrenchScrewdriverIcon className="h-6 w-6" />
        <div>
          <div className="dark:text-polar-200 font-medium text-gray-600 ">
            Contribution instructions
          </div>
          <div className="dark:text-polar-400 text-sm font-light text-gray-500">
            Rewards are not guaranteed, but do require these steps
          </div>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <CircledNumber>1</CircledNumber>
        <div className="space-y-1">
          <Title>Fork & Commit</Title>
          <div className="dark:text-polar-400 text-xs text-gray-600">
            Make an impact and get things ready for a pull request.
          </div>

          <a
            className="text-xs text-blue-700 hover:text-blue-800"
            href={`https://github.com/${issue.repository.organization.name}/${issue.repository.name}/blob/main/CONTRIBUTING.md`}
          >
            Checkout CONTRIBUTING.md for {issue.repository.name}
          </a>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <CircledNumber>2</CircledNumber>
        <div className="space-y-1">
          <Title>Create & Connect Pull Request</Title>
          <div className="dark:text-polar-400 text-xs text-gray-600">
            Link the issue in the pull request like usual to ensure it&apos;s
            eligible for a potential reward once the issue is closed.
          </div>
          <div className="flex flex-wrap gap-2">
            <Hashtag>Resolves #{issue.number}</Hashtag>
            <Hashtag>Fixes #{issue.number}</Hashtag>
            <Hashtag>Closes #{issue.number}</Hashtag>
          </div>
          <a
            className="text-xs text-blue-700 hover:text-blue-800"
            href="https://docs.github.com/en/issues/tracking-your-work-with-issues/linking-a-pull-request-to-an-issue"
          >
            Documentation on linking PRs
          </a>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <CircledNumber>3</CircledNumber>
        <div className="space-y-1">
          <Title>Sign up to receive rewards</Title>
          <div className="dark:text-polar-400 text-xs text-gray-600">
            You need to have a Polar account with GitHub connected as well as
            having setup Stripe.
          </div>

          <a
            className="text-xs text-blue-700 hover:text-blue-800"
            href="https://polar.sh/faq"
          >
            Make sure you’re eligible to receive Stripe payouts.
          </a>
        </div>
      </div>
    </div>
  )
}

export default PledgeCheckoutContribute

const Title = ({ children }: { children: React.ReactNode }) => (
  <div className="dark:text-polar-200 text-sm font-medium text-gray-600">
    {children}
  </div>
)

const Hashtag = ({ children }: { children: React.ReactNode }) => (
  <div className="dark:text-polar-400 dark:border-polar-600 whitespace-nowrap rounded-sm border px-2 py-1 font-mono text-xs text-gray-400">
    {children}
  </div>
)
