import { PrimaryButton } from 'polarkit/components/ui'
import IconCounter from '../Dashboard/IconCounter'
import IssueLabel from '../Dashboard/IssueLabel'
import IssueProgress from '../Dashboard/IssueProgress'

const OnboardingAddBadge = () => {
  return (
    <div className="grid overflow-hidden rounded-xl bg-white shadow dark:bg-gray-800 dark:ring-1 dark:ring-gray-700 lg:grid-cols-2">
      <div className="py-3 px-6">
        <h2 className="font-medium text-gray-900 dark:text-gray-400">
          Add the Polar badge to an issue to promote funding.
        </h2>
        <p className="mt-4 flex flex-wrap items-center text-sm text-gray-500">
          <span className="">Or add the </span>
          <div className="px-1">
            <IssueLabel label={{ name: 'polar', color: '000088' }} />
          </div>
          <span> to the issue on Github.</span>
        </p>
      </div>
      <div className="bg-grid-pattern dark:bg-grid-pattern-dark relative flex min-h-[80px] flex-wrap items-center justify-center space-x-6 border-blue-100 bg-blue-50 bg-[12px_12px] dark:border-blue-500/20 dark:bg-blue-500/20">
        <div className="hidden xl:block">
          <IconCounter icon="comments" count={6} />
        </div>

        <IconCounter icon="thumbs_up" count={21} />

        <IssueProgress progress="backlog" />
        <PrimaryButton fullWidth={false} size="small">
          <span>Add badge</span>
        </PrimaryButton>
        <div className="absolute top-0 bottom-0 left-0 right-0">
          {/* Just here to add an overlay on top of the buttons etc, so that they are not clickable. */}
        </div>
      </div>
    </div>
  )
}

export default OnboardingAddBadge
