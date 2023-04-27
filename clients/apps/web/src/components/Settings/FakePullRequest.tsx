import placeholderAvatar from './placeholder_avatar.png'

const FakePullRequest = ({ showAmount }: { showAmount: boolean }) => {
  return (
    <div className="overflow-hidden rounded-lg border-[1px] border-[#E1E4E6]">
      <div className="inline-flex w-full items-center space-x-2 border-b-[1px] border-[#C8CFDA] bg-[#F6F8FA] px-4 py-2 text-sm text-[#909FB1]">
        <span>
          <strong className="font-medium text-black/70">janedoe</strong>{' '}
          commented 2 days ago &mdash; edited by Polar
        </span>
        <div className="rounded-full border-[1px] border-[#C8CFDA] px-2 py-0.5">
          bot
        </div>
      </div>
      <div className="flex flex-col space-y-3.5 p-4 pb-2">
        <div className="h-4 w-full max-w-[250px] rounded-full bg-[#EAEBEC]"></div>
        <div className="h-4 w-full max-w-[500px] rounded-full bg-[#EAEBEC]"></div>
        <div className="h-4 w-full max-w-[400px] rounded-full bg-[#EAEBEC]"></div>
        <PolarBadge showAmount={showAmount} />
      </div>
    </div>
  )
}

const PolarBadge = ({ showAmount }: { showAmount: boolean }) => {
  return (
    <div className="flex h-12 w-fit min-w-[550px] items-center space-x-6 rounded-xl px-4 py-2 text-sm shadow">
      <div className="font-medium">Polar</div>
      <div className="text-black/50">Open source funding</div>
      <div
        className={`rounded-xl border-[1px] border-[#FAE7AC] bg-[#FFF0C0] px-2 py-1 text-black/50 transition-opacity duration-100 ease-in  ${
          showAmount ? 'opacity-100' : 'opacity-0'
        }`}
      >
        <span>
          <strong className="font-medium text-black">$250</strong> raised
        </span>
      </div>
      <div className="flex-1"></div>
      <img className="h-8 w-8 rounded-full" src={placeholderAvatar.src} />
      <div className="rounded-md bg-[#7D7D7D] px-3 py-1 text-white">
        Back issue
      </div>
    </div>
  )
}

export default FakePullRequest
