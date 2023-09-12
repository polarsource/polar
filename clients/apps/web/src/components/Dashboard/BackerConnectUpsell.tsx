import { XMarkIcon } from '@heroicons/react/24/outline'
import { CONFIG } from 'polarkit/config'
import { useStore } from 'polarkit/store'

const BackerConnectUpsell = () => {
  const setSkipped = useStore(
    (store) => store.setOnboardingMaintainerConnectRepositories,
  )

  return (
    <div className="flex items-center justify-between border-b border-blue-100 bg-blue-50 px-8 py-2 text-sm text-sm font-medium text-gray-700 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-300">
      <div className="flex flex-wrap">
        <span className="whitespace-nowrap pr-4">
          Get funding for your public repositories.
        </span>
        <a
          href={CONFIG.GITHUB_INSTALLATION_URL}
          className="whitespace-nowrap text-blue-600 hover:text-blue-700 dark:hover:text-blue-500"
        >
          Connect repositories
        </a>
      </div>
      <div>
        <XMarkIcon
          className="h-4 w-4 cursor-pointer text-blue-400 hover:text-blue-500 dark:hover:text-blue-300"
          onClick={() => setSkipped(true)}
        />
      </div>
    </div>
  )
}

export default BackerConnectUpsell
