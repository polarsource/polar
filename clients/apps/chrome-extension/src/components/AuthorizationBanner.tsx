import { LogoType70 } from 'polarkit/components/brand'
import { CONFIG } from '../config'

const AuthorizationBanner = () => (
  <div className="flex items-center justify-between sm:justify-start sm:space-x-4">
    <LogoType70 className="h-12" />
    <a
      href={`${CONFIG.WEB_URL}/settings/extension`}
      target="_blank"
      rel="noreferrer"
      className="mr-2 inline-flex items-center space-x-2 rounded-lg bg-blue-500 p-2 px-3 text-center text-sm font-medium text-white transition-colors duration-100 hover:bg-blue-500 sm:mr-0"
    >
      Connect Polar
    </a>
    <span className="hidden text-sm text-gray-500 sm:inline-flex">
      Connect Polar to see pledges here on GitHub
    </span>
  </div>
)

export default AuthorizationBanner
