import { CONFIG } from 'polarkit'
import { IconCounter, IssueLabel } from 'polarkit/components/Issue'
import { Button } from 'polarkit/components/ui/atoms'

const OnboardingAddBadge = () => {
  return (
    <div className="dark:bg-polar-800 dark:ring-polar-700 grid overflow-hidden rounded-2xl bg-white shadow-sm dark:ring-1 lg:grid-cols-2">
      <div className="px-6 py-4">
        <h2 className="dark:text-polar-50 font-medium text-gray-900">
          Add the Polar badge to an issue to promote funding.
        </h2>
        <p className="dark:text-polar-300 mt-2 flex flex-wrap items-center text-sm text-gray-500">
          <span className="">Or add the </span>
          <div className="px-1">
            <IssueLabel
              label={{
                name: CONFIG.GITHUB_BADGE_EMBED_DEFAULT_LABEL,
                color: '000088',
              }}
            />
          </div>
          <span> label to the issue on GitHub.</span>
        </p>
      </div>
      <div className="bg-grid-pattern dark:bg-grid-pattern-dark relative flex min-h-[80px] flex-wrap items-center justify-center space-x-6 border-blue-100 bg-blue-50 bg-[12px_12px] dark:border-blue-500/20 dark:bg-blue-500/20">
        <div className="hidden xl:block">
          <IconCounter icon="comments" count={6} />
        </div>

        <IconCounter icon="thumbs_up" count={21} />

        <Button fullWidth={false} size="sm">
          <span>Add badge</span>
        </Button>
        <div className="absolute bottom-0 left-0 right-0 top-0">
          {/* Just here to add an overlay on top of the buttons etc, so that they are not clickable. */}
        </div>
      </div>
    </div>
  )
}

export default OnboardingAddBadge
