import { CONFIG } from '@/utils/config'

const SandboxBanner = () => {
  if (!CONFIG.IS_SANDBOX) {
    return null
  }
  return (
    <div className="sticky top-0 z-50 flex flex-row items-center justify-between bg-yellow-100 px-8 py-2 text-sm text-yellow-500 dark:bg-yellow-950">
      <div></div>
      <div className="hidden md:block">
        Our sandbox is currently experiencing some rate limit issues. We&apos;re working to resolve it.
      </div>
      <div>
        <a href="https://polar.sh/start" className="font-bold hover:opacity-50">
          Exit sandbox
        </a>
      </div>
    </div>
  )
}

export default SandboxBanner
