import { Badge } from 'polarkit/components'

export const ShowcaseGithubBadge = ({
  showAmountRaised,
}: {
  showAmountRaised: boolean
}) => {
  return (
    <>
      <div className="my-4 rounded-lg border border-gray-100 bg-white">
        <div className="flex flex-row border-b border-gray-100 bg-gray-50 py-2.5 px-4 ">
          <p className="text-sm text-gray-400">
            <strong className="text-black">janedoe</strong> commented 2 days ago
            - edited by Polar{' '}
            <span className="rounded-full border border-gray-400 py-0.5 px-2 text-xs font-medium">
              bot
            </span>
          </p>
        </div>
        <div className="p-4">
          <div className="mb-2 w-64 rounded-xl bg-gray-100">&nbsp;</div>
          <div className="mb-2 w-auto rounded-xl bg-gray-100">&nbsp;</div>
          <div className="mb-6 w-96 rounded-xl bg-gray-100">&nbsp;</div>
          <Badge showAmountRaised={showAmountRaised} />
        </div>
      </div>
    </>
  )
}

export default ShowcaseGithubBadge
